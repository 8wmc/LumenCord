/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { C, clamp, GameDef, glowText, pick, rand, randInt, roundRect, starfield } from "./core";

const W = 480, H = 320;
const isJump = (e: KeyboardEvent) => e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W";

// ───────────────────────── Flappy Comet ─────────────────────────
const flappy: GameDef = {
    id: "flappy", name: "Flappy Comet", icon: "☄️", color: "#f472b6", category: "Arcade",
    description: "Tap to fly your comet through the crystal gaps.",
    controls: "Space, ↑ or click to flap",
    start(api) {
        const { cv, g } = api.canvas(W, H);
        let y = H / 2, vy = 0, started = false, dead = false, score = 0, spawn = 0, t = 0;
        const pipes: Array<{ x: number; gap: number; passed: boolean; }> = [];
        const trail: Array<{ x: number; y: number; a: number; }> = [];
        const GAP = 112, PW = 46;
        const flap = () => {
            if (dead) return;
            started = true;
            vy = -285;
        };
        api.onKey((e, down) => { if (down && isJump(e)) { flap(); return true; } });
        cv.addEventListener("pointerdown", flap);

        api.loop(dt => {
            t += dt;
            if (started && !dead) {
                vy += 900 * dt;
                y += vy * dt;
                const speed = 150 + score * 3;
                spawn -= dt;
                if (spawn <= 0) {
                    spawn = 1.45;
                    pipes.push({ x: W + 20, gap: rand(70, H - 70), passed: false });
                }
                for (const p of pipes) {
                    p.x -= speed * dt;
                    if (!p.passed && p.x + PW < 110) {
                        p.passed = true;
                        api.setScore(++score);
                    }
                    if (110 + 10 > p.x && 110 - 10 < p.x + PW && (y - 10 < p.gap - GAP / 2 || y + 10 > p.gap + GAP / 2)) dead = true;
                }
                while (pipes.length && pipes[0].x < -PW) pipes.shift();
                if (y > H - 8 || y < -30) dead = true;
                if (dead) api.end(score, "Crashed!", "Your comet hit a crystal.");
            } else if (!started) {
                y = H / 2 + Math.sin(t * 3) * 8;
            }
            trail.unshift({ x: 110, y, a: 1 });
            if (trail.length > 18) trail.pop();

            starfield(g, W, H);
            for (const p of pipes) {
                for (const [top, h] of [[0, p.gap - GAP / 2], [p.gap + GAP / 2, H - (p.gap + GAP / 2)]] as const) {
                    const grd = g.createLinearGradient(p.x, 0, p.x + PW, 0);
                    grd.addColorStop(0, "#7c3aed"); grd.addColorStop(.5, "#c084fc"); grd.addColorStop(1, "#6d28d9");
                    g.fillStyle = grd;
                    roundRect(g, p.x, top - 6, PW, h + 12, 8);
                    g.fill();
                    g.strokeStyle = "rgba(255,255,255,.35)";
                    g.stroke();
                }
            }
            for (let i = trail.length - 1; i >= 0; i--) {
                const p = trail[i];
                g.globalAlpha = (1 - i / trail.length) * .6;
                g.fillStyle = i % 2 ? C.pink : C.cyan;
                g.beginPath();
                g.arc(p.x - i * 4, p.y, 9 - i * .4, 0, Math.PI * 2);
                g.fill();
            }
            g.globalAlpha = 1;
            const grd = g.createRadialGradient(106, y - 4, 1, 110, y, 12);
            grd.addColorStop(0, "#fff"); grd.addColorStop(.5, "#fde68a"); grd.addColorStop(1, "#f472b6");
            g.fillStyle = grd;
            g.shadowColor = C.pink; g.shadowBlur = 16;
            g.beginPath(); g.arc(110, y, 11, 0, Math.PI * 2); g.fill();
            g.shadowBlur = 0;
            glowText(g, String(score), W / 2, 30, 28);
            if (!started) glowText(g, "Press Space or click to fly", W / 2, H - 40, 16, C.muted);
        });
    }
};

