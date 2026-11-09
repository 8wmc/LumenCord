/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { blocks } from "./blocks";
import { GameDef, pick, shuffle } from "./core";
import { blockBlast, bubblePop, gemSwap } from "./puzzle2";
import { hangman, lightsOut, slidePuzzle, wordSearch } from "./puzzle3";

const arrowDir = (e: KeyboardEvent): [number, number] | null => {
    switch (e.key) {
        case "ArrowLeft": case "a": case "A": return [-1, 0];
        case "ArrowRight": case "d": case "D": return [1, 0];
        case "ArrowUp": case "w": case "W": return [0, -1];
        case "ArrowDown": case "s": case "S": return [0, 1];
    }
    return null;
};

// ───────────────────────── Lumen 2048 ─────────────────────────
const twenty48: GameDef = {
    id: "2048", name: "Lumen 2048", icon: "🔢", color: "#f59e0b", category: "Puzzle",
    description: "Slide the tiles and merge matching numbers. Can you reach 2048?",
    controls: "Arrow keys / WASD, or swipe",
    start(api) {
        const N = 4;
        let grid: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
        let score = 0, won = false;
        const board = api.el("div", "lcg-2048");
        const cells: HTMLDivElement[] = [];
        for (let i = 0; i < N * N; i++) cells.push(api.el("div", "lcg-tile", "", board));

        const empty = () => {
            const out: [number, number][] = [];
            grid.forEach((row, r) => row.forEach((v, c) => { if (!v) out.push([r, c]); }));
            return out;
        };
        const add = () => {
            const e = empty();
            if (!e.length) return null;
            const [r, c] = pick(e);
            grid[r][c] = Math.random() < .9 ? 2 : 4;
            return r * N + c;
        };
        const render = (fresh: number | null = null, merged: Set<number> = new Set()) => {
            grid.flat().forEach((v, i) => {
                const el = cells[i];
                el.textContent = v ? String(v) : "";
                el.className = `lcg-tile v${Math.min(v, 4096)}${i === fresh ? " pop" : ""}${merged.has(i) ? " merge" : ""}`;
            });
            api.setScore(score);
        };
        const canMove = () => {
            if (empty().length) return true;
            for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
                if (c < N - 1 && grid[r][c] === grid[r][c + 1]) return true;
                if (r < N - 1 && grid[r][c] === grid[r + 1][c]) return true;
            }
            return false;
        };
        const move = (dx: number, dy: number) => {
            let moved = false;
            const merged = new Set<number>();
            const next: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
            for (let line = 0; line < N; line++) {
                // read the line in the direction of travel
                const idx: [number, number][] = [];
                for (let k = 0; k < N; k++) {
                    const p = dx === 1 || dy === 1 ? N - 1 - k : k;
                    idx.push(dx ? [line, p] : [p, line]);
                }
                const vals = idx.map(([r, c]) => grid[r][c]).filter(Boolean);
                const out: number[] = [];
                const mergedAt: number[] = [];
                for (let i = 0; i < vals.length; i++) {
                    if (vals[i] === vals[i + 1]) {
                        out.push(vals[i] * 2);
                        score += vals[i] * 2;
                        mergedAt.push(out.length - 1);
                        if (vals[i] * 2 === 2048) won = true;
                        i++;
                    } else out.push(vals[i]);
                }
                idx.forEach(([r, c], k) => {
                    next[r][c] = out[k] ?? 0;
                    if (next[r][c] !== grid[r][c]) moved = true;
                    if (mergedAt.includes(k)) merged.add(r * N + c);
                });
            }
            if (!moved) return;
            grid = next;
            const fresh = add();
            render(fresh, merged);
            if (won) {
                won = false;
                api.setStatus("2048! Keep going for a bigger score.");
            }
            if (!canMove()) api.end(score, "No more moves", `Biggest tile: ${Math.max(...grid.flat())}`);
        };

        api.onKey((e, down) => {
            if (!down) return;
            const d = arrowDir(e);
            if (!d) return;
            move(d[0], d[1]);
            return true;
        });
        let sx = 0, sy = 0;
        board.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; });
        board.addEventListener("pointerup", e => {
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
            if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0);
            else move(0, Math.sign(dy));
        });
        add(); add();
        render();
    }
};

