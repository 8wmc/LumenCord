/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Slide Puzzle, Lights Out, Hangman, Word Search (DOM games) */

import { GameDef, pick, randInt, shuffle } from "./core";

// ───────────────────────── Slide Puzzle ─────────────────────────
export const slidePuzzle: GameDef = {
    id: "slide", name: "Slide Puzzle", icon: "🔢", color: "#14b8a6", category: "Puzzle", scoreKind: "time",
    description: "The classic 15 puzzle. Slide the tiles until they're in order from 1 to 15.",
    controls: "Click a tile next to the gap (or a whole row/column) · arrow keys work too",
    start(api) {
        const N = 4;
        let tiles = [...Array(N * N).keys()].map(i => (i + 1) % (N * N)); // 0 = gap
        let moves = 0, t0 = 0, done = false;
        const msg = api.el("div", "lcg-msg", "Put the tiles back in order. The clock starts on your first move.");
        const board = api.el("div", "lcg-slide");
        const els = [...Array(N * N - 1).keys()].map(i => {
            const e = api.el("button", "lcg-slide-tile", String(i + 1), board);
            e.style.setProperty("--h", String(160 + i * 9));
            e.onclick = () => clickTile(i + 1);
            return e;
        });
        // shuffle with random legal moves so it's always solvable
        let gap = tiles.indexOf(0), last = -1;
        for (let k = 0; k < 300; k++) {
            const opts = [gap - 1, gap + 1, gap - N, gap + N].filter(p => p >= 0 && p < N * N && p !== last && (Math.floor(p / N) === Math.floor(gap / N) || p % N === gap % N));
            const p = pick(opts);
            [tiles[gap], tiles[p]] = [tiles[p], tiles[gap]];
            last = gap; gap = p;
        }
        const timer = setInterval(() => { if (t0 && !done) api.setScore(Math.floor((Date.now() - t0) / 1000)); }, 500);
        api.cleanup(() => clearInterval(timer));
        function render() {
            tiles.forEach((v, i) => {
                if (!v) return;
                const e = els[v - 1];
                e.style.transform = `translate(${(i % N) * 100}%, ${Math.floor(i / N) * 100}%)`;
                e.classList.toggle("home", v === i + 1);
            });
            api.setStatus(`${moves} moves`);
        }
        function clickTile(v: number) {
            if (done) return;
            const i = tiles.indexOf(v), gp = tiles.indexOf(0);
            const sameRow = Math.floor(i / N) === Math.floor(gp / N), sameCol = i % N === gp % N;
            if (!sameRow && !sameCol) return;
            if (!t0) t0 = Date.now();
            // slide the whole line toward the gap
            const step = sameRow ? (i > gp ? 1 : -1) : (i > gp ? N : -N);
            let g2 = gp;
            while (g2 !== i) { tiles[g2] = tiles[g2 + step]; g2 += step; }
            tiles[i] = 0;
            moves++;
            render();
            if (tiles.every((x, k) => x === (k + 1) % (N * N))) {
                done = true;
                const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
                api.setScore(secs);
                msg.textContent = "Solved! 🎉";
                api.later(() => api.end(secs, "Solved! 🎉", `${moves} moves`), 500);
            }
        }
        api.onKey((e, d) => {
            if (!d) return;
            const gp = tiles.indexOf(0);
            const map: Record<string, number> = { ArrowLeft: gp + 1, ArrowRight: gp - 1, ArrowUp: gp + N, ArrowDown: gp - N };
            const target = map[e.key];
            if (target == null) return;
            if (target >= 0 && target < N * N && (e.key === "ArrowUp" || e.key === "ArrowDown" || Math.floor(target / N) === Math.floor(gp / N))) clickTile(tiles[target]);
            return true;
        });
        render();
    }
};

