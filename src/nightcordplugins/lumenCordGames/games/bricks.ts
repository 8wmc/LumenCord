/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Brick Breaker: Breakout/Arkanoid style with levels and power-ups. */

import { clamp, GameDef, pick, rand } from "./core";
import { Floaters, glowCircle, keys, muteButton, nebula, Particles, sfx, Shake, text, titleCard } from "./fx";

const W = 800, H = 560, COLS = 12, BW = 58, BH = 22, GAP = 4, TOP = 70;
const LEFT = (W - (COLS * (BW + GAP) - GAP)) / 2;

// . = empty, 1-3 = hits needed, P = always drops a power-up
const LEVELS = [
    ["............", "111111111111", "111111111111", "122222222221", "111111111111", "111111111111"],
    ["1..........1", "11........11", "121......121", "1221....1221", "12221..12221", "122221122221", "111111111111"],
    ["....3333....", "...322223...", "..32111123..", ".3211PP1123.", "..32111123..", "...322223...", "....3333...."],
    ["2.2.2.2.2.2.", ".1.1.1.1.1.1", "2.2.2.2.2.2.", ".1.1.1.1.1.1", "3.3.P.P.3.3.", ".2.2.2.2.2.2"],
    ["333333333333", "1..........1", "1.22222222.1", "1.2P1111P2.1", "1.22222222.1", "1..........1", "333333333333"],
    ["11.111111.11", "22.222222.22", "33.3PPPP3.33", "22.222222.22", "11.111111.11", "............", "333..33..333"],
];
const HUES = [280, 320, 200, 160, 40, 0];
type PowerKind = "wide" | "multi" | "slow" | "laser" | "life";
const POWER: Record<PowerKind, { color: string; label: string; }> = {
    wide: { color: "#60a5fa", label: "W" }, multi: { color: "#f472b6", label: "M" }, slow: { color: "#4ade80", label: "S" },
    laser: { color: "#f87171", label: "L" }, life: { color: "#fde047", label: "+" },
};

interface Brick { x: number; y: number; hp: number; max: number; power: boolean; hue: number; hit: number; }
interface Ball { x: number; y: number; vx: number; vy: number; stuck: boolean; trail: { x: number; y: number; }[]; }

