/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Retro Snake, Stack Tower, Jet Dash */

import { GameDef, pick, rand, randInt } from "./core";
import { Floaters, glowCircle, hsl, muteButton, nebula, Particles, sfx, Shake, StarLayers, text, titleCard } from "./fx";

// ───────────────────────── Retro Snake ─────────────────────────
export const retroSnake: GameDef = {
    id: "retrosnake", name: "Retro Snake", icon: "🟩", color: "#22c55e", category: "Arcade", selfSound: true,
    description: "The classic! Eat apples to grow, don't hit the walls or yourself. Golden apples are worth extra.",
    controls: "Arrow keys / WASD",
    start(api) {
        const C = 24, R = 18, S = 26, W = C * S, H = R * S + 40;
        const { cv, g } = api.canvas(W, H);
        muteButton(api);
        const fx = new Particles(), floaters = new Floaters();
        let snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }, { x: 5, y: 9 }];
        let dir = { x: 1, y: 0 }, queue: { x: number; y: number; }[] = [], apple = { x: 16, y: 9, gold: false, t: 0 };
        let stepT = 0, interval = .12, score = 0, t = 0, started = false, over = false, grow = 0;
        const place = () => {
            let p: { x: number; y: number; };
            do p = { x: randInt(0, C - 1), y: randInt(0, R - 1) }; while (snake.some(s => s.x === p.x && s.y === p.y));
            apple = { ...p, gold: Math.random() < .12, t: 0 };
        };
        api.onKey((e, d) => {
            if (!d) return;
            const map: Record<string, [number, number]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
            const m = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
            if (e.key === " " && !started) { started = true; return true; }
            if (!m) return;
            if (!started) started = true;
            const last = queue.length ? queue[queue.length - 1] : dir;
            if ((m[0] !== -last.x || m[1] !== -last.y) && (m[0] !== last.x || m[1] !== last.y) && queue.length < 3) queue.push({ x: m[0], y: m[1] });
            return true;
        });
        cv.addEventListener("mousedown", () => { started = true; });

        api.loop(dt => {
            t += dt;
            fx.update(dt); floaters.update(dt);
            apple.t += dt;
            if (started && !over) {
                stepT += dt;
                while (stepT >= interval && !over) {
                    stepT -= interval;
                    if (queue.length) dir = queue.shift()!;
                    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
                    if (head.x < 0 || head.y < 0 || head.x >= C || head.y >= R || snake.slice(0, -1).some(s => s.x === head.x && s.y === head.y)) {
                        over = true;
                        sfx.hit();
                        fx.burst(snake[0].x * S + S / 2, snake[0].y * S + S / 2 + 40, { n: 40, color: ["#4ade80", "#fff"], speed: 260 });
                        api.later(() => api.end(score, head.x < 0 || head.y < 0 || head.x >= C || head.y >= R ? "You hit the wall!" : "You bit yourself!", `Length ${snake.length}`), 700);
                        break;
                    }
                    snake.unshift(head);
                    if (head.x === apple.x && head.y === apple.y) {
                        const pts = apple.gold ? 50 : 10;
                        score += pts; grow += apple.gold ? 3 : 1;
                        sfx.coin();
                        floaters.add(apple.x * S + S / 2, apple.y * S + 40, `+${pts}`, apple.gold ? "#fde047" : "#86efac", 16);
                        fx.burst(apple.x * S + S / 2, apple.y * S + S / 2 + 40, { n: 16, color: apple.gold ? "#fde047" : "#f87171", speed: 180, life: .5 });
                        interval = Math.max(.055, interval * .975);
                        place();
                        api.setScore(score);
                    }
                    if (grow > 0) grow--; else snake.pop();
                }
            }
            // draw
            g.fillStyle = "#07140c"; g.fillRect(0, 0, W, H);
            for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { g.fillStyle = (x + y) % 2 ? "#0c2416" : "#0a1f13"; g.fillRect(x * S, y * S + 40, S, S); }
            g.strokeStyle = "#22c55e"; g.lineWidth = 2; g.shadowColor = "#22c55e"; g.shadowBlur = 10;
            g.strokeRect(1, 41, W - 2, H - 42); g.shadowBlur = 0;
            // apple
            const ax = apple.x * S + S / 2, ay = apple.y * S + S / 2 + 40, bob = Math.sin(apple.t * 6) * 1.5;
            glowCircle(g, ax, ay + bob, S * .36, apple.gold ? "#fde047" : "#ef4444", S * .9);
            g.fillStyle = "#65a30d"; g.beginPath(); g.ellipse(ax + 4, ay - S * .38 + bob, 5, 2.5, -.5, 0, Math.PI * 2); g.fill();
            // snake, smoothly between steps
            const k = started && !over ? Math.min(1, stepT / interval) : 0;
            for (let i = snake.length - 1; i >= 0; i--) {
                const s = snake[i];
                // the head glides into its new square; the body sits on the grid
                const px = i === 0 ? s.x - dir.x * (1 - k) : s.x;
                const py = i === 0 ? s.y - dir.y * (1 - k) : s.y;
                const x = px * S, y = py * S + 40;
                const l = 60 - (i / snake.length) * 25;
                g.fillStyle = hsl(140 - i * 1.2, 80, l);
                g.beginPath(); g.roundRect(x + 2, y + 2, S - 4, S - 4, i === 0 ? 9 : 6); g.fill();
                g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x + 5, y + 4, S - 10, 3);
                if (i === 0) {
                    g.fillStyle = "#fff";
                    const ex = dir.x * 4, ey = dir.y * 4;
                    for (const sgn of [-1, 1]) {
                        const ox = S / 2 + ex + (dir.y ? sgn * 5 : 0), oy = S / 2 + ey + (dir.x ? sgn * 5 : 0);
                        g.fillStyle = "#fff"; g.beginPath(); g.arc(x + ox, y + oy, 3.4, 0, Math.PI * 2); g.fill();
                        g.fillStyle = "#052e16"; g.beginPath(); g.arc(x + ox + dir.x, y + oy + dir.y, 1.7, 0, Math.PI * 2); g.fill();
                    }
                }
            }
            fx.draw(g); floaters.draw(g);
            text(g, `🍎 ${score}`, 12, 20, 18, "#fff", "left", 900, "#22c55e");
            text(g, `Length ${snake.length}`, W - 12, 20, 15, "#86efac", "right", 700, "#000");
            if (!started) titleCard(g, W, H, "Retro Snake", ["Arrow keys to turn", "Golden apples = +50 and extra length"], t, "#22c55e");
        });
    }
};

