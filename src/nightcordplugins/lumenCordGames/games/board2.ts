/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Reversi, Dots and Boxes, Battleship */

import { GameDef, pick, randInt, shuffle } from "./core";

// ───────────────────────── Reversi ─────────────────────────
const RW = [
    [100, -20, 10, 5, 5, 10, -20, 100], [-20, -50, -2, -2, -2, -2, -50, -20], [10, -2, 1, 1, 1, 1, -2, 10], [5, -2, 1, 0, 0, 1, -2, 5],
    [5, -2, 1, 0, 0, 1, -2, 5], [10, -2, 1, 1, 1, 1, -2, 10], [-20, -50, -2, -2, -2, -2, -50, -20], [100, -20, 10, 5, 5, 10, -20, 100],
];
export const reversi: GameDef = {
    id: "reversi", name: "Reversi", icon: "⚫", color: "#10b981", category: "Board",
    description: "Othello-style! Trap the computer's discs between yours to flip them. Most discs at the end wins.",
    controls: "Click a glowing square",
    start(api) {
        const N = 8;
        let b: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
        b[3][3] = b[4][4] = 2; b[3][4] = b[4][3] = 1;
        let busy = false, last: [number, number] | null = null;
        const msg = api.el("div", "lcg-msg", "You are pink. Make a move!");
        const boardEl = api.el("div", "lcg-reversi");
        const cells = [...Array(N * N).keys()].map(i => { const c = api.el("button", "lcg-rv", "", boardEl); c.onclick = () => humanMove(Math.floor(i / N), i % N); return c; });
        const flips = (s: number[][], r: number, c: number, p: number): [number, number][] => {
            if (s[r][c]) return [];
            const out: [number, number][] = [];
            for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const line: [number, number][] = [];
                let rr = r + dr, cc = c + dc;
                while (rr >= 0 && rr < N && cc >= 0 && cc < N && s[rr][cc] === 3 - p) { line.push([rr, cc]); rr += dr; cc += dc; }
                if (line.length && rr >= 0 && rr < N && cc >= 0 && cc < N && s[rr][cc] === p) out.push(...line);
            }
            return out;
        };
        const movesFor = (s: number[][], p: number) => { const m: [number, number][] = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (flips(s, r, c, p).length) m.push([r, c]); return m; };
        const apply = (s: number[][], r: number, c: number, p: number) => { const n = s.map(x => x.slice()); n[r][c] = p; for (const [a, d] of flips(s, r, c, p)) n[a][d] = p; return n; };
        const evalB = (s: number[][]) => { let v = 0; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) v += s[r][c] === 2 ? RW[r][c] : s[r][c] === 1 ? -RW[r][c] : 0; return v + (movesFor(s, 2).length - movesFor(s, 1).length) * 5; };
        const search = (s: number[][], depth: number, p: number, a: number, bb: number): number => {
            const ms = movesFor(s, p);
            if (!depth || (!ms.length && !movesFor(s, 3 - p).length)) return evalB(s);
            if (!ms.length) return search(s, depth - 1, 3 - p, a, bb);
            for (const [r, c] of ms) {
                const v = search(apply(s, r, c, p), depth - 1, 3 - p, a, bb);
                if (p === 2) a = Math.max(a, v); else bb = Math.min(bb, v);
                if (a >= bb) break;
            }
            return p === 2 ? a : bb;
        };
        const count = (p: number) => b.flat().filter(x => x === p).length;
        function render(flipped: [number, number][] = []) {
            const hints = busy ? [] : movesFor(b, 1);
            cells.forEach((cell, i) => {
                const r = Math.floor(i / N), c = i % N;
                const v = b[r][c];
                cell.innerHTML = v ? `<span class="disc p${v}${flipped.some(([a, d]) => a === r && d === c) ? " flip" : ""}"></span>` : "";
                cell.classList.toggle("hint", hints.some(([a, d]) => a === r && d === c));
                cell.classList.toggle("last", !!last && last[0] === r && last[1] === c);
            });
            api.setScore(count(1));
            api.setStatus(`You ${count(1)} : ${count(2)} Computer`);
        }
        function finish() {
            const me = count(1), cpu = count(2);
            api.end(me, me > cpu ? "You win! 🏆" : me === cpu ? "It's a draw" : "The computer wins", `${me} : ${cpu}`);
        }
        function humanMove(r: number, c: number) {
            if (busy) return;
            const f = flips(b, r, c, 1);
            if (!f.length) return;
            b = apply(b, r, c, 1);
            last = [r, c];
            busy = true;
            render(f);
            api.later(cpuTurn, 550);
        }
        function cpuTurn() {
            const ms = movesFor(b, 2);
            if (!ms.length) {
                busy = false;
                if (!movesFor(b, 1).length) return finish();
                msg.textContent = "The computer has no moves. Your turn again!";
                return render();
            }
            let best = ms[0], bv = -Infinity;
            for (const [r, c] of shuffle(ms)) { const v = search(apply(b, r, c, 2), 3, 1, -Infinity, Infinity); if (v > bv) { bv = v; best = [r, c]; } }
            const f = flips(b, best[0], best[1], 2);
            b = apply(b, best[0], best[1], 2);
            last = best;
            busy = false;
            render(f);
            if (!movesFor(b, 1).length) {
                if (!movesFor(b, 2).length) return finish();
                msg.textContent = "You have no moves, the computer goes again.";
                busy = true;
                api.later(cpuTurn, 700);
            } else msg.textContent = "Your move.";
        }
        render();
    }
};

