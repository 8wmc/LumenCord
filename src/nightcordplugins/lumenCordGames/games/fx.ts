/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* Shared effects for LumenCord Games: sound, particles, shake, glow drawing, backgrounds, start screens. */

import { GameApi, pick, rand } from "./core";

// ───────────────────────── speed settings ─────────────────────────

/** Turns on by itself when a game runs slowly on this PC; games draw fewer effects. */
export const quality = { low: false };

// ───────────────────────── sound (tiny synth, no files) ─────────────────────────

let audio: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem("lcg-muted") === "1"; } catch { }

export const isMuted = () => muted;
export function setMuted(m: boolean) {
    muted = m;
    try { localStorage.setItem("lcg-muted", m ? "1" : "0"); } catch { }
}

function ctx() {
    if (muted) return null;
    try {
        audio ??= new AudioContext();
        if (audio.state === "suspended") void audio.resume();
        return audio;
    } catch {
        return null;
    }
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = .12, slideTo?: number, delay = 0) {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const gn = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + .01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(a.destination);
    o.start(t);
    o.stop(t + dur + .02);
}

function noise(dur: number, vol = .15, filterFreq = 1200) {
    const a = ctx();
    if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    const gn = a.createGain();
    gn.gain.value = vol;
    src.connect(f).connect(gn).connect(a.destination);
    src.start();
}

export const sfx = {
    jump: () => tone(420, .12, "square", .06, 760),
    flap: () => tone(520, .09, "triangle", .08, 880),
    coin: () => { tone(988, .07, "square", .05); tone(1319, .12, "square", .05, undefined, .06); },
    point: () => tone(880, .08, "sine", .08, 1320),
    hit: () => { tone(180, .18, "sawtooth", .08, 60); noise(.15, .1, 900); },
    boom: () => { noise(.45, .22, 700); tone(120, .35, "sine", .12, 40); },
    shoot: () => tone(880, .07, "square", .035, 300),
    bounce: () => tone(330, .05, "square", .05, 440),
    select: () => tone(660, .05, "sine", .06),
    place: () => tone(300, .06, "triangle", .08, 220),
    clear: () => { tone(523, .1, "square", .05); tone(659, .1, "square", .05, undefined, .08); tone(784, .16, "square", .05, undefined, .16); },
    power: () => { for (let i = 0; i < 5; i++) tone(400 + i * 140, .07, "square", .04, undefined, i * .05); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .18, "triangle", .08, undefined, i * .11)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, .2, "triangle", .08, undefined, i * .13)),
    card: () => noise(.05, .06, 3000),
    tick: () => tone(1200, .02, "square", .025),
};

// ───────────────────────── particles ─────────────────────────

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; g: number; drag: number; shrink: boolean; }

export class Particles {
    list: P[] = [];
    burst(x: number, y: number, o: { n?: number; color?: string | string[]; speed?: number; life?: number; size?: number; gravity?: number; drag?: number; angle?: number; spread?: number; } = {}) {
        const n = quality.low ? Math.ceil((o.n ?? 16) / 3) : o.n ?? 16;
        for (let i = 0; i < n; i++) {
            const a = o.angle != null ? o.angle + rand(-(o.spread ?? Math.PI), o.spread ?? Math.PI) : rand(0, Math.PI * 2);
            const s = rand(.3, 1) * (o.speed ?? 220);
            const life = rand(.6, 1) * (o.life ?? .7);
            this.list.push({
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life,
                size: rand(.6, 1.2) * (o.size ?? 3),
                color: Array.isArray(o.color) ? pick(o.color) : o.color ?? "#e9d5ff",
                g: o.gravity ?? 0, drag: o.drag ?? 1.5, shrink: true,
            });
        }
        const cap = quality.low ? 150 : 450;
        if (this.list.length > cap) this.list.splice(0, this.list.length - cap);
    }
    update(dt: number) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const p = this.list[i];
            p.life -= dt;
            if (p.life <= 0) { this.list.splice(i, 1); continue; }
            p.vx -= p.vx * p.drag * dt;
            p.vy -= p.vy * p.drag * dt;
            p.vy += p.g * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }
    draw(g: CanvasRenderingContext2D) {
        g.save();
        g.globalCompositeOperation = "lighter";
        for (const p of this.list) {
            const k = p.life / p.max;
            g.globalAlpha = Math.min(1, k * 1.4);
            g.fillStyle = p.color;
            const s = p.shrink ? p.size * (.3 + .7 * k) : p.size;
            g.beginPath();
            g.arc(p.x, p.y, s, 0, Math.PI * 2);
            g.fill();
        }
        g.restore();
    }
}

// ───────────────────────── floating score text ─────────────────────────

