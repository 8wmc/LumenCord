/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Glow Snake: a Slither.io-style arena game. */

import { GameDef, pick, rand } from "./core";
import { muteButton, sfx, text, titleCard } from "./fx";

const W = 900, H = 560;
const WORLD = 2400;            // arena radius
const FOOD_TARGET = 750;
const BOT_COUNT = 10;
const BOT_NAMES = ["Nova", "Pixel", "Comet", "Zephyr", "Blitz", "Echo", "Vortex", "Luna", "Orbit", "Spark", "Rogue", "Nebby", "Quasar", "Glitch", "Jinx", "Astra"];

interface Seg { x: number; y: number; }
interface Snake {
    name: string; hue: number; segs: Seg[]; mass: number; ang: number; want: number;
    boost: boolean; alive: boolean; bot: boolean; dropT: number; think: number; respawn: number;
    sprite: HTMLCanvasElement; stripe: HTMLCanvasElement; glowSprite: HTMLCanvasElement;
}
interface Food { x: number; y: number; v: number; hue: number; r: number; ph: number; }

const radiusOf = (m: number) => 9 + Math.sqrt(m) * .9;
const segCount = (m: number) => Math.floor(12 + m / 3);
const spacingOf = (r: number) => r * .42;

function ballSprite(hue: number, glow: boolean, dark = false) {
    const S = 64, c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    if (glow) {
        const grd = g.createRadialGradient(32, 32, 8, 32, 32, 32);
        grd.addColorStop(0, `hsla(${hue} 100% 70% / .9)`);
        grd.addColorStop(1, `hsla(${hue} 100% 60% / 0)`);
        g.fillStyle = grd;
        g.fillRect(0, 0, S, S);
        return c;
    }
    const grd = g.createRadialGradient(24, 22, 2, 32, 32, 30);
    grd.addColorStop(0, `hsl(${hue} 100% ${dark ? 76 : 88}%)`);
    grd.addColorStop(.35, `hsl(${hue} 95% ${dark ? 52 : 62}%)`);
    grd.addColorStop(1, `hsl(${hue} 80% ${dark ? 22 : 28}%)`);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(32, 32, 30, 0, Math.PI * 2);
    g.fill();
    return c;
}