// ───────────────────────── Dots and Boxes ─────────────────────────
export const dotsBoxes: GameDef = {
    id: "dots", name: "Dots and Boxes", icon: "🔲", color: "#f472b6", category: "Board",
    description: "Take turns drawing lines. Close a box to claim it and go again. Most boxes wins!",
    controls: "Click between two dots",
    start(api) {
        const B = 5; // boxes per side
        const h: number[][] = Array.from({ length: B + 1 }, () => Array(B).fill(0)); // horizontal lines [row][col]
        const v: number[][] = Array.from({ length: B }, () => Array(B + 1).fill(0)); // vertical lines
        const owner: number[][] = Array.from({ length: B }, () => Array(B).fill(0));
        let busy = false;
        const msg = api.el("div", "lcg-msg", "Your turn (pink). Close boxes to score!");
        const board = api.el("div", "lcg-dots");
        board.style.setProperty("--n", String(B));
        const els: Record<string, HTMLElement> = {};
        for (let r = 0; r <= B * 2; r++) for (let c = 0; c <= B * 2; c++) {
            const dot = r % 2 === 0 && c % 2 === 0, hl = r % 2 === 0 && c % 2 === 1, vl = r % 2 === 1 && c % 2 === 0;
            const e = api.el("div", dot ? "lcg-dot" : hl ? "lcg-hl" : vl ? "lcg-vl" : "lcg-box", "", board);
            if (hl) { const key = `h${r / 2},${(c - 1) / 2}`; els[key] = e; e.onclick = () => human("h", r / 2, (c - 1) / 2); }
            if (vl) { const key = `v${(r - 1) / 2},${c / 2}`; els[key] = e; e.onclick = () => human("v", (r - 1) / 2, c / 2); }
            if (!dot && !hl && !vl) els[`b${(r - 1) / 2},${(c - 1) / 2}`] = e;
        }
        const sides = (r: number, c: number) => h[r][c] + h[r + 1][c] + v[r][c] + v[r][c + 1];
        // returns boxes completed by this line
        function draw(kind: "h" | "v", r: number, c: number, p: number): number {
            if (kind === "h") h[r][c] = p; else v[r][c] = p;
            els[`${kind}${r},${c}`].className = `${kind === "h" ? "lcg-hl" : "lcg-vl"} p${p}`;
            let done = 0;
            const check = (br: number, bc: number) => { if (br >= 0 && br < B && bc >= 0 && bc < B && !owner[br][bc] && sides(br, bc) === 4) { owner[br][bc] = p; els[`b${br},${bc}`].className = `lcg-box p${p}`; done++; } };
            if (kind === "h") { check(r - 1, c); check(r, c); } else { check(r, c - 1); check(r, c); }
            return done;
        }
        const freeLines = () => { const out: ["h" | "v", number, number][] = []; h.forEach((row, r) => row.forEach((x, c) => { if (!x) out.push(["h", r, c]); })); v.forEach((row, r) => row.forEach((x, c) => { if (!x) out.push(["v", r, c]); })); return out; };
        const score = (p: number) => owner.flat().filter(x => x === p).length;
        function status() { api.setScore(score(1)); api.setStatus(`You ${score(1)} : ${score(2)} Computer`); }
        function end() { const a = score(1), b2 = score(2); api.end(a, a > b2 ? "You win! 🏆" : a === b2 ? "Draw!" : "The computer wins", `${a} : ${b2}`); }
        function human(kind: "h" | "v", r: number, c: number) {
            if (busy || (kind === "h" ? h[r][c] : v[r][c])) return;
            const got = draw(kind, r, c, 1);
            status();
            if (!freeLines().length) return end();
            if (got) { msg.textContent = "Box! Go again."; return; }
            busy = true;
            msg.textContent = "Computer is thinking…";
            api.later(cpu, 450);
        }
        // how many sides would boxes next to this line have after drawing it
        const risky = (kind: "h" | "v", r: number, c: number) => {
            const nb: [number, number][] = kind === "h" ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
            return nb.some(([br, bc]) => br >= 0 && br < B && bc >= 0 && bc < B && sides(br, bc) === 2);
        };
        const completes = (kind: "h" | "v", r: number, c: number) => {
            const nb: [number, number][] = kind === "h" ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
            return nb.some(([br, bc]) => br >= 0 && br < B && bc >= 0 && bc < B && sides(br, bc) === 3);
        };
        function cpu() {
            const free = freeLines();
            if (!free.length) return end();
            const take = free.find(l => completes(...l));
            const safe = free.filter(l => !risky(...l));
            const move = take ?? (safe.length ? pick(safe) : pick(free));
            const got = draw(move[0], move[1], move[2], 2);
            status();
            if (!freeLines().length) { busy = false; return end(); }
            if (got) { api.later(cpu, 350); return; }
            busy = false;
            msg.textContent = "Your turn.";
        }
        status();
    }
};