// ───────────────────────── Glow Snake (slither-style) ─────────────────────────
interface Snake { pts: Array<{ x: number; y: number; }>; ang: number; len: number; color: string; bot: boolean; alive: boolean; turn: number; boost: boolean; }
const glowSnake: GameDef = {
    id: "glowsnake", name: "Glow Snake", icon: "🐍", color: "#4ade80", category: "Arcade",
    description: "Eat glowing orbs to grow. Make other snakes crash into you, and don't hit them or the wall.",
    controls: "Move the mouse to steer (or ← →). Hold click or Space to boost.",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        const orbs: Array<{ x: number; y: number; r: number; c: string; }> = [];
        const COLORS = [C.pink, C.cyan, C.gold, C.green, "#fb923c", "#a78bfa"];
        const addOrb = (x = rand(15, W - 15), y = rand(15, H - 15), r = rand(2.5, 4.5)) => orbs.push({ x, y, r, c: pick(COLORS) });
        for (let i = 0; i < 60; i++) addOrb();
        const mk = (x: number, y: number, color: string, bot: boolean): Snake =>
            ({ pts: [{ x, y }], ang: rand(0, Math.PI * 2), len: 24, color, bot, alive: true, turn: 0, boost: false });
        const me = mk(W / 2, H / 2, C.violet, false);
        me.ang = 0;
        const snakes: Snake[] = [me];
        const spawnBot = () => {
            let x = 0, y = 0;
            do { x = rand(40, W - 40); y = rand(40, H - 40); } while (Math.hypot(x - me.pts[0].x, y - me.pts[0].y) < 120);
            snakes.push(mk(x, y, pick(["#f472b6", "#22d3ee", "#facc15", "#fb923c", "#34d399"]), true));
        };
        for (let i = 0; i < 4; i++) spawnBot();

        let mouse: { x: number; y: number; } | null = null, mouseDown = false, keyL = false, keyR = false, keyBoost = false;
        cv.addEventListener("pointermove", e => mouse = toLocal(e));
        cv.addEventListener("pointerdown", () => mouseDown = true);
        const up = () => mouseDown = false;
        window.addEventListener("pointerup", up);
        api.cleanup(() => window.removeEventListener("pointerup", up));
        api.onKey((e, down) => {
            if (e.key === "ArrowLeft" || e.key === "a") { keyL = down; mouse = null; return true; }
            if (e.key === "ArrowRight" || e.key === "d") { keyR = down; mouse = null; return true; }
            if (e.key === " ") { keyBoost = down; return true; }
        });

        const pathLen = (s: Snake) => s.len * 4;
        function step(s: Snake, dt: number) {
            const head = s.pts[0];
            let target = s.ang;
            if (!s.bot) {
                if (mouse) target = Math.atan2(mouse.y - head.y, mouse.x - head.x);
                else target = s.ang + ((keyR ? 1 : 0) - (keyL ? 1 : 0)) * 1.2;
                s.boost = (mouseDown || keyBoost) && s.len > 14;
            } else {
                // bots: chase nearest orb, steer away from walls
                let best = null as null | { x: number; y: number; }, bd = 1e9;
                for (const o of orbs) {
                    const d = (o.x - head.x) ** 2 + (o.y - head.y) ** 2;
                    if (d < bd) { bd = d; best = o; }
                }
                if (best) target = Math.atan2(best.y - head.y, best.x - head.x) + Math.sin(performance.now() / 500 + s.len) * .4;
                const m = 40;
                if (head.x < m || head.x > W - m || head.y < m || head.y > H - m) target = Math.atan2(H / 2 - head.y, W / 2 - head.x);
                s.boost = false;
            }
            let diff = target - s.ang;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            s.ang += clamp(diff, -4 * dt, 4 * dt);
            const speed = (s.bot ? 85 : 100) * (s.boost ? 1.9 : 1);
            const nx = head.x + Math.cos(s.ang) * speed * dt, ny = head.y + Math.sin(s.ang) * speed * dt;
            s.pts.unshift({ x: nx, y: ny });
            if (s.boost) {
                s.len -= dt * 4;
                if (Math.random() < dt * 8) { const tail = s.pts[s.pts.length - 1]; addOrb(tail.x, tail.y, 2.5); }
            }
            // trim to path length
            let acc = 0;
            for (let i = 1; i < s.pts.length; i++) {
                acc += Math.hypot(s.pts[i].x - s.pts[i - 1].x, s.pts[i].y - s.pts[i - 1].y);
                if (acc > pathLen(s)) { s.pts.length = i + 1; break; }
            }
        }
        const radius = (s: Snake) => 4 + Math.min(s.len, 120) / 30;
        function kill(s: Snake) {
            s.alive = false;
            for (let i = 0; i < s.pts.length; i += 6) addOrb(s.pts[i].x + rand(-3, 3), s.pts[i].y + rand(-3, 3), rand(3.5, 5.5));
        }

        let respawn = 0;
        api.loop(dt => {
            for (const s of snakes) if (s.alive) step(s, dt);
            // eat
            for (const s of snakes) {
                if (!s.alive) continue;
                const h = s.pts[0], r = radius(s) + 3;
                for (let i = orbs.length - 1; i >= 0; i--) {
                    const o = orbs[i];
                    if ((o.x - h.x) ** 2 + (o.y - h.y) ** 2 < (r + o.r) ** 2) {
                        s.len += o.r * .55;
                        orbs.splice(i, 1);
                    }
                }
            }
            while (orbs.length < 60) addOrb();
            // crashes
            for (const s of snakes) {
                if (!s.alive) continue;
                const h = s.pts[0];
                if (h.x < 0 || h.x > W || h.y < 0 || h.y > H) { kill(s); continue; }
                for (const o of snakes) {
                    if (o === s || !o.alive) continue;
                    const rr = (radius(s) * .7 + radius(o)) ** 2;
                    for (let i = 0; i < o.pts.length; i += 2) {
                        if ((o.pts[i].x - h.x) ** 2 + (o.pts[i].y - h.y) ** 2 < rr) { kill(s); break; }
                    }
                    if (!s.alive) break;
                }
            }
            for (let i = snakes.length - 1; i > 0; i--) if (!snakes[i].alive) snakes.splice(i, 1);
            respawn -= dt;
            if (snakes.length < 5 && respawn <= 0) { spawnBot(); respawn = 2; }
            api.setScore(Math.floor(me.len));
            if (!me.alive) api.end(Math.floor(me.len), "You crashed!", "Grow big and make the others crash into you.");

            // draw
            starfield(g, W, H);
            g.strokeStyle = "rgba(248,113,113,.5)";
            g.lineWidth = 2;
            g.strokeRect(1, 1, W - 2, H - 2);
            for (const o of orbs) {
                g.fillStyle = o.c;
                g.shadowColor = o.c; g.shadowBlur = 8;
                g.beginPath(); g.arc(o.x, o.y, o.r, 0, Math.PI * 2); g.fill();
            }
            g.shadowBlur = 0;
            for (const s of snakes) {
                if (!s.alive) continue;
                const r = radius(s);
                g.lineCap = "round"; g.lineJoin = "round";
                g.shadowColor = s.color; g.shadowBlur = s.boost ? 18 : 8;
                g.strokeStyle = s.color;
                g.lineWidth = r * 2;
                g.beginPath();
                g.moveTo(s.pts[0].x, s.pts[0].y);
                for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i].x, s.pts[i].y);
                g.stroke();
                g.shadowBlur = 0;
                g.strokeStyle = "rgba(255,255,255,.25)";
                g.lineWidth = r * .6;
                g.stroke();
                const h = s.pts[0];
                for (const side of [-1, 1]) {
                    const ex = h.x + Math.cos(s.ang + side * .6) * r * .6, ey = h.y + Math.sin(s.ang + side * .6) * r * .6;
                    g.fillStyle = "#fff"; g.beginPath(); g.arc(ex, ey, r * .38, 0, Math.PI * 2); g.fill();
                    g.fillStyle = "#111"; g.beginPath(); g.arc(ex + Math.cos(s.ang) * r * .15, ey + Math.sin(s.ang) * r * .15, r * .2, 0, Math.PI * 2); g.fill();
                }
            }
        });
    }
};