// ───────────────────────── Lights Out ─────────────────────────
export const lightsOut: GameDef = {
    id: "lightsout", name: "Lights Out", icon: "💡", color: "#fde047", category: "Puzzle",
    description: "Pressing a light flips it and its neighbours. Turn every light off! Each level gets harder.",
    controls: "Click a light",
    start(api) {
        const N = 5;
        let lights: boolean[] = [], level = 1, moves = 0, par = 0, score = 0;
        const msg = api.el("div", "lcg-msg");
        const grid = api.el("div", "lcg-lights");
        const cells = [...Array(N * N).keys()].map(i => { const b = api.el("button", "lcg-light", "", grid); b.onclick = () => press(i); return b; });
        const controls = api.el("div", "lcg-controls");
        api.el("button", "lcg-btn", "Give up", controls).onclick = () => api.end(score, "Lights left on", `You solved ${level - 1} level${level === 2 ? "" : "s"}.`);
        function flip(i: number) {
            const r = Math.floor(i / N), c = i % N;
            for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const rr = r + dr, cc = c + dc;
                if (rr >= 0 && rr < N && cc >= 0 && cc < N) lights[rr * N + cc] = !lights[rr * N + cc];
            }
        }
        function newLevel() {
            lights = Array(N * N).fill(false);
            par = Math.min(14, 2 + level);
            const presses = shuffle([...Array(N * N).keys()]).slice(0, par);
            for (const p of presses) flip(p);
            if (lights.every(x => !x)) return newLevel();
            moves = 0;
            msg.textContent = `Level ${level} · can be solved in ${par} presses`;
            render();
        }
        function render() {
            lights.forEach((on, i) => cells[i].classList.toggle("on", on));
            api.setStatus(`Level ${level} · ${moves} presses`);
        }
        function press(i: number) {
            flip(i);
            moves++;
            render();
            if (lights.every(x => !x)) {
                const pts = Math.max(10, 100 - (moves - par) * 10) * level;
                score += pts;
                api.setScore(score);
                msg.textContent = moves <= par ? `Perfect! +${pts}` : `Solved! +${pts}`;
                level++;
                api.later(newLevel, 900);
            }
        }
        newLevel();
    }
};

