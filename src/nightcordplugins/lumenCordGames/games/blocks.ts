/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Lumen Blocks: falling-block puzzle (Tetris style) with SRS rotation, hold, ghost and next queue. */

import { GameDef, shuffle } from "./core";
import { Floaters, muteButton, nebula, Particles, sfx, Shake, text, titleCard } from "./fx";

const W = 760, H = 560, COLS = 10, ROWS = 20, CELL = 26;
const BX = (W - COLS * CELL) / 2, BY = 20;

type Kind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
const SHAPES: Record<Kind, number[][]> = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};
const COLORS: Record<Kind, string> = { I: "#22d3ee", O: "#fde047", T: "#c084fc", S: "#4ade80", Z: "#f87171", J: "#60a5fa", L: "#fb923c" };
// SRS wall kicks (y is up in the spec, so we flip the sign)
const KICKS: Record<string, number[][]> = {
    "01": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "10": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    "12": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "21": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    "23": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "32": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    "30": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "03": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICKS_I: Record<string, number[][]> = {
    "01": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], "10": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    "12": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], "21": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    "23": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], "32": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    "30": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], "03": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

const sprites = new Map<string, HTMLCanvasElement>();
function blockSprite(color: string) {
    let c = sprites.get(color);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = CELL * 2;
    const g = c.getContext("2d")!;
    g.scale(2, 2);
    const s = CELL;
    const grd = g.createLinearGradient(0, 0, s, s);
    grd.addColorStop(0, "#fff");
    grd.addColorStop(.18, color);
    grd.addColorStop(1, "#000");
    g.fillStyle = grd;
    g.fillRect(1, 1, s - 2, s - 2);
    g.fillStyle = color;
    g.globalAlpha = .85;
    g.fillRect(4, 4, s - 8, s - 8);
    g.globalAlpha = .45;
    g.fillStyle = "#fff";
    g.fillRect(5, 5, s - 12, 3);
    g.globalAlpha = 1;
    g.strokeStyle = "rgba(255,255,255,.5)";
    g.strokeRect(1.5, 1.5, s - 3, s - 3);
    sprites.set(color, c);
    return c;
}