// ───────────────────────── Orb Roll 3D ─────────────────────────
const orbRoll: GameDef = {
    id: "orbroll", name: "Orb Roll 3D", icon: "🔮", color: "#22d3ee", category: "Arcade",
    description: "Roll down the neon track. Dodge the blocks, grab the gems, jump the low walls.",
    controls: "← → (or A D / mouse) to steer, Space to jump",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        const HOR = 110, LANE = 1.0;
        let x = 0, vx = 0, jumpY = 0, jumpV = 0, speed = 9, dist = 0, gems = 0, spin = 0, spawn = 0;
        let left = false, right = false, mouseX: number | null = null;
        const objs: Array<{ x: number; z: number; kind: "block" | "low" | "gem"; hit?: boolean; }> = [];
        api.onKey((e, down) => {
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { left = down; mouseX = null; return true; }
            if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { right = down; mouseX = null; return true; }
            if (isJump(e)) { if (down && jumpY <= 0) jumpV = 7; return true; }
        });
        cv.addEventListener("pointermove", e => mouseX = (toLocal(e).x / W) * 4 - 2);
        cv.addEventListener("pointerdown", () => { if (jumpY <= 0) jumpV = 7; });

        const proj = (wx: number, wy: number, z: number) => {
            const s = 156 / z;
            return { x: W / 2 + (wx - x * .55) * s, y: HOR + (1.4 - wy) * s, s };
        };

        api.loop(dt => {
            speed += dt * .18;
            dist += speed * dt;
            spin += speed * dt;
            const target = mouseX != null ? clamp(mouseX, -2, 2) : null;
            if (target != null) vx = (target - x) * 8;
            else vx = ((right ? 1 : 0) - (left ? 1 : 0)) * 4.2;
            x = clamp(x + vx * dt, -2, 2);
            if (jumpY > 0 || jumpV > 0) { jumpV -= 22 * dt; jumpY = Math.max(0, jumpY + jumpV * dt); if (jumpY === 0) jumpV = 0; }

            spawn -= dt * speed;
            if (spawn <= 0) {
                spawn = rand(5, 9);
                const lane = randInt(-2, 2) * LANE;
                const r = Math.random();
                objs.push({ x: lane, z: 60, kind: r < .2 ? "gem" : r < .38 ? "low" : "block" });
                if (Math.random() < .35) objs.push({ x: clamp(lane + pick([-2, 2]) * LANE, -2, 2), z: 60, kind: "block" });
            }
            for (const o of objs) o.z -= speed * dt;
            for (const o of objs) {
                if (o.hit || o.z > 1.4 || o.z < .4) continue;
                if (Math.abs(o.x - x) < .62) {
                    if (o.kind === "gem") { o.hit = true; gems++; }
                    else if (o.kind === "low" && jumpY > .5) { /* cleared */ }
                    else { api.end(Math.floor(dist) + gems * 25, "Bonk!", `You rolled ${Math.floor(dist)}m and grabbed ${gems} gems.`); }
                }
            }
            while (objs.length && objs[0].z < .2) objs.shift();
            api.setScore(Math.floor(dist) + gems * 25);

            // sky + track
            const sky = g.createLinearGradient(0, 0, 0, HOR);
            sky.addColorStop(0, "#0b0624"); sky.addColorStop(1, "#3b0764");
            g.fillStyle = sky; g.fillRect(0, 0, W, HOR);
            g.fillStyle = "#e879f9"; g.globalAlpha = .9;
            g.beginPath(); g.arc(W / 2, HOR, 46, Math.PI, 0); g.fill(); g.globalAlpha = 1;
            for (let i = 0; i < 5; i++) { g.fillStyle = "#3b0764"; g.fillRect(W / 2 - 50, HOR - 8 - i * 9, 100, 3); }
            g.fillStyle = "#07041a"; g.fillRect(0, HOR, W, H - HOR);
            // track edges
            const near = proj(-2.6, 0, 1.1), far = proj(-2.6, 0, 60), nearR = proj(2.6, 0, 1.1), farR = proj(2.6, 0, 60);
            const road = g.createLinearGradient(0, HOR, 0, H);
            road.addColorStop(0, "#1e0b3d"); road.addColorStop(1, "#3b1a70");
            g.fillStyle = road;
            g.beginPath(); g.moveTo(far.x, far.y); g.lineTo(farR.x, farR.y); g.lineTo(nearR.x, nearR.y); g.lineTo(near.x, near.y); g.fill();
            g.strokeStyle = C.cyan; g.lineWidth = 2; g.shadowColor = C.cyan; g.shadowBlur = 10;
            g.beginPath(); g.moveTo(far.x, far.y); g.lineTo(near.x, near.y); g.moveTo(farR.x, farR.y); g.lineTo(nearR.x, nearR.y); g.stroke();
            g.shadowBlur = 0;
            // moving stripes
            g.strokeStyle = "rgba(232,121,249,.35)"; g.lineWidth = 1;
            for (let z = 60 - (dist % 4); z > 1.2; z -= 4) {
                const a = proj(-2.6, 0, z), b = proj(2.6, 0, z);
                g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
            }
            // objects (far first)
            for (let i = objs.length - 1; i >= 0; i--) {
                const o = objs[i];
                if (o.hit || o.z < .9) continue;
                const p = proj(o.x, 0, o.z);
                const w = .8 * p.s, h = (o.kind === "low" ? .3 : o.kind === "gem" ? .5 : .8) * p.s;
                if (o.kind === "gem") {
                    const gy = p.y - p.s * .55 + Math.sin(dist + i) * p.s * .05;
                    g.fillStyle = C.gold; g.shadowColor = C.gold; g.shadowBlur = 14;
                    g.beginPath(); g.moveTo(p.x, gy - w * .35); g.lineTo(p.x + w * .25, gy); g.lineTo(p.x, gy + w * .35); g.lineTo(p.x - w * .25, gy); g.fill();
                    g.shadowBlur = 0;
                } else {
                    const grd = g.createLinearGradient(0, p.y - h, 0, p.y);
                    grd.addColorStop(0, o.kind === "low" ? "#fb923c" : "#f472b6"); grd.addColorStop(1, o.kind === "low" ? "#9a3412" : "#7e22ce");
                    g.fillStyle = grd;
                    g.fillRect(p.x - w / 2, p.y - h, w, h);
                    g.strokeStyle = "rgba(255,255,255,.5)"; g.strokeRect(p.x - w / 2, p.y - h, w, h);
                }
            }
            // ball
            const bp = proj(x, jumpY * .4, 1.15);
            const r = 24;
            g.fillStyle = "rgba(0,0,0,.4)";
            g.beginPath(); g.ellipse(bp.x, proj(x, 0, 1.15).y - 2, r * (1 - jumpY * .05), 5, 0, 0, Math.PI * 2); g.fill();
            const by = bp.y - r;
            const ball = g.createRadialGradient(bp.x - 6, by - 7, 2, bp.x, by, r);
            ball.addColorStop(0, "#fff"); ball.addColorStop(.35, C.cyan); ball.addColorStop(1, "#4338ca");
            g.fillStyle = ball; g.shadowColor = C.cyan; g.shadowBlur = 16;
            g.beginPath(); g.arc(bp.x, by, r, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
            g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 2;
            const sp = (spin * 1.5) % (Math.PI * 2);
            g.beginPath(); g.ellipse(bp.x, by, r * .9, r * Math.abs(Math.cos(sp)) * .9, 0, 0, Math.PI * 2); g.stroke();
            glowText(g, `${Math.floor(dist)}m  ·  💎 ${gems}`, W / 2, 18, 15);
        });
    }
};