export const bricks: GameDef = {
    id: "bricks", name: "Brick Breaker", icon: "🧨", color: "#fb923c", category: "Arcade",
    selfSound: true,
    description: "Bounce the ball to smash every brick. Catch power-ups for a wide paddle, multi-ball, lasers and more!",
    controls: "Mouse or ← → to move · click or Space to launch / fire",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        const k = keys(api);
        const fx = new Particles(), shake = new Shake(), floaters = new Floaters();
        let level = 0, lives = 3, score = 0, t = 0, started = false, over = false, mouseX: number | null = null, levelT = 0;
        const pad = { x: W / 2, w: 110, wideT: 0, laserT: 0, slowT: 0, fireCd: 0 };
        let bricksList: Brick[] = [], balls: Ball[] = [], drops: { x: number; y: number; kind: PowerKind; }[] = [], lasers: { x: number; y: number; }[] = [];

        function loadLevel() {
            const map = LEVELS[level % LEVELS.length];
            const bonus = Math.floor(level / LEVELS.length);
            bricksList = [];
            map.forEach((row, r) => [...row].forEach((ch, c) => {
                if (ch === ".") return;
                const hp = ch === "P" ? 1 : Math.min(4, Number(ch) + bonus);
                bricksList.push({ x: LEFT + c * (BW + GAP), y: TOP + r * (BH + GAP), hp, max: hp, power: ch === "P" || Math.random() < .1, hue: HUES[(r + level) % HUES.length], hit: 0 });
            }));
            balls = [newBall()];
            drops = []; lasers = [];
            levelT = 1.6;
        }
        const newBall = (): Ball => ({ x: pad.x, y: H - 52, vx: 0, vy: 0, stuck: true, trail: [] });
        const ballSpeed = () => (380 + level * 25) * (pad.slowT > 0 ? .65 : 1);

        function launch() {
            if (!started) { started = true; return; }
            for (const b of balls) if (b.stuck) {
                b.stuck = false;
                const a = -Math.PI / 2 + rand(-.35, .35);
                b.vx = Math.cos(a) * ballSpeed(); b.vy = Math.sin(a) * ballSpeed();
            }
            if (pad.laserT > 0 && pad.fireCd <= 0) {
                lasers.push({ x: pad.x - pad.w / 2 + 8, y: H - 46 }, { x: pad.x + pad.w / 2 - 8, y: H - 46 });
                pad.fireCd = .25;
                sfx.shoot();
            }
        }
        cv.addEventListener("mousemove", e => { mouseX = toLocal(e).x; });
        cv.addEventListener("mousedown", launch);
        api.onKey((e, d) => { if (e.key === " ") { if (d) launch(); return true; } });

        function hitBrick(b: Brick, fromLaser = false) {
            b.hp--;
            b.hit = .15;
            if (b.hp <= 0) {
                score += 10 * b.max * (level + 1);
                fx.burst(b.x + BW / 2, b.y + BH / 2, { n: 18, color: [`hsl(${b.hue} 90% 65%)`, "#fff"], speed: 260, life: .7, size: 3, gravity: 500 });
                if (b.power) drops.push({ x: b.x + BW / 2, y: b.y + BH / 2, kind: pick<PowerKind>(["wide", "multi", "slow", "laser", "multi", "wide", "life"]) });
                bricksList.splice(bricksList.indexOf(b), 1);
                sfx.point();
            } else sfx.bounce();
            if (!fromLaser) shake.hit(2, .06);
            api.setScore(score);
        }

        function collect(kind: PowerKind) {
            sfx.power();
            floaters.add(pad.x, H - 70, { wide: "WIDE!", multi: "MULTI-BALL!", slow: "SLOW", laser: "LASERS!", life: "+1 LIFE" }[kind], POWER[kind].color);
            if (kind === "wide") pad.wideT = 12;
            if (kind === "slow") { pad.slowT = 10; for (const b of balls) { const s = Math.hypot(b.vx, b.vy) || 1; b.vx *= ballSpeed() / s; b.vy *= ballSpeed() / s; } }
            if (kind === "laser") pad.laserT = 10;
            if (kind === "life") lives++;
            if (kind === "multi") {
                const src = balls.find(b => !b.stuck) ?? balls[0];
                for (const da of [-.5, .5]) {
                    const s = ballSpeed(), a = Math.atan2(src.vy || -1, src.vx) + da;
                    balls.push({ x: src.x, y: src.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, stuck: false, trail: [] });
                }
            }
        }

        // brick images are drawn once per colour/damage and reused
        const brickCache = new Map<string, HTMLCanvasElement>();
        function brickImg(hue: number, hp: number, max: number, power: boolean) {
            const key = `${hue}|${hp}|${max}|${power}`;
            let c = brickCache.get(key);
            if (c) return c;
            c = document.createElement("canvas");
            c.width = (BW + 16) * 2; c.height = (BH + 16) * 2;
            const b = c.getContext("2d")!;
            b.scale(2, 2); b.translate(8, 8);
            const l = 40 + 25 * (hp / Math.max(1, max));
            b.shadowColor = `hsl(${hue} 100% 60%)`; b.shadowBlur = 8;
            const grd = b.createLinearGradient(0, 0, 0, BH);
            grd.addColorStop(0, `hsl(${hue} 95% ${l + 25}%)`); grd.addColorStop(.5, `hsl(${hue} 90% ${l}%)`); grd.addColorStop(1, `hsl(${hue} 85% ${l - 22}%)`);
            b.fillStyle = grd;
            b.beginPath(); b.roundRect(0, 0, BW, BH, 5); b.fill();
            b.shadowBlur = 0;
            b.fillStyle = "rgba(255,255,255,.35)"; b.fillRect(4, 3, BW - 8, 3);
            if (max > 1 && hp < max) {
                b.strokeStyle = "rgba(0,0,0,.5)"; b.lineWidth = 1.5;
                b.beginPath(); b.moveTo(BW * .3, 0); b.lineTo(BW * .45, BH * .5); b.lineTo(BW * .35, BH); b.stroke();
                if (hp < max - 1) { b.beginPath(); b.moveTo(BW * .7, 0); b.lineTo(BW * .6, BH * .6); b.lineTo(BW * .75, BH); b.stroke(); }
            }
            if (power) { b.fillStyle = "rgba(255,255,255,.9)"; b.font = "800 12px sans-serif"; b.textAlign = "center"; b.fillText("★", BW / 2, BH / 2 + 4); }
            brickCache.set(key, c);
            return c;
        }
        function drawBrick(b: Brick) {
            if (b.hit > 0) { g.fillStyle = "#fff"; g.beginPath(); g.roundRect(b.x - 2, b.y - 2, BW + 4, BH + 4, 5); g.fill(); return; }
            g.drawImage(brickImg(b.hue, b.hp, b.max, b.power), b.x - 8, b.y - 8, BW + 16, BH + 16);
        }

        loadLevel();
        api.setStatus("Level 1 · ♥♥♥");
        api.loop(dt => {
            t += dt;
            // paddle
            const w = pad.wideT > 0 ? 170 : 110;
            pad.w += (w - pad.w) * Math.min(1, dt * 10);
            if (mouseX != null && !k.has("ArrowLeft", "ArrowRight", "a", "d")) pad.x += (mouseX - pad.x) * Math.min(1, dt * 20);
            else pad.x += ((k.has("ArrowRight", "d") ? 1 : 0) - (k.has("ArrowLeft", "a") ? 1 : 0)) * 700 * dt;
            pad.x = clamp(pad.x, pad.w / 2, W - pad.w / 2);
            pad.wideT -= dt; pad.slowT -= dt; pad.laserT -= dt; pad.fireCd -= dt;
            if (pad.laserT > 0 && k.has(" ") && pad.fireCd <= 0) launch();

            if (started && !over) {
                levelT -= dt;
                for (const b of [...balls]) {
                    if (b.stuck) { b.x = pad.x; b.y = H - 52; continue; }
                    // sub-steps so fast balls never skip through bricks
                    const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6);
                    for (let s = 0; s < steps; s++) {
                        const sdt = dt / steps;
                        b.x += b.vx * sdt; b.y += b.vy * sdt;
                        if (b.x < 9) { b.x = 9; b.vx = Math.abs(b.vx); sfx.tick(); }
                        if (b.x > W - 9) { b.x = W - 9; b.vx = -Math.abs(b.vx); sfx.tick(); }
                        if (b.y < 9) { b.y = 9; b.vy = Math.abs(b.vy); sfx.tick(); }
                        // paddle
                        if (b.vy > 0 && b.y > H - 48 && b.y < H - 30 && Math.abs(b.x - pad.x) < pad.w / 2 + 8) {
                            const rel = clamp((b.x - pad.x) / (pad.w / 2), -1, 1);
                            const a = -Math.PI / 2 + rel * 1.05, sp = ballSpeed();
                            b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
                            b.y = H - 48;
                            sfx.bounce();
                            fx.burst(b.x, b.y + 6, { n: 8, color: "#fde68a", speed: 140, angle: -Math.PI / 2, spread: 1.2, life: .35, size: 2 });
                        }
                        // bricks
                        for (const br of bricksList) {
                            const cx = clamp(b.x, br.x, br.x + BW), cy = clamp(b.y, br.y, br.y + BH);
                            if ((b.x - cx) ** 2 + (b.y - cy) ** 2 < 81) {
                                if (Math.abs(b.x - cx) > Math.abs(b.y - cy)) b.vx = -b.vx; else b.vy = -b.vy;
                                b.x += b.vx * sdt * 1.5; b.y += b.vy * sdt * 1.5;
                                hitBrick(br);
                                break;
                            }
                        }
                    }
                    b.trail.push({ x: b.x, y: b.y });
                    if (b.trail.length > 12) b.trail.shift();
                    if (b.y > H + 20) balls.splice(balls.indexOf(b), 1);
                }
                if (!balls.length) {
                    lives--;
                    shake.hit(8, .3);
                    sfx.hit();
                    if (lives <= 0) {
                        over = true;
                        api.later(() => api.end(score, "Out of balls!", `You reached level ${level + 1}`), 700);
                    } else { balls = [newBall()]; pad.wideT = pad.laserT = pad.slowT = 0; }
                }
                for (const d of [...drops]) {
                    d.y += 170 * dt;
                    if (d.y > H - 50 && d.y < H - 26 && Math.abs(d.x - pad.x) < pad.w / 2 + 14) { collect(d.kind); drops.splice(drops.indexOf(d), 1); }
                    else if (d.y > H + 20) drops.splice(drops.indexOf(d), 1);
                }
                for (const l of [...lasers]) {
                    l.y -= 700 * dt;
                    const br = bricksList.find(b => l.x > b.x && l.x < b.x + BW && l.y > b.y && l.y < b.y + BH);
                    if (br) { hitBrick(br, true); lasers.splice(lasers.indexOf(l), 1); }
                    else if (l.y < 0) lasers.splice(lasers.indexOf(l), 1);
                }
                if (!bricksList.length) {
                    level++;
                    score += 500;
                    sfx.win();
                    floaters.add(W / 2, H / 2, `LEVEL ${level + 1}`, "#fde047", 34);
                    loadLevel();
                }
            }
            for (const b of bricksList) b.hit = Math.max(0, b.hit - dt);
            fx.update(dt); shake.update(dt); floaters.update(dt);
            api.setStatus(`Level ${level + 1} · ${"♥".repeat(Math.max(0, lives))}`);

            // ── draw ──
            g.save();
            shake.apply(g);
            nebula(g, W, H, 300);
            bricksList.forEach(drawBrick);
            for (const d of drops) {
                const p = POWER[d.kind];
                g.save();
                g.shadowColor = p.color; g.shadowBlur = 16;
                g.fillStyle = p.color;
                g.beginPath(); g.roundRect(d.x - 18, d.y - 9, 36, 18, 9); g.fill();
                g.fillStyle = "#fff"; g.font = "900 13px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
                g.fillText(p.label, d.x, d.y + 1);
                g.restore();
            }
            for (const l of lasers) { g.fillStyle = "#fca5a5"; g.shadowColor = "#f87171"; g.shadowBlur = 10; g.fillRect(l.x - 1.5, l.y - 10, 3, 14); g.shadowBlur = 0; }
            // paddle
            g.save();
            const pc = pad.laserT > 0 ? "#f87171" : "#fb923c";
            g.shadowColor = pc; g.shadowBlur = 22;
            const grd = g.createLinearGradient(0, H - 42, 0, H - 26);
            grd.addColorStop(0, "#fff"); grd.addColorStop(.4, pc); grd.addColorStop(1, "#7c2d12");
            g.fillStyle = grd;
            g.beginPath(); g.roundRect(pad.x - pad.w / 2, H - 42, pad.w, 16, 8); g.fill();
            if (pad.laserT > 0) { g.fillStyle = "#fecaca"; g.fillRect(pad.x - pad.w / 2 + 5, H - 48, 6, 8); g.fillRect(pad.x + pad.w / 2 - 11, H - 48, 6, 8); }
            g.restore();
            for (const b of balls) {
                b.trail.forEach((p, i) => { g.globalAlpha = i / b.trail.length * .4; glowCircle(g, p.x, p.y, 2 + i * .5, "#fde68a", 8); });
                g.globalAlpha = 1;
                glowCircle(g, b.x, b.y, 8, "#fde047", 26);
            }
            fx.draw(g);
            floaters.draw(g);
            text(g, `Score ${score}`, 16, 24, 18, "#fff", "left", 800);
            text(g, `Level ${level + 1}`, W / 2, 24, 18, "#fde68a", "center", 800, "#f59e0b");
            text(g, "♥ ".repeat(Math.max(0, lives)).trim(), W - 16, 24, 18, "#fb7185", "right", 800, "#e11d48");
            if (started && levelT > 0 && balls.some(b => b.stuck)) text(g, "Click or Space to launch", W / 2, H / 2 + 60, 18, "#fde68a", "center", 700, "#f59e0b");
            if (!started) titleCard(g, W, H, "Brick Breaker", ["Move with your mouse · click to launch", "★ bricks drop power-ups"], t, "#fb923c");
            g.restore();
        });
    }
};