// ───────────────────────── Hangman ─────────────────────────
const HANG_WORDS: Record<string, string[]> = {
    Animals: ["penguin", "giraffe", "dolphin", "octopus", "kangaroo", "cheetah", "hedgehog", "flamingo", "squirrel", "panther", "koala", "lobster"],
    Space: ["galaxy", "nebula", "asteroid", "comet", "astronaut", "satellite", "eclipse", "meteor", "telescope", "planet", "orbit", "rocket"],
    Food: ["pancake", "spaghetti", "burrito", "avocado", "pretzel", "cupcake", "lemonade", "sandwich", "popcorn", "noodles", "waffle", "nachos"],
    Games: ["controller", "keyboard", "speedrun", "respawn", "checkpoint", "joystick", "multiplayer", "leaderboard", "achievement", "arcade", "pixel", "console"],
    Music: ["guitar", "drummer", "playlist", "melody", "rhythm", "concert", "headphones", "microphone", "karaoke", "trumpet", "violin", "chorus"],
};
export const hangman: GameDef = {
    id: "hangman", name: "Hangman", icon: "🔤", color: "#f97316", category: "Word",
    description: "Guess the hidden word one letter at a time before the drawing is finished. Keep your streak going!",
    controls: "Type letters or click the keyboard",
    start(api) {
        let word = "", cat = "", guessed = new Set<string>(), wrong = 0, streak = 0, done = false;
        const MAX = 7;
        const fig = api.el("div", "lcg-hang");
        const catEl = api.el("div", "lcg-hang-cat");
        const wordEl = api.el("div", "lcg-hang-word");
        const kb = api.el("div", "lcg-kb");
        const keys = new Map<string, HTMLButtonElement>();
        for (const line of ["qwertyuiop", "asdfghjkl", "zxcvbnm"]) {
            const row = api.el("div", "lcg-kb-row", undefined, kb);
            for (const ch of line) { const b = api.el("button", "lcg-key", ch.toUpperCase(), row); b.onclick = () => guess(ch); keys.set(ch, b); }
        }
        const parts = [
            '<line x1="20" y1="190" x2="140" y2="190"/>', '<line x1="50" y1="190" x2="50" y2="20"/><line x1="50" y1="20" x2="120" y2="20"/><line x1="120" y1="20" x2="120" y2="40"/>',
            '<circle cx="120" cy="58" r="18"/>', '<line x1="120" y1="76" x2="120" y2="130"/>', '<line x1="120" y1="90" x2="98" y2="112"/>',
            '<line x1="120" y1="90" x2="142" y2="112"/>', '<line x1="120" y1="130" x2="100" y2="164"/><line x1="120" y1="130" x2="140" y2="164"/>',
        ];
        function newWord() {
            cat = pick(Object.keys(HANG_WORDS));
            word = pick(HANG_WORDS[cat]);
            guessed = new Set(); wrong = 0; done = false;
            keys.forEach(k => { k.className = "lcg-key"; k.disabled = false; });
            render();
        }
        function render() {
            fig.innerHTML = `<svg viewBox="0 0 160 200">${parts.slice(0, wrong).join("")}</svg><div class="lcg-hang-lives">${"❤".repeat(MAX - wrong)}${"🖤".repeat(wrong)}</div>`;
            catEl.textContent = `Category: ${cat}`;
            wordEl.innerHTML = [...word].map(ch => `<span class="${guessed.has(ch) ? "shown" : ""}">${guessed.has(ch) || done ? ch.toUpperCase() : ""}</span>`).join("");
            api.setStatus(`Streak ${streak}`);
        }
        function guess(ch: string) {
            if (done || guessed.has(ch)) return;
            guessed.add(ch);
            const k = keys.get(ch)!;
            k.disabled = true;
            if (word.includes(ch)) k.classList.add("hit");
            else { k.classList.add("miss"); wrong++; }
            if ([...word].every(c => guessed.has(c))) {
                done = true; streak++;
                api.setScore(streak);
                render();
                api.later(newWord, 1300);
                return;
            }
            if (wrong >= MAX) {
                done = true;
                render();
                api.later(() => api.end(streak, "Out of guesses!", `The word was ${word.toUpperCase()}. Streak: ${streak}`), 700);
                return;
            }
            render();
        }
        api.onKey((e, d) => { if (d && /^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey) { guess(e.key.toLowerCase()); return true; } });
        newWord();
    }
};