// ───────────────────────── Battleship ─────────────────────────
export const battleship: GameDef = {
    id: "battleship", name: "Battleship", icon: "🚢", color: "#0ea5e9", category: "Board",
    description: "Sink the computer's fleet before it sinks yours. Fewer shots = higher score.",
    controls: "Click the enemy grid to fire",
    start(api) {
        const N = 10, SHIPS = [5, 4, 3, 3, 2];
        type Board = { ship: number[]; shot: boolean[]; ships: number[][]; };
        const make = (): Board => {
            const b: Board = { ship: Array(N * N).fill(-1), shot: Array(N * N).fill(false), ships: [] };
            SHIPS.forEach((len, id) => {
                for (;;) {
                    const horiz = Math.random() < .5, r = randInt(0, horiz ? N - 1 : N - len), c = randInt(0, horiz ? N - len : N - 1);
                    const cells = Array.from({ length: len }, (_, i) => (r + (horiz ? 0 : i)) * N + c + (horiz ? i : 0));
                    if (cells.some(k => b.ship[k] >= 0)) continue;
                    cells.forEach(k => { b.ship[k] = id; });
                    b.ships.push(cells);
                    break;
                }
            });
            return b;
        };
        let mine = make(), enemy = make(), shots = 0, busy = false, started = false, hunt: number[] = [];
        const msg = api.el("div", "lcg-msg", "Your fleet is ready. Shuffle it if you like, then fire at the enemy grid!");
        const wrap = api.el("div", "lcg-bs-wrap");
        const side = (label: string) => { const col = api.el("div", "lcg-bs-side", undefined, wrap); api.el("div", "lcg-hand-label", label, col); return api.el("div", "lcg-bs", undefined, col); };
        const mineEl = side("Your fleet"), enemyEl = side("Enemy waters");
        const controls = api.el("div", "lcg-controls");
        const shuffleBtn = api.el("button", "lcg-btn", "🔀 Shuffle my ships", controls);
        shuffleBtn.onclick = () => { if (!started) { mine = make(); render(); } };
        const mCells = [...Array(N * N).keys()].map(() => api.el("div", "lcg-bs-cell", "", mineEl));
        const eCells = [...Array(N * N).keys()].map(i => { const c = api.el("button", "lcg-bs-cell", "", enemyEl); c.onclick = () => fire(i); return c; });
        const sunk = (b: Board, id: number) => b.ships[id].every(k => b.shot[k]);
        const allSunk = (b: Board) => b.ships.every((_, id) => sunk(b, id));
        function render() {
            mCells.forEach((c, i) => { c.className = "lcg-bs-cell" + (mine.ship[i] >= 0 ? " ship" : "") + (mine.shot[i] ? mine.ship[i] >= 0 ? " hit" : " miss" : "") + (mine.ship[i] >= 0 && sunk(mine, mine.ship[i]) ? " sunk" : ""); });
            eCells.forEach((c, i) => { c.className = "lcg-bs-cell" + (enemy.shot[i] ? enemy.ship[i] >= 0 ? " hit" : " miss" : "") + (enemy.ship[i] >= 0 && sunk(enemy, enemy.ship[i]) ? " sunk ship" : ""); });
            const left = enemy.ships.filter((_, id) => !sunk(enemy, id)).length;
            api.setStatus(`${shots} shots · ${left} enemy ships left`);
        }
        function fire(i: number) {
            if (busy || enemy.shot[i]) return;
            started = true; shuffleBtn.disabled = true;
            enemy.shot[i] = true; shots++;
            const id = enemy.ship[i];
            msg.textContent = id >= 0 ? sunk(enemy, id) ? `💥 You sank their ${["carrier", "battleship", "cruiser", "submarine", "destroyer"][id]}!` : "💥 Hit!" : "Splash, miss.";
            render();
            if (allSunk(enemy)) return api.end(Math.max(10, 120 - shots), "Victory! ⚓", `You sank their fleet in ${shots} shots.`);
            busy = true;
            api.later(cpuFire, 650);
        }
        function cpuFire() {
            // hunt/target: after a hit, try the squares around it
            let target = -1;
            while (hunt.length && target < 0) { const k = hunt.pop()!; if (!mine.shot[k]) target = k; }
            if (target < 0) { const open = [...Array(N * N).keys()].filter(k => !mine.shot[k] && (Math.floor(k / N) + k) % 2 === 0); target = open.length ? pick(open) : pick([...Array(N * N).keys()].filter(k => !mine.shot[k])); }
            mine.shot[target] = true;
            const id = mine.ship[target];
            if (id >= 0) {
                if (sunk(mine, id)) hunt = hunt.filter(k => mine.ship[k] !== id);
                else { const r = Math.floor(target / N), c = target % N; for (const [dr, dc] of shuffle([[0, 1], [1, 0], [0, -1], [-1, 0]])) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N) hunt.push(rr * N + cc); } }
            }
            render();
            busy = false;
            if (allSunk(mine)) api.end(0, "Your fleet was sunk!", `The computer needed ${mine.shot.filter(Boolean).length} shots.`);
        }
        render();
    }
};
