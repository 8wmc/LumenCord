/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Fruit Slice: Fruit Ninja style. */

import { GameDef, pick, rand, randInt } from "./core";
import { Floaters, muteButton, Particles, sfx, Shake, text, titleCard } from "./fx";

const W = 820, H = 540;
interface Kind { name: string; r: number; skin: string; skin2: string; inside: string; juice: string; seeds?: string; }
const KINDS: Kind[] = [
    { name: "melon", r: 38, skin: "#16a34a", skin2: "#14532d", inside: "#f43f5e", juice: "#fb7185", seeds: "#1c1917" },
    { name: "orange", r: 28, skin: "#fb923c", skin2: "#c2410c", inside: "#fdba74", juice: "#fb923c" },
    { name: "apple", r: 27, skin: "#ef4444", skin2: "#991b1b", inside: "#fef9c3", juice: "#fef08a", seeds: "#78350f" },
    { name: "lime", r: 24, skin: "#84cc16", skin2: "#3f6212", inside: "#d9f99d", juice: "#bef264" },
    { name: "plum", r: 25, skin: "#a855f7", skin2: "#581c87", inside: "#fde68a", juice: "#c084fc" },
    { name: "kiwi", r: 26, skin: "#a16207", skin2: "#713f12", inside: "#86efac", juice: "#4ade80", seeds: "#14532d" },
    { name: "peach", r: 28, skin: "#fda4af", skin2: "#e11d48", inside: "#fde68a", juice: "#fda4af" },
];
interface Fruit { kind: Kind | null; x: number; y: number; vx: number; vy: number; rot: number; vr: number; }
interface Half { kind: Kind; x: number; y: number; vx: number; vy: number; rot: number; vr: number; side: number; cut: number; }

