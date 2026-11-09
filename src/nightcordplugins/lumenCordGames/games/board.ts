/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { battleship, dotsBoxes, reversi } from "./board2";
import { GameDef, pick } from "./core";

// ───────────────────────── Tic-Tac-Toe ─────────────────────────
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const ttt: GameDef = {
    id: "tictactoe", name: "Tic-Tac-Toe", icon: "⭕", color: "#e879f9", category: "Board",
    description: "Three in a row beats the computer. Keep your win streak going; a loss ends it.",
    controls: "Click a square",
    start(api) {
        let b: string[] = Array(9).fill(""), streak = 0, busy = false, youStart = true;
        const msg = api.el("div", "lcg-msg", "You are ✕. Get three in a row!");
        const grid = api.el("div", "lcg-ttt");
        const cells = b.map((_, i) => { const c = api.el("button", "lcg-ttt-cell", "", grid); c.onclick = () => play(i); return c; });
        const winner = (s: string[]) => {
            for (const [a, c, d] of LINES) if (s[a] && s[a] === s[c] && s[a] === s[d]) return s[a];
            return s.every(Boolean) ? "draw" : "";
        };
        const minimax = (s: string[], me: boolean): number => {
            const w = winner(s);
            if (w === "O") return 1; if (w === "X") return -1; if (w === "draw") return 0;
            let best = me ? -2 : 2;
            for (let i = 0; i < 9; i++) if (!s[i]) {
                s[i] = me ? "O" : "X";
                const v = minimax(s, !me);
                s[i] = "";
                best = me ? Math.max(best, v) : Math.min(best, v);
            }
            return best;
        };
        const cpu = () => {
            const free = b.map((v, i) => v ? -1 : i).filter(i => i >= 0);
            let move = pick(free);
            if (Math.random() > .22) {
                let best = -3;
                for (const i of free) { b[i] = "O"; const v = minimax(b, false); b[i] = ""; if (v > best) { best = v; move = i; } }
            }
            b[move] = "O";
        };
        const render = () => b.forEach((v, i) => { cells[i].textContent = v === "X" ? "✕" : v === "O" ? "◯" : ""; cells[i].className = `lcg-ttt-cell ${v}`; });
        function after() {
            render();
            const w = winner(b);
            if (!w) return false;
            if (w === "X") { streak++; msg.textContent = "You win this round! 🎉"; }
            else if (w === "draw") msg.textContent = "Draw. Streak kept!";
            else { api.end(streak, "The computer got three in a row", `Your win streak: ${streak}`); return true; }
            api.setScore(streak);
            busy = true;
            api.later(() => {
                b = Array(9).fill(""); busy = false; youStart = !youStart;
                msg.textContent = youStart ? "Your move." : "Computer starts…";
                if (!youStart) cpu();
                render();
            }, 1200);
            return true;
        }
        function play(i: number) {
            if (busy || b[i]) return;
            b[i] = "X";
            if (after()) return;
            busy = true;
            api.later(() => { cpu(); busy = false; if (!after()) msg.textContent = "Your move."; }, 300);
        }
        render();
    }
};