// ───────────────────────── Lumen Blocks (Tetris-style) ─────────────────────────
const SHAPES: Record<string, number[][]> = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};
const PIECE_COLORS: Record<string, string> = { I: "#22d3ee", O: "#fde047", T: "#c084fc", S: "#4ade80", Z: "#f87171", J: "#60a5fa", L: "#fb923c" };
const blocks: GameDef = {
    id: "blocks", name: "Lumen Blocks", icon: "🧱", color: "#c084fc", category: "Puzzle",
    description: "Stack falling blocks and fill full rows to clear them.",
    controls: "← → move, ↑ rotate, ↓ soft drop, Space hard drop",
    start(api) {
        const { g } = api.canvas(W, H);
        const COLS = 10, ROWS = 20, CS = 15, OX = 150, OY = 10;
        const grid: (string | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        const bag: string[] = [];
        const nextType = () => { if (!bag.length) bag.push(...Object.keys(SHAPES).sort(() => Math.random() - .5)); return bag.pop()!; };
        let cur = { t: "", m: [] as number[][], x: 0, y: 0 }, next = nextType(), score = 0, lines = 0, level = 1, fall = 0, over = false, flash = 0;
        const collide = (m: number[][], x: number, y: number) => {
            for (let r = 0; r < m.length; r++) for (let c = 0; c < m[r].length; c++) {
                if (!m[r][c]) continue;
                const gx = x + c, gy = y + r;
                if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
                if (gy >= 0 && grid[gy][gx]) return true;
            }
            return false;
        };
        const spawn = () => {
            const t = next; next = nextType();
            cur = { t, m: SHAPES[t].map(r => [...r]), x: 3, y: t === "I" ? -1 : 0 };
            if (collide(cur.m, cur.x, cur.y)) { over = true; api.end(score, "Stacked out!", `You cleared ${lines} lines.`); }
        };
        const rotate = (m: number[][]) => m[0].map((_, i) => m.map(r => r[i]).reverse());
        const lock = () => {
            cur.m.forEach((row, r) => row.forEach((v, c) => { if (v && cur.y + r >= 0) grid[cur.y + r][cur.x + c] = cur.t; }));
            let cleared = 0;
            for (let r = ROWS - 1; r >= 0; r--) {
                if (grid[r].every(Boolean)) { grid.splice(r, 1); grid.unshift(Array(COLS).fill(null)); cleared++; r++; }
            }
            if (cleared) {
                lines += cleared;
                score += [0, 100, 300, 500, 800][cleared] * level;
                level = 1 + Math.floor(lines / 10);
                flash = .15;
            }
            api.setScore(score);
            spawn();
        };
        const move = (dx: number, dy: number) => {
            if (over) return false;
            if (!collide(cur.m, cur.x + dx, cur.y + dy)) { cur.x += dx; cur.y += dy; return true; }
            return false;
        };
        api.onKey((e, down) => {
            if (!down || over) return;
            if (e.key === "ArrowLeft") move(-1, 0);
            else if (e.key === "ArrowRight") move(1, 0);
            else if (e.key === "ArrowDown") { if (move(0, 1)) score += 1; else lock(); }
            else if (e.key === "ArrowUp" || e.key === "x" || e.key === "X") {
                const m = rotate(cur.m);
                for (const k of [0, -1, 1, -2, 2]) if (!collide(m, cur.x + k, cur.y)) { cur.m = m; cur.x += k; break; }
            } else if (e.key === " ") { while (move(0, 1)) score += 2; lock(); }
            else return;
            return true;
        });
        spawn();

        const cell = (x: number, y: number, color: string, alpha = 1) => {
            g.globalAlpha = alpha;
            g.fillStyle = color;
            g.fillRect(x + 1, y + 1, CS - 2, CS - 2);
            g.fillStyle = "rgba(255,255,255,.35)";
            g.fillRect(x + 1, y + 1, CS - 2, 3);
            g.globalAlpha = 1;
        };
        api.loop(dt => {
            if (!over) {
                fall += dt;
                const interval = Math.max(.08, .75 - (level - 1) * .065);
                if (fall > interval) { fall = 0; if (!move(0, 1)) lock(); }
            }
            starfield(g, W, H);
            g.fillStyle = "rgba(10,6,30,.85)";
            g.fillRect(OX - 2, OY - 2, COLS * CS + 4, ROWS * CS + 4);
            g.strokeStyle = C.line; g.strokeRect(OX - 2, OY - 2, COLS * CS + 4, ROWS * CS + 4);
            if (flash > 0) { flash -= dt; g.fillStyle = `rgba(232,121,249,${flash * 2})`; g.fillRect(OX, OY, COLS * CS, ROWS * CS); }
            grid.forEach((row, r) => row.forEach((t, c) => { if (t) cell(OX + c * CS, OY + r * CS, PIECE_COLORS[t]); }));
            if (!over) {
                let gy = cur.y;
                while (!collide(cur.m, cur.x, gy + 1)) gy++;
                cur.m.forEach((row, r) => row.forEach((v, c) => {
                    if (!v) return;
                    if (gy + r >= 0) cell(OX + (cur.x + c) * CS, OY + (gy + r) * CS, PIECE_COLORS[cur.t], .22);
                    if (cur.y + r >= 0) cell(OX + (cur.x + c) * CS, OY + (cur.y + r) * CS, PIECE_COLORS[cur.t]);
                }));
            }
            const px = OX + COLS * CS + 24;
            glowText(g, "NEXT", px + 30, 24, 13, C.muted);
            SHAPES[next].forEach((row, r) => row.forEach((v, c) => { if (v) cell(px + c * CS, 40 + r * CS, PIECE_COLORS[next]); }));
            glowText(g, `Lines ${lines}`, px + 30, 130, 14, C.text);
            glowText(g, `Level ${level}`, px + 30, 152, 14, C.cyan);
            glowText(g, String(score), px + 30, 186, 22, C.gold);
            glowText(g, "← → ↑ ↓", 75, 140, 13, C.muted);
            glowText(g, "Space: drop", 75, 160, 13, C.muted);
        });
    }
};

// ───────────────────────── Pong ─────────────────────────
const pong: GameDef = {
    id: "pong", name: "Neon Pong", icon: "🏓", color: "#67e8f9", category: "Arcade",
    description: "Classic paddle battle against the computer. First to 7 wins.",
    controls: "Mouse or ↑ ↓ to move your paddle",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        const PH = 64;
        let py = H / 2, cy = H / 2, bx = W / 2, by = H / 2, vx = 0, vy = 0, you = 0, cpu = 0, up = false, dn = false, wait = 1;
        const serve = (dir: number) => { bx = W / 2; by = H / 2; const a = rand(-.5, .5); vx = Math.cos(a) * 240 * dir; vy = Math.sin(a) * 240; wait = .8; };
        serve(pick([-1, 1]));
        cv.addEventListener("pointermove", e => py = toLocal(e).y);
        api.onKey((e, d) => {
            if (e.key === "ArrowUp" || e.key === "w") { up = d; return true; }
            if (e.key === "ArrowDown" || e.key === "s") { dn = d; return true; }
        });
        api.loop(dt => {
            py = clamp(py + ((dn ? 1 : 0) - (up ? 1 : 0)) * 340 * dt, PH / 2, H - PH / 2);
            cy += clamp(by - cy, -210 * dt, 210 * dt);
            cy = clamp(cy, PH / 2, H - PH / 2);
            if (wait > 0) wait -= dt;
            else {
                bx += vx * dt; by += vy * dt;
                if (by < 6 || by > H - 6) { vy *= -1; by = clamp(by, 6, H - 6); }
                const hit = (padX: number, padY: number, dir: number) => {
                    if (Math.abs(bx - padX) < 10 && Math.abs(by - padY) < PH / 2 + 6 && Math.sign(vx) !== dir) {
                        const off = (by - padY) / (PH / 2);
                        const sp = Math.min(Math.hypot(vx, vy) * 1.06, 620);
                        const a = off * 1.0;
                        vx = Math.cos(a) * sp * dir; vy = Math.sin(a) * sp;
                    }
                };
                hit(24, py, 1);
                hit(W - 24, cy, -1);
                if (bx < -10) { cpu++; serve(1); }
                if (bx > W + 10) { you++; api.setScore(you); serve(-1); }
                if (you >= 7 || cpu >= 7) api.end(you, you >= 7 ? "You win! 🏆" : "CPU wins", `Final score ${you} - ${cpu}`);
            }
            starfield(g, W, H);
            g.setLineDash([6, 8]); g.strokeStyle = C.line; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([]);
            glowText(g, String(you), W / 2 - 50, 34, 30, C.cyan);
            glowText(g, String(cpu), W / 2 + 50, 34, 30, C.pink);
            g.shadowBlur = 14;
            g.fillStyle = C.cyan; g.shadowColor = C.cyan; roundRect(g, 16, py - PH / 2, 9, PH, 4); g.fill();
            g.fillStyle = C.pink; g.shadowColor = C.pink; roundRect(g, W - 25, cy - PH / 2, 9, PH, 4); g.fill();
            g.fillStyle = "#fff"; g.shadowColor = "#fff"; g.beginPath(); g.arc(bx, by, 6, 0, Math.PI * 2); g.fill();
            g.shadowBlur = 0;
        });
    }
};

