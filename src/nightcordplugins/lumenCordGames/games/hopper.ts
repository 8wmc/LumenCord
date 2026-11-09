/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Road Hopper: Crossy Road / Frogger style endless hopper. */

import { GameDef, pick, rand, randInt } from "./core";
import { muteButton, Particles, sfx, Shake, text, titleCard } from "./fx";

const T = 48, COLS = 13, W = COLS * T, H = 560, VIS = Math.ceil(H / T) + 2;
type RType = "grass" | "road" | "river" | "rail";
interface Obj { x: number; w: number; color: string; }
interface Row { type: RType; dir: number; speed: number; objs: Obj[]; trees: Set<number>; trainT: number; warn: number; }

const CAR_COLORS = ["#f43f5e", "#38bdf8", "#facc15", "#a855f7", "#22c55e", "#fb923c", "#f472b6"];

function block(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: string, side: string, lift = 10) {
    g.fillStyle = side;
    g.fillRect(x, y - lift + h, w, lift);
    g.fillStyle = top;
    g.fillRect(x, y - lift, w, h);
}

export const hopper: GameDef = {
    id: "hopper", name: "Road Hopper", icon: "🐥", color: "#4ade80", category: "Arcade", selfSound: true,
    description: "Hop across busy roads, rivers and train tracks. How far can you get? Don't stand still too long!",
    controls: "Arrow keys / WASD to hop",
    start(api) {
        const { cv, g } = api.canvas(W, H);
        muteButton(api);
        const fx = new Particles(), shake = new Shake();
        const rows = new Map<number, Row>();
        const p = { col: 6, row: 0, x: 6 * T, hopT: 0, fromX: 6 * T, fromRow: 0, face: "up" as "up" | "down" | "left" | "right", dead: false };
        let camY = -2, best = 0, t = 0, started = false, streak = 0, lastType: RType = "grass";

        function genRow(i: number): Row {
            let type: RType = "grass";
            if (i > 2) {
                if (streak > 0) { streak--; type = lastType; }
                else {
                    const r = Math.random(), diff = Math.min(1, i / 300);
                    type = r < .32 - diff * .1 ? "grass" : r < .7 ? "road" : r < .9 ? "river" : "rail";
                    if (type !== "grass" && type !== "rail") streak = randInt(0, type === "road" ? 3 : 2);
                }
            }
            if (type === lastType && type === "rail") type = "grass";
            lastType = type;
            const diff = Math.min(1, i / 250);
            const row: Row = { type, dir: Math.random() < .5 ? -1 : 1, speed: 0, objs: [], trees: new Set(), trainT: rand(2, 6), warn: 0 };
            if (type === "grass") {
                const n = i < 3 ? 0 : randInt(1, 4);
                for (let k = 0; k < n; k++) { const c = randInt(0, COLS - 1); if (i > 2 || Math.abs(c - 6) > 1) row.trees.add(c); }
                row.trees.add(-1); row.trees.add(COLS);
            } else if (type === "road") {
                row.speed = rand(70, 150) * (1 + diff * .8);
                const w = pick([1.4, 1.6, 2.4]) * T;
                let x = rand(0, 3) * T;
                while (x < W + 4 * T) { row.objs.push({ x, w, color: pick(CAR_COLORS) }); x += w + rand(2.2, 5) * T; }
            } else if (type === "river") {
                row.speed = rand(45, 100) * (1 + diff * .4);
                let x = rand(0, 2) * T;
                while (x < W + 5 * T) { const w = randInt(2, 4) * T; row.objs.push({ x, w, color: "#92400e" }); x += w + rand(1.3, 2.6) * T; }
            }
            return row;
        }
        const rowAt = (i: number) => { let r = rows.get(i); if (!r) { r = genRow(i); rows.set(i, r); } return r; };
        for (let i = -3; i < VIS + 3; i++) rowAt(i);

        function hop(dir: "up" | "down" | "left" | "right") {
            if (!started) { started = true; return; }
            if (p.dead || p.hopT > 0) return;
            const dc = dir === "left" ? -1 : dir === "right" ? 1 : 0, dr = dir === "up" ? 1 : dir === "down" ? -1 : 0;
            const nc = Math.round(p.x / T) + dc, nr = p.row + dr;
            p.face = dir;
            if (nc < 0 || nc >= COLS) return;
            const target = rowAt(nr);
            if (target.type === "grass" && target.trees.has(nc)) return;
            if (nr < camY - 1) return;
            p.fromX = p.x; p.fromRow = p.row;
            p.col = nc; p.row = nr;
            p.hopT = .13;
            sfx.jump();
        }
        api.onKey((e, d) => {
            if (!d) return;
            const map: Record<string, "up" | "down" | "left" | "right"> = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
            if (map[e.key]) { if (!e.repeat) hop(map[e.key]); return true; }
            if (e.key === " " && !started) { started = true; return true; }
        });
        cv.addEventListener("mousedown", () => { if (!started) started = true; });

        function die(msg: string, splash = false) {
            if (p.dead) return;
            p.dead = true;
            shake.hit(8, .3);
            splash ? sfx.lose() : sfx.hit();
            const sy = H - (p.row - camY + 1) * T + T / 2;
            fx.burst(p.x + T / 2, sy, { n: 40, color: splash ? ["#7dd3fc", "#fff"] : ["#f0abfc", "#fff", "#fde047"], speed: 260, life: .9, gravity: 400 });
            api.later(() => api.end(best, msg, `You hopped ${best} rows`), 1000);
        }

        const rowY = (r: number) => H - (r - camY + 1) * T;

        api.loop(dt => {
            t += dt;
            // move traffic and logs
            for (let i = Math.floor(camY) - 2; i < camY + VIS + 2; i++) {
                const row = rowAt(i);
                if (row.type === "road" || row.type === "river") {
                    const span = W + 6 * T;
                    for (const o of row.objs) {
                        o.x += row.dir * row.speed * dt;
                        if (row.dir > 0 && o.x > W + T) o.x -= span;
                        if (row.dir < 0 && o.x + o.w < -T) o.x += span;
                    }
                } else if (row.type === "rail") {
                    row.trainT -= dt;
                    if (row.trainT < 1.2 && row.trainT > 0 && row.warn === 0) row.warn = 1;
                    if (row.trainT <= 0 && !row.objs.length) { row.objs.push({ x: row.dir > 0 ? -14 * T : W, w: 14 * T, color: "#e2e8f0" }); row.warn = 0; if (Math.abs(i - p.row) < 4) sfx.boom(); }
                    for (const o of row.objs) o.x += row.dir * 1100 * dt;
                    if (row.objs.length && (row.dir > 0 ? row.objs[0].x > W + T : row.objs[0].x < -15 * T)) { row.objs = []; row.trainT = rand(4, 9); }
                }
            }
            if (started && !p.dead) {
                // hop animation
                if (p.hopT > 0) {
                    p.hopT -= dt;
                    const k = 1 - Math.max(0, p.hopT) / .13;
                    p.x = p.fromX + (p.col * T - p.fromX) * k;
                    if (p.hopT <= 0) {
                        p.x = p.col * T;
                        best = Math.max(best, p.row);
                        api.setScore(best);
                    }
                }
                const row = rowAt(p.row);
                const cx = p.x + T / 2;
                if (p.hopT <= 0) {
                    if (row.type === "river") {
                        const log = row.objs.find(o => cx > o.x + 4 && cx < o.x + o.w - 4);
                        if (!log) die("Splash! You fell in the river", true);
                        else { p.x += row.dir * row.speed * dt; p.col = Math.round(p.x / T); if (p.x < -T / 2 || p.x > W - T / 2) die("Swept away by the river", true); }
                    }
                }
                if (row.type === "road" || row.type === "rail") {
                    for (const o of row.objs) if (cx + 14 > o.x && cx - 14 < o.x + o.w) die(row.type === "rail" ? "Hit by a train!" : "Squashed by a car!");
                }
                // camera: follows you and slowly pushes forward
                const push = .35 + Math.min(.9, best / 200);
                camY += Math.max(push * dt, (p.row - 3 - camY) * Math.min(1, dt * 3));
                if (p.row < camY - .6) die("Too slow! The screen caught you");
                for (const key of rows.keys()) if (key < camY - 6) rows.delete(key);
            }
            fx.update(dt); shake.update(dt);

            // ── draw ──
            g.save();
            shake.apply(g);
            for (let i = Math.floor(camY) + VIS; i >= Math.floor(camY) - 1; i--) {
                const row = rowAt(i), y = rowY(i);
                if (row.type === "grass") {
                    g.fillStyle = i % 2 ? "#4c1d95" : "#5b21b6";
                    g.fillRect(0, y, W, T);
                } else if (row.type === "road") {
                    g.fillStyle = "#1e1b2e"; g.fillRect(0, y, W, T);
                    const nr = rowAt(i + 1);
                    if (nr.type === "road") { g.fillStyle = "rgba(255,255,255,.35)"; for (let x = 10; x < W; x += 52) g.fillRect(x, y - 2, 26, 4); }
                } else if (row.type === "river") {
                    g.fillStyle = "#1d4ed8"; g.fillRect(0, y, W, T);
                    g.fillStyle = "rgba(147,197,253,.35)";
                    for (let x = (t * 30 * row.dir) % 60 - 60; x < W; x += 60) g.fillRect(x, y + 14 + (i % 3) * 6, 26, 3);
                } else {
                    g.fillStyle = "#334155"; g.fillRect(0, y, W, T);
                    g.fillStyle = "#78716c"; for (let x = 4; x < W; x += 18) g.fillRect(x, y + 8, 7, T - 16);
                    g.fillStyle = "#cbd5e1"; g.fillRect(0, y + 14, W, 3); g.fillRect(0, y + T - 17, W, 3);
                    // warning light
                    const on = row.warn && Math.floor(t * 8) % 2 === 0;
                    g.fillStyle = on ? "#ef4444" : "#450a0a";
                    g.shadowColor = "#ef4444"; g.shadowBlur = on ? 16 : 0;
                    g.beginPath(); g.arc(W - 16, y + 10, 6, 0, Math.PI * 2); g.fill();
                    g.shadowBlur = 0;
                }
            }
            // objects (drawn top row first so nearer rows overlap)
            for (let i = Math.floor(camY) + VIS; i >= Math.floor(camY) - 1; i--) {
                const row = rowAt(i), y = rowY(i);
                if (row.type === "grass") {
                    for (const c of row.trees) {
                        if (c < 0 || c >= COLS) continue;
                        block(g, c * T + 8, y + 24, 32, 18, "#78350f", "#451a03", 6);
                        block(g, c * T + 4, y + 2, 40, 30, "#22c55e", "#15803d", 18);
                        g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(c * T + 8, y - 14, 14, 6);
                    }
                } else if (row.type === "river") {
                    for (const o of row.objs) {
                        block(g, o.x, y + 8, o.w, T - 16, "#b45309", "#78350f", 6);
                        g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 2;
                        for (let x = o.x + 20; x < o.x + o.w - 10; x += 24) { g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x, y + T - 14); g.stroke(); }
                    }
                } else if (row.type === "road") {
                    for (const o of row.objs) {
                        const x = o.x, cy = y + 6;
                        block(g, x, cy + 6, o.w, T - 16, o.color, "#0f0a1f", 12);
                        g.fillStyle = "rgba(15,23,42,.75)";
                        g.fillRect(x + (row.dir > 0 ? o.w * .55 : o.w * .12), cy - 2, o.w * .3, T - 24);
                        g.fillStyle = "#fef08a"; g.shadowColor = "#fef08a"; g.shadowBlur = 12;
                        const hx = row.dir > 0 ? x + o.w - 4 : x;
                        g.fillRect(hx, cy + 2, 4, 6); g.fillRect(hx, cy + T - 24, 4, 6);
                        g.shadowBlur = 0;
                    }
                } else if (row.type === "rail") {
                    for (const o of row.objs) {
                        block(g, o.x, y + 4, o.w, T - 8, "#e2e8f0", "#64748b", 16);
                        g.fillStyle = "#38bdf8";
                        for (let x = o.x + 14; x < o.x + o.w - 20; x += 46) g.fillRect(x, y - 6, 30, 12);
                        g.fillStyle = "#ef4444"; g.fillRect(row.dir > 0 ? o.x + o.w - 10 : o.x, y - 12, 10, T - 8);
                    }
                }
                if (i === p.row && !p.dead) {
                    // the hopper (a little glowing chick)
                    const k = p.hopT > 0 ? 1 - p.hopT / .13 : 1;
                    const jump = p.hopT > 0 ? Math.sin(k * Math.PI) * 18 : 0;
                    const ry = p.hopT > 0 ? rowY(p.fromRow) + (rowY(p.row) - rowY(p.fromRow)) * k : y;
                    const x = p.x + 9;
                    g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(x + 15, ry + T - 10, 15, 6, 0, 0, Math.PI * 2); g.fill();
                    const by = ry + 12 - jump;
                    g.shadowColor = "#f0abfc"; g.shadowBlur = 14;
                    block(g, x, by, 30, 26, "#fdf4ff", "#d8b4fe", 12);
                    g.shadowBlur = 0;
                    g.fillStyle = "#f43f5e"; g.fillRect(x + 11, by - 18, 8, 6);
                    g.fillStyle = "#1e1b4b";
                    const ex = p.face === "left" ? -4 : p.face === "right" ? 4 : 0;
                    if (p.face !== "down") { g.fillRect(x + 6 + ex, by - 6, 4, 4); g.fillRect(x + 20 + ex, by - 6, 4, 4); }
                    g.fillStyle = "#fb923c";
                    if (p.face === "up") g.fillRect(x + 12, by - 12, 6, 4);
                    else if (p.face === "left") g.fillRect(x - 4, by - 2, 6, 5);
                    else if (p.face === "right") g.fillRect(x + 28, by - 2, 6, 5);
                    else g.fillRect(x + 12, by + 2, 6, 5);
                }
            }
            fx.draw(g);
            text(g, String(best), W / 2, 34, 34, "#fff", "center", 900, "#a855f7");
            if (!started) titleCard(g, W, H, "Road Hopper", ["Hop with the arrow keys", "Ride logs across rivers · watch for trains!"], t, "#4ade80");
            g.restore();
        });
    }
};
