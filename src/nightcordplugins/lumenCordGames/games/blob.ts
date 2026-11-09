/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Blob Arena: Agar.io style. */

import { GameDef, rand } from "./core";
import { muteButton, sfx, text, titleCard } from "./fx";

const W = 860, H = 540, WORLD = 3000, PELLETS = 900, BOTS = 14;
const NAMES = ["Bubbles", "Gloop", "Mochi", "Nova", "Jelly", "Orbit", "Pixel", "Zest", "Boba", "Comet", "Muffin", "Echo", "Squish", "Lumi", "Tofu", "Wobble", "Blip"];
interface Cell { x: number; y: number; m: number; vx: number; vy: number; merge: number; }
interface Blob { name: string; hue: number; cells: Cell[]; bot: boolean; alive: boolean; target: { x: number; y: number; }; think: number; respawn: number; }
interface Pellet { x: number; y: number; hue: number; }
interface Virus { x: number; y: number; }

const rOf = (m: number) => Math.sqrt(m) * 4;
const blobSprites = new Map<number, HTMLCanvasElement>();
function blobSprite(hue: number) {
    const h = Math.round(hue / 10) * 10;
    let c = blobSprites.get(h);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64 - 19, 64 - 22, 6, 64, 64, 60);
    grd.addColorStop(0, `hsl(${h} 100% 85%)`); grd.addColorStop(.5, `hsl(${h} 85% 60%)`); grd.addColorStop(1, `hsl(${h} 80% 40%)`);
    g.fillStyle = grd;
    g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
    g.strokeStyle = `hsl(${h} 80% 30%)`; g.lineWidth = 4; g.stroke();
    blobSprites.set(h, c);
    return c;
}
const speedOf = (m: number) => 260 * Math.pow(m, -.32) * 4.2;

