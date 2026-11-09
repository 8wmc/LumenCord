/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Maze Muncher: Pac-Man style maze chase with 4 ghosts that each think differently. */

import { GameDef, pick } from "./core";
import { Floaters, glowCircle, keys, muteButton, Particles, sfx, text, titleCard } from "./fx";

const MAZE = [
    "#####################",
    "#.........#.........#",
    "#o###.###.#.###.###o#",
    "#...................#",
    "#.###.#.#####.#.###.#",
    "#.....#...#...#.....#",
    "#####.### # ###.#####",
    "    #.#       #.#    ",
    "#####.# ##-## #.#####",
    "     .  #   #  .     ",
    "#####.# ##### #.#####",
    "    #.#       #.#    ",
    "#####.# ##### #.#####",
    "#.........#.........#",
    "#.###.###.#.###.###.#",
    "#o..#...........#..o#",
    "###.#.#.#####.#.#.###",
    "#.....#...#...#.....#",
    "#.#######.#.#######.#",
    "#...................#",
    "#####################",
];
const COLS = 21, ROWS = 21, T = 22, W = 640, H = 530;
const OX = (W - COLS * T) / 2, OY = 52;
const DIRS: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], none: [0, 0] };
const OPP: Record<string, string> = { up: "down", down: "up", left: "right", right: "left", none: "none" };
type Dir = keyof typeof DIRS;

interface Actor { x: number; y: number; dir: Dir; }
interface Ghost extends Actor {
    name: string; color: string; corner: [number, number];
    state: "house" | "leaving" | "normal" | "scared" | "eyes"; release: number;
}

