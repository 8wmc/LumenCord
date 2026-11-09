/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Gem Swap (match-3), Bubble Pop (bubble shooter), Block Blast (block puzzle) */

import { GameDef, pick, randInt, shuffle } from "./core";
import { Floaters, muteButton, nebula, Particles, sfx, Shake, text, titleCard } from "./fx";

const GEM_COLORS = ["#f43f5e", "#f59e0b", "#facc15", "#22c55e", "#38bdf8", "#a855f7", "#f472b6"];

/** gem sprites: a different shape per colour, drawn once */
const gemCache = new Map<string, HTMLCanvasElement>();
function gemSprite(type: number, special: "" | "line" | "bomb" = "") {
    const key = `${type}${special}`;
    let c = gemCache.get(key);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 96;
    const g = c.getContext("2d")!;
    g.translate(48, 48);
    if (special === "bomb") {
        const grd = g.createRadialGradient(-12, -14, 4, 0, 0, 38);
        grd.addColorStop(0, "#fff"); grd.addColorStop(.5, "#e9d5ff"); grd.addColorStop(1, "#4c1d95");
        g.fillStyle = grd;
        g.beginPath(); g.arc(0, 0, 34, 0, Math.PI * 2); g.fill();
        GEM_COLORS.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(Math.cos(i / 7 * Math.PI * 2) * 18, Math.sin(i / 7 * Math.PI * 2) * 18, 7, 0, Math.PI * 2); g.fill(); });
        gemCache.set(key, c);
        return c;
    }
    const col = GEM_COLORS[type];
    const grd = g.createLinearGradient(-34, -34, 34, 34);
    grd.addColorStop(0, "#fff"); grd.addColorStop(.3, col); grd.addColorStop(1, "#000");
    g.fillStyle = grd;
    g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 3;
    g.beginPath();
    const poly = (n: number, r: number, rot = -Math.PI / 2) => { for (let i = 0; i < n; i++) { const a = rot + i / n * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
    switch (type) {
        case 0: poly(4, 36); break;                    // diamond
        case 1: g.arc(0, 0, 33, 0, Math.PI * 2); break; // orb
        case 2: poly(6, 35); break;                     // hexagon
        case 3: g.roundRect(-30, -30, 60, 60, 12); break;
        case 4: poly(3, 38, -Math.PI / 2); break;       // triangle
        case 5: for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI * 2, r = i % 2 ? 16 : 37; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); break; // star
        default: poly(8, 34, Math.PI / 8); break;      // octagon
    }
    g.fill(); g.stroke();
    // facet shine
    g.fillStyle = "rgba(255,255,255,.45)";
    g.beginPath(); g.ellipse(-10, -12, 12, 6, -.6, 0, Math.PI * 2); g.fill();
    if (special === "line") {
        g.strokeStyle = "#fff"; g.lineWidth = 5;
        for (const y of [-8, 0, 8]) { g.beginPath(); g.moveTo(-26, y); g.lineTo(26, y); g.stroke(); }
    }
    gemCache.set(key, c);
    return c;
}