// ───────────────────────── Connect Four ─────────────────────────
const connect4: GameDef = {
    id: "connect4", name: "Connect Four", icon: "🔴", color: "#f87171", category: "Board",
    description: "Drop discs and connect four in a row before the computer does. Build a win streak.",
    controls: "Click a column to drop a disc",
    start(api) {
        const R = 6, Cc = 7;
        let b: number[][] = [], streak = 0, busy = false;
        const msg = api.el("div", "lcg-msg", "You are pink. Connect four!");
        const grid = api.el("div", "lcg-c4");
        const holes: HTMLElement[][] = [];
        for (let r = 0; r < R; r++) {
            holes.push([]);
            for (let c = 0; c < Cc; c++) {
                const h = api.el("div", "lcg-c4-hole", "", grid);
                h.onclick = () => drop(c);
                holes[r].push(h);
            }
        }
        const reset = () => { b = Array.from({ length: R }, () => Array(Cc).fill(0)); };
        const rowFor = (s: number[][], c: number) => { for (let r = R - 1; r >= 0; r--) if (!s[r][c]) return r; return -1; };
        const wins = (s: number[][], p: number) => {
            for (let r = 0; r < R; r++) for (let c = 0; c < Cc; c++) {
                if (s[r][c] !== p) continue;
                for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
                    let k = 1;
                    while (k < 4 && s[r + dr * k]?.[c + dc * k] === p) k++;
                    if (k === 4) return true;
                }
            }
            return false;
        };
        const scoreBoard = (s: number[][]) => {
            let sc = 0;
            for (let r = 0; r < R; r++) if (s[r][3] === 2) sc += 3;
            for (let r = 0; r < R; r++) for (let c = 0; c < Cc; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
                let me = 0, them = 0;
                for (let k = 0; k < 4; k++) { const v = s[r + dr * k]?.[c + dc * k]; if (v === undefined) { me = them = -9; break; } if (v === 2) me++; else if (v === 1) them++; }
                if (me < 0) continue;
                if (them === 0) sc += [0, 1, 4, 20, 1000][me];
                if (me === 0) sc -= [0, 1, 5, 40, 1000][them];
            }
            return sc;
        };
        const search = (s: number[][], depth: number, alpha: number, beta: number, cpu: boolean): number => {
            if (wins(s, 2)) return 100000 + depth;
            if (wins(s, 1)) return -100000 - depth;
            if (depth === 0) return scoreBoard(s);
            let any = false, best = cpu ? -Infinity : Infinity;
            for (const c of [3, 2, 4, 1, 5, 0, 6]) {
                const r = rowFor(s, c);
                if (r < 0) continue;
                any = true;
                s[r][c] = cpu ? 2 : 1;
                const v = search(s, depth - 1, alpha, beta, !cpu);
                s[r][c] = 0;
                if (cpu) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
                if (beta <= alpha) break;
            }
            return any ? best : 0;
        };
        const cpuMove = () => {
            let bestC = 3, best = -Infinity;
            for (const c of [3, 2, 4, 1, 5, 0, 6]) {
                const r = rowFor(b, c);
                if (r < 0) continue;
                b[r][c] = 2;
                const v = search(b, 4, -Infinity, Infinity, false) + Math.random();
                b[r][c] = 0;
                if (v > best) { best = v; bestC = c; }
            }
            b[rowFor(b, bestC)][bestC] = 2;
        };
        const render = () => b.forEach((row, r) => row.forEach((v, c) => holes[r][c].className = `lcg-c4-hole p${v}`));
        const full = () => b[0].every(Boolean);
        function check(): boolean {
            render();
            if (wins(b, 1)) { streak++; api.setScore(streak); msg.textContent = "Four in a row, you win! 🎉"; next(); return true; }
            if (wins(b, 2)) { api.end(streak, "The computer connected four", `Your win streak: ${streak}`); return true; }
            if (full()) { msg.textContent = "Board full, it's a draw."; next(); return true; }
            return false;
        }
        function next() { busy = true; api.later(() => { reset(); busy = false; msg.textContent = "New round, your move."; render(); }, 1400); }
        function drop(c: number) {
            if (busy) return;
            const r = rowFor(b, c);
            if (r < 0) return;
            b[r][c] = 1;
            if (check()) return;
            busy = true;
            msg.textContent = "Computer is thinking…";
            api.later(() => { cpuMove(); busy = false; if (!check()) msg.textContent = "Your move."; }, 250);
        }
        reset(); render();
    }
};

