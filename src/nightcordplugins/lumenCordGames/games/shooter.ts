/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Star Shooter: Galaga-style space shooter with swooping waves and bosses. */

import { clamp, GameDef, pick, rand } from "./core";
import { Floaters, glowCircle, keys, muteButton, nebula, Particles, sfx, Shake, StarLayers, text, titleCard } from "./fx";

const W = 800, H = 560;
type EType = "drone" | "fighter" | "tank" | "boss";
const STATS: Record<EType, { hp: number; pts: number; color: string; r: number; }> = {
    drone: { hp: 1, pts: 50, color: "#f472b6", r: 14 },
    fighter: { hp: 2, pts: 100, color: "#22d3ee", r: 16 },
    tank: { hp: 4, pts: 200, color: "#fbbf24", r: 19 },
    boss: { hp: 60, pts: 3000, color: "#a855f7", r: 52 },
};
interface Enemy {
    type: EType; hp: number; x: number; y: number; sx: number; sy: number;
    state: "enter" | "form" | "dive"; t: number; path: number[]; fire: number; flash: number;
}
interface Shot { x: number; y: number; vx: number; vy: number; enemy: boolean; }

const bez = (p: number[], t: number) => {
    const u = 1 - t;
    return [
        u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6],
        u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7],
    ];
};

