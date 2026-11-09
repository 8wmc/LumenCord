/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Orb Roll 3D: steer a rolling ball down a winding neon track (Slope / Ball 3D style). */

import { GameDef, randInt } from "./core";
import { keys, muteButton, Particles, sfx, Shake, text, titleCard } from "./fx";

const W = 860, H = 520, LANES = 5, VIEW = 56;
const F = 520, HOR = 150;

interface Row { tiles: boolean[]; block: boolean[]; gem: number; }

export const orbRoll: GameDef = {
    id: "orbroll", name: "Orb Roll 3D", icon: "🔮", color: "#34d399", category: "Arcade",
    selfSound: true,
    description: "Roll down a twisting 3D neon track. Dodge red blocks, jump over nothing, and don't fall off the edge!",
    controls: "← → or A D to steer · mouse works too",
    start(api) {
        const { cv, g, toLocal } = api.canvas(W, H);
        muteButton(api);
        const k = keys(api);
        const fx = new Particles(), shake = new Shake();
        const rows: Row[] = [];
        let safe = 2, t = 0, state: "ready" | "play" | "fall" | "crash" = "ready";
        let z = 0, off = 0, vx = 0, speed = 13, ballY = 0, fallV = 0, roll = 0, gems = 0, mouseX: number | null = null, endT = 0;

        const centerX = (zz: number) => 2.6 * Math.sin(zz / 38) + 1.4 * Math.sin(zz / 15.5);
        const trackY = (zz: number) => 1.1 * Math.sin(zz / 26) + .5 * Math.sin(zz / 9.7);

        function genRow(i: number): Row {
            const tiles = Array(LANES).fill(true), block = Array(LANES).fill(false);
            let gem = -1;
            if (i > 28) {
                const diff = Math.min(1, i / 900);
                if (i % 3 === 0 && Math.random() < .55) safe = Math.max(0, Math.min(LANES - 1, safe + randInt(-1, 1)));
                const r = Math.random();
                if (r < .1 + diff * .18) {
                    // gap row: holes everywhere except a path
                    for (let l = 0; l < LANES; l++) if (Math.abs(l - safe) > (Math.random() < .5 ? 1 : 0)) tiles[l] = Math.random() < .25 - diff * .2;
                } else if (r < .2 + diff * .3) {
                    for (let l = 0; l < LANES; l++) if (l !== safe && Math.random() < .35 + diff * .3) block[l] = true;
                }
                if (Math.random() < .06) gem = safe;
            }
            tiles[safe] = true;
            block[safe] = false;
            return { tiles, block, gem };
        }
        const rowAt = (i: number) => { while (rows.length <= i) rows.push(genRow(rows.length)); return rows[i]; };

        cv.addEventListener("mousemove", e => { mouseX = toLocal(e).x; });
        cv.addEventListener("mouseleave", () => { mouseX = null; });
        cv.addEventListener("mousedown", () => { if (state === "ready") state = "play"; });
        api.onKey((e, d) => { if (d && e.key === " " && state === "ready") { state = "play"; return true; } });

        // projection: world (x, y, zz) → screen
        let camX = 0, camY = 0, camZ = -4;
        const proj = (x: number, y: number, zz: number) => {
            const dz = Math.max(.15, zz - camZ);
            return { x: W / 2 + (x - camX) * F / dz, y: HOR + (camY - y) * F / dz, s: F / dz };
        };

        function quad(a: { x: number; y: number; }, b: { x: number; y: number; }, c: { x: number; y: number; }, d: { x: number; y: number; }) {
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
        }

        function drawRow(i: number) {
            const row = rowAt(i);
            const z0 = i, z1 = i + 1;
            const c0 = centerX(z0), c1 = centerX(z1), y0 = trackY(z0), y1 = trackY(z1);
            const fade = Math.max(0, Math.min(1, (VIEW - (i - z)) / 18));
            for (let l = 0; l < LANES; l++) {
                if (!row.tiles[l]) continue;
                const lx = l - LANES / 2;
                const a = proj(c0 + lx, y0, z0), b = proj(c0 + lx + 1, y0, z0), c = proj(c1 + lx + 1, y1, z1), d = proj(c1 + lx, y1, z1);
                quad(a, b, c, d);
                const shadeK = .5 + .5 * Math.sin((y1 - y0) * 3 + 1);
                g.fillStyle = (i + l) % 2 ? `rgba(16,${30 + shadeK * 20},40,${fade})` : `rgba(10,${22 + shadeK * 16},34,${fade})`;
                g.fill();
                g.strokeStyle = `rgba(52,211,153,${.85 * fade})`;
                g.lineWidth = Math.max(.6, a.y > HOR ? (a.y - HOR) / 160 : .6);
                g.stroke();
                // side wall on the outer/edge tiles so the track looks solid
                const leftOpen = l === 0 || !row.tiles[l - 1], rightOpen = l === LANES - 1 || !row.tiles[l + 1];
                if (leftOpen || rightOpen) {
                    g.fillStyle = `rgba(16,185,129,${.25 * fade})`;
                    if (leftOpen) { const a2 = proj(c0 + lx, y0 - .5, z0), d2 = proj(c1 + lx, y1 - .5, z1); quad(a, d, d2, a2); g.fill(); }
                    if (rightOpen) { const b2 = proj(c0 + lx + 1, y0 - .5, z0), c2 = proj(c1 + lx + 1, y1 - .5, z1); quad(b, c, c2, b2); g.fill(); }
                }
                if (row.block[l]) drawBlock(c0 + lx, y0, z0, c1 + lx, y1, fade);
                if (row.gem === l) {
                    const p = proj(c0 + lx + .5, y0 + .55 + .12 * Math.sin(t * 4 + i), z0 + .5);
                    const s = p.s * .22;
                    g.save();
                    g.translate(p.x, p.y);
                    g.rotate(t * 2);
                    g.shadowColor = "#fde047"; g.shadowBlur = 20;
                    g.fillStyle = "#fde047";
                    g.beginPath(); g.moveTo(0, -s); g.lineTo(s * .7, 0); g.lineTo(0, s); g.lineTo(-s * .7, 0); g.closePath(); g.fill();
                    g.restore();
                }
            }
        }

        function drawBlock(x0: number, y0: number, z0: number, x1b: number, y1: number, fade: number) {
            const h = .85, inset = .08;
            const fl = proj(x0 + inset, y0, z0 + .1), fr = proj(x0 + 1 - inset, y0, z0 + .1);
            const tl = proj(x0 + inset, y0 + h, z0 + .1), tr = proj(x0 + 1 - inset, y0 + h, z0 + .1);
            const bl = proj(x1b + inset, y1 + h, z0 + .9), br = proj(x1b + 1 - inset, y1 + h, z0 + .9);
            g.globalAlpha = fade;
            // top
            quad(tl, tr, br, bl);
            g.fillStyle = "#fb7185"; g.fill();
            // front
            quad(fl, fr, tr, tl);
            const grd = g.createLinearGradient(0, tl.y, 0, fl.y);
            grd.addColorStop(0, "#f43f5e"); grd.addColorStop(1, "#7f1d1d");
            g.fillStyle = grd; g.fill();
            g.shadowColor = "#f43f5e"; g.shadowBlur = 14;
            g.strokeStyle = "#fecdd3"; g.lineWidth = 1.5; g.stroke();
            g.shadowBlur = 0;
            g.globalAlpha = 1;
        }

        function drawBall() {
            const bx = centerX(z) + off, by = trackY(z) + .38 + ballY;
            const p = proj(bx, by, z);
            const r = p.s * .38;
            // shadow
            if (state !== "fall") {
                const sh = proj(bx, trackY(z), z);
                g.fillStyle = "rgba(0,0,0,.45)";
                g.beginPath(); g.ellipse(sh.x, sh.y, r * 1.1, r * .35, 0, 0, Math.PI * 2); g.fill();
            }
            g.save();
            g.shadowColor = "#6ee7b7"; g.shadowBlur = 26;
            const grd = g.createRadialGradient(p.x - r * .35, p.y - r * .4, r * .1, p.x, p.y, r);
            grd.addColorStop(0, "#ecfdf5"); grd.addColorStop(.35, "#34d399"); grd.addColorStop(1, "#064e3b");
            g.fillStyle = grd;
            g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
            g.shadowBlur = 0;
            // rolling stripes
            g.clip();
            g.strokeStyle = "rgba(255,255,255,.45)";
            g.lineWidth = r * .18;
            for (let s = -2; s <= 2; s++) {
                const yy = p.y + ((roll * r * 2 + s * r * .9) % (r * 4.5)) - r * 2.2;
                g.beginPath(); g.ellipse(p.x, yy, r, r * .28, 0, 0, Math.PI * 2); g.stroke();
            }
            g.restore();
        }

        // sky is drawn once into an image (gradients every frame are slow)
        const skyImg = document.createElement("canvas");
        skyImg.width = W; skyImg.height = H;
        (() => {
            const s2 = skyImg.getContext("2d")!;
            const grd = s2.createLinearGradient(0, 0, 0, H);
            grd.addColorStop(0, "#020617"); grd.addColorStop(.35, "#062a2a"); grd.addColorStop(.6, "#041c1c"); grd.addColorStop(1, "#010409");
            s2.fillStyle = grd;
            s2.fillRect(0, 0, W, H);
            const sun = s2.createRadialGradient(W / 2, HOR + 20, 10, W / 2, HOR + 20, 260);
            sun.addColorStop(0, "rgba(110,231,183,.55)"); sun.addColorStop(1, "rgba(110,231,183,0)");
            s2.fillStyle = sun; s2.fillRect(0, 0, W, H);
            s2.fillStyle = "rgba(255,255,255,.5)";
            for (let i = 0; i < 70; i++) s2.fillRect(Math.random() * W, Math.random() * HOR, 1.5, 1.5);
        })();
        function drawSky() { g.drawImage(skyImg, 0, 0); }

        function end(kind: "fall" | "crash") {
            if (state !== "play") return;
            state = kind;
            endT = 0;
            const score = Math.floor(z) + gems * 25;
            if (kind === "crash") {
                shake.hit(10, .4); sfx.boom();
                const p = proj(centerX(z) + off, trackY(z) + .4, z);
                fx.burst(p.x, p.y, { n: 60, color: ["#6ee7b7", "#fff", "#fb7185"], speed: 420, life: 1, size: 4, gravity: 500 });
            } else sfx.lose();
            api.later(() => api.end(score, kind === "crash" ? "Smashed into a block!" : "You fell off!", `Distance ${Math.floor(z)} · ${gems} gem${gems === 1 ? "" : "s"} (+25 each)`), 1100);
        }

        api.loop(dt => {
            t += dt;
            if (state === "play") {
                speed = Math.min(34, 13 + z / 55);
                z += speed * dt;
                let steer = (k.has("ArrowRight", "d") ? 1 : 0) - (k.has("ArrowLeft", "a") ? 1 : 0);
                if (!steer && mouseX != null) steer = Math.max(-1, Math.min(1, (mouseX - W / 2) / 160));
                vx += steer * 32 * dt;
                vx *= Math.pow(.02, dt);
                off += vx * dt;
                roll += speed * dt * .15;
                const row = rowAt(Math.floor(z)), lane = Math.floor(off + LANES / 2);
                if (lane < 0 || lane >= LANES || !row.tiles[lane]) end("fall");
                else {
                    const bl = Math.floor(off - .3 + LANES / 2), br = Math.floor(off + .3 + LANES / 2);
                    const fz = z - Math.floor(z);
                    if (fz > .05 && fz < .95 && ((bl >= 0 && row.block[bl]) || (br < LANES && row.block[br]))) end("crash");
                    if (row.gem === lane) { row.gem = -1; gems++; sfx.coin(); const p = proj(centerX(z) + off, trackY(z) + .5, z); fx.burst(p.x, p.y, { n: 18, color: "#fde047", speed: 200, life: .6 }); }
                }
                api.setScore(Math.floor(z) + gems * 25);
                api.setStatus(`Speed ${Math.round(speed * 10)} km/h`);
            } else if (state === "fall") {
                endT += dt;
                fallV += 22 * dt;
                ballY -= fallV * dt;
                z += speed * .4 * dt;
            } else if (state === "ready") {
                roll += dt * 2;
            }
            fx.update(dt); shake.update(dt);
            // camera follows the ball (a bit behind and above)
            const bx = centerX(z) + off;
            camX += (bx * .75 + centerX(z) * .25 - camX) * Math.min(1, dt * 6);
            camY += (trackY(z) + 1.75 - camY) * Math.min(1, dt * 5);
            camZ = z - 4.2;

            g.save();
            shake.apply(g);
            drawSky();
            const first = Math.max(0, Math.floor(camZ) + 1);
            const last = Math.floor(z) + VIEW;
            for (let i = last; i >= Math.floor(z) + 1; i--) drawRow(i);
            drawBall();
            for (let i = Math.floor(z); i >= first; i--) drawRow(i);
            fx.draw(g);
            text(g, `${Math.floor(z)} m`, W / 2, 34, 30, "#fff", "center", 900, "#34d399");
            if (gems) text(g, `💎 ${gems}`, W - 20, 30, 20, "#fde047", "right", 800, "#f59e0b");
            if (state === "ready") titleCard(g, W, H, "Orb Roll 3D", ["Steer with ← → (or your mouse)", "Dodge red blocks, don't roll off the edge, grab gems"], t, "#34d399");
            g.restore();
        });
        // the track starts generated
        for (let i = 0; i < VIEW + 5; i++) rowAt(i);
    }
};
