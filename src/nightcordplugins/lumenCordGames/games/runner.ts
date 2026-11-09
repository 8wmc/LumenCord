/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Neon Runner: Geometry Dash-style auto-runner with a jumping cube. */

import { GameDef, pick } from "./core";
import { muteButton, Particles, sfx, Shake, text, titleCard } from "./fx";

const W = 860, H = 500, GROUND = 400, T = 40, PX = 200, SIZE = 36;

type OType = "spike" | "block" | "pad" | "orb";
interface Ob { type: OType; x: number; y: number; w: number; h: number; used?: boolean; }

// patterns: [type, x tiles, height tiles above ground (bottom), w tiles, h tiles]
type Pat = [OType, number, number, number?, number?][];
const PATTERNS: { len: number; items: Pat; min: number; }[] = [
    { len: 6, min: 0, items: [["spike", 0, 0]] },
    { len: 7, min: 0, items: [["spike", 0, 0], ["spike", 1, 0]] },
    { len: 7, min: 0, items: [["block", 0, 0, 1, 1], ["spike", 3, 0]] },
    { len: 9, min: 1, items: [["block", 0, 0, 2, 1], ["block", 4, 0, 2, 2], ["spike", 2, 0], ["spike", 3, 0]] },
    { len: 8, min: 1, items: [["spike", 0, 0], ["spike", 1, 0], ["spike", 2, 0]] },
    { len: 10, min: 1, items: [["pad", 0, 0], ["spike", 2, 0], ["spike", 3, 0], ["spike", 4, 0], ["spike", 5, 0], ["spike", 6, 0]] },
    { len: 10, min: 2, items: [["spike", 0, 0], ["spike", 1, 0], ["spike", 2, 0], ["orb", 2, 2], ["spike", 3, 0], ["spike", 4, 0], ["spike", 5, 0]] },
    { len: 12, min: 1, items: [["block", 0, 0, 1, 1], ["block", 1, 0, 1, 2], ["block", 2, 0, 1, 3], ["block", 3, 0, 4, 3], ["spike", 4, 0], ["spike", 5, 0], ["spike", 6, 0], ["spike", 5, 3]] },
    { len: 11, min: 2, items: [["block", 0, 2, 4, 1], ["spike", 0, 0], ["spike", 1, 0], ["spike", 2, 0], ["spike", 3, 0], ["block", 6, 0, 1, 1]] },
    { len: 9, min: 2, items: [["spike", 0, 0], ["block", 2, 0, 1, 1], ["spike", 3, 0], ["block", 5, 0, 1, 2]] },
    { len: 12, min: 3, items: [["pad", 0, 0], ["block", 4, 3, 3, 1], ["spike", 2, 0], ["spike", 3, 0], ["spike", 4, 0], ["spike", 5, 0], ["spike", 6, 0], ["spike", 7, 0], ["spike", 6, 4]] },
];