export const blocks: GameDef = {
    id: "blocks", name: "Lumen Blocks", icon: "🧱", color: "#c084fc", category: "Puzzle",
    selfSound: true,
    description: "Stack the falling blocks and clear full lines. Clear 4 at once for a TETRIS!",
    controls: "← → move · ↑/X rotate · Z rotate back · ↓ soft drop · Space hard drop · C/Shift hold",
    start(api) {
        const { cv, g } = api.canvas(W, H);
        muteButton(api);
        const fx = new Particles(), shake = new Shake(), floaters = new Floaters();
        const board: (Kind | null)[][] = Array.from({ length: ROWS + 2 }, () => Array(COLS).fill(null)); // 2 hidden rows on top
        let bag: Kind[] = [];
        const next = (): Kind => { if (!bag.length) bag = shuffle(["I", "O", "T", "S", "Z", "J", "L"] as Kind[]); return bag.pop()!; };
        const queue: Kind[] = [next(), next(), next(), next()];
        let cur = { k: "T" as Kind, m: SHAPES.T, x: 3, y: 0, r: 0 };
        let hold: Kind | null = null, holdUsed = false;
        let score = 0, lines = 0, level = 1, t = 0, fall = 0, lockT = 0, lockResets = 0, started = false, over = false;
        let clearing: number[] = [], clearT = 0, combo = -1;
        const held = { left: 0, right: 0, down: false };

        const rotate = (m: number[][], dir: number) => {
            const n = m.length, out = m.map(r => r.slice());
            for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y][x] = dir > 0 ? m[n - 1 - x][y] : m[x][n - 1 - y];
            return out;
        };
        const fits = (m: number[][], x: number, y: number) => {
            for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
                if (!m[r][c]) continue;
                const bx = x + c, by = y + r;
                if (bx < 0 || bx >= COLS || by >= ROWS + 2) return false;
                if (by >= 0 && board[by][bx]) return false;
            }
            return true;
        };
        const gravity = () => Math.pow(.8 - (level - 1) * .007, level - 1);

        function spawn(k?: Kind) {
            const kind = k ?? queue.shift()!;
            if (!k) queue.push(next());
            cur = { k: kind, m: SHAPES[kind].map(r => r.slice()), x: kind === "O" ? 4 : 3, y: 0, r: 0 };
            holdUsed = holdUsed && !!k;
            lockT = 0; lockResets = 0; fall = 0;
            if (!fits(cur.m, cur.x, cur.y)) gameOver();
        }
        function gameOver() {
            if (over) return;
            over = true;
            sfx.lose();
            shake.hit(8, .4);
            api.later(() => api.end(score, "Topped out!", `${lines} lines · level ${level}`), 900);
        }
        function tryMove(dx: number, dy: number) {
            if (fits(cur.m, cur.x + dx, cur.y + dy)) {
                cur.x += dx; cur.y += dy;
                if (dx && onGround() && lockResets < 15) { lockT = 0; lockResets++; }
                return true;
            }
            return false;
        }
        const onGround = () => !fits(cur.m, cur.x, cur.y + 1);
        function rot(dir: number) {
            if (cur.k === "O") return;
            const m = rotate(cur.m, dir);
            const to = (cur.r + dir + 4) % 4;
            const table = (cur.k === "I" ? KICKS_I : KICKS)[`${cur.r}${to}`];
            for (const [kx, ky] of table) {
                if (fits(m, cur.x + kx, cur.y - ky)) {
                    cur.m = m; cur.x += kx; cur.y -= ky; cur.r = to;
                    if (onGround() && lockResets < 15) { lockT = 0; lockResets++; }
                    sfx.select();
                    return;
                }
            }
        }
        function lock() {
            let topOut = true;
            for (let r = 0; r < cur.m.length; r++) for (let c = 0; c < cur.m.length; c++) {
                if (!cur.m[r][c]) continue;
                const by = cur.y + r;
                if (by >= 0) board[by][cur.x + c] = cur.k;
                if (by >= 2) topOut = false;
            }
            sfx.place();
            if (topOut) return gameOver();
            const full: number[] = [];
            for (let y = 0; y < ROWS + 2; y++) if (board[y].every(Boolean)) full.push(y);
            if (full.length) {
                clearing = full; clearT = .28;
                combo++;
                const pts = [0, 100, 300, 500, 800][full.length] * level + Math.max(0, combo) * 50 * level;
                score += pts;
                lines += full.length;
                level = 1 + Math.floor(lines / 10);
                const midY = BY + (full[0] - 2 + full.length / 2) * CELL;
                floaters.add(W / 2, midY, full.length === 4 ? "TETRIS!" : `+${pts}`, full.length === 4 ? "#22d3ee" : "#fde047", full.length === 4 ? 34 : 20);
                if (combo > 0) floaters.add(W / 2, midY + 30, `${combo} combo`, "#f0abfc", 16);
                for (const y of full) for (let x = 0; x < COLS; x++) fx.burst(BX + x * CELL + CELL / 2, BY + (y - 2) * CELL + CELL / 2, { n: 4, color: COLORS[board[y][x]!], speed: 260, life: .7, size: 3, gravity: 300 });
                if (full.length === 4) { shake.hit(8, .35); sfx.win(); } else sfx.clear();
            } else {
                combo = -1;
                spawn();
            }
            api.setScore(score);
            api.setStatus(`Level ${level} · ${lines} lines`);
        }
        function hardDrop() {
            let d = 0;
            while (fits(cur.m, cur.x, cur.y + 1)) { cur.y++; d++; }
            score += d * 2;
            shake.hit(3, .1);
            lock();
        }
        function doHold() {
            if (holdUsed) return;
            const k = cur.k;
            if (hold) spawn(hold); else spawn();
            hold = k;
            holdUsed = true;
            sfx.select();
        }

        api.onKey((e, down) => {
            const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            const mine = ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "x", "z", "c", "Shift", "a", "d", "s", "w"].includes(key);
            if (!mine) return;
            if (!started && down && key === " ") { started = true; return true; }
            if (!started || over || clearing.length) {
                if (key === "ArrowLeft" || key === "a") held.left = down ? .0001 : 0;
                if (key === "ArrowRight" || key === "d") held.right = down ? .0001 : 0;
                return true;
            }
            if (key === "ArrowLeft" || key === "a") { if (down && !e.repeat) { tryMove(-1, 0); held.left = .0001; held.right = 0; } else if (!down) held.left = 0; }
            if (key === "ArrowRight" || key === "d") { if (down && !e.repeat) { tryMove(1, 0); held.right = .0001; held.left = 0; } else if (!down) held.right = 0; }
            if (key === "ArrowDown" || key === "s") held.down = down;
            if (!down || e.repeat) return true;
            if (key === "ArrowUp" || key === "x" || key === "w") rot(1);
            if (key === "z") rot(-1);
            if (key === " ") hardDrop();
            if (key === "c" || key === "Shift") doHold();
            return true;
        });
        cv.addEventListener("mousedown", () => { if (!started) started = true; });

        function drawCell(x: number, y: number, color: string, alpha = 1, size = CELL) {
            g.globalAlpha = alpha;
            g.drawImage(blockSprite(color), x, y, size, size);
            g.globalAlpha = 1;
        }
        function drawMini(k: Kind | null, x: number, y: number, label: string, dim = false) {
            g.fillStyle = "rgba(15,10,40,.75)";
            g.strokeStyle = "rgba(192,132,252,.35)";
            g.lineWidth = 1.5;
            g.beginPath(); g.roundRect(x, y, 112, 84, 10); g.fill(); g.stroke();
            text(g, label, x + 56, y + 13, 12, "#c4b5fd", "center", 800, "#000");
            if (!k) return;
            const m = SHAPES[k], s = 20;
            const cells: [number, number][] = [];
            m.forEach((row, r) => row.forEach((v, c) => { if (v) cells.push([c, r]); }));
            const minX = Math.min(...cells.map(p => p[0])), maxX = Math.max(...cells.map(p => p[0]));
            const minY = Math.min(...cells.map(p => p[1])), maxY = Math.max(...cells.map(p => p[1]));
            const ox = x + 56 - (maxX - minX + 1) * s / 2, oy = y + 50 - (maxY - minY + 1) * s / 2;
            for (const [c, r] of cells) drawCell(ox + (c - minX) * s, oy + (r - minY) * s, COLORS[k], dim ? .35 : 1, s);
        }

        spawn();
        api.setStatus("Level 1 · 0 lines");
        api.loop(dt => {
            t += dt;
            fx.update(dt); shake.update(dt); floaters.update(dt);
            if (started && !over) {
                if (clearing.length) {
                    clearT -= dt;
                    if (clearT <= 0) {
                        for (const y of clearing) { board.splice(y, 1); board.unshift(Array(COLS).fill(null)); }
                        clearing = [];
                        spawn();
                    }
                } else {
                    // auto-repeat (DAS 150ms, ARR 40ms)
                    for (const dir of ["left", "right"] as const) {
                        if (!held[dir]) continue;
                        held[dir] += dt;
                        while (held[dir] > .19) { tryMove(dir === "left" ? -1 : 1, 0); held[dir] -= .04; }
                    }
                    const g2 = held.down ? Math.min(gravity(), .03) : gravity();
                    fall += dt;
                    while (fall >= g2) {
                        fall -= g2;
                        if (tryMove(0, 1)) { if (held.down) score++; } else break;
                    }
                    if (onGround()) {
                        lockT += dt;
                        if (lockT > .5) lock();
                    } else lockT = 0;
                }
            }

            // ── draw ──
            g.save();
            shake.apply(g);
            nebula(g, W, H, 270);
            // board frame
            g.fillStyle = "rgba(8,5,25,.82)";
            g.fillRect(BX - 4, BY - 4, COLS * CELL + 8, ROWS * CELL + 8);
            g.shadowColor = "#a855f7"; g.shadowBlur = 20;
            g.strokeStyle = "#a855f7"; g.lineWidth = 2;
            g.strokeRect(BX - 4, BY - 4, COLS * CELL + 8, ROWS * CELL + 8);
            g.shadowBlur = 0;
            g.strokeStyle = "rgba(168,85,247,.08)"; g.lineWidth = 1;
            for (let x = 1; x < COLS; x++) { g.beginPath(); g.moveTo(BX + x * CELL, BY); g.lineTo(BX + x * CELL, BY + ROWS * CELL); g.stroke(); }
            for (let y = 1; y < ROWS; y++) { g.beginPath(); g.moveTo(BX, BY + y * CELL); g.lineTo(BX + COLS * CELL, BY + y * CELL); g.stroke(); }
            // settled blocks
            for (let y = 2; y < ROWS + 2; y++) for (let x = 0; x < COLS; x++) {
                const k = board[y][x];
                if (!k) continue;
                if (clearing.includes(y)) {
                    const a = clearT / .28;
                    g.fillStyle = `rgba(255,255,255,${a})`;
                    g.fillRect(BX + x * CELL, BY + (y - 2) * CELL, CELL, CELL);
                    continue;
                }
                drawCell(BX + x * CELL, BY + (y - 2) * CELL, COLORS[k]);
            }
            if (started && !over && !clearing.length) {
                // ghost
                let gy = cur.y;
                while (fits(cur.m, cur.x, gy + 1)) gy++;
                cur.m.forEach((row, r) => row.forEach((v, c) => {
                    if (!v || gy + r < 2) return;
                    g.strokeStyle = COLORS[cur.k]; g.globalAlpha = .55; g.lineWidth = 2;
                    g.strokeRect(BX + (cur.x + c) * CELL + 2, BY + (gy + r - 2) * CELL + 2, CELL - 4, CELL - 4);
                    g.globalAlpha = 1;
                }));
                cur.m.forEach((row, r) => row.forEach((v, c) => {
                    if (v && cur.y + r >= 2) drawCell(BX + (cur.x + c) * CELL, BY + (cur.y + r - 2) * CELL, COLORS[cur.k], 1 - (onGround() ? lockT : 0) * .6);
                }));
            }
            // side panels
            drawMini(hold, BX - 140, BY, "HOLD", holdUsed);
            queue.slice(0, 3).forEach((k, i) => drawMini(k, BX + COLS * CELL + 28, BY + i * 96, i ? "" : "NEXT"));
            const sx = BX - 140;
            text(g, "SCORE", sx + 56, BY + 130, 13, "#c4b5fd", "center", 800, "#000");
            text(g, String(score), sx + 56, BY + 156, 26, "#fff", "center", 900);
            text(g, "LEVEL", sx + 56, BY + 200, 13, "#c4b5fd", "center", 800, "#000");
            text(g, String(level), sx + 56, BY + 226, 26, "#fde047", "center", 900, "#f59e0b");
            text(g, "LINES", sx + 56, BY + 270, 13, "#c4b5fd", "center", 800, "#000");
            text(g, String(lines), sx + 56, BY + 296, 26, "#67e8f9", "center", 900, "#0891b2");
            fx.draw(g);
            floaters.draw(g);
            if (!started) titleCard(g, W, H, "Lumen Blocks", ["← → move · ↑ rotate · Space hard drop", "↓ soft drop · C hold"], t, "#c084fc");
            g.restore();
        });
    }
};