export const muncher: GameDef = {
    id: "muncher", name: "Maze Muncher", icon: "👻", color: "#facc15", category: "Arcade", selfSound: true,
    description: "Gobble every dot in the maze while 4 ghosts hunt you. Eat a big dot to turn the tables!",
    controls: "Arrow keys / WASD (you can press a turn early)",
    start(api) {
        const { cv, g } = api.canvas(W, H);
        muteButton(api);
        const k = keys(api);
        const fx = new Particles(), floaters = new Floaters();
        let grid: string[][] = [], dots = 0, score = 0, lives = 3, level = 1, t = 0, started = false, over = false;
        let modeT = 0, modeIdx = 0, scaredT = 0, eatChain = 0, deathT = 0, clearT = 0, readyT = 2;
        const SCHEDULE = [7, 20, 7, 20, 5, 9999];
        const pac: Actor & { want: Dir; mouth: number; } = { x: 10, y: 15, dir: "left", want: "left", mouth: 0 };
        const ghosts: Ghost[] = [
            { name: "Blaze", color: "#f87171", corner: [19, -2], x: 10, y: 7, dir: "left", state: "normal", release: 0 },
            { name: "Pinky", color: "#f9a8d4", corner: [1, -2], x: 10, y: 9, dir: "up", state: "house", release: 2 },
            { name: "Frost", color: "#67e8f9", corner: [20, 22], x: 9, y: 9, dir: "up", state: "house", release: 6 },
            { name: "Sunny", color: "#fdba74", corner: [0, 22], x: 11, y: 9, dir: "up", state: "house", release: 11 },
        ];
        const start = ghosts.map(gh => ({ x: gh.x, y: gh.y, state: gh.state, dir: gh.dir }));

        function loadMaze() {
            grid = MAZE.map(r => [...r]);
            dots = grid.flat().filter(c => c === "." || c === "o").length;
        }
        function resetActors() {
            Object.assign(pac, { x: 10, y: 15, dir: "left", want: "left" });
            ghosts.forEach((gh, i) => Object.assign(gh, start[i], { release: [0, 2, 6, 11][i] / Math.min(2, 1 + (level - 1) * .2) }));
            modeT = 0; modeIdx = 0; scaredT = 0; readyT = 2;
        }
        loadMaze();

        const cell = (x: number, y: number) => {
            if (y < 0 || y >= ROWS) return "#";
            return grid[y][((x % COLS) + COLS) % COLS];
        };
        const open = (x: number, y: number, ghost = false) => { const c = cell(x, y); return c !== "#" && (ghost || c !== "-"); };

        // ── walls are drawn once into an image ──
        const wallImg = document.createElement("canvas");
        wallImg.width = COLS * T * 2; wallImg.height = ROWS * T * 2;
        (() => {
            const w = wallImg.getContext("2d")!;
            w.scale(2, 2);
            const isWall = (x: number, y: number) => x >= 0 && x < COLS && y >= 0 && y < ROWS && MAZE[y][x] === "#";
            w.lineCap = "round";
            for (const pass of [0, 1]) {
                w.strokeStyle = pass ? "#a5b4fc" : "rgba(99,102,241,.5)";
                w.lineWidth = pass ? 2 : 6;
                for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
                    if (!isWall(x, y)) continue;
                    if (!pass) { w.fillStyle = "rgba(30,27,75,.85)"; w.fillRect(x * T, y * T, T, T); }
                    const px = x * T, py = y * T, i = 4;
                    w.beginPath();
                    if (!isWall(x, y - 1) && y > 0) { w.moveTo(px + (isWall(x - 1, y) ? 0 : i), py + i); w.lineTo(px + T - (isWall(x + 1, y) ? 0 : i), py + i); }
                    if (!isWall(x, y + 1) && y < ROWS - 1) { w.moveTo(px + (isWall(x - 1, y) ? 0 : i), py + T - i); w.lineTo(px + T - (isWall(x + 1, y) ? 0 : i), py + T - i); }
                    if (!isWall(x - 1, y) && x > 0) { w.moveTo(px + i, py + (isWall(x, y - 1) ? 0 : i)); w.lineTo(px + i, py + T - (isWall(x, y + 1) ? 0 : i)); }
                    if (!isWall(x + 1, y) && x < COLS - 1) { w.moveTo(px + T - i, py + (isWall(x, y - 1) ? 0 : i)); w.lineTo(px + T - i, py + T - (isWall(x, y + 1) ? 0 : i)); }
                    w.stroke();
                }
            }
            // ghost door
            w.fillStyle = "#f9a8d4";
            w.fillRect(10 * T + 2, 8 * T + T / 2 - 2, T - 4, 4);
        })();

        // move an actor along the grid; `choose` picks a direction each time it reaches a tile centre
        function step(a: Actor, speed: number, dt: number, choose: () => Dir, ghost: boolean) {
            let dist = speed * dt;
            for (let guard = 0; dist > 1e-6 && guard < 8; guard++) {
                if (a.dir === "none") break;
                const [dx, dy] = DIRS[a.dir];
                const pos = dx ? a.x : a.y, d = dx || dy;
                const atCenter = Math.abs(pos - Math.round(pos)) < 1e-6;
                const next = atCenter ? Math.round(pos) + d : d > 0 ? Math.ceil(pos) : Math.floor(pos);
                const toC = Math.abs(next - pos);
                if (toC > dist) {
                    if (dx) a.x += d * dist; else a.y += d * dist;
                    break;
                }
                if (dx) a.x = next; else a.y = next;
                dist -= toC;
                // wrap through the side tunnel
                if (a.x <= -1) a.x = COLS - 1; else if (a.x >= COLS) a.x = 0;
                const nd = choose();
                if (open(a.x + DIRS[nd][0], a.y + DIRS[nd][1], ghost)) a.dir = nd;
                else if (!open(a.x + dx, a.y + dy, ghost)) a.dir = "none";
            }
        }

        function ghostTarget(gh: Ghost): [number, number] {
            if (gh.state === "eyes") return [10, 7];
            const chase = modeIdx % 2 === 1;
            if (!chase) return gh.corner;
            const [dx, dy] = DIRS[pac.dir];
            if (gh.name === "Blaze") return [pac.x, pac.y];
            if (gh.name === "Pinky") return [pac.x + dx * 4, pac.y + dy * 4];
            if (gh.name === "Frost") { const b = ghosts[0], ax = pac.x + dx * 2, ay = pac.y + dy * 2; return [ax * 2 - b.x, ay * 2 - b.y]; }
            return Math.hypot(pac.x - gh.x, pac.y - gh.y) > 8 ? [pac.x, pac.y] : gh.corner;
        }
        function ghostChoose(gh: Ghost): Dir {
            const opts = (["up", "left", "down", "right"] as Dir[]).filter(d => d !== OPP[gh.dir] && open(Math.round(gh.x) + DIRS[d][0], Math.round(gh.y) + DIRS[d][1], gh.state === "eyes"));
            if (!opts.length) return OPP[gh.dir] as Dir;
            if (gh.state === "scared") return pick(opts);
            const [tx, ty] = ghostTarget(gh);
            let best = opts[0], bd = Infinity;
            for (const d of opts) {
                const nx = Math.round(gh.x) + DIRS[d][0], ny = Math.round(gh.y) + DIRS[d][1];
                const dd = (nx - tx) ** 2 + (ny - ty) ** 2;
                if (dd < bd) { bd = dd; best = d; }
            }
            return best;
        }

        function eatAt(x: number, y: number) {
            x = ((x % COLS) + COLS) % COLS;
            if (y < 0 || y >= ROWS) return;
            const c = cell(x, y);
            if (c !== "." && c !== "o") return;
            grid[y][x] = " ";
            dots--;
            if (c === ".") { score += 10; if (Math.random() < .5) sfx.tick(); }
            else {
                score += 50;
                sfx.power();
                scaredT = Math.max(3, 8 - level);
                eatChain = 0;
                for (const gh of ghosts) if (gh.state === "normal") { gh.state = "scared"; gh.dir = OPP[gh.dir] as Dir; }
            }
            if (!dots) { clearT = 2; sfx.win(); }
        }

        function die() {
            deathT = 1.6;
            sfx.lose();
            fx.burst(OX + pac.x * T + T / 2, OY + pac.y * T + T / 2, { n: 40, color: ["#fde047", "#fff"], speed: 260, life: 1 });
        }

        const dirKey = (): Dir | null => k.has("ArrowUp", "w") ? "up" : k.has("ArrowDown", "s") ? "down" : k.has("ArrowLeft", "a") ? "left" : k.has("ArrowRight", "d") ? "right" : null;
        api.onKey((e, d) => { if (d && e.key === " " && !started) { started = true; return true; } });
        cv.addEventListener("mousedown", () => { started = true; });

        function drawGhost(gh: Ghost) {
            const x = OX + gh.x * T + T / 2, y = OY + gh.y * T + T / 2, r = T * .5;
            const flashing = gh.state === "scared" && scaredT < 2 && Math.floor(t * 6) % 2 === 0;
            if (gh.state !== "eyes") {
                const body = gh.state === "scared" ? (flashing ? "#f8fafc" : "#3b82f6") : gh.color;
                g.save();
                g.shadowColor = body; g.shadowBlur = 12;
                g.fillStyle = body;
                g.beginPath();
                g.arc(x, y - 1, r, Math.PI, 0);
                g.lineTo(x + r, y + r);
                const waves = 3, ph = Math.sin(t * 14) * 2;
                for (let i = 0; i < waves; i++) {
                    const x1 = x + r - (i + .5) * (2 * r / waves), x2 = x + r - (i + 1) * (2 * r / waves);
                    g.quadraticCurveTo(x1, y + r - 5 + (i % 2 ? ph : -ph), x2, y + r);
                }
                g.closePath();
                g.fill();
                g.restore();
                if (gh.state === "scared") {
                    g.fillStyle = flashing ? "#ef4444" : "#fde68a";
                    g.fillRect(x - 5, y - 4, 3, 3); g.fillRect(x + 2, y - 4, 3, 3);
                    g.strokeStyle = g.fillStyle; g.lineWidth = 1.5;
                    g.beginPath(); g.moveTo(x - 7, y + 4); for (let i = 0; i < 5; i++) g.lineTo(x - 7 + (i + 1) * 2.8, y + 4 + (i % 2 ? 0 : -2.5)); g.stroke();
                    return;
                }
            }
            const [dx, dy] = DIRS[gh.dir];
            for (const s of [-1, 1]) {
                g.fillStyle = "#fff";
                g.beginPath(); g.ellipse(x + s * 4.5, y - 3, 3.6, 4.4, 0, 0, Math.PI * 2); g.fill();
                g.fillStyle = "#1e3a8a";
                g.beginPath(); g.arc(x + s * 4.5 + dx * 1.8, y - 3 + dy * 2, 2, 0, Math.PI * 2); g.fill();
            }
        }

        function drawPac() {
            const x = OX + pac.x * T + T / 2, y = OY + pac.y * T + T / 2;
            let mouth = .05 + Math.abs(Math.sin(pac.mouth)) * .32;
            let r = T * .52;
            if (deathT > 0) { mouth = Math.min(1, (1.6 - deathT) / 1.2) * Math.PI * .98 / Math.PI; r *= Math.max(.1, deathT / 1.6); }
            const ang = ({ up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 } as Record<string, number>)[pac.dir] ?? Math.PI;
            g.save();
            g.shadowColor = "#fde047"; g.shadowBlur = 16;
            const grd = g.createRadialGradient(x - 4, y - 5, 2, x, y, r);
            grd.addColorStop(0, "#fffbeb"); grd.addColorStop(.4, "#fde047"); grd.addColorStop(1, "#ca8a04");
            g.fillStyle = grd;
            g.beginPath();
            g.moveTo(x, y);
            g.arc(x, y, r, ang + mouth * Math.PI, ang - mouth * Math.PI + Math.PI * 2);
            g.closePath();
            g.fill();
            g.restore();
        }

        api.loop(dt => {
            t += dt;
            fx.update(dt); floaters.update(dt);
            if (started && !over) {
                if (clearT > 0) {
                    clearT -= dt;
                    if (clearT <= 0) { level++; loadMaze(); resetActors(); floaters.add(W / 2, OY + 9.5 * T, `LEVEL ${level}`, "#fde047", 28); }
                } else if (deathT > 0) {
                    deathT -= dt;
                    if (deathT <= 0) {
                        lives--;
                        if (lives <= 0) { over = true; api.end(score, "Caught by a ghost!", `You reached level ${level}`); }
                        else resetActors();
                    }
                } else if (readyT > 0) {
                    readyT -= dt;
                } else {
                    // mode timers
                    if (scaredT > 0) {
                        scaredT -= dt;
                        if (scaredT <= 0) for (const gh of ghosts) if (gh.state === "scared") gh.state = "normal";
                    } else {
                        modeT += dt;
                        if (modeT > SCHEDULE[modeIdx]) { modeT = 0; modeIdx = Math.min(SCHEDULE.length - 1, modeIdx + 1); for (const gh of ghosts) if (gh.state === "normal") gh.dir = OPP[gh.dir] as Dir; }
                    }
                    // player
                    const want = dirKey();
                    if (want) pac.want = want;
                    if (pac.want === OPP[pac.dir]) pac.dir = pac.want;
                    if (pac.dir === "none" && open(Math.round(pac.x) + DIRS[pac.want][0], Math.round(pac.y) + DIRS[pac.want][1])) pac.dir = pac.want;
                    const ps = 6.6 + level * .25;
                    step(pac, ps, dt, () => pac.want, false);
                    if (pac.dir !== "none") pac.mouth += dt * 14;
                    eatAt(Math.round(pac.x), Math.round(pac.y));
                    // ghosts
                    for (const gh of ghosts) {
                        if (gh.state === "house") {
                            gh.release -= dt;
                            gh.y = 9 + Math.sin(t * 6 + gh.x) * .25;
                            if (gh.release <= 0) gh.state = "leaving";
                            continue;
                        }
                        if (gh.state === "leaving") {
                            if (Math.abs(gh.x - 10) > .05) gh.x += Math.sign(10 - gh.x) * Math.min(Math.abs(10 - gh.x), 4 * dt);
                            else { gh.x = 10; gh.y -= 4 * dt; if (gh.y <= 7) { gh.y = 7; gh.state = scaredT > 0 ? "scared" : "normal"; gh.dir = "left"; } }
                            continue;
                        }
                        const tunnel = Math.round(gh.y) === 9 && (gh.x < 5 || gh.x > 15);
                        const sp = gh.state === "eyes" ? 13 : gh.state === "scared" ? 4.2 : tunnel ? 3.8 : 6.1 + level * .3;
                        step(gh, sp, dt, () => ghostChoose(gh), gh.state === "eyes");
                        if (gh.state === "eyes" && Math.round(gh.x) === 10 && Math.round(gh.y) === 7) { gh.state = "house"; gh.x = 10; gh.y = 9; gh.release = .6; }
                        // collisions
                        if (Math.hypot(gh.x - pac.x, gh.y - pac.y) < .65) {
                            if (gh.state === "scared") {
                                const pts = 200 * 2 ** eatChain++;
                                score += pts;
                                gh.state = "eyes";
                                sfx.coin();
                                floaters.add(OX + gh.x * T + T / 2, OY + gh.y * T, String(pts), "#67e8f9", 16);
                            } else if (gh.state === "normal") { die(); break; }
                        }
                    }
                }
                api.setScore(score);
                api.setStatus(`Level ${level} · ${"♥".repeat(Math.max(0, lives))}`);
            }

            // ── draw ──
            g.fillStyle = "#06041a";
            g.fillRect(0, 0, W, H);
            const flash = clearT > 0 && Math.floor(t * 6) % 2 === 0;
            g.globalAlpha = flash ? .4 : 1;
            g.drawImage(wallImg, OX, OY, COLS * T, ROWS * T);
            g.globalAlpha = 1;
            for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
                const c = grid[y][x];
                if (c === ".") { g.fillStyle = "#fde68a"; g.fillRect(OX + x * T + T / 2 - 2, OY + y * T + T / 2 - 2, 4, 4); }
                else if (c === "o" && Math.floor(t * 4) % 2 === 0) glowCircle(g, OX + x * T + T / 2, OY + y * T + T / 2, 6, "#fde047", 16);
            }
            if (deathT <= 0 || deathT > 1.4) for (const gh of ghosts) drawGhost(gh);
            drawPac();
            fx.draw(g);
            floaters.draw(g);
            text(g, `SCORE ${score}`, OX, 26, 18, "#fff", "left", 900);
            text(g, `LEVEL ${level}`, W / 2, 26, 18, "#fde047", "center", 900, "#ca8a04");
            for (let i = 0; i < lives; i++) glowCircle(g, OX + COLS * T - 10 - i * 22, 26, 8, "#fde047", 0);
            if (started && readyT > 0 && clearT <= 0 && deathT <= 0) text(g, "READY!", W / 2, OY + 11 * T + T / 2 + 2, 20, "#fde047", "center", 900, "#ca8a04");
            if (!started) titleCard(g, W, H, "Maze Muncher", ["Eat all the dots · avoid the ghosts", "Big dots make ghosts blue: eat them for 200 → 1600!"], t, "#facc15");
        });
    }
};