// ───────────────────────── Stack Tower ─────────────────────────
export const stackTower: GameDef = {
    id: "stack", name: "Stack Tower", icon: "🏗️", color: "#f59e0b", category: "Arcade", selfSound: true,
    description: "Drop each sliding block right on top of the last one. Whatever hangs over gets chopped off!",
    controls: "Click or Space to drop",
    start(api) {
        const W = 520, H = 620;
        const { cv, g } = api.canvas(W, H);
        muteButton(api);
        const fx = new Particles(), floaters = new Floaters();
        const BH = 22;
        interface Blk { x: number; z: number; w: number; d: number; y: number; hue: number; }
        let stack: Blk[] = [{ x: 0, z: 0, w: 160, d: 160, y: 0, hue: 30 }];
        let moving: Blk | null = null, axis: "x" | "z" = "x", dir = 1, speed = 160, camY = 0, t = 0, started = false, over = false, perfect = 0;
        let falling: (Blk & { vy: number; fy: number; })[] = [];
        // isometric projection
        const iso = (x: number, y: number, z: number) => ({ x: W / 2 + (x - z) * .86, y: H * .62 + (x + z) * .5 - (y - camY) });
        function drawBox(b: Blk, yy: number, alpha = 1) {
            const top = [iso(b.x - b.w / 2, yy + BH, b.z - b.d / 2), iso(b.x + b.w / 2, yy + BH, b.z - b.d / 2), iso(b.x + b.w / 2, yy + BH, b.z + b.d / 2), iso(b.x - b.w / 2, yy + BH, b.z + b.d / 2)];
            const bottomR = iso(b.x + b.w / 2, yy, b.z + b.d / 2), bottomL = iso(b.x - b.w / 2, yy, b.z + b.d / 2), bottomB = iso(b.x + b.w / 2, yy, b.z - b.d / 2);
            g.globalAlpha = alpha;
            g.fillStyle = hsl(b.hue, 70, 62);
            g.beginPath(); top.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fill();
            g.fillStyle = hsl(b.hue, 65, 45);
            g.beginPath(); g.moveTo(top[3].x, top[3].y); g.lineTo(top[2].x, top[2].y); g.lineTo(bottomR.x, bottomR.y); g.lineTo(bottomL.x, bottomL.y); g.closePath(); g.fill();
            g.fillStyle = hsl(b.hue, 60, 34);
            g.beginPath(); g.moveTo(top[2].x, top[2].y); g.lineTo(top[1].x, top[1].y); g.lineTo(bottomB.x, bottomB.y); g.lineTo(bottomR.x, bottomR.y); g.closePath(); g.fill();
            g.globalAlpha = 1;
        }
        function spawn() {
            const top = stack[stack.length - 1];
            axis = stack.length % 2 ? "x" : "z";
            dir = 1;
            moving = { ...top, y: top.y + BH, hue: (top.hue + 9) % 360 };
            if (axis === "x") moving.x = -220; else moving.z = -220;
            speed = Math.min(420, 160 + stack.length * 6);
        }
        function drop() {
            if (!started) { started = true; spawn(); return; }
            if (!moving || over) return;
            const top = stack[stack.length - 1];
            const delta = axis === "x" ? moving.x - top.x : moving.z - top.z;
            const size = axis === "x" ? top.w : top.d;
            const overlap = size - Math.abs(delta);
            if (overlap <= 0) {
                falling.push({ ...moving, vy: 0, fy: moving.y });
                moving = null; over = true; sfx.lose();
                api.later(() => api.end(stack.length - 1, "Missed!", `Your tower: ${stack.length - 1} blocks`), 900);
                return;
            }
            if (Math.abs(delta) < 4) {
                // perfect: snap, and grow back a little after a streak
                perfect++;
                if (axis === "x") moving.x = top.x; else moving.z = top.z;
                if (perfect >= 3) { if (axis === "x") moving.w = Math.min(160, moving.w + 10); else moving.d = Math.min(160, moving.d + 10); }
                sfx.coin();
                floaters.add(W / 2, 140, perfect >= 3 ? `PERFECT ×${perfect}` : "PERFECT", "#fde047", 22);
                const c = iso(moving.x, moving.y + BH, moving.z);
                fx.burst(c.x, c.y, { n: 24, color: ["#fff", "#fde047"], speed: 220, life: .6 });
            } else {
                perfect = 0;
                sfx.place();
                const cut = Math.abs(delta);
                const piece: Blk = { ...moving };
                if (axis === "x") { moving.w = overlap; moving.x = top.x + delta / 2; piece.w = cut; piece.x = moving.x + Math.sign(delta) * (overlap / 2 + cut / 2); }
                else { moving.d = overlap; moving.z = top.z + delta / 2; piece.d = cut; piece.z = moving.z + Math.sign(delta) * (overlap / 2 + cut / 2); }
                falling.push({ ...piece, vy: 0, fy: piece.y });
            }
            stack.push(moving);
            moving = null;
            api.setScore(stack.length - 1);
            spawn();
        }
        cv.addEventListener("mousedown", drop);
        api.onKey((e, d) => { if (e.key === " ") { if (d && !e.repeat) drop(); return true; } });
        api.loop(dt => {
            t += dt;
            if (moving && !over) {
                const v = (axis === "x" ? moving.x : moving.z) + dir * speed * dt;
                if (v > 220) dir = -1; if (v < -220) dir = 1;
                if (axis === "x") moving.x = v; else moving.z = v;
            }
            for (const f of falling) { f.vy += 900 * dt; f.fy -= f.vy * dt; }
            falling = falling.filter(f => f.fy > camY - 500);
            camY += (Math.max(0, (stack.length - 7) * BH) - camY) * Math.min(1, dt * 4);
            fx.update(dt); floaters.update(dt);
            const top = stack[stack.length - 1];
            const bg = g.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, hsl((top.hue + 200) % 360, 45, 18)); bg.addColorStop(1, hsl((top.hue + 230) % 360, 50, 8));
            g.fillStyle = bg; g.fillRect(0, 0, W, H);
            for (let i = Math.max(0, stack.length - 30); i < stack.length; i++) drawBox(stack[i], stack[i].y);
            if (moving) drawBox(moving, moving.y);
            for (const f of falling) drawBox(f, f.fy, .85);
            fx.draw(g); floaters.draw(g);
            text(g, String(stack.length - 1), W / 2, 70, 56, "#fff", "center", 900, "#f59e0b");
            if (!started) titleCard(g, W, H, "Stack Tower", ["Click when the block lines up", "3 perfect drops in a row grow it back"], t, "#f59e0b");
        });
    }
};