export const shooter: GameDef = {
    id: "shooter", name: "Star Shooter", icon: "🚀", color: "#818cf8", category: "Arcade",
    selfSound: true,
    description: "Blast swooping alien waves in a Galaga-style shooter. A boss shows up every 5 waves!",
    controls: "Mouse or ← → ↑ ↓ to fly · you fire automatically",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        const k = keys(api);
        const fx = new Particles(), shake = new Shake(), floaters = new Floaters();
        const stars = new StarLayers(W, H, [90, 45, 20]);
        const ship = { x: W / 2, y: H - 60, inv: 2, shield: 0, gun: 1, fireCd: 0 };
        let enemies: Enemy[] = [], shots: Shot[] = [], drops: { x: number; y: number; kind: "gun" | "shield" | "life"; }[] = [];
        let wave = 0, score = 0, lives = 3, t = 0, scroll = 0, started = false, over = false, sway = 0, diveCd = 3, waveT = 0;
        let mouse: { x: number; y: number; } | null = null;

        cv.addEventListener("mousemove", e => { mouse = toLocal(e); });
        cv.addEventListener("mousedown", () => { started = true; });
        api.onKey((e, d) => { if (e.key === " " && d) { started = true; return true; } });

        function nextWave() {
            wave++;
            waveT = 2;
            floaters.add(W / 2, H / 2 - 40, wave % 5 === 0 ? "⚠ BOSS ⚠" : `WAVE ${wave}`, wave % 5 === 0 ? "#f87171" : "#c4b5fd", 34);
            if (wave % 5 === 0) {
                enemies.push({ type: "boss", hp: STATS.boss.hp + wave * 8, x: W / 2, y: -80, sx: W / 2, sy: 120, state: "enter", t: 0, path: [W / 2, -80, W / 2, 0, W / 2, 60, W / 2, 120], fire: 2, flash: 0 });
                return;
            }
            const rows: EType[] = wave < 3 ? ["drone", "drone", "fighter"] : wave < 7 ? ["drone", "fighter", "fighter", "tank"] : ["fighter", "fighter", "tank", "tank", "drone"];
            const perRow = Math.min(10, 6 + Math.floor(wave / 2));
            rows.forEach((type, r) => {
                for (let c = 0; c < perRow; c++) {
                    const sx = W / 2 + (c - (perRow - 1) / 2) * 56, sy = 70 + r * 46;
                    const fromLeft = (r + c) % 2 === 0;
                    const x0 = fromLeft ? -40 : W + 40, y0 = rand(80, 260);
                    enemies.push({
                        type, hp: STATS[type].hp, x: x0, y: y0, sx, sy, state: "enter", t: -(c * .09 + r * .35), flash: 0,
                        path: [x0, y0, fromLeft ? W * .55 : W * .45, H * .75, fromLeft ? W * .2 : W * .8, -60, sx, sy], fire: rand(2, 6),
                    });
                }
            });
        }

        function explode(x: number, y: number, color: string, big = false) {
            fx.burst(x, y, { n: big ? 120 : 26, color: [color, "#fff", "#fde68a"], speed: big ? 480 : 300, life: big ? 1.3 : .7, size: big ? 5 : 3 });
            big ? sfx.boom() : sfx.hit();
            shake.hit(big ? 14 : 3, big ? .6 : .12);
        }

        function hurtShip() {
            if (ship.inv > 0) return;
            if (ship.shield > 0) { ship.shield = 0; ship.inv = 1; sfx.hit(); fx.burst(ship.x, ship.y, { n: 30, color: "#67e8f9", speed: 250 }); return; }
            lives--;
            ship.gun = Math.max(1, ship.gun - 1);
            explode(ship.x, ship.y, "#818cf8", true);
            ship.inv = 2.5;
            if (lives <= 0) {
                over = true;
                api.later(() => api.end(score, "Ship destroyed!", `You reached wave ${wave}`), 1300);
            }
        }

        function drawShip() {
            if (over || (ship.inv > 0 && Math.floor(t * 12) % 2)) return;
            const { x, y } = ship;
            g.save();
            g.translate(x, y);
            // engine flame
            const fl = 14 + Math.sin(t * 40) * 4;
            const fg = g.createLinearGradient(0, 14, 0, 14 + fl);
            fg.addColorStop(0, "#fff"); fg.addColorStop(.3, "#67e8f9"); fg.addColorStop(1, "rgba(103,232,249,0)");
            g.fillStyle = fg;
            g.beginPath(); g.moveTo(-6, 14); g.lineTo(0, 14 + fl); g.lineTo(6, 14); g.fill();
            g.shadowColor = "#818cf8"; g.shadowBlur = 18;
            const body = g.createLinearGradient(-22, 0, 22, 0);
            body.addColorStop(0, "#3730a3"); body.addColorStop(.5, "#c7d2fe"); body.addColorStop(1, "#3730a3");
            g.fillStyle = body;
            g.beginPath();
            g.moveTo(0, -24); g.lineTo(8, -6); g.lineTo(24, 10); g.lineTo(22, 16); g.lineTo(8, 12); g.lineTo(0, 16);
            g.lineTo(-8, 12); g.lineTo(-22, 16); g.lineTo(-24, 10); g.lineTo(-8, -6); g.closePath();
            g.fill();
            g.shadowBlur = 0;
            g.fillStyle = "#22d3ee";
            g.beginPath(); g.ellipse(0, -6, 4, 8, 0, 0, Math.PI * 2); g.fill();
            g.fillStyle = "#f472b6";
            g.fillRect(-21, 8, 4, 6); g.fillRect(17, 8, 4, 6);
            g.restore();
            if (ship.shield > 0) {
                g.save();
                g.strokeStyle = `rgba(103,232,249,${.5 + .3 * Math.sin(t * 6)})`;
                g.shadowColor = "#67e8f9"; g.shadowBlur = 16; g.lineWidth = 2.5;
                g.beginPath(); g.arc(x, y - 2, 32, 0, Math.PI * 2); g.stroke();
                g.restore();
            }
        }

        function drawEnemy(e: Enemy) {
            const s = STATS[e.type], c = e.flash > 0 ? "#ffffff" : s.color;
            g.save();
            g.translate(e.x, e.y);
            const ang = e.state === "form" ? Math.PI : Math.atan2(e.path[7] - e.y, e.path[6] - e.x) + Math.PI / 2;
            g.rotate(e.type === "boss" ? 0 : ang + Math.PI);
            if (e.type === "boss" || enemies.length < 14) { g.shadowColor = s.color; g.shadowBlur = 10; }
            g.fillStyle = c;
            const r = s.r;
            if (e.type === "drone") {
                g.beginPath(); g.moveTo(0, r); g.lineTo(r, -r * .4); g.lineTo(r * .4, -r * .2); g.lineTo(0, -r * .7); g.lineTo(-r * .4, -r * .2); g.lineTo(-r, -r * .4); g.closePath(); g.fill();
                g.fillStyle = "#1e1b4b"; g.beginPath(); g.arc(0, 0, r * .28, 0, Math.PI * 2); g.fill();
            } else if (e.type === "fighter") {
                g.beginPath(); g.moveTo(0, r); g.lineTo(r * .5, 0); g.lineTo(r, -r); g.lineTo(0, -r * .4); g.lineTo(-r, -r); g.lineTo(-r * .5, 0); g.closePath(); g.fill();
                g.fillStyle = "#fff"; g.fillRect(-2, -2, 4, 10);
            } else if (e.type === "tank") {
                g.beginPath(); g.roundRect(-r, -r * .7, r * 2, r * 1.4, 6); g.fill();
                g.fillStyle = "#78350f"; g.fillRect(-r * .25, 0, r * .5, r);
                g.fillStyle = "#fef3c7"; g.beginPath(); g.arc(0, -r * .1, r * .3, 0, Math.PI * 2); g.fill();
            } else {
                // boss
                const grd = g.createRadialGradient(0, -10, 10, 0, 0, r * 1.4);
                grd.addColorStop(0, e.flash > 0 ? "#fff" : "#e9d5ff"); grd.addColorStop(.5, c); grd.addColorStop(1, "#3b0764");
                g.fillStyle = grd;
                g.beginPath(); g.ellipse(0, 0, r * 1.5, r * .75, 0, 0, Math.PI * 2); g.fill();
                g.fillStyle = "#f472b6";
                for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * r * 1.4, 0); g.lineTo(sx * r * 2, r * .8); g.lineTo(sx * r * 1.1, r * .4); g.fill(); }
                g.fillStyle = "#fde047"; g.beginPath(); g.arc(0, 4, 12 + Math.sin(t * 8) * 2, 0, Math.PI * 2); g.fill();
            }
            g.restore();
        }

        api.loop(dt => {
            t += dt;
            scroll -= 140 * dt;
            if (started && !over) {
                // move ship
                if (mouse && !k.has("ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", "w", "s")) {
                    ship.x += (mouse.x - ship.x) * Math.min(1, dt * 12);
                    ship.y += (clamp(mouse.y, H * .55, H - 30) - ship.y) * Math.min(1, dt * 12);
                } else {
                    ship.x += ((k.has("ArrowRight", "d") ? 1 : 0) - (k.has("ArrowLeft", "a") ? 1 : 0)) * 420 * dt;
                    ship.y += ((k.has("ArrowDown", "s") ? 1 : 0) - (k.has("ArrowUp", "w") ? 1 : 0)) * 320 * dt;
                }
                ship.x = clamp(ship.x, 24, W - 24); ship.y = clamp(ship.y, H * .55, H - 30);
                ship.inv -= dt; ship.shield -= dt;
                // auto-fire
                ship.fireCd -= dt;
                if (ship.fireCd <= 0) {
                    ship.fireCd = .16;
                    const spread = ship.gun === 1 ? [0] : ship.gun === 2 ? [-8, 8] : [-12, 0, 12];
                    for (const o of spread) shots.push({ x: ship.x + o, y: ship.y - 22, vx: o * 6, vy: -720, enemy: false });
                    sfx.shoot();
                }
                if (!enemies.length && waveT <= 0) nextWave();
                waveT -= dt;
                sway += dt;
                // pick divers
                diveCd -= dt;
                const formed = enemies.filter(e => e.state === "form" && e.type !== "boss");
                if (diveCd <= 0 && formed.length) {
                    diveCd = Math.max(.6, 2.6 - wave * .15);
                    const e = pick(formed);
                    e.state = "dive"; e.t = 0;
                    e.path = [e.x, e.y, e.x + (e.x < W / 2 ? -140 : 140), e.y + 120, ship.x + rand(-120, 120), ship.y - 60, ship.x + rand(-60, 60), H + 60];
                }
                for (const e of enemies) {
                    e.flash -= dt;
                    if (e.state === "enter") {
                        e.t += dt / (e.type === "boss" ? 2.2 : 1.7);
                        if (e.t >= 1) { e.state = "form"; e.t = 0; }
                        else if (e.t > 0) { [e.x, e.y] = bez(e.path, e.t); }
                    } else if (e.state === "form") {
                        const tx = e.sx + Math.sin(sway * .8) * (e.type === "boss" ? 220 : 40), ty = e.sy + Math.sin(sway * 1.6 + e.sx) * 6;
                        e.x += (tx - e.x) * Math.min(1, dt * 5); e.y += (ty - e.y) * Math.min(1, dt * 5);
                    } else {
                        e.t += dt / 2.1;
                        if (e.t >= 1) { e.state = "enter"; e.t = 0; e.path = [e.x, -40, e.x, 0, e.sx, e.sy - 60, e.sx, e.sy]; e.y = -40; }
                        else [e.x, e.y] = bez(e.path, e.t);
                    }
                    // enemy fire
                    e.fire -= dt;
                    if (e.fire <= 0 && e.y > 0 && e.state !== "enter") {
                        if (e.type === "boss") {
                            e.fire = 1.1;
                            const n = 9 + (wave / 5);
                            for (let i = 0; i < n; i++) {
                                const a = Math.PI / 2 + (i - (n - 1) / 2) * .16 + Math.sin(t) * .3;
                                shots.push({ x: e.x, y: e.y + 30, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, enemy: true });
                            }
                        } else if (e.type !== "drone" || e.state === "dive") {
                            e.fire = rand(2.5, 5) / Math.min(2, 1 + wave * .08);
                            const a = Math.atan2(ship.y - e.y, ship.x - e.x);
                            shots.push({ x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, enemy: true });
                        } else e.fire = rand(2, 5);
                    }
                    if (Math.hypot(e.x - ship.x, e.y - ship.y) < STATS[e.type].r + 16) { hurtShip(); if (e.type !== "boss") e.hp = 0; }
                }
                // shots
                for (const s of shots) {
                    s.x += s.vx * dt; s.y += s.vy * dt;
                    if (s.enemy) {
                        if (Math.hypot(s.x - ship.x, s.y - ship.y) < 14) { s.y = 9e9; hurtShip(); }
                    } else {
                        for (const e of enemies) {
                            const r = STATS[e.type].r;
                            if (e.hp > 0 && Math.abs(s.x - e.x) < (e.type === "boss" ? r * 1.5 : r) && Math.abs(s.y - e.y) < r) {
                                if (e.type === "boss") fx.burst(s.x, s.y, { n: 3, color: "#e9d5ff", speed: 120, life: .3 });
                                e.hp--; e.flash = .06; s.y = -9e9;
                                break;
                            }
                        }
                    }
                }
                shots = shots.filter(s => s.y > -30 && s.y < H + 30 && s.x > -30 && s.x < W + 30);
                for (const e of enemies.filter(e => e.hp <= 0)) {
                    const st = STATS[e.type];
                    const pts = st.pts * (e.state === "dive" ? 2 : 1);
                    score += pts;
                    floaters.add(e.x, e.y, `+${pts}`, st.color, e.type === "boss" ? 30 : 15);
                    explode(e.x, e.y, st.color, e.type === "boss");
                    const dropChance = e.type === "boss" ? 1 : e.type === "tank" ? .25 : .06;
                    if (Math.random() < dropChance) drops.push({ x: e.x, y: e.y, kind: pick(["gun", "gun", "shield", "life"] as const) });
                }
                enemies = enemies.filter(e => e.hp > 0);
                for (const d of drops) {
                    d.y += 110 * dt;
                    if (Math.hypot(d.x - ship.x, d.y - ship.y) < 30) {
                        d.y = 9e9; sfx.power();
                        if (d.kind === "gun") { ship.gun = Math.min(3, ship.gun + 1); floaters.add(ship.x, ship.y - 40, ship.gun === 3 ? "TRIPLE SHOT!" : "DOUBLE SHOT!", "#fde047"); }
                        if (d.kind === "shield") { ship.shield = 12; floaters.add(ship.x, ship.y - 40, "SHIELD!", "#67e8f9"); }
                        if (d.kind === "life") { lives++; floaters.add(ship.x, ship.y - 40, "+1 LIFE", "#fb7185"); }
                    }
                }
                drops = drops.filter(d => d.y < H + 20);
                api.setScore(score);
                api.setStatus(`Wave ${wave} · ${"♥".repeat(Math.max(0, lives))}`);
            }
            fx.update(dt); shake.update(dt); floaters.update(dt);

            g.save();
            shake.apply(g);
            nebula(g, W, H, 245);
            stars.draw(g, 0, scroll);
            for (const d of drops) {
                const col = d.kind === "gun" ? "#fde047" : d.kind === "shield" ? "#67e8f9" : "#fb7185";
                glowCircle(g, d.x, d.y, 11, col, 26);
                text(g, d.kind === "gun" ? "P" : d.kind === "shield" ? "S" : "♥", d.x, d.y + 1, 13, "#1e1b4b", "center", 900, "transparent");
            }
            enemies.forEach(drawEnemy);
            const boss = enemies.find(e => e.type === "boss");
            if (boss) {
                const max = STATS.boss.hp + wave * 8;
                g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(W / 2 - 160, 14, 320, 10);
                g.fillStyle = "#a855f7"; g.shadowColor = "#a855f7"; g.shadowBlur = 10;
                g.fillRect(W / 2 - 160, 14, 320 * boss.hp / max, 10); g.shadowBlur = 0;
            }
            // bullets: a soft wide layer + a bright core (much cheaper than canvas blur)
            g.save();
            g.globalCompositeOperation = "lighter";
            for (const s of shots) {
                if (s.enemy) {
                    g.fillStyle = "rgba(244,63,94,.35)"; g.beginPath(); g.arc(s.x, s.y, 8, 0, Math.PI * 2); g.fill();
                    g.fillStyle = "#fecdd3"; g.beginPath(); g.arc(s.x, s.y, 3.5, 0, Math.PI * 2); g.fill();
                } else {
                    g.fillStyle = "rgba(34,211,238,.35)"; g.fillRect(s.x - 5, s.y - 11, 10, 20);
                    g.fillStyle = "#e0f2fe"; g.fillRect(s.x - 1.5, s.y - 9, 3, 16);
                }
            }
            g.restore();
            drawShip();
            fx.draw(g);
            floaters.draw(g);
            text(g, `${score}`, 16, 24, 20, "#fff", "left", 900);
            text(g, "♥ ".repeat(Math.max(0, lives)).trim(), W - 16, 24, 18, "#fb7185", "right", 800, "#e11d48");
            if (!started) titleCard(g, W, H, "Star Shooter", ["Fly with your mouse or arrow keys · you fire automatically", "Divers are worth double · boss every 5 waves"], t, "#818cf8");
            g.restore();
        });
    }
};