// ───────────────────────── Star Sweeper (minesweeper) ─────────────────────────
const sweeper: GameDef = {
    id: "sweeper", name: "Star Sweeper", icon: "💣", color: "#94a3b8", category: "Puzzle", scoreKind: "time",
    description: "Clear the field without touching a black hole. Numbers show how many are next to a square.",
    controls: "Click to reveal · right-click to flag",
    start(api) {
        const R = 10, Cc = 12, MINES = 18;
        const msg = api.el("div", "lcg-msg", `Find the ${MINES} black holes. Your first click is always safe.`);
        const board = api.el("div", "lcg-sweep");
        board.style.gridTemplateColumns = `repeat(${Cc}, 1fr)`;
        type Cell = { mine: boolean; n: number; open: boolean; flag: boolean; el: HTMLButtonElement; };
        const cells: Cell[][] = [];
        let started = false, done = false, flags = 0, opened = 0, t0 = 0;
        const timer = setInterval(() => { if (started && !done) api.setScore(Math.floor((Date.now() - t0) / 1000)); }, 250);
        api.cleanup(() => clearInterval(timer));

        for (let r = 0; r < R; r++) {
            cells.push([]);
            for (let c = 0; c < Cc; c++) {
                const el = api.el("button", "lcg-sw", "", board);
                const cell: Cell = { mine: false, n: 0, open: false, flag: false, el };
                el.onclick = () => reveal(r, c);
                el.oncontextmenu = e => { e.preventDefault(); toggleFlag(r, c); };
                cells[r].push(cell);
            }
        }
        const around = (r: number, c: number) => {
            const out: [number, number][] = [];
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                const rr = r + dr, cc = c + dc;
                if ((dr || dc) && rr >= 0 && rr < R && cc >= 0 && cc < Cc) out.push([rr, cc]);
            }
            return out;
        };
        const plant = (sr: number, sc: number) => {
            const safe = new Set([[sr, sc], ...around(sr, sc)].map(([r, c]) => r * Cc + c));
            const spots = shuffle([...Array(R * Cc).keys()].filter(i => !safe.has(i))).slice(0, MINES);
            for (const i of spots) cells[Math.floor(i / Cc)][i % Cc].mine = true;
            for (let r = 0; r < R; r++) for (let c = 0; c < Cc; c++)
                cells[r][c].n = around(r, c).filter(([a, b]) => cells[a][b].mine).length;
        };
        const status = () => api.setStatus(`🚩 ${flags}/${MINES}`);
        function toggleFlag(r: number, c: number) {
            const cell = cells[r][c];
            if (done || cell.open) return;
            cell.flag = !cell.flag;
            flags += cell.flag ? 1 : -1;
            cell.el.textContent = cell.flag ? "🚩" : "";
            cell.el.classList.toggle("flag", cell.flag);
            status();
        }
        function reveal(r: number, c: number) {
            if (done) return;
            const cell = cells[r][c];
            if (cell.flag) return;
            if (!started) {
                started = true;
                t0 = Date.now();
                plant(r, c);
            }
            if (cell.open) {
                // chord: open neighbours if the flags around match the number
                const ar = around(r, c);
                if (cell.n && ar.filter(([a, b]) => cells[a][b].flag).length === cell.n)
                    for (const [a, b] of ar) if (!cells[a][b].open && !cells[a][b].flag) open(a, b);
            } else open(r, c);
            check();
        }
        function open(r: number, c: number) {
            const stack: [number, number][] = [[r, c]];
            while (stack.length) {
                const [a, b] = stack.pop()!;
                const cell = cells[a][b];
                if (cell.open || cell.flag) continue;
                cell.open = true;
                opened++;
                cell.el.classList.add("open");
                if (cell.mine) {
                    cell.el.classList.add("boom");
                    cell.el.textContent = "🕳️";
                    lose();
                    return;
                }
                if (cell.n) {
                    cell.el.textContent = String(cell.n);
                    cell.el.classList.add(`n${cell.n}`);
                } else stack.push(...around(a, b));
            }
        }
        function lose() {
            done = true;
            for (const row of cells) for (const cell of row) if (cell.mine && !cell.open) { cell.el.textContent = "🕳️"; cell.el.classList.add("open"); }
            msg.textContent = "A black hole got you!";
            api.end(0, "Swallowed by a black hole", "Try again: the first click is always safe.");
        }
        function check() {
            if (done || opened !== R * Cc - MINES) return;
            done = true;
            const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
            api.setScore(secs);
            msg.textContent = "Field cleared!";
            api.end(secs, "Field cleared!", "Lower time is better.");
        }
        status();
    }
};