export const blobArena: GameDef = {
    id: "blob", name: "Blob Arena", icon: "🫧", color: "#34d399", category: "Arcade", selfSound: true,
    description: "Agar.io style! Eat dots and smaller blobs to grow. Split to catch prey, and run from anything bigger.",
    controls: "Mouse to move · Space to split",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        let pellets: Pellet[] = [], viruses: Virus[] = [];
        const blobs: Blob[] = [];
        let mouse = { x: W / 2 + 50, y: H / 2 }, cam = { x: 0, y: 0, z: 1 }, t = 0, started = false, over = false, bestMass = 0, eaten = 0;
        const rp = () => ({ x: rand(-WORLD, WORLD), y: rand(-WORLD, WORLD) });
        for (let i = 0; i < PELLETS; i++) pellets.push({ ...rp(), hue: rand(0, 360) });
        for (let i = 0; i < 12; i++) viruses.push(rp());

        const newBlob = (name: string, bot: boolean, hue: number, m: number): Blob => {
            const p = rp();
            return { name, hue, bot, alive: true, cells: [{ x: p.x, y: p.y, m, vx: 0, vy: 0, merge: 0 }], target: { x: p.x, y: p.y }, think: 0, respawn: 0 };
        };
        const me = newBlob("You", false, 150, 20);
        me.cells[0].x = 0; me.cells[0].y = 0;
        blobs.push(me);
        for (let i = 0; i < BOTS; i++) blobs.push(newBlob(NAMES[i % NAMES.length], true, rand(0, 360), rand(15, 160)));
        const mass = (b: Blob) => b.cells.reduce((s, c) => s + c.m, 0);
        const center = (b: Blob) => {
            const m = mass(b) || 1;
            return { x: b.cells.reduce((s, c) => s + c.x * c.m, 0) / m, y: b.cells.reduce((s, c) => s + c.y * c.m, 0) / m };
        };

        function split(b: Blob) {
            if (b.cells.length >= 8) return;
            for (const c of [...b.cells]) {
                if (c.m < 36 || b.cells.length >= 8) continue;
                const a = Math.atan2(b.target.y - c.y, b.target.x - c.x);
                c.m /= 2;
                c.merge = 9 + c.m / 60;
                b.cells.push({ x: c.x + Math.cos(a) * rOf(c.m), y: c.y + Math.sin(a) * rOf(c.m), m: c.m, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, merge: c.merge });
            }
            if (b === me) sfx.jump();
        }

        cv.addEventListener("mousemove", e => { mouse = toLocal(e); });
        cv.addEventListener("mousedown", () => { started = true; });
        api.onKey((e, d) => {
            if (e.key !== " ") return;
            if (d && !e.repeat) { if (!started) started = true; else if (!over) split(me); }
            return true;
        });

        function botThink(b: Blob, dt: number) {
            b.think -= dt;
            if (b.think > 0) return;
            b.think = rand(.2, .45);
            const c = center(b), m = mass(b);
            let fx = 0, fy = 0;
            // run from bigger blobs, chase smaller ones
            let prey: { x: number; y: number; d: number; } | null = null;
            for (const o of blobs) {
                if (o === b || !o.alive) continue;
                for (const oc of o.cells) {
                    const d = Math.hypot(oc.x - c.x, oc.y - c.y);
                    if (d > 520) continue;
                    if (oc.m > m * 0.6 * 1.25 && oc.m > Math.max(...b.cells.map(x => x.m)) * 1.2) { fx -= (oc.x - c.x) / d * (600 / d); fy -= (oc.y - c.y) / d * (600 / d); }
                    else if (oc.m * 1.25 < Math.min(...b.cells.map(x => x.m)) && (!prey || d < prey.d)) prey = { x: oc.x, y: oc.y, d };
                }
            }
            if (Math.abs(fx) + Math.abs(fy) > .5) { b.target = { x: c.x + fx * 200, y: c.y + fy * 200 }; return; }
            if (prey) {
                b.target = { x: prey.x, y: prey.y };
                if (prey.d < rOf(m) * 2.5 && m > 80 && b.cells.length === 1 && Math.random() < .3) split(b);
                return;
            }
            let best: Pellet | null = null, bd = 1e9;
            for (const p of pellets) { const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < bd) { bd = d; best = p; } }
            if (best) b.target = { x: best.x + rand(-40, 40), y: best.y + rand(-40, 40) };
        }

        function eatCell(eater: Blob, ec: Cell, victim: Blob, vc: Cell) {
            ec.m += vc.m;
            victim.cells.splice(victim.cells.indexOf(vc), 1);
            if (eater === me) { eaten++; sfx.coin(); }
            if (!victim.cells.length) {
                victim.alive = false;
                if (victim === me) {
                    over = true;
                    sfx.lose();
                    api.later(() => api.end(Math.floor(bestMass), `${eater.name} ate you!`, `Biggest size ${Math.floor(bestMass)} · ${eaten} blobs eaten`), 600);
                } else victim.respawn = 4;
            }
        }

        api.loop(dt => {
            t += dt;
            if (started && !over) {
                const mc = center(me);
                // the mouse points where to go (relative to the screen centre)
                me.target = { x: mc.x + (mouse.x - W / 2) / cam.z, y: mc.y + (mouse.y - H / 2) / cam.z };
            }
            if (started) {
                for (const b of blobs) {
                    if (!b.alive) {
                        if (b.bot && (b.respawn -= dt) <= 0) Object.assign(b, newBlob(b.name, true, b.hue, rand(15, 60)));
                        continue;
                    }
                    if (b === me && over) continue;
                    if (b.bot) botThink(b, dt);
                    for (const c of b.cells) {
                        const dx = b.target.x - c.x, dy = b.target.y - c.y, d = Math.hypot(dx, dy) || 1;
                        const sp = speedOf(c.m) * Math.min(1, d / 60);
                        c.x += (dx / d * sp + c.vx) * dt; c.y += (dy / d * sp + c.vy) * dt;
                        c.vx *= Math.pow(.02, dt); c.vy *= Math.pow(.02, dt);
                        c.merge -= dt;
                        c.m = Math.max(10, c.m - c.m * .0018 * dt * (c.m > 300 ? 2 : 1)); // slow shrink when big
                        c.x = Math.max(-WORLD, Math.min(WORLD, c.x)); c.y = Math.max(-WORLD, Math.min(WORLD, c.y));
                    }
                    // own cells push apart or merge
                    for (let i = 0; i < b.cells.length; i++) for (let j = i + 1; j < b.cells.length; j++) {
                        const a = b.cells[i], c = b.cells[j];
                        const d = Math.hypot(a.x - c.x, a.y - c.y) || .01, rr = rOf(a.m) + rOf(c.m);
                        if (d < rr) {
                            if (a.merge <= 0 && c.merge <= 0) { if (d < Math.max(rOf(a.m), rOf(c.m))) { a.m += c.m; b.cells.splice(j, 1); j--; } }
                            else { const push = (rr - d) / 2; a.x += (a.x - c.x) / d * push; a.y += (a.y - c.y) / d * push; c.x -= (a.x - c.x) / d * push; c.y -= (a.y - c.y) / d * push; }
                        }
                    }
                    // pellets
                    for (const c of b.cells) {
                        const r = rOf(c.m);
                        for (let i = pellets.length - 1; i >= 0; i--) {
                            const p = pellets[i];
                            if (Math.abs(p.x - c.x) < r && Math.abs(p.y - c.y) < r && (p.x - c.x) ** 2 + (p.y - c.y) ** 2 < r * r) { c.m += 1.2; pellets.splice(i, 1); }
                        }
                        // viruses pop big cells into pieces
                        for (const v of viruses) {
                            if (c.m > 140 && Math.hypot(v.x - c.x, v.y - c.y) < r * .9 && b.cells.length < 8) {
                                const pieces = Math.min(8 - b.cells.length, 5);
                                const share = c.m / (pieces + 1);
                                c.m = share; c.merge = 12;
                                for (let k = 0; k < pieces; k++) { const a = k / pieces * Math.PI * 2; b.cells.push({ x: c.x, y: c.y, m: share, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, merge: 12 }); }
                                Object.assign(v, rp());
                                if (b === me) sfx.boom();
                                break;
                            }
                        }
                    }
                }
                // blobs eat each other (25% bigger and mostly covering)
                for (const a of blobs) for (const b of blobs) {
                    if (a === b || !a.alive || !b.alive) continue;
                    for (const ac of [...a.cells]) for (const bc of [...b.cells]) {
                        if (ac.m < bc.m * 1.25 || !a.cells.includes(ac) || !b.cells.includes(bc)) continue;
                        if (Math.hypot(ac.x - bc.x, ac.y - bc.y) < rOf(ac.m) - rOf(bc.m) * .4) eatCell(a, ac, b, bc);
                    }
                }
                while (pellets.length < PELLETS) pellets.push({ ...rp(), hue: rand(0, 360) });
                if (me.alive) { bestMass = Math.max(bestMass, mass(me)); api.setScore(Math.floor(mass(me))); }
            }
            // camera
            if (me.alive) {
                const c = center(me), m = mass(me);
                cam.x += (c.x - cam.x) * Math.min(1, dt * 6); cam.y += (c.y - cam.y) * Math.min(1, dt * 6);
                const z = Math.max(.32, Math.min(1.2, 1.25 / Math.pow(m / 20, .22) * (me.cells.length > 1 ? .85 : 1)));
                cam.z += (z - cam.z) * Math.min(1, dt * 2);
            }

            // ── draw ──
            g.fillStyle = "#0b0a1e"; g.fillRect(0, 0, W, H);
            const sx = (x: number) => (x - cam.x) * cam.z + W / 2, sy = (y: number) => (y - cam.y) * cam.z + H / 2;
            // grid
            g.strokeStyle = "rgba(167,139,250,.08)"; g.lineWidth = 1;
            const step = 50 * cam.z;
            for (let x = ((sx(0) % step) + step) % step; x < W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
            for (let y = ((sy(0) % step) + step) % step; y < H; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
            g.strokeStyle = "rgba(248,113,113,.6)"; g.lineWidth = 4;
            g.strokeRect(sx(-WORLD), sy(-WORLD), WORLD * 2 * cam.z, WORLD * 2 * cam.z);
            for (const p of pellets) {
                const x = sx(p.x), y = sy(p.y);
                if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
                g.fillStyle = `hsl(${Math.round(p.hue / 30) * 30} 90% 65%)`;
                const pr = Math.max(2, 5 * cam.z);
                g.beginPath(); g.arc(x, y, pr, 0, Math.PI * 2); g.fill();
            }
            // everything round, smallest first
            const draws: { x: number; y: number; r: number; hue: number; name: string; virus?: boolean; }[] = [];
            for (const b of blobs) if (b.alive) for (const c of b.cells) draws.push({ x: c.x, y: c.y, r: rOf(c.m), hue: b.hue, name: b.name });
            for (const v of viruses) draws.push({ x: v.x, y: v.y, r: rOf(120), hue: 120, name: "", virus: true });
            draws.sort((a, b) => a.r - b.r);
            for (const d of draws) {
                const x = sx(d.x), y = sy(d.y), r = d.r * cam.z;
                if (x < -r || x > W + r || y < -r || y > H + r) continue;
                if (d.virus) {
                    g.fillStyle = "rgba(34,197,94,.55)"; g.strokeStyle = "#4ade80"; g.lineWidth = 3;
                    g.beginPath();
                    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, rr = r * (i % 2 ? .92 : 1.06); g.lineTo(x + Math.cos(a + t * .3) * rr, y + Math.sin(a + t * .3) * rr); }
                    g.fill(); g.stroke();
                    continue;
                }
                const wob = Math.sin(t * 4 + d.x * .01) * .02;
                g.drawImage(blobSprite(d.hue), x - r * (1 + wob) * 1.067, y - r * (1 - wob) * 1.067, r * (1 + wob) * 2.133, r * (1 - wob) * 2.133);
                if (r > 16) text(g, d.name, x, y, Math.max(11, Math.min(26, r * .38)), "#fff", "center", 800, "#000");
            }
            // leaderboard
            const ranked = blobs.filter(b => b.alive).sort((a, b) => mass(b) - mass(a));
            g.fillStyle = "rgba(10,8,30,.6)"; g.fillRect(W - 180, 10, 170, 24 + 8 * 18);
            text(g, "Leaderboard", W - 95, 22, 13, "#e9d5ff", "center", 800);
            ranked.slice(0, 8).forEach((b, i) => {
                const col = b === me ? "#fde047" : "#ddd6fe";
                text(g, `${i + 1}. ${b.name}`, W - 170, 42 + i * 18, 12, col, "left", b === me ? 800 : 600, "#000");
                text(g, String(Math.floor(mass(b))), W - 18, 42 + i * 18, 12, col, "right", 700, "#000");
            });
            text(g, `Size ${Math.floor(mass(me))}`, 16, H - 20, 20, "#fff", "left", 900);
            if (!started) titleCard(g, W, H, "Blob Arena", ["Move with your mouse · Space splits you in two", "Eat smaller blobs, run from bigger ones · green spikes pop big blobs"], t, "#34d399");
        });
    }
};