export class Floaters {
    list: { x: number; y: number; text: string; color: string; life: number; size: number; }[] = [];
    add(x: number, y: number, text: string, color = "#fde047", size = 18) { this.list.push({ x, y, text, color, life: 1, size }); }
    update(dt: number) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const f = this.list[i];
            f.life -= dt * 1.2;
            f.y -= 40 * dt;
            if (f.life <= 0) this.list.splice(i, 1);
        }
    }
    draw(g: CanvasRenderingContext2D) {
        for (const f of this.list) {
            g.save();
            g.globalAlpha = Math.min(1, f.life * 1.5);
            g.font = `800 ${f.size}px "gg sans","Segoe UI",system-ui,sans-serif`;
            g.textAlign = "center";
            g.shadowColor = f.color;
            g.shadowBlur = 10;
            g.fillStyle = f.color;
            g.fillText(f.text, f.x, f.y);
            g.restore();
        }
    }
}

// ───────────────────────── screen shake ─────────────────────────

export class Shake {
    t = 0; power = 0;
    hit(power: number, time = .3) { this.power = Math.max(this.power, power); this.t = Math.max(this.t, time); }
    update(dt: number) { this.t = Math.max(0, this.t - dt); if (!this.t) this.power = 0; }
    apply(g: CanvasRenderingContext2D) { if (this.t > 0 && !quality.low) g.translate(rand(-1, 1) * this.power, rand(-1, 1) * this.power); }
}

// ───────────────────────── drawing helpers ─────────────────────────

// Speed: glow and ball images are drawn once per colour and reused (gradients every frame are slow)
const glowCache = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string) {
    let c = glowCache.get(color);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const s = c.getContext("2d")!;
    const grd = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, color);
    grd.addColorStop(.35, color + "88");
    grd.addColorStop(1, color + "00");
    s.fillStyle = grd;
    s.fillRect(0, 0, 64, 64);
    glowCache.set(color, c);
    return c;
}
const ballCache = new Map<string, HTMLCanvasElement>();
function ballSprite(color: string, core: string) {
    const key = color + core;
    let c = ballCache.get(key);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const s = c.getContext("2d")!;
    const b = s.createRadialGradient(32 - 11, 32 - 11, 3, 32, 32, 31);
    b.addColorStop(0, core);
    b.addColorStop(.35, color);
    b.addColorStop(1, shade(color, -.45));
    s.fillStyle = b;
    s.beginPath();
    s.arc(32, 32, 31, 0, Math.PI * 2);
    s.fill();
    ballCache.set(key, c);
    return c;
}

export function glowCircle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, glow = r * 2.2, core = "#fff") {
    if (!quality.low && glow > r) {
        const prev = g.globalCompositeOperation;
        g.globalCompositeOperation = "lighter";
        g.drawImage(glowSprite(color), x - glow, y - glow, glow * 2, glow * 2);
        g.globalCompositeOperation = prev;
    }
    g.drawImage(ballSprite(color, core), x - r, y - r, r * 2, r * 2);
}

/** lighten (amt > 0) or darken (amt < 0) a #rrggbb colour */
export function shade(hex: string, amt: number) {
    const n = parseInt(hex.slice(1, 7), 16);
    let r = n >> 16 & 255, gg = n >> 8 & 255, b = n & 255;
    const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
    r = f(r); gg = f(gg); b = f(b);
    return "#" + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
}

export function hsl(h: number, s = 90, l = 62) { return `hsl(${h} ${s}% ${l}%)`; }

/** neon line: thick soft glow + bright core */
export function neonStroke(g: CanvasRenderingContext2D, color: string, width = 3, path?: () => void) {
    g.save();
    if (path) path();
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = color;
    g.globalAlpha = .25;
    g.lineWidth = width * 4;
    g.stroke();
    g.globalAlpha = 1;
    g.lineWidth = width;
    g.stroke();
    g.strokeStyle = "#ffffffcc";
    g.lineWidth = Math.max(1, width * .35);
    g.stroke();
    g.restore();
}

export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = "#f3eeff", align: CanvasTextAlign = "center", weight = 800, glow = "#a855f7") {
    g.save();
    g.font = `${weight} ${size}px "gg sans","Segoe UI",system-ui,sans-serif`;
    g.textAlign = align;
    g.textBaseline = "middle";
    if (!quality.low && glow !== "#000" && glow !== "transparent") {
        g.shadowColor = glow;
        g.shadowBlur = size * .6;
    }
    g.fillStyle = color;
    g.fillText(s, x, y);
    g.restore();
}