// ───────────────────────── Brick Breaker ─────────────────────────
const bricks: GameDef = {
    id: "bricks", name: "Brick Breaker", icon: "🧨", color: "#fb923c", category: "Arcade",
    description: "Bounce the orb to smash every brick. 3 lives.",
    controls: "Mouse or ← → to move, click or Space to launch",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        let px = W / 2, pw = 76, bx = 0, by = 0, vx = 0, vy = 0, stuck = true, lives = 3, score = 0, level = 1, left = false, right = false;
        let wall: Array<{ x: number; y: number; w: number; h: number; hp: number; c: string; }> = [];
        const build = () => {
            wall = [];
            const cols = 10, rows = 5 + Math.min(level, 3), bw = 42, bh = 14;
            const colors = ["#f472b6", "#e879f9", "#c084fc", "#a78bfa", "#818cf8", "#60a5fa", "#22d3ee", "#2dd4bf"];
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
                wall.push({ x: 22 + c * (bw + 2), y: 34 + r * (bh + 3), w: bw, h: bh, hp: r < level - 1 ? 2 : 1, c: colors[r % colors.length] });
        };
        build();
        const launch = () => { if (stuck) { stuck = false; const a = rand(-.6, .6); vx = Math.sin(a) * (240 + level * 25); vy = -Math.cos(a) * (240 + level * 25); } };
        cv.addEventListener("pointermove", e => px = toLocal(e).x);
        cv.addEventListener("pointerdown", launch);
        api.onKey((e, d) => {
            if (e.key === "ArrowLeft") { left = d; return true; }
            if (e.key === "ArrowRight") { right = d; return true; }
            if (e.key === " ") { if (d) launch(); return true; }
        });
        api.loop(dt => {
            px = clamp(px + ((right ? 1 : 0) - (left ? 1 : 0)) * 420 * dt, pw / 2, W - pw / 2);
            if (stuck) { bx = px; by = H - 30; }
            else {
                bx += vx * dt; by += vy * dt;
                if (bx < 6 || bx > W - 6) { vx *= -1; bx = clamp(bx, 6, W - 6); }
                if (by < 6) { vy = Math.abs(vy); }
                if (vy > 0 && by > H - 30 && by < H - 18 && Math.abs(bx - px) < pw / 2 + 6) {
                    const sp = Math.hypot(vx, vy), off = (bx - px) / (pw / 2);
                    vx = off * sp * .8; vy = -Math.sqrt(Math.max(sp * sp - vx * vx, sp * sp * .3));
                }
                for (const b of wall) {
                    if (b.hp <= 0) continue;
                    if (bx + 6 > b.x && bx - 6 < b.x + b.w && by + 6 > b.y && by - 6 < b.y + b.h) {
                        const ox = Math.min(bx + 6 - b.x, b.x + b.w - (bx - 6)), oy = Math.min(by + 6 - b.y, b.y + b.h - (by - 6));
                        if (ox < oy) vx *= -1; else vy *= -1;
                        b.hp--;
                        score += 10 * level;
                        api.setScore(score);
                        break;
                    }
                }
                if (by > H + 10) {
                    lives--;
                    stuck = true;
                    if (lives <= 0) api.end(score, "Out of lives", `You reached level ${level}.`);
                }
                if (wall.every(b => b.hp <= 0)) { level++; stuck = true; build(); }
            }
            starfield(g, W, H);
            for (const b of wall) {
                if (b.hp <= 0) continue;
                g.fillStyle = b.c; g.globalAlpha = b.hp > 1 ? 1 : .85;
                roundRect(g, b.x, b.y, b.w, b.h, 3); g.fill();
                g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(b.x + 2, b.y + 2, b.w - 4, 3);
                if (b.hp > 1) { g.strokeStyle = "#fff"; g.stroke(); }
            }
            g.globalAlpha = 1;
            g.fillStyle = C.cyan; g.shadowColor = C.cyan; g.shadowBlur = 12;
            roundRect(g, px - pw / 2, H - 22, pw, 9, 4); g.fill();
            g.fillStyle = "#fff"; g.shadowColor = C.pink;
            g.beginPath(); g.arc(bx, by, 6, 0, Math.PI * 2); g.fill();
            g.shadowBlur = 0;
            glowText(g, "❤".repeat(lives), 30, 14, 12, C.pink, "left");
            glowText(g, `Level ${level}`, W - 14, 14, 12, C.muted, "right");
            if (stuck) glowText(g, "Click or Space to launch", W / 2, H / 2 + 40, 15, C.muted);
        });
    }
};