// ───────────────────────── Lumen Word ─────────────────────────
const ANSWERS = ("about,above,actor,adult,after,again,agent,alarm,album,alien,alive,alley,amber,angel,anger,angle,apple,arena,armor,arrow,audio,award,badge,baker,beach,beast,berry,bingo,blade,blank,blast,blaze,blend,block,bloom,board,boost,brain,brave,bread,brick,bride,bring,brush,buddy,cabin,camel,candy,cargo,chain,chair,charm,chase,cheer,chess,chest,chief,child,cliff,climb,clock,cloud,coach,comet,coral,couch,crash,cream,crown,crush,curve,dance,delta,dream,drift,drink,drive,eagle,earth,elbow,ember,enjoy,entry,event,extra,fable,faith,feast,fence,field,flame,flash,fleet,float,flood,flute,focus,frost,fruit,ghost,giant,glare,glass,gleam,globe,glory,glove,grape,grass,green,grill,guard,guest,guide,happy,heart,honey,horse,hotel,house,human,humor,image,input,jelly,jewel,juice,knife,laser,laugh,lemon,level,light,lucky,lunar,magic,mango,maple,march,match,metal,minty,model,money,month,moose,motor,mouse,music,night,noble,ocean,olive,orbit,otter,panda,paper,party,peace,pearl,piano,pilot,pixel,pizza,plane,plant,plaza,point,power,pride,prism,proud,queen,quest,quiet,radio,raven,relax,river,robot,rover" +
    ",royal,salad,scale,scarf,score,shade,shark,shine,smile,snack,solar,sound,space,spark,spice,spoon,sport,squad,stack,stage,steam,stone,storm,story,sugar,sunny,swamp,sweet,swing,table,tiger,toast,torch,tower,track,trail,train,treat,trend,tulip,ultra,unity,valid,vapor,vivid,voice,watch,water,whale,wheel,world,yacht,young,zebra")
    .split(",").filter(w => w.length === 5);

const wordGame: GameDef = {
    id: "lumenword", name: "Lumen Word", icon: "🔤", color: "#22c55e", category: "Word",
    description: "Guess the 5-letter word in 6 tries. Green = right spot, gold = in the word.",
    controls: "Type letters · Enter to guess · Backspace to delete",
    start(api) {
        const answer = pick(ANSWERS).toUpperCase();
        const rows: HTMLDivElement[][] = [];
        const grid = api.el("div", "lcg-word");
        for (let r = 0; r < 6; r++) {
            const row = api.el("div", "lcg-word-row", undefined, grid);
            rows.push(Array.from({ length: 5 }, () => api.el("div", "lcg-word-cell", "", row)));
        }
        const msg = api.el("div", "lcg-msg", "Start typing your first guess.");
        const kb = api.el("div", "lcg-kb");
        const keyEls = new Map<string, HTMLButtonElement>();
        for (const line of ["QWERTYUIOP", "ASDFGHJKL", "⏎ZXCVBNM⌫"]) {
            const row = api.el("div", "lcg-kb-row", undefined, kb);
            for (const ch of line) {
                const b = api.el("button", "lcg-key" + (ch === "⏎" || ch === "⌫" ? " wide" : ""), ch === "⏎" ? "Enter" : ch, row);
                b.onclick = () => press(ch === "⏎" ? "Enter" : ch === "⌫" ? "Backspace" : ch);
                keyEls.set(ch, b);
            }
        }
        let row = 0, cur = "", done = false;
        const rank: Record<string, number> = {};
        const draw = () => rows[row]?.forEach((c, i) => { c.textContent = cur[i] ?? ""; c.classList.toggle("typed", !!cur[i]); });

        function press(key: string) {
            if (done) return;
            if (key === "Enter") return submit();
            if (key === "Backspace") { cur = cur.slice(0, -1); draw(); return; }
            if (/^[A-Z]$/.test(key) && cur.length < 5) { cur += key; draw(); }
        }
        function submit() {
            if (cur.length < 5) { msg.textContent = "Not enough letters."; return; }
            const res: string[] = Array(5).fill("miss");
            const left: Record<string, number> = {};
            for (let i = 0; i < 5; i++) {
                if (cur[i] === answer[i]) res[i] = "hit";
                else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
            }
            for (let i = 0; i < 5; i++) if (res[i] !== "hit" && left[cur[i]]) { res[i] = "near"; left[cur[i]]--; }
            const score = { miss: 1, near: 2, hit: 3 } as const;
            rows[row].forEach((c, i) => {
                api.later(() => c.classList.add(res[i], "flip"), i * 90);
                const k = cur[i];
                const s = score[res[i] as keyof typeof score];
                if ((rank[k] ?? 0) < s) {
                    rank[k] = s;
                    const el = keyEls.get(k);
                    if (el) api.later(() => { el.classList.remove("miss", "near", "hit"); el.classList.add(res[i]); }, 500);
                }
            });
            if (cur === answer) {
                done = true;
                const pts = (7 - (row + 1)) * 100;
                api.setScore(pts);
                msg.textContent = "You got it!";
                api.later(() => api.end(pts, "You got it!", `The word was ${answer}. Solved in ${row + 1}/6.`), 700);
                return;
            }
            row++;
            cur = "";
            if (row >= 6) {
                done = true;
                api.later(() => api.end(0, "Out of guesses", `The word was ${answer}.`), 700);
                return;
            }
            msg.textContent = `${6 - row} guesses left.`;
        }
        api.onKey((e, down) => {
            if (!down || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === "Enter" || e.key === "Backspace") { press(e.key); return true; }
            if (/^[a-zA-Z]$/.test(e.key)) { press(e.key.toUpperCase()); return true; }
        });
    }
};