/** Nebula background (cached per size + hue) with drifting star layers drawn on top by parallax(). */
const bgCache = new Map<string, HTMLCanvasElement>();
export function nebula(g: CanvasRenderingContext2D, w: number, h: number, hue = 270) {
    const key = `${w}x${h}@${hue}`;
    let c = bgCache.get(key);
    if (!c) {
        c = document.createElement("canvas");
        c.width = w; c.height = h;
        const s = c.getContext("2d")!;
        const base = s.createLinearGradient(0, 0, 0, h);
        base.addColorStop(0, `hsl(${hue} 60% 9%)`);
        base.addColorStop(1, `hsl(${hue + 20} 70% 4%)`);
        s.fillStyle = base;
        s.fillRect(0, 0, w, h);
        for (let i = 0; i < 7; i++) {
            const x = rand(0, w), y = rand(0, h), r = rand(w * .15, w * .45);
            const grd = s.createRadialGradient(x, y, 0, x, y, r);
            const hh = hue + rand(-40, 50);
            grd.addColorStop(0, `hsla(${hh} 90% 55% / ${rand(.12, .25)})`);
            grd.addColorStop(1, `hsla(${hh} 90% 55% / 0)`);
            s.fillStyle = grd;
            s.fillRect(0, 0, w, h);
        }
        for (let i = 0; i < (w * h) / 900; i++) {
            s.globalAlpha = rand(.15, .8);
            s.fillStyle = pick(["#fff", "#e9d5ff", "#a5f3fc", "#fbcfe8"]);
            const r = rand(.3, 1.3);
            s.beginPath();
            s.arc(rand(0, w), rand(0, h), r, 0, Math.PI * 2);
            s.fill();
        }
        s.globalAlpha = 1;
        const v = s.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .75);
        v.addColorStop(0, "rgba(0,0,0,0)");
        v.addColorStop(1, "rgba(0,0,0,.55)");
        s.fillStyle = v;
        s.fillRect(0, 0, w, h);
        bgCache.set(key, c);
    }
    g.drawImage(c, 0, 0, w, h);
}

/** scrolling star layers, offset in px */
export class StarLayers {
    layers: { x: number; y: number; r: number; a: number; }[][] = [];
    constructor(public w: number, public h: number, counts = [70, 40, 18]) {
        this.layers = counts.map((n, i) => Array.from({ length: n }, () => ({ x: rand(0, w), y: rand(0, h), r: (i + 1) * .55 + rand(0, .5), a: rand(.35, 1) })));
    }
    draw(g: CanvasRenderingContext2D, offX: number, offY = 0) {
        this.layers.forEach((L, i) => {
            const k = (i + 1) * .25;
            for (const s of L) {
                const x = ((s.x - offX * k) % this.w + this.w) % this.w;
                const y = ((s.y - offY * k) % this.h + this.h) % this.h;
                g.globalAlpha = s.a;
                g.fillStyle = "#fff";
                g.fillRect(x - s.r * .7, y - s.r * .7, s.r * 1.4, s.r * 1.4);
            }
        });
        g.globalAlpha = 1;
    }
}

// ───────────────────────── input helper ─────────────────────────

export function keys(api: GameApi) {
    const down = new Set<string>();
    api.onKey((e, isDown) => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (isDown) down.add(k); else down.delete(k);
        return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "w", "a", "s", "d", "Shift", "x", "z", "c"].includes(k);
    });
    const blur = () => down.clear();
    window.addEventListener("blur", blur);
    api.cleanup(() => window.removeEventListener("blur", blur));
    return {
        has: (...ks: string[]) => ks.some(k => down.has(k)),
        down,
    };
}

/** "Press to start" title card drawn on a canvas */
export function titleCard(g: CanvasRenderingContext2D, w: number, h: number, title: string, lines: string[], t: number, color = "#e879f9") {
    g.save();
    g.fillStyle = "rgba(7,5,26,.55)";
    g.fillRect(0, 0, w, h);
    text(g, title, w / 2, h / 2 - 40, 44, "#fff", "center", 900, color);
    lines.forEach((l, i) => text(g, l, w / 2, h / 2 + 14 + i * 26, 16, "#d8ccff", "center", 600, "#000"));
    g.globalAlpha = .55 + .45 * Math.sin(t * 4);
    text(g, "Click or press Space to start", w / 2, h / 2 + 30 + lines.length * 26, 18, "#fde68a", "center", 800, "#f59e0b");
    g.restore();
}

/** Mute button that sits in the game's top-left corner */
export function muteButton(api: GameApi) {
    const b = api.el("button", "lcg-mute", isMuted() ? "🔇" : "🔊");
    b.title = "Sound on/off";
    b.onclick = e => {
        e.stopPropagation();
        setMuted(!isMuted());
        b.textContent = isMuted() ? "🔇" : "🔊";
    };
}
