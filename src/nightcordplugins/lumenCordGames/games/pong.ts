/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Neon Pong: first to 7 against a computer player. */

import { clamp, GameDef, rand } from "./core";
import { glowCircle, keys, muteButton, nebula, Particles, sfx, Shake, text, titleCard } from "./fx";

const W = 820, H = 500, PH = 92, PW = 14, WIN = 7;

export const pong: GameDef = {
    id: "pong", name: "Neon Pong", icon: "🏓", color: "#38bdf8", category: "Arcade",
    selfSound: true,
    description: "Classic Pong with a neon glow. Hit the ball with a moving paddle to curve it. First to 7 wins!",
    controls: "Mouse, or W/S / ↑ ↓ to move",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        const k = keys(api);
        const fx = new Particles(), shake = new Shake();
        const me = { y: H / 2, vy: 0 }, ai = { y: H / 2, vy: 0, aim: 0, react: 0 };
        const ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, spin: 0 };
        const trail: { x: number; y: number; }[] = [];
        let pScore = 0, aScore = 0, serveT = 1.2, server = 1, started = false, over = false, t = 0, mouseY: number | null = null, rally = 0;

        cv.addEventListener("mousemove", e => { mouseY = toLocal(e).y; });
        cv.addEventListener("mousedown", () => { started = true; });
        api.onKey((e, d) => { if (e.key === " " && d) { started = true; return true; } });

        function serve() {
            ball.x = W / 2; ball.y = H / 2 + rand(-80, 80);
            const a = rand(-.45, .45);
            const sp = 380;
            ball.vx = Math.cos(a) * sp * server; ball.vy = Math.sin(a) * sp; ball.spin = 0;
            rally = 0;
            trail.length = 0;
        }
        function point(toPlayer: boolean) {
            if (toPlayer) pScore++; else aScore++;
            server = toPlayer ? 1 : -1;
            shake.hit(8, .3);
            fx.burst(ball.x < W / 2 ? 0 : W, ball.y, { n: 40, color: toPlayer ? ["#38bdf8", "#fff"] : ["#f472b6", "#fff"], speed: 420, life: .8, size: 3.5 });
            if (toPlayer) sfx.coin(); else sfx.hit();
            if (pScore >= WIN || aScore >= WIN) {
                over = true;
                const won = pScore > aScore;
                won ? sfx.win() : sfx.lose();
                api.later(() => api.end(won ? pScore * 100 - aScore * 10 : pScore * 10, won ? "You win! 🏆" : "The computer wins", `${pScore} : ${aScore}`), 800);
            } else serveT = 1;
            ball.vx = 0; ball.vy = 0; ball.x = W / 2; ball.y = H / 2;
            api.setScore(pScore);
            api.setStatus(`You ${pScore} : ${aScore} Computer`);
        }
        // predict where the ball will cross x (with wall bounces)
        function predict(x: number) {
            if (ball.vx === 0) return H / 2;
            let px = ball.x, py = ball.y, vx = ball.vx, vy = ball.vy;
            for (let i = 0; i < 400 && (vx > 0 ? px < x : px > x); i++) {
                const dt = 1 / 120;
                px += vx * dt; py += vy * dt; vy += ball.spin * dt;
                if (py < 10 || py > H - 10) vy = -vy;
            }
            return py;
        }

        function paddleHit(p: { y: number; vy: number; }, dir: number) {
            const rel = clamp((ball.y - p.y) / (PH / 2), -1, 1);
            rally++;
            const sp = Math.min(900, Math.hypot(ball.vx, ball.vy) * 1.06 + 8);
            const a = rel * .95;
            ball.vx = Math.cos(a) * sp * dir;
            ball.vy = Math.sin(a) * sp + p.vy * .25;
            ball.spin = clamp(p.vy * 1.2, -900, 900);
            sfx.bounce();
            fx.burst(ball.x, ball.y, { n: 18, color: dir > 0 ? ["#38bdf8", "#e0f2fe"] : ["#f472b6", "#fce7f3"], speed: 260, angle: dir > 0 ? 0 : Math.PI, spread: 1, life: .5 });
            if (rally % 5 === 0) shake.hit(3, .1);
        }

        function paddle(x: number, y: number, color: string) {
            g.save();
            g.shadowColor = color; g.shadowBlur = 24;
            const grd = g.createLinearGradient(x, 0, x + PW, 0);
            grd.addColorStop(0, "#fff"); grd.addColorStop(.4, color); grd.addColorStop(1, color);
            g.fillStyle = grd;
            g.beginPath(); g.roundRect(x, y - PH / 2, PW, PH, 7); g.fill();
            g.restore();
        }

        api.setStatus("You 0 : 0 Computer");
        api.loop(dt => {
            t += dt;
            // player paddle
            const prev = me.y;
            if (mouseY != null && !k.has("w", "s", "ArrowUp", "ArrowDown")) me.y += (mouseY - me.y) * Math.min(1, dt * 18);
            else me.y += ((k.has("s", "ArrowDown") ? 1 : 0) - (k.has("w", "ArrowUp") ? 1 : 0)) * 620 * dt;
            me.y = clamp(me.y, PH / 2, H - PH / 2);
            me.vy = (me.y - prev) / Math.max(dt, .001);

            if (started && !over) {
                if (serveT > 0) {
                    serveT -= dt;
                    if (serveT <= 0) serve();
                } else {
                    // computer: re-aims a few times a second with some error, gets sharper as you lead
                    ai.react -= dt;
                    if (ai.react <= 0) {
                        ai.react = rand(.12, .22);
                        const err = Math.max(18, 70 - pScore * 7 + aScore * 6) * (Math.hypot(ball.vx, ball.vy) / 500);
                        ai.aim = ball.vx > 0 ? predict(W - 40) + rand(-err, err) : H / 2 + (ball.y - H / 2) * .3;
                    }
                    const aprev = ai.y;
                    const maxSp = 470 + pScore * 25;
                    ai.y += clamp(ai.aim - ai.y, -maxSp * dt, maxSp * dt);
                    ai.y = clamp(ai.y, PH / 2, H - PH / 2);
                    ai.vy = (ai.y - aprev) / Math.max(dt, .001);

                    ball.vy += ball.spin * dt;
                    ball.spin *= Math.pow(.25, dt);
                    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
                    if (ball.y < 10) { ball.y = 10; ball.vy = Math.abs(ball.vy); sfx.tick(); }
                    if (ball.y > H - 10) { ball.y = H - 10; ball.vy = -Math.abs(ball.vy); sfx.tick(); }
                    if (ball.vx < 0 && ball.x < 40 + PW + 10 && ball.x > 30 && Math.abs(ball.y - me.y) < PH / 2 + 10) { ball.x = 40 + PW + 10; paddleHit(me, 1); }
                    if (ball.vx > 0 && ball.x > W - 40 - PW - 10 && ball.x < W - 30 && Math.abs(ball.y - ai.y) < PH / 2 + 10) { ball.x = W - 40 - PW - 10; paddleHit(ai, -1); }
                    if (ball.x < -20) point(false);
                    if (ball.x > W + 20) point(true);
                    trail.push({ x: ball.x, y: ball.y });
                    if (trail.length > 16) trail.shift();
                }
            }
            fx.update(dt); shake.update(dt);

            g.save();
            shake.apply(g);
            nebula(g, W, H, 220);
            // scores behind everything
            text(g, String(pScore), W / 2 - 90, 70, 72, "rgba(56,189,248,.35)", "center", 900, "#38bdf8");
            text(g, String(aScore), W / 2 + 90, 70, 72, "rgba(244,114,182,.35)", "center", 900, "#f472b6");
            // centre line
            g.setLineDash([14, 14]);
            g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 4;
            g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
            g.setLineDash([]);
            g.strokeStyle = "rgba(255,255,255,.08)"; g.lineWidth = 2;
            g.beginPath(); g.arc(W / 2, H / 2, 70, 0, Math.PI * 2); g.stroke();
            paddle(40, me.y, "#38bdf8");
            paddle(W - 40 - PW, ai.y, "#f472b6");
            trail.forEach((p, i) => { g.globalAlpha = i / trail.length * .5; glowCircle(g, p.x, p.y, 3 + i * .4, "#fde68a", 10); });
            g.globalAlpha = 1;
            if (serveT <= 0 || over) glowCircle(g, ball.x, ball.y, 9, "#fde047", 30);
            else if (started) text(g, String(Math.ceil(serveT)), W / 2, H / 2, 48, "#fff", "center", 900);
            fx.draw(g);
            text(g, "YOU", 70, H - 18, 13, "#7dd3fc", "left", 800, "#000");
            text(g, "COMPUTER", W - 70, H - 18, 13, "#f9a8d4", "right", 800, "#000");
            if (!started) titleCard(g, W, H, "Neon Pong", ["Move with your mouse (or W/S)", "Hit with a moving paddle to curve the ball · first to 7"], t, "#38bdf8");
            g.restore();
        });
    }
};