// ───────────────────────── Sudoku ─────────────────────────
function makeSudoku(holes: number) {
    const g: number[] = Array(81).fill(0);
    const ok = (i: number, v: number) => {
        const r = Math.floor(i / 9), c = i % 9;
        for (let k = 0; k < 9; k++) if (g[r * 9 + k] === v || g[k * 9 + c] === v) return false;
        const br = r - r % 3, bc = c - c % 3;
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (g[(br + a) * 9 + bc + b] === v) return false;
        return true;
    };
    const fill = (i: number): boolean => {
        if (i === 81) return true;
        for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
            if (ok(i, v)) { g[i] = v; if (fill(i + 1)) return true; g[i] = 0; }
        }
        return false;
    };
    fill(0);
    const solution = [...g];
    const puzzle = [...g];
    for (const i of shuffle([...Array(81).keys()]).slice(0, holes)) puzzle[i] = 0;
    return { puzzle, solution };
}

const sudoku: GameDef = {
    id: "sudoku", name: "Sudoku", icon: "🧩", color: "#60a5fa", category: "Puzzle", scoreKind: "time",
    description: "Fill the grid so every row, column and 3×3 box has 1 to 9.",
    controls: "Click a square, then type 1-9 · Backspace to clear · arrows to move",
    start(api) {
        const { puzzle, solution } = makeSudoku(44);
        const vals = [...puzzle];
        const t0 = Date.now();
        let sel = vals.findIndex(v => !v), done = false, mistakes = 0;
        const board = api.el("div", "lcg-sudoku");
        const cells = vals.map((_, i) => {
            const r = Math.floor(i / 9), c = i % 9;
            const e = api.el("button", "lcg-su" + (puzzle[i] ? " given" : "") + (c % 3 === 2 && c < 8 ? " br" : "") + (r % 3 === 2 && r < 8 ? " bb" : ""), "", board);
            e.onclick = () => { sel = i; render(); };
            return e;
        });
        const pad = api.el("div", "lcg-numpad");
        for (let n = 1; n <= 9; n++) api.el("button", "lcg-btn", String(n), pad).onclick = () => put(n);
        api.el("button", "lcg-btn", "⌫", pad).onclick = () => put(0);
        const timer = setInterval(() => { if (!done) api.setScore(Math.floor((Date.now() - t0) / 1000)); }, 500);
        api.cleanup(() => clearInterval(timer));

        function render() {
            const sv = vals[sel];
            cells.forEach((e, i) => {
                e.textContent = vals[i] ? String(vals[i]) : "";
                const r = Math.floor(i / 9), c = i % 9, sr = Math.floor(sel / 9), sc = sel % 9;
                const same = r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3));
                e.classList.toggle("sel", i === sel);
                e.classList.toggle("peer", i !== sel && same);
                e.classList.toggle("match", !!sv && vals[i] === sv && i !== sel);
                e.classList.toggle("wrong", !puzzle[i] && !!vals[i] && vals[i] !== solution[i]);
            });
            api.setStatus(mistakes ? `Mistakes: ${mistakes}` : "");
        }
        function put(n: number) {
            if (done || sel < 0 || puzzle[sel]) return;
            vals[sel] = n;
            if (n && n !== solution[sel]) mistakes++;
            render();
            if (vals.every((v, i) => v === solution[i])) {
                done = true;
                const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
                api.setScore(secs);
                api.end(secs, "Solved!", mistakes ? `${mistakes} mistake${mistakes > 1 ? "s" : ""} along the way.` : "Perfect, no mistakes!");
            }
        }
        api.onKey((e, down) => {
            if (!down) return;
            if (/^[1-9]$/.test(e.key)) { put(Number(e.key)); return true; }
            if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") { put(0); return true; }
            const d = arrowDir(e);
            if (d && !/^[wasdWASD]$/.test(e.key)) {
                const r = (Math.floor(sel / 9) + d[1] + 9) % 9, c = (sel % 9 + d[0] + 9) % 9;
                sel = r * 9 + c;
                render();
                return true;
            }
        });
        render();
    }
};