// ───────────────────────── Word Search ─────────────────────────
const WS_THEMES: Record<string, string[]> = {
    "Space": ["GALAXY", "COMET", "NEBULA", "ORBIT", "PLANET", "ROCKET", "STAR", "MOON", "ALIEN", "SATURN", "METEOR", "COSMOS"],
    "Gaming": ["PIXEL", "BOSS", "LEVEL", "QUEST", "COMBO", "LOOT", "ARCADE", "RESPAWN", "SPEED", "SCORE", "PLAYER", "CHEST"],
    "Ocean": ["WHALE", "CORAL", "SHARK", "WAVE", "OCTOPUS", "SQUID", "REEF", "TIDE", "PEARL", "CRAB", "DOLPHIN", "KELP"],
    "Snacks": ["CHIPS", "PIZZA", "TACO", "COOKIE", "DONUT", "PRETZEL", "CANDY", "WAFFLE", "BAGEL", "MUFFIN", "POPCORN", "NACHO"],
};
export const wordSearch: GameDef = {
    id: "wordsearch", name: "Word Search", icon: "🔎", color: "#06b6d4", category: "Word", scoreKind: "time",
    description: "Find all the hidden words. They go across, down, diagonally and even backwards!",
    controls: "Drag across a word to circle it",
    start(api) {
        const N = 12;
        const theme = pick(Object.keys(WS_THEMES));
        const words = shuffle([...WS_THEMES[theme]]).slice(0, 9).sort((a, b) => b.length - a.length);
        const grid: string[][] = Array.from({ length: N }, () => Array(N).fill(""));
        const placed: { w: string; cells: number[]; }[] = [];
        const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
        for (const w of words) {
            for (let tries = 0; tries < 200; tries++) {
                const [dr, dc] = pick(DIRS), r = randInt(0, N - 1), c = randInt(0, N - 1);
                const cells: number[] = [];
                let ok = true;
                for (let i = 0; i < w.length; i++) {
                    const rr = r + dr * i, cc = c + dc * i;
                    if (rr < 0 || rr >= N || cc < 0 || cc >= N || (grid[rr][cc] && grid[rr][cc] !== w[i])) { ok = false; break; }
                    cells.push(rr * N + cc);
                }
                if (!ok) continue;
                cells.forEach((k, i) => { grid[Math.floor(k / N)][k % N] = w[i]; });
                placed.push({ w, cells });
                break;
            }
        }
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) grid[r][c] = "ABCDEFGHIJKLMNOPRSTUVWY"[randInt(0, 22)];
        const t0 = Date.now();
        const found = new Set<string>();
        api.el("div", "lcg-msg", `Theme: ${theme}`);
        const wrap = api.el("div", "lcg-ws-wrap");
        const gridEl = api.el("div", "lcg-ws", undefined, wrap);
        const list = api.el("div", "lcg-ws-list", undefined, wrap);
        const cells = grid.flat().map((ch, i) => { const e = api.el("div", "lcg-ws-cell", ch, gridEl); e.dataset.i = String(i); return e; });
        const wordEls = new Map(placed.map(p => [p.w, api.el("div", "lcg-ws-word", p.w, list)]));
        let start: number | null = null, path: number[] = [];
        const timer = setInterval(() => api.setScore(Math.floor((Date.now() - t0) / 1000)), 500);
        api.cleanup(() => clearInterval(timer));
        const hue = () => 160 + found.size * 23;
        function line(a: number, b: number): number[] {
            const r1 = Math.floor(a / N), c1 = a % N, r2 = Math.floor(b / N), c2 = b % N;
            const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1), len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
            if (r1 !== r2 && c1 !== c2 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return [a];
            return Array.from({ length: len + 1 }, (_, i) => (r1 + dr * i) * N + c1 + dc * i);
        }
        const cellFrom = (e: PointerEvent) => { const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>(".lcg-ws-cell"); return el ? Number(el.dataset.i) : null; };
        gridEl.addEventListener("pointerdown", e => { const i = cellFrom(e); if (i == null) return; start = i; path = [i]; draw(); });
        gridEl.addEventListener("pointermove", e => { if (start == null) return; const i = cellFrom(e); if (i == null) return; path = line(start, i); draw(); });
        const up = () => {
            if (start == null) return;
            const str = path.map(i => grid[Math.floor(i / N)][i % N]).join("");
            const hit = placed.find(p => !found.has(p.w) && (p.w === str || p.w === [...str].reverse().join("")) && p.cells.length === path.length);
            if (hit) {
                found.add(hit.w);
                const h = hue();
                for (const i of path) { cells[i].classList.add("found"); cells[i].style.setProperty("--h", String(h)); }
                wordEls.get(hit.w)!.classList.add("done");
                if (found.size === placed.length) {
                    const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
                    api.end(secs, "All words found! 🎉", `Theme: ${theme}`);
                }
            }
            start = null; path = []; draw();
        };
        window.addEventListener("pointerup", up);
        api.cleanup(() => window.removeEventListener("pointerup", up));
        function draw() { cells.forEach((c, i) => c.classList.toggle("sel", path.includes(i))); }
    }
};
