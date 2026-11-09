/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Rock Blaster: Asteroids style. */

import { GameDef, rand } from "./core";
import { Floaters, keys, muteButton, nebula, Particles, sfx, Shake, text, titleCard } from "./fx";

const W = 820, H = 540;
interface Rock { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; pts: number[]; }
interface Bullet { x: number; y: number; vx: number; vy: number; life: number; enemy: boolean; }

export const rocks: GameDef = {
    id: "rocks", name: "Rock Blaster", icon: "☄", color: "#94a3b8", category: "Arcade", selfSound: true,
    description: "Asteroids-style space battle. Blast big rocks into smaller ones and watch out for the flying saucer!",
    controls: "← → turn · ↑ thrust · Space shoot · Shift hyperspace",
    start(api) {
        const { cv, g } = api.canvas(W, H);
        muteButton(api);
        const k = keys(api);
        const fx = new Particles(), shake = new Shake(), floaters = new Floaters();
        const ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 2, cd: 0, alive: true, respawn: 0, hyperCd: 0 };
        let list: Rock[] = [], bullets: Bullet[] = [], ufo: { x: number; y: number; vx: number; cd: number; hp: number; } | null = null;
        let score = 0, lives = 3, wave = 0, t = 0, started = false, over = false, ufoT = 15, thrustOn = false;

        const wrap = (o: { x: number; y: number; }, m = 0) => {
            if (o.x < -m) o.x += W + m * 2; if (o.x > W + m) o.x -= W + m * 2;
            if (o.y < -m) o.y += H + m * 2; if (o.y > H + m) o.y -= H + m * 2;
        };
        function makeRock(x: number, y: number, r: number): Rock {
            const a = rand(0, Math.PI * 2), sp = rand(30, 90) * (60 / r) ** .4 * (1 + wave * .06);
            const n = Math.floor(rand(9, 13));
            return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, rot: 0, vr: rand(-1, 1), pts: Array.from({ length: n }, () => rand(.72, 1.1)) };
        }
        function nextWave() {
            wave++;
            for (let i = 0; i < 3 + wave; i++) {
                let x = rand(0, W), y = rand(0, H);
                while (Math.hypot(x - ship.x, y - ship.y) < 180) { x = rand(0, W); y = rand(0, H); }
                list.push(makeRock(x, y, 46));
            }
            floaters.add(W / 2, H / 2 - 60, `WAVE ${wave}`, "#c4b5fd", 30);
        }
        function shatter(r: Rock, i: number) {
            list.splice(i, 1);
            const pts = r.r > 40 ? 20 : r.r > 22 ? 50 : 100;
            score += pts;
            sfx.hit();
            shake.hit(r.r > 40 ? 6 : 3, .15);
            fx.burst(r.x, r.y, { n: Math.floor(r.r / 1.5), color: ["#cbd5e1", "#a78bfa", "#fff"], speed: 220, life: .8, size: 2.5 });
            if (r.r > 22) for (let j = 0; j < 2; j++) list.push(makeRock(r.x, r.y, r.r > 40 ? 26 : 14));
        }
        function killShip() {
            if (!ship.alive || ship.inv > 0) return;
            ship.alive = false;
            lives--;
            sfx.boom(); shake.hit(12, .5);
            fx.burst(ship.x, ship.y, { n: 70, color: ["#67e8f9", "#e879f9", "#fff"], speed: 380, life: 1.2, size: 3 });
            if (lives <= 0) { over = true; api.later(() => api.end(score, "Ship destroyed!", `You reached wave ${wave}`), 1300); }
            else ship.respawn = 1.8;
        }

        api.onKey((e, d) => { if (e.key === " " && d && !started) { started = true; return true; } });
        cv.addEventListener("mousedown", () => { started = true; });

        api.loop(dt => {
            t += dt;
            if (started && !over) {
                if (!list.length && !ufo) nextWave();
                // ship
                if (ship.alive) {
                    if (k.has("ArrowLeft", "a")) ship.a -= 4.6 * dt;
                    if (k.has("ArrowRight", "d")) ship.a += 4.6 * dt;
                    thrustOn = k.has("ArrowUp", "w");
                    if (thrustOn) {
                        ship.vx += Math.cos(ship.a) * 380 * dt; ship.vy += Math.sin(ship.a) * 380 * dt;
                        if (Math.random() < .8) fx.burst(ship.x - Math.cos(ship.a) * 14, ship.y - Math.sin(ship.a) * 14, { n: 1, color: ["#fde68a", "#fb923c"], speed: 160, angle: ship.a + Math.PI, spread: .3, life: .3, size: 2.5 });
                    }
                    ship.vx *= Math.pow(.55, dt); ship.vy *= Math.pow(.55, dt);
                    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
                    wrap(ship);
                    ship.inv -= dt; ship.cd -= dt; ship.hyperCd -= dt;
                    if (k.has(" ") && ship.cd <= 0 && bullets.filter(b => !b.enemy).length < 6) {
                        ship.cd = .17;
                        bullets.push({ x: ship.x + Math.cos(ship.a) * 16, y: ship.y + Math.sin(ship.a) * 16, vx: Math.cos(ship.a) * 620 + ship.vx, vy: Math.sin(ship.a) * 620 + ship.vy, life: .95, enemy: false });
                        sfx.shoot();
                    }
                    if (k.has("Shift") && ship.hyperCd <= 0) {
                        ship.hyperCd = 2;
                        fx.burst(ship.x, ship.y, { n: 20, color: "#67e8f9", speed: 200 });
                        ship.x = rand(40, W - 40); ship.y = rand(40, H - 40); ship.vx = ship.vy = 0; ship.inv = .5;
                        sfx.power();
                    }
                } else {
                    ship.respawn -= dt;
                    if (ship.respawn <= 0) Object.assign(ship, { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, inv: 2.5, alive: true });
                }
                // saucer
                ufoT -= dt;
                if (!ufo && ufoT <= 0 && wave > 1) { ufoT = rand(15, 25); const left = Math.random() < .5; ufo = { x: left ? -30 : W + 30, y: rand(60, H - 60), vx: left ? 110 : -110, cd: 1.2, hp: 3 }; }
                if (ufo) {
                    ufo.x += ufo.vx * dt; ufo.y += Math.sin(t * 2) * 40 * dt;
                    ufo.cd -= dt;
                    if (ufo.cd <= 0 && ship.alive) {
                        ufo.cd = 1.3;
                        const a = Math.atan2(ship.y - ufo.y, ship.x - ufo.x) + rand(-.25, .25);
                        bullets.push({ x: ufo.x, y: ufo.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: 2, enemy: true });
                        sfx.shoot();
                    }
                    if (ufo.x < -60 || ufo.x > W + 60) ufo = null;
                }
                for (const r of list) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt; wrap(r, r.r); }
                for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b); }
                // hits
                for (const b of bullets) {
                    if (b.life <= 0) continue;
                    if (b.enemy) {
                        if (ship.alive && Math.hypot(b.x - ship.x, b.y - ship.y) < 14) { b.life = 0; killShip(); }
                        continue;
                    }
                    for (let i = list.length - 1; i >= 0; i--) {
                        if (Math.hypot(b.x - list[i].x, b.y - list[i].y) < list[i].r) { b.life = 0; shatter(list[i], i); break; }
                    }
                    if (b.life > 0 && ufo && Math.hypot(b.x - ufo.x, b.y - ufo.y) < 22) {
                        b.life = 0;
                        if (--ufo.hp <= 0) {
                            score += 500; floaters.add(ufo.x, ufo.y, "+500", "#f0abfc", 20);
                            fx.burst(ufo.x, ufo.y, { n: 50, color: ["#f0abfc", "#fff"], speed: 320 });
                            sfx.boom(); ufo = null;
                        } else sfx.hit();
                    }
                }
                bullets = bullets.filter(b => b.life > 0);
                if (ship.alive) for (const r of list) if (Math.hypot(r.x - ship.x, r.y - ship.y) < r.r + 10) { killShip(); break; }
                api.setScore(score);
                api.setStatus(`Wave ${wave} · ${"▲".repeat(Math.max(0, lives))}`);
            }
            fx.update(dt); shake.update(dt); floaters.update(dt);

            g.save();
            shake.apply(g);
            nebula(g, W, H, 230);
            g.lineJoin = "round";
            // rocks
            for (const r of list) {
                g.save();
                g.translate(r.x, r.y);
                g.rotate(r.rot);
                g.beginPath();
                r.pts.forEach((p, i) => { const a = i / r.pts.length * Math.PI * 2; i ? g.lineTo(Math.cos(a) * r.r * p, Math.sin(a) * r.r * p) : g.moveTo(Math.cos(a) * r.r * p, Math.sin(a) * r.r * p); });
                g.closePath();
                g.fillStyle = "rgba(51,41,97,.65)";
                g.fill();
                g.shadowColor = "#a78bfa"; g.shadowBlur = 10;
                g.strokeStyle = "#c4b5fd"; g.lineWidth = 2;
                g.stroke();
                g.restore();
            }
            if (ufo) {
                g.save();
                g.translate(ufo.x, ufo.y);
                g.shadowColor = "#f0abfc"; g.shadowBlur = 14;
                g.strokeStyle = "#f0abfc"; g.lineWidth = 2; g.fillStyle = "rgba(112,26,117,.6)";
                g.beginPath(); g.ellipse(0, 0, 24, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke();
                g.beginPath(); g.ellipse(0, -7, 10, 8, 0, Math.PI, 0); g.stroke();
                g.restore();
            }
            for (const b of bullets) {
                g.fillStyle = b.enemy ? "#f9a8d4" : "#a5f3fc";
                g.shadowColor = b.enemy ? "#ec4899" : "#22d3ee"; g.shadowBlur = 10;
                g.beginPath(); g.arc(b.x, b.y, 2.6, 0, Math.PI * 2); g.fill();
            }
            g.shadowBlur = 0;
            if (ship.alive && !(ship.inv > 0 && Math.floor(t * 10) % 2)) {
                g.save();
                g.translate(ship.x, ship.y);
                g.rotate(ship.a);
                if (thrustOn) {
                    g.fillStyle = "#fb923c";
                    g.beginPath(); g.moveTo(-10, -5); g.lineTo(-20 - Math.random() * 8, 0); g.lineTo(-10, 5); g.fill();
                }
                g.shadowColor = "#67e8f9"; g.shadowBlur = 14;
                g.strokeStyle = "#e0f2fe"; g.fillStyle = "rgba(14,116,144,.55)"; g.lineWidth = 2;
                g.beginPath(); g.moveTo(16, 0); g.lineTo(-11, -10); g.lineTo(-6, 0); g.lineTo(-11, 10); g.closePath();
                g.fill(); g.stroke();
                g.restore();
            }
            fx.draw(g);
            floaters.draw(g);
            text(g, String(score), 16, 26, 22, "#fff", "left", 900);
            for (let i = 0; i < lives; i++) {
                g.save(); g.translate(W - 20 - i * 22, 26); g.rotate(-Math.PI / 2);
                g.strokeStyle = "#67e8f9"; g.lineWidth = 1.6;
                g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -6); g.lineTo(-3, 0); g.lineTo(-6, 6); g.closePath(); g.stroke();
                g.restore();
            }
            if (!started) titleCard(g, W, H, "Rock Blaster", ["← → turn · ↑ thrust · Space shoot", "Shift = hyperspace jump (risky!)"], t, "#a78bfa");
            g.restore();
        });
    }
};