// ───────────────────────── Type Rush ─────────────────────────
const TYPE_WORDS = ("the of and to in is you that it he was for on are as with his they at be this have from or one had by word but not what all were we when your can said there use an each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first water been call who oil its now find long down day did get come made may part star moon glow light purple dream game play fast quick jump code night cloud ocean river happy music power magic world space party friend")
    .split(" ");

const typeRush: GameDef = {
    id: "typerush", name: "Type Rush", icon: "⌨️", color: "#e879f9", category: "Word",
    description: "Type as many words as you can in 30 seconds. Your score is words per minute.",
    controls: "Just start typing · Space moves to the next word",
    start(api) {
        const SECONDS = 30;
        const words = Array.from({ length: 80 }, () => pick(TYPE_WORDS));
        const box = api.el("div", "lcg-type");
        const spans = words.map(w => api.el("span", "lcg-tw", w, box));
        const input = api.el("input", "lcg-type-input") as HTMLInputElement;
        input.placeholder = "Start typing here…";
        input.spellcheck = false;
        input.autocomplete = "off";
        const msg = api.el("div", "lcg-msg", `You have ${SECONDS} seconds once you start.`);
        let i = 0, correct = 0, chars = 0, started = false, t0 = 0, done = false;
        spans[0].classList.add("cur");
        api.later(() => input.focus(), 50);

        const tick = setInterval(() => {
            if (!started || done) return;
            const left = SECONDS - (Date.now() - t0) / 1000;
            api.setStatus(`${Math.max(0, Math.ceil(left))}s left`);
            const mins = (Date.now() - t0) / 60000;
            if (mins > 0) api.setScore(Math.round(chars / 5 / mins));
            if (left <= 0) finish();
        }, 200);
        api.cleanup(() => clearInterval(tick));

        function finish() {
            done = true;
            input.disabled = true;
            const wpm = Math.round(chars / 5 / (SECONDS / 60));
            api.setScore(wpm);
            api.end(wpm, `${wpm} WPM`, `${correct} words right out of ${i}.`);
        }
        input.addEventListener("input", () => {
            if (done) return;
            if (!started) { started = true; t0 = Date.now(); msg.textContent = "Go go go!"; }
            const v = input.value;
            if (v.endsWith(" ")) {
                const typed = v.trim();
                const ok = typed === words[i];
                spans[i].classList.remove("cur", "bad");
                spans[i].classList.add(ok ? "good" : "wrong");
                if (ok) { correct++; chars += typed.length + 1; }
                i++;
                input.value = "";
                if (i >= words.length) return finish();
                spans[i].classList.add("cur");
                spans[i].scrollIntoView({ block: "nearest" });
            } else {
                spans[i].classList.toggle("bad", !words[i].startsWith(v));
            }
        });
        // keep the game's arrow/space handling from swallowing typing
        api.onKey(() => false);
    }
};

export const PUZZLE: GameDef[] = [blocks, gemSwap, blockBlast, bubblePop, twenty48, sweeper, sudoku, slidePuzzle, lightsOut, wordGame, hangman, wordSearch, typeRush];