// ───────────────────────── Gem Swap ─────────────────────────
export const gemSwap: GameDef = {
    id: "gemswap", name: "Gem Swap", icon: "💎", color: "#ec4899", category: "Puzzle", selfSound: true,
    description: "Match-3 like Bejeweled/Candy Crush. Swap gems to line up 3+. Match 4 for a line blaster, 5 for a rainbow bomb!",
    controls: "Click a gem then a neighbour (or drag)",
    start(api) {
        const N = 8, S = 60, W = N * S + 220, H = N * S + 40, OX = 20, OY = 20;
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        const fx = new Particles(), shake = new Shake(), floaters = new Floaters();
        interface Gem { type: number; special: "" | "line" | "bomb"; x: number; y: number; pop: number; }
        let board: (Gem | null)[][] = [];
        let sel: [number, number] | null = null, busy = false, score = 0, moves = 30, combo = 0, t = 0, started = false, over = false, dragFrom: [number, number] | null = null, hint: [number, number] | null = null, idleT = 0;

        const newGem = (r: number, c: number, fromAbove = 0): Gem => ({ type: randInt(0, 6), special: "", x: c, y: r - fromAbove, pop: 0 });
        function fill() {
            board = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => newGem(r, c, N + 2)));
            while (findMatches().length) for (const [r, c] of findMatches().flat()) board[r][c] = newGem(r, c, N + 2);
            if (!hasMove()) fill();
        }
        function findMatches(): [number, number][][] {
            const groups: [number, number][][] = [];
            for (let r = 0; r < N; r++) for (let c = 0; c < N;) {
                const t0 = board[r][c]?.type; let e = c + 1;
                while (e < N && board[r][e] && board[r][e]!.type === t0 && board[r][c]!.special !== "bomb" && board[r][e]!.special !== "bomb") e++;
                if (t0 != null && e - c >= 3) groups.push(Array.from({ length: e - c }, (_, i) => [r, c + i]));
                c = e;
            }
            for (let c = 0; c < N; c++) for (let r = 0; r < N;) {
                const t0 = board[r][c]?.type; let e = r + 1;
                while (e < N && board[e][c] && board[e][c]!.type === t0 && board[r][c]!.special !== "bomb" && board[e][c]!.special !== "bomb") e++;
                if (t0 != null && e - r >= 3) groups.push(Array.from({ length: e - r }, (_, i) => [r + i, c]));
                r = e;
            }
            return groups;
        }
        function hasMove(): [number, number] | null {
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
                const r2 = r + dr, c2 = c + dc;
                if (r2 >= N || c2 >= N) continue;
                if (board[r][c]?.special === "bomb" || board[r2][c2]?.special === "bomb") return [r, c];
                [board[r][c], board[r2][c2]] = [board[r2][c2], board[r][c]];
                const ok = findMatches().length > 0;
                [board[r][c], board[r2][c2]] = [board[r2][c2], board[r][c]];
                if (ok) return [r, c];
            }
            return null;
        }
        const wait = (ms: number) => new Promise<void>(res => api.later(res, ms));
        const settled = () => board.every((row, r) => row.every((gm, c) => !gm || (Math.abs(gm.x - c) < .01 && Math.abs(gm.y - r) < .01)));
        async function waitSettled() { for (let i = 0; i < 80 && !settled(); i++) await wait(16); }

        function clearCell(r: number, c: number, cleared: Set<string>) {
            const key = `${r},${c}`;
            if (cleared.has(key) || !board[r][c]) return;
            cleared.add(key);
            const gm = board[r][c]!;
            if (gm.special === "line") {
                for (let i = 0; i < N; i++) { clearCell(r, i, cleared); }
                fx.burst(OX + N * S / 2, OY + r * S + S / 2, { n: 40, color: ["#fff", GEM_COLORS[gm.type]], speed: 500, angle: 0, spread: .15, life: .5 });
                fx.burst(OX + N * S / 2, OY + r * S + S / 2, { n: 40, color: ["#fff", GEM_COLORS[gm.type]], speed: 500, angle: Math.PI, spread: .15, life: .5 });
                shake.hit(5, .2);
            }
        }

        async function resolve(swapA?: [number, number], swapB?: [number, number]) {
            combo = 0;
            for (;;) {
                const groups = findMatches();
                if (!groups.length) break;
                combo++;
                const cleared = new Set<string>();
                const makeSpecial: { r: number; c: number; type: number; kind: "line" | "bomb"; }[] = [];
                for (const grp of groups) {
                    if (grp.length >= 4) {
                        const at = [swapA, swapB].find(p => p && grp.some(([r, c]) => r === p[0] && c === p[1])) ?? grp[1];
                        makeSpecial.push({ r: at[0], c: at[1], type: board[grp[0][0]][grp[0][1]]!.type, kind: grp.length >= 5 ? "bomb" : "line" });
                    }
                    for (const [r, c] of grp) clearCell(r, c, cleared);
                }
                const gained = cleared.size * 10 * combo;
                score += gained;
                for (const key of cleared) {
                    const [r, c] = key.split(",").map(Number);
                    const gm = board[r][c];
                    if (gm) fx.burst(OX + c * S + S / 2, OY + r * S + S / 2, { n: 8, color: [GEM_COLORS[gm.type], "#fff"], speed: 200, life: .5, size: 3 });
                    board[r][c] = null;
                }
                for (const s of makeSpecial) board[s.r][s.c] = { type: s.type, special: s.kind, x: s.c, y: s.r, pop: 1 };
                const mid = [...cleared][0].split(",").map(Number);
                floaters.add(OX + mid[1] * S + S / 2, OY + mid[0] * S, combo > 1 ? `+${gained} ×${combo}` : `+${gained}`, combo > 1 ? "#fde047" : "#fff", combo > 1 ? 22 : 17);
                combo > 2 ? sfx.clear() : sfx.point();
                if (combo > 2) shake.hit(combo * 1.5, .2);
                await wait(140);
                // gravity
                for (let c = 0; c < N; c++) {
                    let write = N - 1;
                    for (let r = N - 1; r >= 0; r--) if (board[r][c]) { const gm = board[r][c]!; board[r][c] = null; board[write][c] = gm; write--; }
                    for (let r = write, k = 1; r >= 0; r--, k++) { board[r][c] = newGem(r, c); board[r][c]!.y = -k; }
                }
                await waitSettled();
                swapA = swapB = undefined;
            }
            api.setScore(score);
            if (!hasMove()) {
                floaters.add(OX + N * S / 2, OY + N * S / 2, "No moves, shuffling!", "#c4b5fd", 20);
                await wait(400);
                const flat = shuffle(board.flat());
                board = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => { const gm = flat[r * N + c]!; gm.x = c; gm.y = r - N; return gm; }));
                await waitSettled();
                if (findMatches().length || !hasMove()) await resolve();
            }
        }

        async function trySwap(a: [number, number], b: [number, number]) {
            if (busy || over) return;
            if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) { sel = b; return; }
            busy = true; sel = null; hint = null; idleT = 0;
            const A = board[a[0]][a[1]]!, B = board[b[0]][b[1]]!;
            board[a[0]][a[1]] = B; board[b[0]][b[1]] = A;
            sfx.select();
            await waitSettled();
            // rainbow bomb: clears every gem of the other colour
            const bomb = A.special === "bomb" ? A : B.special === "bomb" ? B : null;
            if (bomb) {
                const other = bomb === A ? B : A;
                const cleared = new Set<string>();
                for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (board[r][c] && (board[r][c]!.type === other.type || board[r][c] === bomb)) clearCell(r, c, cleared);
                score += cleared.size * 25;
                for (const key of cleared) { const [r, c] = key.split(",").map(Number); fx.burst(OX + c * S + S / 2, OY + r * S + S / 2, { n: 10, color: ["#fff", "#f0abfc"], speed: 240 }); board[r][c] = null; }
                sfx.power(); shake.hit(10, .4);
                floaters.add(OX + b[1] * S + S / 2, OY + b[0] * S, `RAINBOW +${cleared.size * 25}`, "#f0abfc", 24);
                for (let c = 0; c < N; c++) {
                    let write = N - 1;
                    for (let r = N - 1; r >= 0; r--) if (board[r][c]) { const gm = board[r][c]!; board[r][c] = null; board[write][c] = gm; write--; }
                    for (let r = write, k = 1; r >= 0; r--, k++) { board[r][c] = newGem(r, c); board[r][c]!.y = -k; }
                }
                await waitSettled();
                moves--;
                await resolve();
            } else if (!findMatches().length) {
                // not a match: swap back
                board[a[0]][a[1]] = A; board[b[0]][b[1]] = B;
                sfx.hit();
                await waitSettled();
            } else {
                moves--;
                await resolve(a, b);
            }
            api.setStatus(`${moves} moves left`);
            busy = false;
            if (moves <= 0) { over = true; api.end(score, "Out of moves!", `Final score ${score}`); }
        }

        const cellAt = (e: MouseEvent): [number, number] | null => {
            const p = toLocal(e);
            const c = Math.floor((p.x - OX) / S), r = Math.floor((p.y - OY) / S);
            return r >= 0 && r < N && c >= 0 && c < N ? [r, c] : null;
        };
        cv.addEventListener("mousedown", e => {
            if (!started) { started = true; return; }
            const cell = cellAt(e);
            if (!cell || busy) return;
            if (sel) void trySwap(sel, cell);
            else { sel = cell; dragFrom = cell; sfx.tick(); }
        });
        cv.addEventListener("mousemove", e => {
            if (!dragFrom || !(e.buttons & 1)) return;
            const cell = cellAt(e);
            if (cell && (cell[0] !== dragFrom[0] || cell[1] !== dragFrom[1])) { const from = dragFrom; dragFrom = null; void trySwap(from, cell); }
        });
        window.addEventListener("mouseup", mup);
        function mup() { dragFrom = null; }
        api.cleanup(() => window.removeEventListener("mouseup", mup));
        api.onKey((e, d) => { if (d && e.key === " " && !started) { started = true; return true; } });

        fill();
        api.setStatus("30 moves left");
        api.loop(dt => {
            t += dt; idleT += dt;
            if (idleT > 6 && !hint && !busy) hint = hasMove();
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
                const gm = board[r][c];
                if (!gm) continue;
                gm.x += (c - gm.x) * Math.min(1, dt * 14);
                gm.y += Math.min(dt * 16, r - gm.y > 0 ? (r - gm.y) : 0) + (r - gm.y < 0 ? (r - gm.y) * Math.min(1, dt * 14) : 0);
                if (Math.abs(gm.x - c) < .01) gm.x = c;
                if (Math.abs(gm.y - r) < .01) gm.y = r;
                gm.pop = Math.max(0, gm.pop - dt * 3);
            }
            fx.update(dt); shake.update(dt); floaters.update(dt);
            g.save();
            shake.apply(g);
            nebula(g, W, H, 300);
            g.fillStyle = "rgba(10,6,30,.65)";
            g.beginPath(); g.roundRect(OX - 6, OY - 6, N * S + 12, N * S + 12, 14); g.fill();
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { g.fillStyle = (r + c) % 2 ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.02)"; g.fillRect(OX + c * S, OY + r * S, S, S); }
            g.save();
            g.beginPath(); g.rect(OX, OY, N * S, N * S); g.clip();
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
                const gm = board[r][c];
                if (!gm) continue;
                const isSel = sel && sel[0] === r && sel[1] === c;
                const isHint = hint && hint[0] === r && hint[1] === c && Math.floor(t * 3) % 2 === 0;
                const sz = S * (.82 + (isSel ? .08 * Math.sin(t * 10) : 0) + gm.pop * .2);
                const x = OX + gm.x * S + S / 2, y = OY + gm.y * S + S / 2;
                if (isSel || isHint) { g.fillStyle = "rgba(253,224,71,.25)"; g.fillRect(OX + c * S + 2, OY + r * S + 2, S - 4, S - 4); }
                g.drawImage(gemSprite(gm.type, gm.special), x - sz / 2, y - sz / 2, sz, sz);
            }
            g.restore();
            fx.draw(g); floaters.draw(g);
            const px = OX + N * S + 30;
            text(g, "SCORE", px, 60, 14, "#c4b5fd", "left", 800, "#000");
            text(g, String(score), px, 90, 32, "#fff", "left", 900, "#ec4899");
            text(g, "MOVES", px, 150, 14, "#c4b5fd", "left", 800, "#000");
            text(g, String(moves), px, 182, 36, moves <= 5 ? "#f87171" : "#fde047", "left", 900, "#f59e0b");
            text(g, "Match 4 → line blaster", px, 260, 12, "#ddd6fe", "left", 600, "#000");
            g.drawImage(gemSprite(5, "line"), px, 272, 34, 34);
            text(g, "Match 5 → rainbow bomb", px, 330, 12, "#ddd6fe", "left", 600, "#000");
            g.drawImage(gemSprite(0, "bomb"), px, 342, 34, 34);
            if (!started) titleCard(g, W, H, "Gem Swap", ["Swap neighbouring gems to make lines of 3+", "30 moves: chain reactions score big!"], t, "#ec4899");
            g.restore();
        });
    }
};