// ───────────────────────── Star Shooter ─────────────────────────
const shooter: GameDef = {
    id: "shooter", name: "Star Shooter", icon: "🚀", color: "#818cf8", category: "Arcade",
    description: "Blast the alien waves before they reach you. 3 lives.",
    controls: "← → or mouse to move, Space or hold click to shoot",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        let x = W / 2, left = false, right = false, firing = false, cool = 0, score = 0, lives = 3, wave = 0, inv = 0, spawnT = 0;
        const shots: Array<{ x: number; y: number; }> = [];
        const enemyShots: Array<{ x: number; y: number; }> = [];
        const foes: Array<{ x: number; y: number; vx: number; hp: number; t: number; kind: number; }> = [];
        const sparks: Array<{ x: number; y: number; vx: number; vy: number; life: number; c: string; }> = [];
        const boom = (px: number, py: number, c: string) => { for (let i = 0; i < 14; i++) sparks.push({ x: px, y: py, vx: rand(-120, 120), vy: rand(-120, 120), life: rand(.3, .7), c }); };
        cv.addEventListener("pointermove", e => x = toLocal(e).x);
        cv.addEventListener("pointerdown", () => firing = true);
        const upF = () => firing = false;
        window.addEventListener("pointerup", upF);
        api.cleanup(() => window.removeEventListener("pointerup", upF));
        api.onKey((e, d) => {
            if (e.key === "ArrowLeft") { left = d; return true; }
            if (e.key === "ArrowRight") { right = d; return true; }
            if (e.key === " ") { firing = d; return true; }
        });
        api.loop(dt => {
            x = clamp(x + ((right ? 1 : 0) - (left ? 1 : 0)) * 300 * dt, 16, W - 16);
            cool -= dt; inv -= dt;
            if (firing && cool <= 0) { shots.push({ x, y: H - 34 }); cool = .2; }
            if (!foes.length && spawnT <= 0) {
                wave++;
                for (let i = 0; i < 5 + wave * 2; i++) foes.push({ x: rand(30, W - 30), y: -20 - i * 26, vx: rand(-60, 60), hp: 1 + Math.floor(wave / 3), t: rand(0, 3), kind: randInt(0, 2) });
                spawnT = 1;
            }
            spawnT -= dt;
            for (const s of shots) s.y -= 420 * dt;
            for (const s of enemyShots) s.y += 200 * dt;
            for (const f of foes) {
                f.t += dt;
                f.y += (28 + wave * 4) * dt;
                f.x += Math.sin(f.t * 2) * f.vx * dt;
                if (f.y > 0 && Math.random() < dt * (.15 + wave * .03)) enemyShots.push({ x: f.x, y: f.y + 10 });
            }
            for (const s of shots) for (const f of foes) {
                if (f.hp > 0 && Math.abs(s.x - f.x) < 14 && Math.abs(s.y - f.y) < 12) { f.hp--; s.y = -99; if (f.hp <= 0) { score += 50; boom(f.x, f.y, C.pink); api.setScore(score); } }
            }
            const hurt = () => { if (inv > 0) return; lives--; inv = 1.5; boom(x, H - 24, C.cyan); if (lives <= 0) api.end(score, "Ship destroyed", `You reached wave ${wave}.`); };
            for (const s of enemyShots) if (Math.abs(s.x - x) < 12 && Math.abs(s.y - (H - 24)) < 12) { s.y = H + 99; hurt(); }
            for (const f of foes) if (f.hp > 0 && f.y > H - 40) { f.hp = 0; hurt(); }
            for (let i = foes.length - 1; i >= 0; i--) if (foes[i].hp <= 0) foes.splice(i, 1);
            for (let i = shots.length - 1; i >= 0; i--) if (shots[i].y < -10) shots.splice(i, 1);
            for (let i = enemyShots.length - 1; i >= 0; i--) if (enemyShots[i].y > H + 10) enemyShots.splice(i, 1);
            for (const p of sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
            for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);

            starfield(g, W, H);
            g.fillStyle = C.cyan; g.shadowColor = C.cyan; g.shadowBlur = 10;
            for (const s of shots) g.fillRect(s.x - 1.5, s.y - 8, 3, 10);
            g.fillStyle = C.red; g.shadowColor = C.red;
            for (const s of enemyShots) { g.beginPath(); g.arc(s.x, s.y, 3, 0, Math.PI * 2); g.fill(); }
            for (const f of foes) {
                const c = [C.pink, "#a3e635", C.gold][f.kind];
                g.fillStyle = c; g.shadowColor = c;
                g.beginPath(); g.ellipse(f.x, f.y, 13, 7, 0, 0, Math.PI * 2); g.fill();
                g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.ellipse(f.x, f.y - 5, 6, 5, 0, Math.PI, 0); g.fill();
            }
            g.shadowBlur = 0;
            if (inv <= 0 || Math.floor(inv * 10) % 2) {
                g.fillStyle = "#e0e7ff"; g.shadowColor = C.violet; g.shadowBlur = 14;
                g.beginPath(); g.moveTo(x, H - 40); g.lineTo(x + 13, H - 14); g.lineTo(x, H - 20); g.lineTo(x - 13, H - 14); g.closePath(); g.fill();
                g.fillStyle = C.pink; g.beginPath(); g.moveTo(x - 5, H - 16); g.lineTo(x, H - 6 - Math.random() * 6); g.lineTo(x + 5, H - 16); g.fill();
                g.shadowBlur = 0;
            }
            for (const p of sparks) { g.globalAlpha = Math.max(0, p.life * 1.5); g.fillStyle = p.c; g.fillRect(p.x, p.y, 2.5, 2.5); }
            g.globalAlpha = 1;
            glowText(g, "❤".repeat(Math.max(0, lives)), 14, 14, 12, C.pink, "left");
            glowText(g, `Wave ${wave}`, W - 14, 14, 12, C.muted, "right");
        });
    }
};