export const runner: GameDef = {
    id: "runner", name: "Neon Runner", icon: "🟪", color: "#a3e635", category: "Arcade",
    selfSound: true,
    description: "Geometry Dash-style! Your cube runs on its own. Jump over spikes, land on blocks, hit pads and rings.",
    controls: "Click, Space or ↑ to jump (hold to keep jumping)",
    start(api) {
        const { cv, g } = api.canvas(W, H);
        muteButton(api);
        const fx = new Particles(), shake = new Shake();
        const p = { y: GROUND - SIZE, vy: 0, rot: 0, ground: true };
        let obs: Ob[] = [], dist = 0, speed = 340, t = 0, started = false, dead = false, holding = false, nextX = W + 200, beat = 0, hue = 280;
        const city = [0, 1, 2].map(layer => Array.from({ length: 30 }, (_, i) => ({ x: i * (70 + layer * 30), w: 40 + Math.random() * 60, h: 60 + Math.random() * (120 - layer * 30) })));

        function addPattern() {
            const level = Math.min(3, Math.floor(dist / 2500));
            const pat = pick(PATTERNS.filter(q => q.min <= level));
            for (const [type, x, y, w = 1, h = 1] of pat.items) {
                const ob: Ob = { type, x: nextX + x * T, y: GROUND - (y + h) * T, w: w * T, h: h * T };
                if (type === "spike") { ob.h = T; ob.y = GROUND - (y + 1) * T; }
                if (type === "pad") { ob.h = 10; ob.y = GROUND - 10; }
                if (type === "orb") { ob.y = GROUND - y * T - T * 1.5; ob.h = T; }
                obs.push(ob);
            }
            nextX += (pat.len + Math.max(1, 4 - level)) * T;
        }

        const press = (d: boolean) => { holding = d; if (d && !started) started = true; };
        cv.addEventListener("mousedown", () => press(true));
        window.addEventListener("mouseup", mup);
        function mup() { holding = false; }
        api.cleanup(() => window.removeEventListener("mouseup", mup));
        api.onKey((e, d) => { if ([" ", "ArrowUp", "w", "W"].includes(e.key)) { press(d); return true; } });

        function die() {
            if (dead) return;
            dead = true;
            sfx.boom();
            shake.hit(12, .4);
            fx.burst(PX + SIZE / 2, p.y + SIZE / 2, { n: 70, color: ["#a3e635", "#fff", "#22d3ee", "#f0abfc"], speed: 500, life: 1, size: 4, gravity: 600 });
            const score = Math.floor(dist / 10);
            api.later(() => api.end(score, "Crashed!", `Distance ${score}`), 900);
        }

        function update(dt: number) {
            speed = Math.min(520, 340 + dist / 60);
            const dx = speed * dt;
            dist += dx;
            for (const o of obs) o.x -= dx;
            nextX -= dx;
            obs = obs.filter(o => o.x + o.w > -60);
            while (nextX < W + 400) addPattern();

            // physics
            const prevBottom = p.y + SIZE;
            p.vy += 2700 * dt;
            p.y += p.vy * dt;
            let onSurface = false;
            if (p.y + SIZE >= GROUND) { p.y = GROUND - SIZE; p.vy = 0; onSurface = true; }
            const L = PX + 3, R = PX + SIZE - 3;
            for (const o of obs) {
                if (o.x > R + 4 || o.x + o.w < L - 4) continue;
                if (o.type === "block") {
                    const overlapX = R > o.x && L < o.x + o.w;
                    if (!overlapX) continue;
                    if (prevBottom <= o.y + 6 && p.y + SIZE >= o.y && p.vy >= 0) { p.y = o.y - SIZE; p.vy = 0; onSurface = true; }
                    else if (p.y + SIZE > o.y + 6 && p.y < o.y + o.h) die();
                } else if (o.type === "spike") {
                    // inner hitbox of the triangle
                    if (R > o.x + 12 && L < o.x + o.w - 12 && p.y + SIZE > o.y + 14 && p.y < o.y + o.h) die();
                } else if (o.type === "pad") {
                    if (R > o.x && L < o.x + o.w && p.y + SIZE >= o.y - 2 && !o.used) { o.used = true; p.vy = -1180; p.ground = false; sfx.power(); fx.burst(o.x + T / 2, o.y, { n: 16, color: "#fde047", speed: 220, angle: -Math.PI / 2, spread: .7 }); }
                } else if (o.type === "orb") {
                    const cx = o.x + T / 2, cy = o.y + T / 2;
                    if (holding && !o.used && Math.hypot(cx - (PX + SIZE / 2), cy - (p.y + SIZE / 2)) < 46) {
                        o.used = true; p.vy = -830; sfx.jump();
                        fx.burst(cx, cy, { n: 20, color: "#fde047", speed: 240 });
                    }
                }
            }
            if (onSurface) {
                p.ground = true;
                p.rot = Math.round(p.rot / (Math.PI / 2)) * (Math.PI / 2);
                if (holding) { p.vy = -830; p.ground = false; sfx.jump(); }
            } else {
                p.ground = false;
                p.rot += 6.6 * dt;
            }
            if (p.ground && Math.random() < .7) fx.burst(PX, p.y + SIZE, { n: 1, color: "#d9f99d", speed: 80, angle: Math.PI, spread: .3, life: .35, size: 2 });
            api.setScore(Math.floor(dist / 10));
        }

        function drawSpike(o: Ob) {
            g.save();
            const grd = g.createLinearGradient(0, o.y, 0, o.y + o.h);
            grd.addColorStop(0, "#fff"); grd.addColorStop(.3, "#1e1b4b"); grd.addColorStop(1, "#0b0820");
            g.fillStyle = grd;
            g.shadowColor = `hsl(${hue} 100% 65%)`; g.shadowBlur = 14;
            g.strokeStyle = `hsl(${hue} 100% 75%)`; g.lineWidth = 2;
            g.beginPath(); g.moveTo(o.x + 2, o.y + o.h); g.lineTo(o.x + o.w / 2, o.y + 2); g.lineTo(o.x + o.w - 2, o.y + o.h); g.closePath();
            g.fill(); g.stroke();
            g.restore();
        }
        function drawBlock(o: Ob) {
            g.save();
            g.fillStyle = "#0b0820";
            g.fillRect(o.x, o.y, o.w, o.h);
            g.strokeStyle = `hsl(${hue} 100% 70%)`; g.lineWidth = 2;
            g.shadowColor = `hsl(${hue} 100% 65%)`; g.shadowBlur = 12;
            g.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
            g.shadowBlur = 0;
            g.strokeStyle = `hsla(${hue} 100% 70% / .3)`; g.lineWidth = 1;
            for (let x = o.x; x < o.x + o.w - 1; x += T) for (let y = o.y; y < o.y + o.h - 1; y += T) g.strokeRect(x + 6, y + 6, T - 12, T - 12);
            g.restore();
        }

        function draw() {
            beat = Math.max(0, beat - .016 * 2);
            if (Math.floor(t * 2.2) !== Math.floor((t - .016) * 2.2)) beat = 1;
            hue = 280 - Math.min(160, dist / 80) + Math.sin(t * .2) * 20;
            const sky = g.createLinearGradient(0, 0, 0, GROUND);
            sky.addColorStop(0, `hsl(${hue} 70% ${8 + beat * 3}%)`);
            sky.addColorStop(1, `hsl(${hue + 30} 80% ${20 + beat * 5}%)`);
            g.fillStyle = sky;
            g.fillRect(0, 0, W, H);
            // sun
            const sun = g.createLinearGradient(0, 120, 0, 300);
            sun.addColorStop(0, "#fde68a"); sun.addColorStop(1, `hsl(${hue + 40} 90% 60%)`);
            g.fillStyle = sun;
            g.beginPath(); g.arc(W * .7, 260, 110, Math.PI, 0); g.fill();
            g.fillStyle = `hsl(${hue + 30} 80% 20%)`;
            for (let i = 0; i < 6; i++) g.fillRect(W * .7 - 120, 165 + i * 16, 240, 3 + i);
            // city layers
            city.forEach((layer, li) => {
                const k = .15 + li * .2, total = layer.length * (70 + li * 30);
                g.fillStyle = `hsl(${hue + 10} 60% ${6 + li * 4}%)`;
                for (const b of layer) {
                    const x = ((b.x - dist * k) % total + total) % total - 80;
                    g.fillRect(x, GROUND - b.h - (2 - li) * 20, b.w, b.h + 60);
                    if (li === 2) {
                        g.fillStyle = `hsla(${hue + 60} 100% 75% / .6)`;
                        for (let wy = GROUND - b.h + 10; wy < GROUND - 10; wy += 16) for (let wx = x + 6; wx < x + b.w - 8; wx += 12) if ((wx * 7 + wy) % 5 < 2) g.fillRect(wx, wy, 4, 6);
                        g.fillStyle = `hsl(${hue + 10} 60% ${6 + li * 4}%)`;
                    }
                }
            });
            // ground
            g.fillStyle = `hsl(${hue} 60% 7%)`;
            g.fillRect(0, GROUND, W, H - GROUND);
            g.strokeStyle = `hsl(${hue} 100% 75%)`; g.lineWidth = 3;
            g.shadowColor = `hsl(${hue} 100% 65%)`; g.shadowBlur = 16 + beat * 10;
            g.beginPath(); g.moveTo(0, GROUND); g.lineTo(W, GROUND); g.stroke();
            g.shadowBlur = 0;
            g.strokeStyle = `hsla(${hue} 100% 70% / .18)`; g.lineWidth = 1;
            for (let x = -(dist % T); x < W; x += T) { g.beginPath(); g.moveTo(x, GROUND); g.lineTo(x, H); g.stroke(); }
            for (const o of obs) {
                if (o.type === "spike") drawSpike(o);
                else if (o.type === "block") drawBlock(o);
                else if (o.type === "pad") {
                    g.save(); g.fillStyle = "#fde047"; g.shadowColor = "#fde047"; g.shadowBlur = 16;
                    g.beginPath(); g.ellipse(o.x + T / 2, GROUND - 4, T / 2 - 2, 7, 0, Math.PI, 0); g.fill(); g.restore();
                } else {
                    g.save(); g.strokeStyle = "#fde047"; g.lineWidth = 4; g.shadowColor = "#fde047"; g.shadowBlur = 18;
                    g.globalAlpha = o.used ? .3 : 1;
                    g.beginPath(); g.arc(o.x + T / 2, o.y + T / 2, 14 + Math.sin(t * 8) * 2, 0, Math.PI * 2); g.stroke(); g.restore();
                }
            }
            // the cube
            if (!dead) {
                g.save();
                g.translate(PX + SIZE / 2, p.y + SIZE / 2);
                g.rotate(p.rot);
                g.shadowColor = "#a3e635"; g.shadowBlur = 22;
                g.fillStyle = "#a3e635";
                g.fillRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE);
                g.shadowBlur = 0;
                g.fillStyle = "#14532d";
                g.fillRect(-SIZE / 2 + 5, -SIZE / 2 + 5, SIZE - 10, SIZE - 10);
                g.fillStyle = "#d9f99d";
                g.fillRect(-SIZE / 2 + 9, -SIZE / 2 + 9, SIZE - 18, SIZE - 18);
                g.fillStyle = "#14532d";
                g.fillRect(-9, -6, 6, 6); g.fillRect(3, -6, 6, 6);
                g.fillRect(-8, 4, 16, 3);
                g.restore();
            }
            fx.draw(g);
            text(g, `${Math.floor(dist / 10)}`, W / 2, 34, 28, "#fff", "center", 900, `hsl(${hue} 100% 65%)`);
        }

        api.loop(dt => {
            t += dt;
            if (started && !dead) update(dt);
            fx.update(dt); shake.update(dt);
            g.save();
            shake.apply(g);
            draw();
            if (!started) titleCard(g, W, H, "Neon Runner", ["Jump over spikes · land on blocks", "Yellow pads launch you · tap inside yellow rings to jump again"], t, "#a3e635");
            g.restore();
        });
    }
};