export const fruitSlice: GameDef = {
    id: "fruit", name: "Fruit Slice", icon: "🍉", color: "#f43f5e", category: "Arcade", selfSound: true,
    description: "Fruit Ninja style! Hold the mouse and swipe to slice flying fruit. Never touch a bomb!",
    controls: "Hold the mouse button and swipe",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        const fx = new Particles(), shake = new Shake(), floaters = new Floaters();
        let fruits: Fruit[] = [], halves: Half[] = [], stains: { x: number; y: number; r: number; c: string; life: number; }[] = [];
        let trail: { x: number; y: number; t: number; }[] = [];
        let score = 0, missed = 0, t = 0, started = false, over = false, waveT = 1, down = false, swipeHits = 0, swipeT = 0, flash = 0;

        // wooden background, drawn once
        const bg = document.createElement("canvas");
        bg.width = W; bg.height = H;
        (() => {
            const b = bg.getContext("2d")!;
            for (let i = 0; i < 9; i++) {
                const y = i * 62;
                const grd = b.createLinearGradient(0, y, 0, y + 62);
                grd.addColorStop(0, i % 2 ? "#3b1d5e" : "#341a54"); grd.addColorStop(1, "#22103a");
                b.fillStyle = grd; b.fillRect(0, y, W, 62);
                b.fillStyle = "rgba(0,0,0,.35)"; b.fillRect(0, y + 60, W, 2);
                b.strokeStyle = "rgba(255,255,255,.04)";
                for (let k = 0; k < 6; k++) { b.beginPath(); b.moveTo(0, y + 8 + k * 9); b.bezierCurveTo(W * .3, y + 4 + k * 9, W * .6, y + 14 + k * 9, W, y + 8 + k * 9); b.stroke(); }
            }
            const v = b.createRadialGradient(W / 2, H / 2, 150, W / 2, H / 2, 560);
            v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.6)");
            b.fillStyle = v; b.fillRect(0, 0, W, H);
        })();

        function throwWave() {
            const n = Math.min(6, randInt(1, 2 + Math.floor(score / 25)));
            const bombChance = Math.min(.25, .06 + score / 600);
            for (let i = 0; i < n; i++) {
                api.later(() => {
                    if (over) return;
                    const x = rand(120, W - 120);
                    fruits.push({ kind: Math.random() < bombChance ? null : pick(KINDS), x, y: H + 40, vx: (W / 2 - x) * rand(.15, .45) + rand(-60, 60), vy: -rand(620, 780), rot: 0, vr: rand(-3, 3) });
                    sfx.tick();
                }, i * rand(80, 220));
            }
            waveT = Math.max(.9, 2.2 - score / 120);
        }

        function slice(f: Fruit, angle: number) {
            if (!f.kind) {
                // bomb!
                over = true;
                flash = 1;
                shake.hit(16, .7);
                sfx.boom();
                fx.burst(f.x, f.y, { n: 120, color: ["#fde047", "#fb923c", "#fff", "#ef4444"], speed: 520, life: 1.2, size: 5 });
                api.later(() => api.end(score, "💣 You sliced a bomb!", `${score} fruit sliced`), 1200);
                return;
            }
            score++;
            swipeHits++;
            sfx.card(); sfx.point();
            const k = f.kind;
            for (const side of [-1, 1]) halves.push({ kind: k, x: f.x, y: f.y, vx: f.vx + Math.cos(angle + Math.PI / 2) * side * 90, vy: f.vy * .4 + Math.sin(angle + Math.PI / 2) * side * 90, rot: angle, vr: side * rand(2, 5), side, cut: angle });
            fx.burst(f.x, f.y, { n: 26, color: [k.juice, k.inside, "#fff"], speed: 300, life: .7, size: 3.5, gravity: 700 });
            stains.push({ x: f.x, y: f.y, r: k.r * rand(1.2, 1.8), c: k.juice, life: 3 });
            api.setScore(score);
        }

        function segHitsCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number) {
            const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
            const tt = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / l2));
            return (ax + dx * tt - cx) ** 2 + (ay + dy * tt - cy) ** 2 < r * r;
        }

        cv.addEventListener("mousedown", e => { if (!started) { started = true; return; } down = true; const p = toLocal(e); trail = [{ ...p, t }]; swipeHits = 0; swipeT = 0; });
        const up = () => {
            if (down && swipeHits >= 3) { const bonus = swipeHits; score += bonus; floaters.add(trail.at(-1)?.x ?? W / 2, trail.at(-1)?.y ?? H / 2, `${swipeHits} FRUIT COMBO +${bonus}`, "#fde047", 22); sfx.coin(); api.setScore(score); }
            down = false;
        };
        window.addEventListener("mouseup", up);
        api.cleanup(() => window.removeEventListener("mouseup", up));
        cv.addEventListener("mousemove", e => {
            if (!down || over) return;
            const p = toLocal(e);
            const last = trail[trail.length - 1];
            trail.push({ ...p, t });
            if (!last) return;
            const speed = Math.hypot(p.x - last.x, p.y - last.y);
            if (speed < 2) return;
            const ang = Math.atan2(p.y - last.y, p.x - last.x);
            for (const f of [...fruits]) {
                if (segHitsCircle(last.x, last.y, p.x, p.y, f.x, f.y, f.kind ? f.kind.r : 26)) {
                    fruits.splice(fruits.indexOf(f), 1);
                    slice(f, ang);
                    if (over) return;
                }
            }
        });
        api.onKey((e, d) => { if (d && e.key === " " && !started) { started = true; return true; } });

        function drawFruit(k: Kind, x: number, y: number, rot: number) {
            g.save();
            g.translate(x, y); g.rotate(rot);
            const grd = g.createRadialGradient(-k.r * .35, -k.r * .4, k.r * .1, 0, 0, k.r);
            grd.addColorStop(0, "#fff"); grd.addColorStop(.25, k.skin); grd.addColorStop(1, k.skin2);
            g.fillStyle = grd;
            g.beginPath(); g.arc(0, 0, k.r, 0, Math.PI * 2); g.fill();
            if (k.name === "melon") { g.strokeStyle = "#14532d"; g.lineWidth = 4; for (const a of [-.5, 0, .5]) { g.beginPath(); g.ellipse(0, 0, k.r * Math.abs(a) + 3, k.r, 0, 0, Math.PI * 2); g.stroke(); } }
            if (k.name === "orange" || k.name === "lime") { g.fillStyle = "rgba(0,0,0,.12)"; for (let i = 0; i < 14; i++) g.fillRect(rand(-k.r * .6, k.r * .6), rand(-k.r * .6, k.r * .6), 2, 2); }
            if (k.name !== "kiwi") {
                g.fillStyle = "#65a30d";
                g.beginPath(); g.ellipse(4, -k.r - 2, 8, 4, -.5, 0, Math.PI * 2); g.fill();
                g.strokeStyle = "#713f12"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -k.r + 3); g.lineTo(-1, -k.r - 6); g.stroke();
            }
            g.restore();
        }
        function drawHalf(h: Half) {
            const k = h.kind;
            g.save();
            g.translate(h.x, h.y); g.rotate(h.rot);
            g.beginPath(); g.arc(0, 0, k.r, h.side > 0 ? 0 : Math.PI, h.side > 0 ? Math.PI : Math.PI * 2); g.closePath();
            g.fillStyle = k.skin2; g.fill();
            g.beginPath(); g.arc(0, 0, k.r * .86, h.side > 0 ? 0 : Math.PI, h.side > 0 ? Math.PI : Math.PI * 2); g.closePath();
            g.fillStyle = k.inside; g.fill();
            if (k.seeds) { g.fillStyle = k.seeds; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(i * k.r * .25, h.side * k.r * .35, 2, 3.5, 0, 0, Math.PI * 2); g.fill(); } }
            g.restore();
        }
        function drawBomb(f: Fruit) {
            g.save();
            g.translate(f.x, f.y); g.rotate(f.rot);
            const grd = g.createRadialGradient(-8, -9, 2, 0, 0, 26);
            grd.addColorStop(0, "#6b7280"); grd.addColorStop(.4, "#1f2937"); grd.addColorStop(1, "#030712");
            g.fillStyle = grd;
            g.beginPath(); g.arc(0, 0, 25, 0, Math.PI * 2); g.fill();
            g.strokeStyle = "#ef4444"; g.lineWidth = 3;
            g.beginPath(); g.arc(0, 0, 25, 0, Math.PI * 2); g.stroke();
            g.fillStyle = "#374151"; g.fillRect(-5, -31, 10, 8);
            g.strokeStyle = "#a8a29e"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -31); g.quadraticCurveTo(8, -40, 4, -46); g.stroke();
            g.restore();
            if (Math.random() < .7) fx.burst(f.x + Math.cos(f.rot - Math.PI / 2) * 46 + 4, f.y + Math.sin(f.rot - Math.PI / 2) * 46, { n: 2, color: ["#fde047", "#fb923c"], speed: 90, life: .3, size: 2 });
        }

        api.loop(dt => {
            t += dt;
            if (started && !over) {
                waveT -= dt;
                if (waveT <= 0 && fruits.length < 3) throwWave();
                for (const f of [...fruits]) {
                    f.vy += 700 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
                    if (f.y > H + 60 && f.vy > 0) {
                        fruits.splice(fruits.indexOf(f), 1);
                        if (f.kind) {
                            missed++;
                            sfx.hit();
                            floaters.add(f.x, H - 30, "✕", "#ef4444", 30);
                            if (missed >= 3) { over = true; api.later(() => api.end(score, "Dropped 3 fruit!", `${score} fruit sliced`), 600); }
                        }
                    }
                }
                swipeT += dt;
            }
            for (const h of halves) { h.vy += 900 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; }
            halves = halves.filter(h => h.y < H + 80);
            for (const s of stains) s.life -= dt;
            stains = stains.filter(s => s.life > 0);
            trail = trail.filter(p => t - p.t < .12);
            fx.update(dt); shake.update(dt); floaters.update(dt);
            flash = Math.max(0, flash - dt);

            g.save();
            shake.apply(g);
            g.drawImage(bg, 0, 0);
            for (const s of stains) { g.globalAlpha = Math.min(.5, s.life / 3 * .5); g.fillStyle = s.c; g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill(); }
            g.globalAlpha = 1;
            halves.forEach(drawHalf);
            for (const f of fruits) f.kind ? drawFruit(f.kind, f.x, f.y, f.rot) : drawBomb(f);
            fx.draw(g);
            // blade trail
            if (trail.length > 1) {
                g.save();
                g.lineCap = "round"; g.lineJoin = "round";
                for (let i = 1; i < trail.length; i++) {
                    const a = trail[i - 1], b = trail[i], k = i / trail.length;
                    g.strokeStyle = `rgba(233,213,255,${k})`;
                    g.shadowColor = "#e879f9"; g.shadowBlur = 14;
                    g.lineWidth = 2 + k * 7;
                    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
                }
                g.restore();
            }
            floaters.draw(g);
            text(g, `🍉 ${score}`, 18, 30, 26, "#fde68a", "left", 900, "#f59e0b");
            for (let i = 0; i < 3; i++) text(g, "✕", W - 30 - i * 30, 30, 26, i < missed ? "#ef4444" : "rgba(255,255,255,.2)", "center", 900, i < missed ? "#ef4444" : "#000");
            if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash})`; g.fillRect(0, 0, W, H); }
            if (!started) titleCard(g, W, H, "Fruit Slice", ["Hold the mouse button and swipe across fruit", "Don't drop 3 fruit · NEVER slice a bomb 💣"], t, "#f43f5e");
            g.restore();
        });
    }
};
