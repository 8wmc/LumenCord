/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Flappy Comet: tap to flap through crystal pillars (Flappy Bird style). */

import { GameDef, rand } from "./core";
import { glowCircle, muteButton, nebula, Particles, sfx, Shake, StarLayers, text, titleCard } from "./fx";

const W = 800, H = 500, FLOOR = 452;

export const flappy: GameDef = {
    id: "flappy", name: "Flappy Comet", icon: "☄️", color: "#f472b6", category: "Arcade",
    selfSound: true,
    description: "Tap to flap your comet through the gaps between crystal pillars. One touch and it's over!",
    controls: "Click, Space or ↑ to flap",
    start(api) {
        const { cv, g } = api.canvas(W, H);
        muteButton(api);
        const stars = new StarLayers(W, FLOOR);
        const fx = new Particles(), shake = new Shake();
        const bird = { x: 220, y: H / 2 - 30, vy: 0, rot: 0 };
        let pipes: { x: number; gap: number; size: number; passed: boolean; hue: number; }[] = [];
        let state: "ready" | "play" | "dead" = "ready";
        let t = 0, scroll = 0, score = 0, flash = 0, deadT = 0;
        const trail: { x: number; y: number; }[] = [];

        const GRAV = 1500, FLAP = -430;
        const speed = () => 190 + Math.min(110, score * 3);

        function flap() {
            if (state === "dead") return;
            if (state === "ready") state = "play";
            bird.vy = FLAP;
            sfx.flap();
            fx.burst(bird.x - 10, bird.y + 6, { n: 6, color: ["#f9a8d4", "#fde68a"], speed: 120, angle: Math.PI * .75, spread: .5, life: .4, size: 2.5 });
        }
        cv.addEventListener("mousedown", flap);
        api.onKey((e, down) => {
            if ([" ", "ArrowUp", "w", "W"].includes(e.key)) { if (down && !e.repeat) flap(); return true; }
        });

        function spawnPipe(x: number) {
            const size = Math.max(128, 170 - score * 1.5);
            pipes.push({ x, gap: rand(90 + size / 2, FLOOR - 70 - size / 2), size, passed: false, hue: rand(260, 330) });
        }
        for (let i = 0; i < 4; i++) spawnPipe(W + 200 + i * 270);

        function die() {
            if (state !== "play") return;
            state = "dead";
            deadT = 0;
            flash = 1;
            shake.hit(9, .35);
            sfx.hit();
            fx.burst(bird.x, bird.y, { n: 50, color: ["#f9a8d4", "#fde68a", "#fff", "#c084fc"], speed: 380, life: 1, size: 3.5, gravity: 400 });
            const medal = score >= 60 ? "💎 Platinum" : score >= 40 ? "🥇 Gold" : score >= 20 ? "🥈 Silver" : score >= 10 ? "🥉 Bronze" : null;
            api.later(() => api.end(score, "Crashed!", medal ? `${medal} medal!` : "Get 10 for a bronze medal."), 900);
        }

        function drawPillar(x: number, top: number, bottom: number, hue: number, cap: "top" | "bottom") {
            const w = 74;
            const grd = g.createLinearGradient(x, 0, x + w, 0);
            grd.addColorStop(0, `hsl(${hue} 70% 22%)`);
            grd.addColorStop(.35, `hsl(${hue} 80% 52%)`);
            grd.addColorStop(.55, `hsl(${hue} 90% 70%)`);
            grd.addColorStop(1, `hsl(${hue} 70% 25%)`);
            g.fillStyle = grd;
            g.fillRect(x, top, w, bottom - top);
            // facets
            g.strokeStyle = `hsla(${hue} 100% 85% / .25)`;
            g.lineWidth = 1;
            for (let yy = top + 30; yy < bottom; yy += 46) {
                g.beginPath(); g.moveTo(x + 6, yy); g.lineTo(x + w - 6, yy + 18); g.stroke();
            }
            // crystal cap
            const cy = cap === "top" ? bottom : top;
            const dir = cap === "top" ? 1 : -1;
            g.fillStyle = `hsl(${hue} 95% 72%)`;
            g.shadowColor = `hsl(${hue} 100% 70%)`;
            g.shadowBlur = 18;
            g.beginPath();
            g.moveTo(x - 8, cy - dir * 22);
            g.lineTo(x + w + 8, cy - dir * 22);
            g.lineTo(x + w + 2, cy);
            g.lineTo(x + w / 2, cy + dir * 12);
            g.lineTo(x - 2, cy);
            g.closePath();
            g.fill();
            g.shadowBlur = 0;
            g.fillStyle = "rgba(255,255,255,.35)";
            g.fillRect(x + 12, cap === "top" ? top : top + 22, 6, bottom - top - 22);
        }

        function drawComet() {
            // trail
            for (let i = 0; i < trail.length; i++) {
                const p = trail[i], k = i / trail.length;
                g.globalAlpha = k * .55;
                glowCircle(g, p.x, p.y, 3 + k * 9, "#f472b6", 6 + k * 16);
            }
            g.globalAlpha = 1;
            g.save();
            g.translate(bird.x, bird.y);
            g.rotate(bird.rot);
            glowCircle(g, 0, 0, 15, "#f9a8d4", 42, "#fff7d6");
            // face
            g.fillStyle = "#fff";
            g.beginPath(); g.arc(6, -4, 5, 0, Math.PI * 2); g.fill();
            g.fillStyle = "#1e1b4b";
            g.beginPath(); g.arc(7.5, -4, 2.5, 0, Math.PI * 2); g.fill();
            g.fillStyle = "#fb7185";
            g.beginPath(); g.moveTo(10, 3); g.lineTo(20, 5); g.lineTo(10, 8); g.closePath(); g.fill();
            g.restore();
        }

        function drawFloor() {
            g.fillStyle = "#12082b";
            g.fillRect(0, FLOOR, W, H - FLOOR);
            g.strokeStyle = "#e879f9";
            g.shadowColor = "#e879f9";
            g.shadowBlur = 12;
            g.lineWidth = 3;
            g.beginPath(); g.moveTo(0, FLOOR); g.lineTo(W, FLOOR); g.stroke();
            g.shadowBlur = 0;
            g.strokeStyle = "rgba(232,121,249,.35)";
            g.lineWidth = 1;
            for (let i = 1; i < 5; i++) {
                const y = FLOOR + i * i * 3;
                g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
            }
            const off = scroll % 40;
            for (let x = -off - 400; x < W + 400; x += 40) {
                g.beginPath(); g.moveTo(x, FLOOR); g.lineTo(W / 2 + (x - W / 2) * 3, H); g.stroke();
            }
        }

        api.loop(dt => {
            t += dt;
            const sp = state === "play" ? speed() : state === "ready" ? 120 : 0;
            scroll += sp * dt;
            if (state === "ready") {
                bird.y = H / 2 - 30 + Math.sin(t * 3) * 10;
                bird.rot = 0;
            } else {
                bird.vy += GRAV * dt;
                bird.y += bird.vy * dt;
                bird.rot = Math.max(-.5, Math.min(1.3, bird.vy / 600));
                if (bird.y > FLOOR - 15) { bird.y = FLOOR - 15; bird.vy = 0; die(); }
                if (bird.y < -40) bird.y = -40;
            }
            if (state === "play") {
                for (const p of pipes) {
                    p.x -= sp * dt;
                    if (!p.passed && p.x + 74 < bird.x) {
                        p.passed = true;
                        score++;
                        api.setScore(score);
                        sfx.point();
                        fx.burst(bird.x, bird.y, { n: 10, color: "#fde68a", speed: 160, life: .5, size: 2 });
                    }
                    // collision (circle vs pillar rects)
                    const r = 13, top = p.gap - p.size / 2, bot = p.gap + p.size / 2;
                    const cx = Math.max(p.x - 8, Math.min(bird.x, p.x + 82));
                    if (Math.abs(cx - bird.x) < r && (bird.y - r < top || bird.y + r > bot)) die();
                }
                if (pipes[0].x < -100) { pipes.shift(); spawnPipe(pipes[pipes.length - 1].x + 270); }
            }
            if (state !== "dead") {
                trail.push({ x: bird.x - 6, y: bird.y });
                for (const p of trail) p.x -= sp * dt;
                if (trail.length > 18) trail.shift();
                if (Math.random() < .5) fx.burst(bird.x - 12, bird.y, { n: 1, color: ["#f9a8d4", "#fde68a"], speed: 40, angle: Math.PI, spread: .4, life: .5, size: 2 });
            } else deadT += dt;
            fx.update(dt);
            shake.update(dt);
            flash = Math.max(0, flash - dt * 3);

            // ── draw ──
            g.save();
            shake.apply(g);
            nebula(g, W, H, 275);
            stars.draw(g, scroll * .3);
            // planet
            const px = ((700 - scroll * .05) % (W + 300) + W + 300) % (W + 300) - 150;
            glowCircle(g, px, 120, 46, "#8b5cf6", 110, "#e9d5ff");
            g.strokeStyle = "rgba(233,213,255,.55)";
            g.lineWidth = 3;
            g.beginPath(); g.ellipse(px, 120, 80, 14, -.3, 0, Math.PI * 2); g.stroke();
            for (const p of pipes) {
                drawPillar(p.x, -10, p.gap - p.size / 2, p.hue, "top");
                drawPillar(p.x, p.gap + p.size / 2, FLOOR, p.hue, "bottom");
            }
            drawFloor();
            drawComet();
            fx.draw(g);
            if (state !== "ready") text(g, String(score), W / 2, 60, 52, "#fff", "center", 900, "#e879f9");
            if (state === "ready") titleCard(g, W, H, "Flappy Comet", ["Flap through the gaps between the crystals", "Medals at 10, 20, 40 and 60"], t, "#f472b6");
            if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * .6})`; g.fillRect(0, 0, W, H); }
            g.restore();
        });
    }
};