// ───────────────────────── Neon Runner ─────────────────────────
const runner: GameDef = {
    id: "runner", name: "Neon Runner", icon: "🏃", color: "#facc15", category: "Arcade",
    description: "Run forever across the neon city. Jump the spikes, duck the drones.",
    controls: "Space / ↑ / click to jump (twice for double jump), ↓ to duck",
    start(api) {
        const { cv, g } = api.canvas(W, H);
        const GROUND = H - 50;
        let y = 0, vy = 0, jumps = 0, duck = false, speed = 230, dist = 0, spawn = 1, t = 0;
        const obs: Array<{ x: number; w: number; h: number; air: boolean; }> = [];
        const skyline = Array.from({ length: 24 }, (_, i) => ({ x: i * 26, h: rand(30, 110) }));
        const jump = () => { if (jumps < 2) { vy = jumps ? -380 : -430; jumps++; } };
        cv.addEventListener("pointerdown", jump);
        api.onKey((e, d) => {
            if (isJump(e)) { if (d) jump(); return true; }
            if (e.key === "ArrowDown" || e.key === "s") { duck = d; return true; }
        });
        api.loop(dt => {
            t += dt;
            speed += dt * 6;
            dist += speed * dt / 10;
            vy += 1300 * dt; y += vy * dt;
            if (y > 0) { y = 0; vy = 0; jumps = 0; }
            spawn -= dt;
            if (spawn <= 0) {
                const air = Math.random() < .3 && dist > 30;
                obs.push(air ? { x: W + 20, w: 30, h: 16, air } : { x: W + 20, w: randInt(14, 28), h: randInt(20, 36), air });
                spawn = rand(.75, 1.6) * 260 / speed;
            }
            for (const o of obs) o.x -= speed * dt;
            while (obs.length && obs[0].x < -40) obs.shift();
            const ph = duck && y === 0 ? 18 : 34, px = 70, pyTop = GROUND + y - ph;
            for (const o of obs) {
                const oy = o.air ? GROUND - 42 : GROUND - o.h;
                if (px + 14 > o.x && px - 4 < o.x + o.w && pyTop < oy + o.h && GROUND + y > oy) {
                    api.end(Math.floor(dist), "Tripped!", `You ran ${Math.floor(dist)}m.`);
                }
            }
            api.setScore(Math.floor(dist));

            starfield(g, W, H);
            g.fillStyle = "#1e1046";
            for (const b of skyline) {
                const bx = ((b.x - dist * 2) % (24 * 26) + 24 * 26) % (24 * 26) - 26;
                g.fillRect(bx, GROUND - b.h, 24, b.h);
                g.fillStyle = "rgba(253,224,71,.5)";
                for (let wy = GROUND - b.h + 6; wy < GROUND - 6; wy += 10) if ((wy + b.x) % 3) g.fillRect(bx + 6, wy, 3, 4);
                g.fillStyle = "#1e1046";
            }
            g.fillStyle = "#0b0620"; g.fillRect(0, GROUND, W, H - GROUND);
            g.strokeStyle = C.pink; g.shadowColor = C.pink; g.shadowBlur = 10; g.lineWidth = 2;
            g.beginPath(); g.moveTo(0, GROUND); g.lineTo(W, GROUND); g.stroke();
            for (const o of obs) {
                if (o.air) {
                    const oy = GROUND - 42;
                    g.fillStyle = C.red; g.shadowColor = C.red;
                    roundRect(g, o.x, oy, o.w, o.h, 6); g.fill();
                    g.fillStyle = "#fff"; g.fillRect(o.x + 6, oy + 5, 4, 4); g.fillRect(o.x + 18, oy + 5, 4, 4);
                } else {
                    g.fillStyle = C.gold; g.shadowColor = C.gold;
                    g.beginPath(); g.moveTo(o.x, GROUND); g.lineTo(o.x + o.w / 2, GROUND - o.h); g.lineTo(o.x + o.w, GROUND); g.fill();
                }
            }
            // runner
            g.fillStyle = C.cyan; g.shadowColor = C.cyan;
            roundRect(g, px - 4, pyTop, 18, ph, 6); g.fill();
            g.fillStyle = "#0b0620"; g.fillRect(px + 7, pyTop + 6, 4, 4);
            g.shadowBlur = 0;
            if (y === 0 && !duck) {
                const leg = Math.sin(t * 22) * 5;
                g.strokeStyle = C.cyan; g.lineWidth = 3;
                g.beginPath(); g.moveTo(px, GROUND - 2); g.lineTo(px - leg, GROUND + 1); g.moveTo(px + 10, GROUND - 2); g.lineTo(px + 10 + leg, GROUND + 1); g.stroke();
            }
            glowText(g, `${Math.floor(dist)}m`, W - 16, 18, 15, C.text, "right");
        });
    }
};

export const ARCADE: GameDef[] = [flappy, glowSnake, orbRoll, blocks, pong, bricks, shooter, runner];