// ───────────────────────── Bubble Pop ─────────────────────────
export const bubblePop: GameDef = {
    id: "bubblepop", name: "Bubble Pop", icon: "🫧", color: "#60a5fa", category: "Puzzle", selfSound: true,
    description: "Bubble shooter! Aim and fire to make groups of 3+ of the same colour. Bubbles left hanging fall for bonus points.",
    controls: "Aim with the mouse · click to shoot · right-click or Space to swap",
    start(api) {
        const COLS = 12, R = 19, D = R * 2, RH = R * Math.sqrt(3), W = COLS * D + R + 40, H = 600, OX = 20, BASE_Y = H - 70;
        const COLORS = ["#f43f5e", "#facc15", "#22c55e", "#38bdf8", "#a855f7", "#fb923c"];
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        const fx = new Particles(), shake = new Shake(), floaters = new Floaters();
        let grid: (number | null)[][] = [], drop = 0, shots = 0, score = 0, t = 0, started = false, over = false;
        let aim = -Math.PI / 2, cur = 0, next = 0, ball: { x: number; y: number; vx: number; vy: number; c: number; } | null = null;
        const falling: { x: number; y: number; vy: number; c: number; }[] = [];
        const cx = (r: number, c: number) => OX + R + c * D + ((r + Math.floor(drop)) % 2 ? R : 0);
        const cy = (r: number) => 30 + R + r * RH + 0;
        const rowCols = (r: number) => (r + Math.floor(drop)) % 2 ? COLS - 1 : COLS;
        const colorsLeft = () => [...new Set(grid.flat().filter(v => v != null))] as number[];
        const pickColor = () => { const left = colorsLeft(); return left.length ? pick(left) : randInt(0, 4); };
        for (let r = 0; r < 6; r++) grid.push(Array.from({ length: COLS }, (_, c) => c < rowCols(r) ? randInt(0, 4) : null));
        for (let r = 6; r < 16; r++) grid.push(Array(COLS).fill(null));
        cur = pickColor(); next = pickColor();

        const neighbours = (r: number, c: number): [number, number][] => {
            const odd = (r + Math.floor(drop)) % 2 === 1;
            const d = odd ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
            return d.map(([dr, dc]) => [r + dr, c + dc] as [number, number]).filter(([rr, cc]) => rr >= 0 && rr < grid.length && cc >= 0 && cc < rowCols(rr));
        };
        function flood(r: number, c: number, same: boolean) {
            const col = grid[r][c], seen = new Set<string>([`${r},${c}`]), out: [number, number][] = [[r, c]];
            for (let i = 0; i < out.length; i++) for (const [rr, cc] of neighbours(out[i][0], out[i][1])) {
                const k = `${rr},${cc}`;
                if (seen.has(k) || grid[rr][cc] == null || (same && grid[rr][cc] !== col)) continue;
                seen.add(k); out.push([rr, cc]);
            }
            return out;
        }
        function snap(x: number, y: number, c: number) {
            let best: [number, number] | null = null, bd = 1e9;
            for (let r = 0; r < grid.length; r++) for (let cc = 0; cc < rowCols(r); cc++) {
                if (grid[r][cc] != null) continue;
                const d = (cx(r, cc) - x) ** 2 + (cy(r) - y) ** 2;
                if (d < bd && (r === 0 || neighbours(r, cc).some(([a, b]) => grid[a][b] != null))) { bd = d; best = [r, cc]; }
            }
            if (!best) return;
            const [r, cc] = best;
            grid[r][cc] = c;
            const grp = flood(r, cc, true);
            if (grp.length >= 3) {
                for (const [a, b] of grp) { fx.burst(cx(a, b), cy(a), { n: 10, color: [COLORS[grid[a][b]!], "#fff"], speed: 200, life: .5 }); grid[a][b] = null; }
                score += grp.length * 10;
                sfx.point();
                // anything no longer connected to the top falls
                const attached = new Set<string>();
                for (let c2 = 0; c2 < rowCols(0); c2++) if (grid[0][c2] != null) for (const [a, b] of flood(0, c2, false)) attached.add(`${a},${b}`);
                let dropped = 0;
                for (let a = 0; a < grid.length; a++) for (let b = 0; b < rowCols(a); b++) if (grid[a][b] != null && !attached.has(`${a},${b}`)) { falling.push({ x: cx(a, b), y: cy(a), vy: -100, c: grid[a][b]! }); grid[a][b] = null; dropped++; }
                if (dropped) { score += dropped * 25; floaters.add(cx(r, cc), cy(r), `+${dropped * 25} DROP!`, "#fde047", 20); sfx.coin(); }
                else floaters.add(cx(r, cc), cy(r), `+${grp.length * 10}`, "#fff");
            } else sfx.place();
            shots++;
            if (shots % 7 === 0) {
                // new row pushes in from the top
                drop++;
                grid.unshift(Array.from({ length: COLS }, (_, c2) => c2 < rowCols(0) ? pickColor() : null));
                grid.pop();
                shake.hit(4, .2);
            }
            if (!colorsLeft().length) { score += 500; floaters.add(W / 2, H / 2, "BOARD CLEAR +500", "#4ade80", 26); sfx.win(); for (let rr = 0; rr < 5; rr++) grid[rr] = Array.from({ length: COLS }, (_, c2) => c2 < rowCols(rr) ? randInt(0, 5) : null); }
            for (let a = 0; a < grid.length; a++) for (let b = 0; b < rowCols(a); b++) if (grid[a][b] != null && cy(a) + R > BASE_Y - 30) {
                over = true; sfx.lose();
                api.later(() => api.end(score, "The bubbles reached the bottom!", `${shots} shots`), 600);
                return;
            }
            api.setScore(score);
        }
        function shoot() {
            if (!started) { started = true; return; }
            if (ball || over) return;
            ball = { x: W / 2, y: BASE_Y, vx: Math.cos(aim) * 900, vy: Math.sin(aim) * 900, c: cur };
            cur = next; next = pickColor();
            sfx.shoot();
        }
        cv.addEventListener("mousemove", e => { const p = toLocal(e); aim = Math.max(-Math.PI + .15, Math.min(-.15, Math.atan2(p.y - BASE_Y, p.x - W / 2))); });
        cv.addEventListener("mousedown", e => { if (e.button === 2) return; shoot(); });
        cv.addEventListener("contextmenu", e => { e.preventDefault(); [cur, next] = [next, cur]; sfx.select(); });
        api.onKey((e, d) => { if (e.key === " " && d) { if (!started) started = true; else [cur, next] = [next, cur]; return true; } });

        const bubble = (x: number, y: number, c: number, r = R - 1) => {
            const grd = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
            grd.addColorStop(0, "#fff"); grd.addColorStop(.3, COLORS[c]); grd.addColorStop(1, "#1e1b4b");
            g.fillStyle = grd;
            g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
            g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.5; g.stroke();
        };
        api.loop(dt => {
            t += dt;
            if (ball) {
                const steps = 4;
                for (let i = 0; i < steps && ball; i++) {
                    ball.x += ball.vx * dt / steps; ball.y += ball.vy * dt / steps;
                    if (ball.x < OX + R) { ball.x = OX + R; ball.vx = Math.abs(ball.vx); sfx.tick(); }
                    if (ball.x > W - 20 - R) { ball.x = W - 20 - R; ball.vx = -Math.abs(ball.vx); sfx.tick(); }
                    let hit = ball.y < cy(0);
                    if (!hit) for (let r = 0; r < grid.length && !hit; r++) for (let c = 0; c < rowCols(r); c++) if (grid[r][c] != null && (cx(r, c) - ball.x) ** 2 + (cy(r) - ball.y) ** 2 < (D * .82) ** 2) { hit = true; break; }
                    if (hit) { const b = ball; ball = null; snap(b.x, b.y, b.c); }
                }
            }
            for (const f of falling) { f.vy += 1400 * dt; f.y += f.vy * dt; }
            while (falling.length && falling[0].y > H + 40) falling.shift();
            fx.update(dt); shake.update(dt); floaters.update(dt);
            g.save();
            shake.apply(g);
            nebula(g, W, H, 215);
            g.strokeStyle = "rgba(248,113,113,.4)"; g.setLineDash([8, 8]); g.lineWidth = 2;
            g.beginPath(); g.moveTo(OX, BASE_Y - 30); g.lineTo(W - 20, BASE_Y - 30); g.stroke(); g.setLineDash([]);
            for (let r = 0; r < grid.length; r++) for (let c = 0; c < rowCols(r); c++) if (grid[r][c] != null) bubble(cx(r, c), cy(r), grid[r][c]!);
            for (const f of falling) bubble(f.x, f.y, f.c);
            // aim guide (with one bounce)
            if (!over) {
                g.fillStyle = "rgba(255,255,255,.5)";
                let x = W / 2, y = BASE_Y, vx = Math.cos(aim), vy = Math.sin(aim);
                for (let i = 0; i < 26; i++) { x += vx * 18; y += vy * 18; if (x < OX + R || x > W - 20 - R) vx = -vx; if (y < 30) break; g.beginPath(); g.arc(x, y, 2.5 - i * .07, 0, Math.PI * 2); g.fill(); }
            }
            if (ball) bubble(ball.x, ball.y, ball.c);
            // launcher
            g.save();
            g.translate(W / 2, BASE_Y); g.rotate(aim + Math.PI / 2);
            g.fillStyle = "#4c1d95"; g.fillRect(-8, -44, 16, 40);
            g.restore();
            g.fillStyle = "#2e1065"; g.beginPath(); g.arc(W / 2, BASE_Y + 10, 34, Math.PI, 0); g.fill();
            if (!ball) bubble(W / 2, BASE_Y, cur);
            bubble(W / 2 + 70, BASE_Y + 24, next, 13);
            text(g, "next", W / 2 + 70, BASE_Y + 50, 11, "#c4b5fd", "center", 700, "#000");
            text(g, String(score), 20, H - 24, 24, "#fff", "left", 900);
            text(g, `Row drops in ${7 - shots % 7}`, W - 24, H - 24, 13, "#c4b5fd", "right", 700, "#000");
            fx.draw(g); floaters.draw(g);
            if (!started) titleCard(g, W, H, "Bubble Pop", ["Aim with the mouse, click to shoot", "Make groups of 3+ · right-click swaps bubbles"], t, "#60a5fa");
            g.restore();
        });
    }
};