// ───────────────────────── Jet Dash ─────────────────────────
export const jetDash: GameDef = {
    id: "jetdash", name: "Jet Dash", icon: "🧑‍🚀", color: "#38bdf8", category: "Arcade", selfSound: true,
    description: "Jetpack Joyride style! Hold to fly, let go to fall. Dodge zappers and missiles, collect coins.",
    controls: "Hold click or Space to fly",
    start(api) {
        const W = 860, H = 500, FLOOR = H - 40, CEIL = 40;
        const { cv, g } = api.canvas(W, H);
        muteButton(api);
        const fx = new Particles(), shake = new Shake(), floaters = new Floaters();
        const stars = new StarLayers(W, H);
        const p = { x: 180, y: FLOOR - 30, vy: 0 };
        interface Zap { x: number; y: number; len: number; ang: number; spin: number; }
        interface Missile { y: number; x: number; warn: number; }
        let zaps: Zap[] = [], missiles: Missile[] = [], coins: { x: number; y: number; got: boolean; }[] = [];
        let dist = 0, coinCount = 0, speed = 330, t = 0, started = false, over = false, holding = false, nextZap = 500, missileT = 6;
        const press = (d: boolean) => { holding = d; if (d && !started) started = true; };
        cv.addEventListener("mousedown", () => press(true));
        const mu = () => { holding = false; };
        window.addEventListener("mouseup", mu);
        api.cleanup(() => window.removeEventListener("mouseup", mu));
        api.onKey((e, d) => { if (e.key === " " || e.key === "ArrowUp") { press(d); return true; } });

        function addStuff() {
            const r = Math.random();
            const x = W + 80;
            if (r < .65) zaps.push({ x, y: rand(CEIL + 60, FLOOR - 60), len: rand(90, 170), ang: pick([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]), spin: Math.random() < .25 + Math.min(.4, dist / 20000) ? rand(-1.6, 1.6) : 0 });
            if (r > .45) {
                const cy = rand(CEIL + 50, FLOOR - 50), shape = randInt(0, 2);
                for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) {
                    const yy = shape === 0 ? cy + (j - 1) * 24 : shape === 1 ? cy + Math.sin(i * .8) * 50 + (j - 1) * 24 : cy + (i - 4) * 10 + (j - 1) * 24;
                    coins.push({ x: x + 200 + i * 28, y: yy, got: false });
                }
            }
            nextZap = rand(260, 420) - Math.min(120, dist / 200);
        }
        function crash(msg: string) {
            if (over) return;
            over = true;
            sfx.boom(); shake.hit(12, .5);
            fx.burst(p.x, p.y, { n: 60, color: ["#38bdf8", "#fde047", "#fff"], speed: 380, life: 1 });
            const score = Math.floor(dist / 10) + coinCount * 5;
            api.later(() => api.end(score, msg, `${Math.floor(dist / 10)} m · ${coinCount} coins (×5)`), 900);
        }
        const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
            const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
            const tt = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
            return Math.hypot(ax + dx * tt - px, ay + dy * tt - py);
        };

        api.loop(dt => {
            t += dt;
            if (started && !over) {
                speed = Math.min(620, 330 + dist / 70);
                const dx = speed * dt;
                dist += dx;
                p.vy += (holding ? -2100 : 1500) * dt;
                p.vy = Math.max(-520, Math.min(700, p.vy));
                p.y += p.vy * dt;
                if (p.y > FLOOR - 22) { p.y = FLOOR - 22; p.vy = 0; }
                if (p.y < CEIL + 22) { p.y = CEIL + 22; p.vy = 0; }
                if (holding && Math.random() < .9) fx.burst(p.x - 14, p.y + 20, { n: 2, color: ["#fde047", "#fb923c", "#f87171"], speed: 220, angle: Math.PI / 2 + .3, spread: .3, life: .35, size: 3 });
                nextZap -= dx;
                if (nextZap <= 0) addStuff();
                for (const z of zaps) { z.x -= dx; z.ang += z.spin * dt; }
                for (const c of coins) c.x -= dx;
                zaps = zaps.filter(z => z.x > -200);
                coins = coins.filter(c => c.x > -20 && !c.got);
                // missiles: warning on the right edge, then they fly through
                missileT -= dt;
                if (missileT <= 0) { missiles.push({ y: p.y, x: W + 60, warn: 1.2 }); missileT = rand(4, 8) - Math.min(2.5, dist / 15000); }
                for (const m of missiles) {
                    if (m.warn > 0) { m.warn -= dt; m.y += (p.y - m.y) * Math.min(1, dt * 3); if (m.warn <= 0) sfx.shoot(); }
                    else { m.x -= (speed + 500) * dt; if (Math.random() < .8) fx.burst(m.x + 26, m.y, { n: 1, color: ["#94a3b8", "#fb923c"], speed: 60, angle: 0, spread: .3, life: .5, size: 4 }); }
                    if (m.warn <= 0 && Math.hypot(m.x - p.x, m.y - p.y) < 24) crash("Hit by a missile!");
                }
                missiles = missiles.filter(m => m.x > -60);
                for (const z of zaps) {
                    const hx = Math.cos(z.ang) * z.len / 2, hy = Math.sin(z.ang) * z.len / 2;
                    if (segDist(p.x, p.y, z.x - hx, z.y - hy, z.x + hx, z.y + hy) < 22) crash("Zapped!");
                }
                for (const c of coins) if (!c.got && Math.hypot(c.x - p.x, c.y - p.y) < 24) { c.got = true; coinCount++; sfx.tick(); }
                api.setScore(Math.floor(dist / 10) + coinCount * 5);
                api.setStatus(`🪙 ${coinCount}`);
            }
            fx.update(dt); shake.update(dt); floaters.update(dt);
            g.save();
            shake.apply(g);
            nebula(g, W, H, 205);
            stars.draw(g, dist * .5);
            // lab floor / ceiling
            g.fillStyle = "#0f172a"; g.fillRect(0, FLOOR, W, H - FLOOR); g.fillRect(0, 0, W, CEIL);
            g.fillStyle = "#38bdf8";
            for (let x = -(dist % 60); x < W; x += 60) { g.fillRect(x, FLOOR, 30, 3); g.fillRect(x + 30, CEIL - 3, 30, 3); }
            for (const c of coins) {
                const sq = Math.abs(Math.cos(t * 4 + c.x * .02));
                g.fillStyle = "#fde047"; g.shadowColor = "#fde047"; g.shadowBlur = 8;
                g.beginPath(); g.ellipse(c.x, c.y, 9 * sq + 2, 9, 0, 0, Math.PI * 2); g.fill();
            }
            g.shadowBlur = 0;
            for (const z of zaps) {
                const hx = Math.cos(z.ang) * z.len / 2, hy = Math.sin(z.ang) * z.len / 2;
                g.save();
                g.lineCap = "round";
                g.strokeStyle = "rgba(250,204,21,.3)"; g.lineWidth = 16;
                g.beginPath(); g.moveTo(z.x - hx, z.y - hy); g.lineTo(z.x + hx, z.y + hy); g.stroke();
                g.strokeStyle = "#fef08a"; g.lineWidth = 4; g.shadowColor = "#facc15"; g.shadowBlur = 14;
                g.beginPath(); g.moveTo(z.x - hx, z.y - hy);
                for (let i = 1; i <= 8; i++) { const k = i / 8; g.lineTo(z.x - hx + hx * 2 * k + (i < 8 ? rand(-5, 5) : 0), z.y - hy + hy * 2 * k + (i < 8 ? rand(-5, 5) : 0)); }
                g.stroke();
                g.restore();
                glowCircle(g, z.x - hx, z.y - hy, 9, "#94a3b8", 16);
                glowCircle(g, z.x + hx, z.y + hy, 9, "#94a3b8", 16);
            }
            for (const m of missiles) {
                if (m.warn > 0) {
                    if (Math.floor(t * 8) % 2) text(g, "⚠", W - 30, m.y, 30, "#ef4444", "center", 900, "#ef4444");
                } else {
                    g.fillStyle = "#cbd5e1"; g.beginPath(); g.roundRect(m.x - 18, m.y - 7, 40, 14, 7); g.fill();
                    g.fillStyle = "#ef4444"; g.beginPath(); g.moveTo(m.x - 18, m.y - 7); g.lineTo(m.x - 30, m.y); g.lineTo(m.x - 18, m.y + 7); g.fill();
                }
            }
            // hero with jetpack
            if (!over) {
                g.save();
                g.translate(p.x, p.y);
                g.rotate(Math.max(-.3, Math.min(.3, p.vy / 1600)));
                g.fillStyle = "#64748b"; g.beginPath(); g.roundRect(-20, -10, 12, 28, 4); g.fill();
                g.shadowColor = "#38bdf8"; g.shadowBlur = 14;
                g.fillStyle = "#e0f2fe"; g.beginPath(); g.roundRect(-10, -18, 24, 36, 10); g.fill();
                g.shadowBlur = 0;
                g.fillStyle = "#0ea5e9"; g.beginPath(); g.roundRect(-2, -12, 15, 11, 5); g.fill();
                g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(2, -10, 5, 3);
                g.restore();
            }
            fx.draw(g); floaters.draw(g);
            text(g, `${Math.floor(dist / 10)} m`, 16, 22, 18, "#fff", "left", 900);
            text(g, `🪙 ${coinCount}`, W - 16, 22, 18, "#fde047", "right", 900, "#ca8a04");
            if (!started) titleCard(g, W, H, "Jet Dash", ["Hold to fly up, let go to drop", "Dodge zappers ⚡ and missiles ⚠ · coins ×5"], t, "#38bdf8");
            g.restore();
        });
    }
};