// ───────────────────────── Checkers ─────────────────────────
interface Piece { p: 1 | 2; king: boolean; }
interface Move { fr: number; fc: number; tr: number; tc: number; cap?: [number, number]; }
const checkers: GameDef = {
    id: "checkers", name: "Checkers", icon: "⚫", color: "#fb7185", category: "Board",
    description: "Jump the computer's pieces. Captures are required. Reach the far side to get a king.",
    controls: "Click your piece, then the square to move to",
    start(api) {
        const b: (Piece | null)[][] = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) =>
            (r + c) % 2 ? (r < 3 ? { p: 2, king: false } : r > 4 ? { p: 1, king: false } : null) : null));
        let sel: [number, number] | null = null, chain: [number, number] | null = null, busy = false, captured = 0;
        const msg = api.el("div", "lcg-msg", "Your turn: you are pink, moving up.");
        const grid = api.el("div", "lcg-checkers");
        const sq: HTMLElement[][] = [];
        for (let r = 0; r < 8; r++) { sq.push([]); for (let c = 0; c < 8; c++) { const s = api.el("div", `lcg-sq ${(r + c) % 2 ? "dark" : "light"}`, "", grid); s.onclick = () => click(r, c); sq[r].push(s); } }

        const dirs = (pc: Piece) => pc.king ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : pc.p === 1 ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]];
        const inb = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
        function movesFor(r: number, c: number, capsOnly = false): Move[] {
            const pc = b[r][c]; if (!pc) return [];
            const out: Move[] = [];
            for (const [dr, dc] of dirs(pc)) {
                const r1 = r + dr, c1 = c + dc, r2 = r + dr * 2, c2 = c + dc * 2;
                if (inb(r2, c2) && b[r1][c1] && b[r1][c1]!.p !== pc.p && !b[r2][c2]) out.push({ fr: r, fc: c, tr: r2, tc: c2, cap: [r1, c1] });
                else if (!capsOnly && inb(r1, c1) && !b[r1][c1]) out.push({ fr: r, fc: c, tr: r1, tc: c1 });
            }
            return out;
        }
        function allMoves(p: 1 | 2): Move[] {
            const all: Move[] = [];
            for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c]?.p === p) all.push(...movesFor(r, c));
            const caps = all.filter(m => m.cap);
            return caps.length ? caps : all;
        }
        function apply(m: Move) {
            const pc = b[m.fr][m.fc]!;
            b[m.tr][m.tc] = pc; b[m.fr][m.fc] = null;
            if (m.cap) b[m.cap[0]][m.cap[1]] = null;
            let crowned = false;
            if (!pc.king && ((pc.p === 1 && m.tr === 0) || (pc.p === 2 && m.tr === 7))) { pc.king = true; crowned = true; }
            return crowned;
        }
        function render() {
            const legal = sel ? (chain ? movesFor(sel[0], sel[1], true) : allMoves(1).filter(m => m.fr === sel![0] && m.fc === sel![1])) : [];
            for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
                const s = sq[r][c], pc = b[r][c];
                s.innerHTML = pc ? `<span class="lcg-piece p${pc.p}${pc.king ? " king" : ""}">${pc.king ? "♛" : ""}</span>` : "";
                s.classList.toggle("sel", !!sel && sel[0] === r && sel[1] === c);
                s.classList.toggle("hint", legal.some(m => m.tr === r && m.tc === c));
            }
            api.setScore(captured);
        }
        function endCheck(): boolean {
            const mine = allMoves(1).length, theirs = allMoves(2).length;
            const count = (p: number) => b.flat().filter(x => x?.p === p).length;
            if (!count(2) || !theirs) { api.end(captured + 12, "You win! 👑", `You captured ${captured} pieces.`); return true; }
            if (!count(1) || !mine) { api.end(captured, "The computer wins", `You captured ${captured} pieces.`); return true; }
            return false;
        }
        function click(r: number, c: number) {
            if (busy) return;
            const pc = b[r][c];
            if (pc?.p === 1 && !chain) { sel = [r, c]; render(); return; }
            if (!sel) return;
            const legal = chain ? movesFor(sel[0], sel[1], true) : allMoves(1).filter(m => m.fr === sel![0] && m.fc === sel![1]);
            const m = legal.find(x => x.tr === r && x.tc === c);
            if (!m) { if (!allMoves(1).some(x => x.fr === sel![0] && x.fc === sel![1])) msg.textContent = "You must capture when you can!"; return; }
            const crowned = apply(m);
            if (m.cap) captured++;
            if (m.cap && !crowned && movesFor(r, c, true).length) { sel = [r, c]; chain = [r, c]; msg.textContent = "Keep jumping!"; render(); return; }
            sel = null; chain = null; render();
            if (endCheck()) return;
            busy = true; msg.textContent = "Computer's turn…";
            api.later(cpu, 500);
        }
        function cpu() {
            let moves = allMoves(2);
            if (!moves.length) { busy = false; endCheck(); return; }
            // prefer captures, then moves that don't hang a piece, then kings
            const safe = moves.filter(m => {
                const save = b.map(row => row.map(x => x && { ...x }));
                apply(m);
                const danger = allMoves(1).some(x => x.cap && x.cap[0] === m.tr && x.cap[1] === m.tc);
                for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) b[r][c] = save[r][c];
                return !danger;
            });
            if (!moves[0].cap && safe.length) moves = safe;
            let m = pick(moves);
            let crowned = apply(m);
            while (m.cap && !crowned) {
                const more = movesFor(m.tr, m.tc, true);
                if (!more.length) break;
                m = pick(more); crowned = apply(m);
            }
            busy = false;
            render();
            if (!endCheck()) msg.textContent = "Your turn.";
        }
        render();
    }
};

export const BOARD: GameDef[] = [reversi, checkers, connect4, battleship, dotsBoxes, ttt];