// ───────────────────────── Block Blast ─────────────────────────
const SHAPES: number[][][] = [
    [[1]], [[1, 1]], [[1], [1]], [[1, 1, 1]], [[1], [1], [1]], [[1, 1, 1, 1]], [[1], [1], [1], [1]], [[1, 1, 1, 1, 1]], [[1], [1], [1], [1], [1]],
    [[1, 1], [1, 1]], [[1, 1, 1], [1, 1, 1], [1, 1, 1]], [[1, 0], [1, 1]], [[0, 1], [1, 1]], [[1, 1], [1, 0]], [[1, 1], [0, 1]],
    [[1, 0, 0], [1, 0, 0], [1, 1, 1]], [[0, 0, 1], [0, 0, 1], [1, 1, 1]], [[1, 1, 1], [0, 1, 0]], [[0, 1, 0], [1, 1, 1]], [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]],
];
export const blockBlast: GameDef = {
    id: "blockblast", name: "Block Blast", icon: "🟦", color: "#3b82f6", category: "Puzzle", selfSound: true,
    description: "Drag blocks onto the board. Fill a whole row or column to blast it. Clear several at once for combos!",
    controls: "Drag a piece onto the board",
    start(api) {
        const N = 8, S = 50, W = 560, H = 640, OX = (W - N * S) / 2, OY = 30, TRAY = OY + N * S + 40;
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        const fx = new Particles(), shake = new Shake(), floaters = new Floaters();
        const board: (string | null)[][] = Array.from({ length: N }, () => Array(N).fill(null));
        interface Piece { shape: number[][]; color: string; used: boolean; }
        let tray: Piece[] = [], drag: { i: number; x: number; y: number; ox: number; oy: number; } | null = null;
        let score = 0, streak = 0, t = 0, started = false, over = false;
        const COLORS = ["#f43f5e", "#f59e0b", "#facc15", "#22c55e", "#38bdf8", "#a855f7", "#ec4899"];
        const fits = (sh: number[][], r: number, c: number) => sh.every((row, i) => row.every((v, j) => !v || (r + i >= 0 && r + i < N && c + j >= 0 && c + j < N && !board[r + i][c + j])));
        const canPlace = (sh: number[][]) => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(sh, r, c)) return true; return false; };
        function refill() {
            tray = Array.from({ length: 3 }, () => ({ shape: pick(SHAPES), color: pick(COLORS), used: false }));
        }
        refill();
        const trayPos = (i: number) => ({ x: W / 6 + i * W / 3, y: TRAY + 60 });
        const blockAt = (g2: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha = 1) => {
            g2.globalAlpha = alpha;
            const grd = g2.createLinearGradient(x, y, x + s, y + s);
            grd.addColorStop(0, "#fff"); grd.addColorStop(.2, color); grd.addColorStop(1, "#0f0a2a");
            g2.fillStyle = grd;
            g2.beginPath(); g2.roundRect(x + 2, y + 2, s - 4, s - 4, s * .18); g2.fill();
            g2.fillStyle = "rgba(255,255,255,.3)"; g2.fillRect(x + s * .2, y + s * .15, s * .5, s * .1);
            g2.globalAlpha = 1;
        };
        const target = (): [number, number] | null => {
            if (!drag) return null;
            const p = tray[drag.i];
            const c = Math.round((drag.x - drag.ox - OX) / S), r = Math.round((drag.y - drag.oy - OY) / S);
            return fits(p.shape, r, c) ? [r, c] : null;
        };
        function place(i: number, r: number, c: number) {
            const p = tray[i];
            let cells = 0;
            p.shape.forEach((row, a) => row.forEach((v, b) => { if (v) { board[r + a][c + b] = p.color; cells++; } }));
            p.used = true;
            score += cells;
            sfx.place();
            // full lines
            const rows = [...Array(N).keys()].filter(y => board[y].every(Boolean));
            const cols = [...Array(N).keys()].filter(x => board.every(row => row[x]));
            const lines = rows.length + cols.length;
            if (lines) {
                streak++;
                const pts = lines * 10 * lines * Math.max(1, streak);
                score += pts;
                for (const y of rows) for (let x = 0; x < N; x++) { fx.burst(OX + x * S + S / 2, OY + y * S + S / 2, { n: 6, color: [board[y][x]!, "#fff"], speed: 220 }); }
                for (const x of cols) for (let y = 0; y < N; y++) { if (board[y][x]) fx.burst(OX + x * S + S / 2, OY + y * S + S / 2, { n: 6, color: [board[y][x]!, "#fff"], speed: 220 }); }
                for (const y of rows) for (let x = 0; x < N; x++) board[y][x] = null;
                for (const x of cols) for (let y = 0; y < N; y++) board[y][x] = null;
                floaters.add(W / 2, OY + N * S / 2, lines > 1 ? `COMBO ×${lines}! +${pts}` : `+${pts}`, lines > 1 ? "#fde047" : "#fff", lines > 1 ? 28 : 20);
                if (streak > 1) floaters.add(W / 2, OY + N * S / 2 + 34, `${streak} in a row`, "#f0abfc", 16);
                lines > 1 ? sfx.clear() : sfx.point();
                shake.hit(lines * 2.5, .25);
            } else streak = 0;
            if (tray.every(q => q.used)) refill();
            api.setScore(score);
            if (!tray.some(q => !q.used && canPlace(q.shape))) {
                over = true;
                sfx.lose();
                api.later(() => api.end(score, "No room left!", `Final score ${score}`), 600);
            }
        }
        cv.addEventListener("mousedown", e => {
            if (!started) { started = true; return; }
            if (over) return;
            const p = toLocal(e);
            tray.forEach((q, i) => {
                if (q.used) return;
                const tp = trayPos(i);
                if (Math.abs(p.x - tp.x) < 70 && Math.abs(p.y - tp.y) < 70) {
                    const w = q.shape[0].length * S, h = q.shape.length * S;
                    drag = { i, x: p.x, y: p.y - 60, ox: w / 2, oy: h / 2 };
                    sfx.tick();
                }
            });
        });
        cv.addEventListener("mousemove", e => { if (drag) { const p = toLocal(e); drag.x = p.x; drag.y = p.y - 60; } });
        const mup = () => {
            if (!drag) return;
            const tg = target();
            if (tg) place(drag.i, tg[0], tg[1]);
            drag = null;
        };
        window.addEventListener("mouseup", mup);
        api.cleanup(() => window.removeEventListener("mouseup", mup));
        api.onKey((e, d) => { if (d && e.key === " " && !started) { started = true; return true; } });

        api.loop(dt => {
            t += dt;
            fx.update(dt); shake.update(dt); floaters.update(dt);
            g.save();
            shake.apply(g);
            nebula(g, W, H, 230);
            g.fillStyle = "rgba(8,6,28,.8)";
            g.beginPath(); g.roundRect(OX - 8, OY - 8, N * S + 16, N * S + 16, 14); g.fill();
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
                if (board[r][c]) blockAt(g, OX + c * S, OY + r * S, S, board[r][c]!);
                else { g.fillStyle = "rgba(255,255,255,.05)"; g.beginPath(); g.roundRect(OX + c * S + 2, OY + r * S + 2, S - 4, S - 4, 8); g.fill(); }
            }
            const tg = target();
            if (drag && tg) tray[drag.i].shape.forEach((row, a) => row.forEach((v, b) => { if (v) blockAt(g, OX + (tg[1] + b) * S, OY + (tg[0] + a) * S, S, tray[drag!.i].color, .35); }));
            tray.forEach((q, i) => {
                if (q.used || drag?.i === i) return;
                const tp = trayPos(i), s = 26;
                const w = q.shape[0].length * s, h = q.shape.length * s;
                const ok = canPlace(q.shape);
                q.shape.forEach((row, a) => row.forEach((v, b) => { if (v) blockAt(g, tp.x - w / 2 + b * s, tp.y - h / 2 + a * s, s, q.color, ok ? 1 : .3); }));
            });
            if (drag) {
                const q = tray[drag.i];
                q.shape.forEach((row, a) => row.forEach((v, b) => { if (v) blockAt(g, drag!.x - drag!.ox + b * S, drag!.y - drag!.oy + a * S, S, q.color, .95); }));
            }
            fx.draw(g); floaters.draw(g);
            text(g, String(score), W / 2, TRAY - 14, 26, "#fff", "center", 900, "#3b82f6");
            if (!started) titleCard(g, W, H, "Block Blast", ["Drag pieces onto the board", "Fill a row or column to blast it"], t, "#3b82f6");
            g.restore();
        });
    }
};