const foodSprites = new Map<number, HTMLCanvasElement>();
function foodSprite(hue: number) {
    let c = foodSprites.get(hue);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, "#fff");
    grd.addColorStop(.25, `hsl(${hue} 100% 70%)`);
    grd.addColorStop(.55, `hsla(${hue} 100% 60% / .45)`);
    grd.addColorStop(1, `hsla(${hue} 100% 60% / 0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    foodSprites.set(hue, c);
    return c;
}

export const glowSnake: GameDef = {
    id: "snake", name: "Glow Snake", icon: "🐍", color: "#22d3ee", category: "Arcade",
    selfSound: true,
    description: "Slither around the arena, eat glowing orbs and grow. Make other snakes crash into you, but don't hit them!",
    controls: "Mouse to steer · hold click or Space to boost",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        const HUES = [190, 280, 320, 45, 130, 0, 210, 160, 30, 260, 345, 100];
        const foods: Food[] = [];
        const snakes: Snake[] = [];
        let started = false, over = false, t = 0;
        let mouse = { x: W / 2 + 100, y: H / 2 }, holding = false, spaceDown = false;
        let zoom = 1, camX = 0, camY = 0, kills = 0, bestRank = 99;

        const rndPoint = (minR = 0, maxR = WORLD - 120) => {
            const a = rand(0, Math.PI * 2), r = Math.sqrt(rand((minR / maxR) ** 2, 1)) * maxR;
            return { x: Math.cos(a) * r, y: Math.sin(a) * r };
        };
        const addFood = (x: number, y: number, v = rand(1, 2.2), hue = pick(HUES)) =>
            foods.push({ x, y, v, hue, r: 4 + v * 2.2, ph: rand(0, 6.28) });
        for (let i = 0; i < FOOD_TARGET; i++) { const p = rndPoint(); addFood(p.x, p.y); }

        function makeSnake(name: string, bot: boolean, hue: number, x: number, y: number, mass = 30): Snake {
            const ang = rand(0, Math.PI * 2);
            const s: Snake = {
                name, hue, segs: [], mass, ang, want: ang, boost: false, alive: true, bot, dropT: 0, think: 0, respawn: 0,
                sprite: ballSprite(hue, false), stripe: ballSprite(hue, false, true), glowSprite: ballSprite(hue, true),
            };
            const sp = spacingOf(radiusOf(mass));
            for (let i = 0; i < segCount(mass); i++) s.segs.push({ x: x - Math.cos(ang) * sp * i, y: y - Math.sin(ang) * sp * i });
            return s;
        }
        const me = makeSnake("You", false, 190, 0, 0);
        snakes.push(me);
        const usedNames = new Set<string>();
        for (let i = 0; i < BOT_COUNT; i++) {
            const p = rndPoint(500);
            let n = pick(BOT_NAMES);
            while (usedNames.has(n)) n = pick(BOT_NAMES);
            usedNames.add(n);
            snakes.push(makeSnake(n, true, HUES[(i + 1) % HUES.length], p.x, p.y, rand(20, 260)));
        }

        // ── input ──
        cv.addEventListener("mousemove", e => { mouse = toLocal(e); });
        cv.addEventListener("mousedown", e => { holding = true; mouse = toLocal(e); if (!started) started = true; });
        window.addEventListener("mouseup", up);
        function up() { holding = false; }
        api.cleanup(() => window.removeEventListener("mouseup", up));
        api.onKey((e, down) => {
            if (e.key === " ") {
                spaceDown = down;
                if (down && !started) started = true;
                return true;
            }
        });

        // ── spatial grid of body segments, for collisions and AI ──
        const CELL = 80;
        let grid = new Map<number, { s: Snake; x: number; y: number; r: number; }[]>();
        const key = (cx: number, cy: number) => (cx + 500) * 1000 + (cy + 500);
        function buildGrid() {
            grid = new Map();
            for (const s of snakes) {
                if (!s.alive) continue;
                const r = radiusOf(s.mass);
                for (let i = 3; i < s.segs.length; i += 2) {
                    const p = s.segs[i];
                    const k = key(Math.floor(p.x / CELL), Math.floor(p.y / CELL));
                    let arr = grid.get(k);
                    if (!arr) grid.set(k, arr = []);
                    arr.push({ s, x: p.x, y: p.y, r });
                }
            }
        }
        function hitsBody(s: Snake, x: number, y: number, pad = 0): boolean {
            const r = radiusOf(s.mass);
            const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                const arr = grid.get(key(cx + dx, cy + dy));
                if (!arr) continue;
                for (const b of arr) {
                    if (b.s === s) continue;
                    const d = r * .6 + b.r * .8 + pad;
                    if ((b.x - x) ** 2 + (b.y - y) ** 2 < d * d) return true;
                }
            }
            return false;
        }

        function kill(s: Snake, by?: Snake) {
            if (!s.alive) return;
            s.alive = false;
            // body turns into food
            const share = Math.max(1.5, s.mass * .8 / Math.max(1, s.segs.length / 2));
            for (let i = 0; i < s.segs.length; i += 2) {
                const p = s.segs[i];
                addFood(p.x + rand(-6, 6), p.y + rand(-6, 6), Math.min(8, share), s.hue);
            }
            if (s === me) {
                over = true;
                sfx.boom();
                const score = Math.floor(me.mass);
                api.later(() => api.end(score, by ? `${by.name} got you!` : "You hit the edge!", `Length ${score} · ${kills} snake${kills === 1 ? "" : "s"} taken down · best rank #${bestRank}`), 900);
            } else {
                s.respawn = 3;
                if (by === me) { kills++; sfx.coin(); }
            }
        }

        function botThink(s: Snake, dt: number) {
            s.think -= dt;
            const head = s.segs[0], r = radiusOf(s.mass);
            // danger check: feelers ahead
            const look = 70 + r * 3;
            let danger = 0;
            for (const da of [-.6, -.3, 0, .3, .6]) {
                const a = s.ang + da;
                const fx = head.x + Math.cos(a) * look, fy = head.y + Math.sin(a) * look;
                if (fx * fx + fy * fy > (WORLD - 60) ** 2 || hitsBody(s, fx, fy, 14)) danger += da === 0 ? 2 : (da < 0 ? -1 : 1) * 1.5;
            }
            if (danger !== 0) {
                // turn away from the side with danger (or a hard turn if straight ahead)
                s.want = s.ang + (danger > 0 ? -1.4 : 1.4);
                s.boost = s.mass > 40 && Math.random() < .3;
                s.think = .25;
                return;
            }
            if (s.think > 0) return;
            s.think = rand(.25, .6);
            s.boost = false;
            // hunt: try to cut in front of a nearby snake's head (mostly the player)
            const target = snakes.find(o => o !== s && o.alive && (o.segs[0].x - head.x) ** 2 + (o.segs[0].y - head.y) ** 2 < 260 ** 2);
            if (target && s.mass > 60 && Math.random() < .35) {
                const th = target.segs[0];
                const ax = th.x + Math.cos(target.ang) * 120, ay = th.y + Math.sin(target.ang) * 120;
                s.want = Math.atan2(ay - head.y, ax - head.x);
                s.boost = s.mass > 50;
                return;
            }
            // eat: head for the best food nearby
            let best: Food | null = null, bestScore = -1;
            for (const f of foods) {
                const d2 = (f.x - head.x) ** 2 + (f.y - head.y) ** 2;
                if (d2 > 380 * 380) continue;
                const sc = f.v / (Math.sqrt(d2) + 30);
                if (sc > bestScore) { bestScore = sc; best = f; }
            }
            if (best) s.want = Math.atan2(best.y - head.y, best.x - head.x);
            else s.want = s.ang + rand(-.8, .8);
            if (head.x * head.x + head.y * head.y > (WORLD - 300) ** 2) s.want = Math.atan2(-head.y, -head.x);
        }

        function moveSnake(s: Snake, dt: number) {
            const r = radiusOf(s.mass);
            const boosting = s.boost && s.mass > 15;
            const speed = (boosting ? 330 : 165) * (1 + Math.min(.25, s.mass / 4000));
            const turn = (boosting ? 3.2 : 4.4) / (1 + s.mass / 900);
            let diff = ((s.want - s.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            diff = Math.max(-turn * dt, Math.min(turn * dt, diff));
            s.ang += diff;
            const head = s.segs[0];
            head.x += Math.cos(s.ang) * speed * dt;
            head.y += Math.sin(s.ang) * speed * dt;
            // body follows
            const sp = spacingOf(r);
            for (let i = 1; i < s.segs.length; i++) {
                const a = s.segs[i - 1], b = s.segs[i];
                const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
                if (d > sp) { const k = (d - sp) / d; b.x += dx * k; b.y += dy * k; }
            }
            const want = segCount(s.mass);
            while (s.segs.length < want) { const l = s.segs[s.segs.length - 1]; s.segs.push({ x: l.x, y: l.y }); }
            while (s.segs.length > want && s.segs.length > 12) s.segs.pop();
            // boosting burns mass and drops a trail of food
            if (boosting) {
                s.mass -= 7 * dt;
                s.dropT -= dt;
                if (s.dropT <= 0) {
                    s.dropT = .09;
                    const tail = s.segs[s.segs.length - 1];
                    addFood(tail.x, tail.y, .9, s.hue);
                }
            }
            // eat
            for (let i = foods.length - 1; i >= 0; i--) {
                const f = foods[i];
                const dx = head.x - f.x, dy = head.y - f.y, d2 = dx * dx + dy * dy;
                const reach = r + 46;
                if (d2 < reach * reach) {
                    // food is pulled into the mouth
                    const d = Math.sqrt(d2) || 1, pull = Math.min(1, 420 * dt / d);
                    f.x += dx * pull; f.y += dy * pull;
                    if (d < r + f.r) {
                        s.mass += f.v;
                        foods.splice(i, 1);
                        if (s === me && Math.random() < .5) sfx.tick();
                    }
                }
            }
            if (head.x * head.x + head.y * head.y > WORLD * WORLD) kill(s);
        }

        // ── drawing ──
        const hexTile = (() => {
            const c = document.createElement("canvas");
            const s = 46, hw = s * Math.sqrt(3);
            c.width = Math.round(hw); c.height = s * 3;
            const x = c.getContext("2d")!;
            x.fillStyle = "#0d0a22";
            x.fillRect(0, 0, c.width, c.height);
            x.strokeStyle = "rgba(168,85,247,.16)";
            x.lineWidth = 2;
            const hex = (cx: number, cy: number) => {
                x.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = Math.PI / 6 + i * Math.PI / 3;
                    x.lineTo(cx + Math.cos(a) * (s - 3), cy + Math.sin(a) * (s - 3));
                }
                x.closePath();
                const grd = x.createRadialGradient(cx, cy - 8, 2, cx, cy, s);
                grd.addColorStop(0, "#1b1440");
                grd.addColorStop(1, "#110c2b");
                x.fillStyle = grd;
                x.fill();
                x.stroke();
            };
            hex(hw / 2, s * .5); hex(0, s * 2); hex(hw, s * 2); hex(hw / 2, s * 3.5); hex(0, -s); hex(hw, -s);
            return g.createPattern(c, "repeat")!;
        })();

        function drawSnake(s: Snake) {
            const r = radiusOf(s.mass);
            const boosting = s.boost && s.mass > 15;
            const n = s.segs.length;
            for (let i = n - 1; i >= 0; i--) {
                const p = s.segs[i];
                const sx = (p.x - camX) * zoom + W / 2, sy = (p.y - camY) * zoom + H / 2;
                const rr = r * zoom * (i === 0 ? 1.08 : 1 - (i / n) * .25);
                if (sx < -rr * 2 || sx > W + rr * 2 || sy < -rr * 2 || sy > H + rr * 2) continue;
                if (boosting) g.drawImage(s.glowSprite, sx - rr * 2, sy - rr * 2, rr * 4, rr * 4);
                g.drawImage(i % 6 < 3 && i > 0 ? s.stripe : s.sprite, sx - rr, sy - rr, rr * 2, rr * 2);
            }
            // eyes
            const h = s.segs[0];
            const hx = (h.x - camX) * zoom + W / 2, hy = (h.y - camY) * zoom + H / 2, rz = r * zoom;
            const look = s === me ? Math.atan2(mouse.y - hy, mouse.x - hx) : s.ang;
            for (const side of [-1, 1]) {
                const ex = hx + Math.cos(s.ang + side * .7) * rz * .55, ey = hy + Math.sin(s.ang + side * .7) * rz * .55;
                g.fillStyle = "#fff";
                g.beginPath(); g.arc(ex, ey, rz * .36, 0, Math.PI * 2); g.fill();
                g.fillStyle = "#0b0820";
                g.beginPath(); g.arc(ex + Math.cos(look) * rz * .14, ey + Math.sin(look) * rz * .14, rz * .19, 0, Math.PI * 2); g.fill();
            }
            if (s.bot && zoom > .45) text(g, s.name, hx, hy - rz - 14, 12, "rgba(255,255,255,.75)", "center", 700, "#000");
        }

        function draw() {
            g.save();
            g.fillStyle = "#07051a";
            g.fillRect(0, 0, W, H);
            // hex floor, moving with the camera
            g.save();
            g.translate(W / 2 - camX * zoom, H / 2 - camY * zoom);
            g.scale(zoom, zoom);
            // only the visible part of the floor is painted
            const vx = camX - W / 2 / zoom, vy = camY - H / 2 / zoom, vw = W / zoom, vh = H / zoom;
            g.fillStyle = hexTile;
            g.fillRect(vx, vy, vw, vh);
            const far = Math.hypot(Math.abs(camX) + vw / 2, Math.abs(camY) + vh / 2);
            if (far > WORLD - 40) {
                // near the edge: darken outside the arena and draw the red border
                g.beginPath();
                g.rect(vx, vy, vw, vh);
                g.arc(0, 0, WORLD, 0, Math.PI * 2, true);
                g.fillStyle = "rgba(7,5,26,.92)";
                g.fill();
                g.beginPath();
                g.arc(0, 0, WORLD, 0, Math.PI * 2);
                g.lineWidth = 26; g.strokeStyle = "rgba(239,68,68,.25)"; g.stroke();
                g.lineWidth = 6; g.strokeStyle = "#f87171"; g.stroke();
            }
            g.restore();

            // food
            g.globalCompositeOperation = "lighter";
            for (const f of foods) {
                const sx = (f.x - camX) * zoom + W / 2, sy = (f.y - camY) * zoom + H / 2;
                if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue;
                const rr = f.r * zoom * (1.6 + .35 * Math.sin(t * 3 + f.ph));
                g.drawImage(foodSprite(f.hue), sx - rr * 2, sy - rr * 2, rr * 4, rr * 4);
            }
            g.globalCompositeOperation = "source-over";

            // snakes: smaller ones first so big ones are on top
            [...snakes].filter(s => s.alive).sort((a, b) => a.mass - b.mass).forEach(drawSnake);

            // HUD: leaderboard
            const ranked = snakes.filter(s => s.alive).sort((a, b) => b.mass - a.mass);
            const myRank = ranked.indexOf(me) + 1;
            if (me.alive && myRank > 0) bestRank = Math.min(bestRank, myRank);
            g.fillStyle = "rgba(10,7,30,.6)";
            g.fillRect(W - 190, 10, 180, 22 + Math.min(8, ranked.length) * 19);
            text(g, "Leaderboard", W - 100, 22, 13, "#e9d5ff", "center", 800);
            ranked.slice(0, 8).forEach((s, i) => {
                const y = 44 + i * 19;
                const col = s === me ? "#fde047" : `hsl(${s.hue} 90% 75%)`;
                text(g, `#${i + 1} ${s.name}`, W - 180, y, 13, col, "left", s === me ? 800 : 600, "#000");
                text(g, String(Math.floor(s.mass)), W - 20, y, 13, col, "right", 700, "#000");
            });
            // HUD: length and rank
            text(g, `Length ${Math.floor(me.mass)}`, 16, H - 40, 20, "#fff", "left", 800);
            text(g, `Rank #${myRank || "-"} of ${ranked.length}  ·  Takedowns ${kills}`, 16, H - 16, 13, "#c4b5fd", "left", 600, "#000");
            // minimap
            const mx = W - 70, my = H - 70, mr = 56;
            g.fillStyle = "rgba(10,7,30,.65)";
            g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
            g.strokeStyle = "rgba(248,113,113,.6)"; g.lineWidth = 2; g.stroke();
            for (const s of snakes) {
                if (!s.alive) continue;
                const p = s.segs[0];
                g.fillStyle = s === me ? "#fde047" : `hsl(${s.hue} 90% 65%)`;
                g.beginPath(); g.arc(mx + p.x / WORLD * mr, my + p.y / WORLD * mr, s === me ? 3.5 : 2, 0, Math.PI * 2); g.fill();
            }
            if (!started) titleCard(g, W, H, "Glow Snake", ["Steer with your mouse · hold click or Space to boost", "Get others to crash into your body. Don't crash into theirs!"], t, "#22d3ee");
            g.restore();
        }

        api.loop(dt => {
            t += dt;
            if (started && !over) {
                // player steering
                const hx = (me.segs[0].x - camX) * zoom + W / 2, hy = (me.segs[0].y - camY) * zoom + H / 2;
                me.want = Math.atan2(mouse.y - hy, mouse.x - hx);
                me.boost = holding || spaceDown;
            }
            if (started) {
                buildGrid();
                for (const s of snakes) {
                    if (!s.alive) {
                        if (s.bot) {
                            s.respawn -= dt;
                            if (s.respawn <= 0) {
                                let p = rndPoint(300);
                                for (let k = 0; k < 10 && Math.hypot(p.x - me.segs[0].x, p.y - me.segs[0].y) < 700; k++) p = rndPoint(300);
                                Object.assign(s, makeSnake(s.name, true, s.hue, p.x, p.y, rand(20, 120)));
                            }
                        }
                        continue;
                    }
                    if (s.bot) botThink(s, dt);
                    if (s === me && over) continue;
                    moveSnake(s, dt);
                }
                // head-to-body collisions
                for (const s of snakes) {
                    if (!s.alive) continue;
                    const h = s.segs[0];
                    if (hitsBody(s, h.x, h.y)) {
                        // who did we hit? (for the message / takedown count)
                        let by: Snake | undefined;
                        let bestD = Infinity;
                        for (const o of snakes) {
                            if (o === s || !o.alive) continue;
                            for (let i = 0; i < o.segs.length; i += 3) {
                                const d = (o.segs[i].x - h.x) ** 2 + (o.segs[i].y - h.y) ** 2;
                                if (d < bestD) { bestD = d; by = o; }
                            }
                        }
                        kill(s, by);
                    }
                }
                // keep the arena stocked
                let missing = FOOD_TARGET - foods.length;
                while (missing-- > 0 && foods.length < FOOD_TARGET) { const p = rndPoint(); addFood(p.x, p.y); }
                if (foods.length > FOOD_TARGET * 2.2) foods.splice(0, foods.length - FOOD_TARGET * 2.2);
            }
            // camera
            const h = me.segs[0];
            camX += (h.x - camX) * Math.min(1, dt * 8);
            camY += (h.y - camY) * Math.min(1, dt * 8);
            const wantZoom = Math.max(.5, 1.05 - Math.sqrt(me.mass) / 70);
            zoom += (wantZoom - zoom) * Math.min(1, dt * 2);
            api.setScore(Math.floor(me.mass));
            draw();
        });
    }
};
