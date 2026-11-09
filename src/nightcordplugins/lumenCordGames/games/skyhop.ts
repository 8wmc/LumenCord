/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Sky Hopper: Doodle Jump style endless climber. */

import { GameDef, pick, rand } from "./core";
import { Floaters, glowCircle, keys, muteButton, nebula, Particles, sfx, StarLayers, text, titleCard } from "./fx";

const W = 480, H = 620;
type PType = "normal" | "moving" | "crumble" | "cloud";
interface Plat { x: number; y: number; w: number; type: PType; vx: number; broken: boolean; spring: boolean; jet: boolean; crumbleT: number; }
interface Monster { x: number; y: number; vx: number; dead: boolean; }

export const skyHop: GameDef = {
    id: "skyhop", name: "Sky Hopper", icon: "🦘", color: "#a78bfa", category: "Arcade", selfSound: true,
    description: "Doodle Jump style! Bounce up from platform to platform. Use springs and jetpacks, avoid black holes.",
    controls: "← → or A D (or move your mouse) · go off one side to come out the other",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        const k = keys(api);
        const fx = new Particles(), floaters = new Floaters();
        const stars = new StarLayers(W, H, [60, 30, 12]);
        const p = { x: W / 2, y: H - 120, vx: 0, vy: -900, face: 1, jet: 0, squash: 0 };
        let plats: Plat[] = [], monsters: Monster[] = [], camY = 0, height = 0, t = 0, started = false, over = false, mouseX: number | null = null, topY = H;

        function addPlat(y: number) {
            const h = -y + H;
            const diff = Math.min(1, h / 20000);
            const r = Math.random();
            const type: PType = h < 600 ? "normal" : r < .16 + diff * .2 ? "moving" : r < .26 + diff * .14 ? "crumble" : r < .3 + diff * .1 ? "cloud" : "normal";
            const w = 70 - diff * 14;
            const pl: Plat = { x: rand(0, W - w), y, w, type, vx: type === "moving" ? pick([-1, 1]) * rand(50, 110 + diff * 60) : 0, broken: false, spring: false, jet: false, crumbleT: 0 };
            if (type === "normal" || type === "moving") { const q = Math.random(); if (q < .07) pl.spring = true; else if (q < .085 && h > 1500) pl.jet = true; }
            plats.push(pl);
            if (h > 2500 && Math.random() < .04 + diff * .05) monsters.push({ x: rand(30, W - 30), y: y - rand(60, 120), vx: rand(-40, 40), dead: false });
        }
        // first screen
        plats.push({ x: W / 2 - 40, y: H - 40, w: 80, type: "normal", vx: 0, broken: false, spring: false, jet: false, crumbleT: 0 });
        topY = H - 40;
        while (topY > -H) { topY -= rand(55, 85); addPlat(topY); }

        cv.addEventListener("mousemove", e => { mouseX = toLocal(e).x; });
        cv.addEventListener("mousedown", () => { started = true; });
        api.onKey((e, d) => { if (d && e.key === " " && !started) { started = true; return true; } });

        function drawPlat(pl: Plat) {
            const y = pl.y - camY;
            if (pl.broken) return;
            const col = pl.type === "moving" ? "#38bdf8" : pl.type === "crumble" ? "#a16207" : pl.type === "cloud" ? "#f8fafc" : "#4ade80";
            g.save();
            if (pl.type === "cloud") {
                g.globalAlpha = .9;
                g.fillStyle = "#f8fafc";
                for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(pl.x + 12 + i * (pl.w - 24) / 3, y + 6 + (i % 2 ? -3 : 2), 11, 0, Math.PI * 2); g.fill(); }
            } else {
                const shake = pl.crumbleT > 0 ? rand(-2, 2) : 0;
                g.shadowColor = col; g.shadowBlur = 12;
                const grd = g.createLinearGradient(0, y, 0, y + 14);
                grd.addColorStop(0, "#fff"); grd.addColorStop(.25, col); grd.addColorStop(1, "#0f172a");
                g.fillStyle = grd;
                g.beginPath(); g.roundRect(pl.x + shake, y, pl.w, 14, 7); g.fill();
                if (pl.type === "crumble") { g.strokeStyle = "#451a03"; g.lineWidth = 2; g.beginPath(); g.moveTo(pl.x + pl.w * .3, y); g.lineTo(pl.x + pl.w * .4, y + 14); g.moveTo(pl.x + pl.w * .7, y); g.lineTo(pl.x + pl.w * .6, y + 14); g.stroke(); }
            }
            g.restore();
            if (pl.spring) {
                g.strokeStyle = "#e2e8f0"; g.lineWidth = 3;
                g.beginPath(); for (let i = 0; i < 4; i++) { g.lineTo(pl.x + pl.w / 2 - 6 + (i % 2) * 12, y - 4 - i * 4); } g.stroke();
                g.fillStyle = "#f43f5e"; g.fillRect(pl.x + pl.w / 2 - 9, y - 20, 18, 5);
            }
            if (pl.jet) {
                g.fillStyle = "#94a3b8"; g.beginPath(); g.roundRect(pl.x + pl.w / 2 - 9, y - 26, 8, 22, 3); g.roundRect(pl.x + pl.w / 2 + 1, y - 26, 8, 22, 3); g.fill();
                g.fillStyle = "#fb923c"; g.fillRect(pl.x + pl.w / 2 - 8, y - 6, 16, 3);
            }
        }

        function drawHero() {
            const x = p.x, y = p.y - camY;
            const sq = p.squash > 0 ? 1 - p.squash * 1.6 : 1;
            g.save();
            g.translate(x, y);
            g.scale(p.face * (2 - sq), sq);
            if (p.jet > 0) {
                g.fillStyle = "#94a3b8"; g.fillRect(-20, -6, 10, 22);
                g.fillStyle = Math.random() < .5 ? "#fb923c" : "#fde047";
                g.beginPath(); g.moveTo(-20, 16); g.lineTo(-15, 30 + rand(0, 12)); g.lineTo(-10, 16); g.fill();
            }
            g.shadowColor = "#a78bfa"; g.shadowBlur = 14;
            const grd = g.createLinearGradient(0, -22, 0, 18);
            grd.addColorStop(0, "#ede9fe"); grd.addColorStop(.5, "#a78bfa"); grd.addColorStop(1, "#5b21b6");
            g.fillStyle = grd;
            g.beginPath(); g.roundRect(-14, -20, 28, 34, 12); g.fill();
            g.shadowBlur = 0;
            // snout + eyes
            g.fillStyle = "#c4b5fd"; g.fillRect(10, -6, 12, 9);
            g.fillStyle = "#fff"; g.beginPath(); g.arc(4, -9, 5, 0, Math.PI * 2); g.fill();
            g.fillStyle = "#1e1b4b"; g.beginPath(); g.arc(6, -9, 2.4, 0, Math.PI * 2); g.fill();
            // legs
            g.strokeStyle = "#4c1d95"; g.lineWidth = 3;
            for (const lx of [-7, 3, 9]) { g.beginPath(); g.moveTo(lx, 14); g.lineTo(lx, 20); g.stroke(); }
            g.restore();
        }

        api.loop(dt => {
            t += dt;
            if (started && !over) {
                // steering
                let steer = (k.has("ArrowRight", "d") ? 1 : 0) - (k.has("ArrowLeft", "a") ? 1 : 0);
                if (!steer && mouseX != null) steer = Math.max(-1, Math.min(1, (mouseX - p.x) / 60));
                p.vx += (steer * 380 - p.vx) * Math.min(1, dt * 9);
                if (Math.abs(steer) > .1) p.face = steer > 0 ? 1 : -1;
                p.x += p.vx * dt;
                if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
                if (p.jet > 0) { p.jet -= dt; p.vy = -1300; if (Math.random() < .6) fx.burst(p.x - 15 * p.face, p.y + 20, { n: 2, color: ["#fb923c", "#fde047"], speed: 140, angle: Math.PI / 2, spread: .4, life: .4 }); }
                else p.vy += 1650 * dt;
                const prevY = p.y;
                p.y += p.vy * dt;
                p.squash = Math.max(0, p.squash - dt);
                // landing (only when falling)
                if (p.vy > 0 && p.jet <= 0) {
                    for (const pl of plats) {
                        if (pl.broken) continue;
                        if (p.x + 12 > pl.x && p.x - 12 < pl.x + pl.w && prevY + 18 <= pl.y && p.y + 18 >= pl.y) {
                            if (pl.type === "crumble") { pl.crumbleT = .01; pl.broken = true; sfx.hit(); fx.burst(pl.x + pl.w / 2, pl.y, { n: 14, color: "#a16207", speed: 140, gravity: 600 }); continue; }
                            p.y = pl.y - 18;
                            if (pl.jet) { p.jet = 2.2; pl.jet = false; sfx.power(); floaters.add(p.x, p.y - camY - 40, "JETPACK!", "#fb923c"); }
                            else if (pl.spring && p.x > pl.x + pl.w / 2 - 16 && p.x < pl.x + pl.w / 2 + 16) { p.vy = -1650; sfx.power(); }
                            else { p.vy = -880; sfx.jump(); }
                            p.squash = .12;
                            if (pl.type === "cloud") { pl.broken = true; fx.burst(pl.x + pl.w / 2, pl.y, { n: 20, color: "#f8fafc", speed: 120 }); }
                            break;
                        }
                    }
                }
                for (const pl of plats) if (pl.type === "moving") { pl.x += pl.vx * dt; if (pl.x < 0 || pl.x + pl.w > W) pl.vx = -pl.vx; }
                // monsters (black holes): stomp from above, otherwise game over
                for (const m of monsters) {
                    if (m.dead) continue;
                    m.x += m.vx * dt; if (m.x < 30 || m.x > W - 30) m.vx = -m.vx;
                    if (Math.hypot(m.x - p.x, m.y - p.y) < 34) {
                        if (p.vy > 0 || p.jet > 0) { m.dead = true; p.vy = -950; score(400, "STOMP! +400"); sfx.boom(); fx.burst(m.x, m.y, { n: 40, color: ["#7c3aed", "#000", "#f0abfc"], speed: 260 }); }
                        else { over = true; sfx.lose(); api.later(() => api.end(Math.floor(height), "Sucked into a black hole!", `You climbed ${Math.floor(height)} m`), 800); }
                    }
                }
                // camera follows when you go above the middle
                if (p.y - camY < H * .42) camY = p.y - H * .42;
                height = Math.max(height, (H - 120 - p.y) / 10);
                while (topY > camY - 100) { topY -= rand(55, 80 + Math.min(70, height / 30)); addPlat(topY); }
                plats = plats.filter(pl => pl.y - camY < H + 40);
                monsters = monsters.filter(m => m.y - camY < H + 60);
                if (p.y - camY > H + 40) { over = true; sfx.lose(); api.later(() => api.end(Math.floor(height), "You fell!", `You climbed ${Math.floor(height)} m`), 300); }
                api.setScore(Math.floor(height));
            }
            fx.update(dt); floaters.update(dt);

            nebula(g, W, H, 255);
            stars.draw(g, 0, camY * .5);
            g.save();
            plats.forEach(drawPlat);
            for (const m of monsters) {
                if (m.dead) continue;
                const y = m.y - camY;
                g.save();
                g.translate(m.x, y); g.rotate(t * 3);
                for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(192,132,252,${.6 - i * .15})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 18 + i * 7, i, i + 4); g.stroke(); }
                g.restore();
                glowCircle(g, m.x, y, 14, "#7c3aed", 30, "#000000");
            }
            g.restore();
            g.save(); g.translate(0, -camY); fx.draw(g); g.restore();
            drawHero();
            floaters.draw(g);
            text(g, `${Math.floor(height)} m`, 16, 28, 22, "#fff", "left", 900);
            if (!started) titleCard(g, W, H, "Sky Hopper", ["Steer with ← → or your mouse", "Springs 🔼 · jetpacks 🚀 · stomp black holes"], t, "#a78bfa");
        });
        function score(n: number, msg: string) { height += n / 10; floaters.add(p.x, p.y - camY - 30, msg, "#f0abfc"); }
    }
};
