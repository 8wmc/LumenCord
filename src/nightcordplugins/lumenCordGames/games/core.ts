/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* LumenCord Games engine. Plain DOM + canvas, no React, so every game is small and fully stops when closed. */

import { quality, sfx } from "./fx";

export type Category = "Arcade" | "Cards" | "Puzzle" | "Board" | "Word";

export interface GameDef {
    id: string;
    name: string;
    icon: string;           // emoji
    color: string;          // card accent
    category: Category;
    description: string;
    controls: string;
    /** "time" scores are seconds and lower is better */
    scoreKind?: "points" | "time";
    /** canvas games play their own sounds; DOM games get automatic click / win / lose sounds */
    selfSound?: boolean;
    start(api: GameApi): void;
}

export interface Loop { stop(): void; start(): void; }

export interface GameApi {
    root: HTMLElement;
    /** current score shown in the top bar */
    setScore(n: number): void;
    /** small status text in the top bar */
    setStatus(text: string): void;
    /** best score so far (0 if none) */
    best(): number;
    /** finish the round. Saves the best score and shows the "Play again" screen. */
    end(score: number, title?: string, text?: string): void;
    /** key handler; return true to swallow the key */
    onKey(fn: (e: KeyboardEvent, down: boolean) => boolean | void): void;
    /** frame loop; dt in seconds (capped). Stops when the game closes. */
    loop(fn: (dt: number) => void): Loop;
    /** add a cleanup function */
    cleanup(fn: () => void): void;
    /** setTimeout that is cleared on close */
    later(fn: () => void, ms: number): void;
    canvas(w: number, h: number): { cv: HTMLCanvasElement; g: CanvasRenderingContext2D; toLocal(e: MouseEvent | Touch): { x: number; y: number; }; };
    el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string, parent?: HTMLElement): HTMLElementTagNameMap[K];
    restart(): void;
    /** true once the game has been closed */
    readonly closed: boolean;
}

export const C = {
    bg: "#0d0a1f",
    bg2: "#171233",
    panel: "#211a45",
    line: "rgba(192,132,252,.25)",
    text: "#f3eeff",
    muted: "#a59cc8",
    violet: "#a855f7",
    pink: "#e879f9",
    cyan: "#67e8f9",
    gold: "#fde047",
    green: "#4ade80",
    red: "#f87171",
};

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function glowText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = C.text, align: CanvasTextAlign = "center") {
    g.save();
    g.font = `700 ${size}px "gg sans", "Segoe UI", system-ui, sans-serif`;
    g.textAlign = align;
    g.textBaseline = "middle";
    g.shadowColor = C.violet;
    g.shadowBlur = 12;
    g.fillStyle = color;
    g.fillText(text, x, y);
    g.restore();
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
}

/** starry backdrop, cached per size */
const starCache = new Map<string, HTMLCanvasElement>();
export function starfield(g: CanvasRenderingContext2D, w: number, h: number) {
    const key = `${w}x${h}`;
    let c = starCache.get(key);
    if (!c) {
        c = document.createElement("canvas");
        c.width = w; c.height = h;
        const s = c.getContext("2d")!;
        const grd = s.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, "#130d2e");
        grd.addColorStop(1, "#07051a");
        s.fillStyle = grd;
        s.fillRect(0, 0, w, h);
        for (let i = 0; i < (w * h) / 1800; i++) {
            s.globalAlpha = rand(.2, .9);
            s.fillStyle = pick(["#fff", "#e9d5ff", "#a5f3fc"]);
            s.fillRect(rand(0, w), rand(0, h), rand(.6, 1.8), rand(.6, 1.8));
        }
        starCache.set(key, c);
    }
    g.drawImage(c, 0, 0);
}

// ───────────────────────── playing cards (DOM) ─────────────────────────

export type Suit = "♠" | "♥" | "♦" | "♣";
export interface Card { rank: number; suit: Suit; up: boolean; }
export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const isRed = (s: Suit) => s === "♥" || s === "♦";
export function newDeck(): Card[] {
    const d: Card[] = [];
    for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) d.push({ rank, suit, up: true });
    return shuffle(d);
}

// pip positions (x, y as fractions of the card's centre area) for 2-10
const PIPS: Record<number, [number, number][]> = {
    2: [[.5, .12], [.5, .88]],
    3: [[.5, .12], [.5, .5], [.5, .88]],
    4: [[.25, .12], [.75, .12], [.25, .88], [.75, .88]],
    5: [[.25, .12], [.75, .12], [.5, .5], [.25, .88], [.75, .88]],
    6: [[.25, .12], [.75, .12], [.25, .5], [.75, .5], [.25, .88], [.75, .88]],
    7: [[.25, .12], [.75, .12], [.5, .31], [.25, .5], [.75, .5], [.25, .88], [.75, .88]],
    8: [[.25, .12], [.75, .12], [.5, .31], [.25, .5], [.75, .5], [.5, .69], [.25, .88], [.75, .88]],
    9: [[.25, .1], [.75, .1], [.25, .37], [.75, .37], [.5, .5], [.25, .63], [.75, .63], [.25, .9], [.75, .9]],
    10: [[.25, .1], [.75, .1], [.5, .24], [.25, .37], [.75, .37], [.25, .63], [.75, .63], [.5, .76], [.25, .9], [.75, .9]],
};
const FACE_MARK: Record<number, string> = { 11: "⚔", 12: "♛", 13: "♚" };

export function cardEl(card: Card | null, small = false): HTMLDivElement {
    const d = document.createElement("div");
    d.className = "lcg-card" + (small ? " small" : "");
    if (!card) {
        d.classList.add("slot");
        return d;
    }
    if (!card.up) {
        d.classList.add("back");
        d.innerHTML = '<span class="logo">L</span>';
        return d;
    }
    if (isRed(card.suit)) d.classList.add("red");
    const r = RANKS[card.rank];
    let mid: string;
    if (card.rank === 1) mid = `<span class="ace">${card.suit}</span>`;
    else if (card.rank >= 11) {
        d.classList.add("face");
        mid = `<span class="face-panel"><span class="face-mark">${FACE_MARK[card.rank]}</span><span class="face-rank">${r}</span><span class="face-suit">${card.suit}</span></span>`;
    } else mid = PIPS[card.rank].map(([x, y]) => `<i style="left:${x * 100}%;top:${y * 100}%"${y > .55 ? ' class="flip"' : ""}>${card.suit}</i>`).join("");
    d.innerHTML = `<span class="tl">${r}<br>${card.suit}</span><span class="mid">${mid}</span><span class="br">${r}<br>${card.suit}</span>`;
    return d;
}

// ───────────────────────── runner ─────────────────────────

export interface ScoreStore {
    get(id: string): number;
    set(id: string, value: number): void;
}

export function isBetter(def: GameDef, score: number, best: number) {
    if (def.scoreKind === "time") return score > 0 && (best <= 0 || score < best);
    return score > best;
}

export function formatScore(def: GameDef, n: number) {
    if (def.scoreKind === "time") {
        if (n <= 0) return "-";
        const m = Math.floor(n / 60), s = Math.round(n % 60);
        return m ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
    }
    return String(Math.round(n));
}

/**
 * Mounts a game into `host`. Returns a function that fully stops and removes it.
 * The host gets a top bar (score / best / status) and a play area.
 */
export function mountGame(def: GameDef, host: HTMLElement, scores: ScoreStore): () => void {
    let session: { close(): void; } | null = null;

    const frame = document.createElement("div");
    frame.className = "lcg-frame";
    frame.style.setProperty("--game-color", def.color);
    host.appendChild(frame);

    const bar = document.createElement("div");
    bar.className = "lcg-bar";
    bar.innerHTML = '<span class="lcg-score"></span><span class="lcg-status"></span><span class="lcg-best"></span><button class="lcg-mini lcg-restart" title="Restart">↻ Restart</button>';
    frame.appendChild(bar);
    const scoreEl = bar.querySelector<HTMLElement>(".lcg-score")!;
    const statusEl = bar.querySelector<HTMLElement>(".lcg-status")!;
    const bestEl = bar.querySelector<HTMLElement>(".lcg-best")!;
    const label = def.scoreKind === "time" ? "Time" : "Score";
    const showBest = () => bestEl.textContent = `Best: ${formatScore(def, scores.get(def.id))}`;

    const area = document.createElement("div");
    area.className = "lcg-area";
    area.tabIndex = 0;
    frame.appendChild(area);

    function startSession() {
        area.innerHTML = "";
        scoreEl.textContent = `${label}: 0`;
        statusEl.textContent = "";
        showBest();

        const cleanups: Array<() => void> = [];
        const keyFns: Array<(e: KeyboardEvent, down: boolean) => boolean | void> = [];
        let closed = false;
        let ended = false;

        const root = document.createElement("div");
        root.className = `lcg-root cat-${def.category.toLowerCase()}`;
        area.appendChild(root);

        const onKeyDown = (e: KeyboardEvent) => handleKey(e, true);
        const onKeyUp = (e: KeyboardEvent) => handleKey(e, false);
        function handleKey(e: KeyboardEvent, down: boolean) {
            if (closed || !frame.isConnected) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA") && !root.contains(t)) return;
            if (e.key === "Escape") return; // let Discord close the window
            let swallow = false;
            for (const fn of keyFns) if (fn(e, down)) swallow = true;
            if (swallow) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("keyup", onKeyUp, true);
        cleanups.push(() => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("keyup", onKeyUp, true);
        });

        const api: GameApi = {
            root,
            get closed() { return closed; },
            setScore(n) { scoreEl.textContent = `${label}: ${formatScore(def, n)}`; },
            setStatus(text) { statusEl.textContent = text; },
            best: () => scores.get(def.id),
            end(score, title, text) {
                if (ended || closed) return;
                ended = true;
                const prev = scores.get(def.id);
                const record = isBetter(def, score, prev);
                if (!def.selfSound) (/win|got it|solved|cleared|found|🎉|🏆|wpm/i.test(`${title} ${text}`) ? sfx.win : sfx.lose)();
                if (record) scores.set(def.id, score);
                showBest();
                const ov = document.createElement("div");
                ov.className = "lcg-over";
                ov.innerHTML = `<div class="lcg-over-box">
                    <div class="lcg-over-title">${title ?? "Game over"}</div>
                    ${text ? `<div class="lcg-over-text">${text}</div>` : ""}
                    <div class="lcg-over-score">${label}: <b>${formatScore(def, score)}</b>${record && score ? ' <span class="lcg-record">New best!</span>' : ""}</div>
                    <button class="lcg-btn primary">Play again</button></div>`;
                ov.querySelector("button")!.addEventListener("click", () => api.restart());
                area.appendChild(ov);
                (ov.querySelector("button") as HTMLButtonElement).focus();
            },
            onKey(fn) { keyFns.push(fn); },
            loop(fn) {
                // Speed: the loop stops completely while Discord is hidden or another window has focus,
                // and switches to low graphics if frames get slow on this PC.
                let raf = 0, last = 0, running = false, slowFor = 0, ema = 1 / 60;
                const away = () => document.hidden || !document.hasFocus();
                const tick = (t: number) => {
                    raf = 0;
                    if (!running || closed) return;
                    if (away()) { last = 0; return; } // resumes on focus / visibility
                    const raw = last ? (t - last) / 1000 : 1 / 60;
                    const dt = Math.min(raw, 1 / 20);
                    last = t;
                    ema += (raw - ema) * .05;
                    if (!quality.low) {
                        slowFor = ema > 1 / 42 ? slowFor + raw : 0;
                        if (slowFor > 1.5) quality.low = true;
                    }
                    try {
                        fn(dt);
                    } catch (err) {
                        running = false;
                        console.error("[LumenCord Games]", def.id, err);
                        return;
                    }
                    raf = requestAnimationFrame(tick);
                };
                const wake = () => { if (running && !closed && !raf && !away()) { last = 0; raf = requestAnimationFrame(tick); } };
                document.addEventListener("visibilitychange", wake);
                window.addEventListener("focus", wake);
                const l: Loop = {
                    start() { if (running || closed) return; running = true; last = 0; raf = requestAnimationFrame(tick); },
                    stop() { running = false; cancelAnimationFrame(raf); raf = 0; },
                };
                cleanups.push(() => {
                    l.stop();
                    document.removeEventListener("visibilitychange", wake);
                    window.removeEventListener("focus", wake);
                });
                l.start();
                return l;
            },
            cleanup(fn) { cleanups.push(fn); },
            later(fn, ms) {
                const id = setTimeout(() => { if (!closed) fn(); }, ms);
                cleanups.push(() => clearTimeout(id));
            },
            canvas(w, h) {
                const cv = document.createElement("canvas");
                // Speed: never draw more than 1.5x pixels on high-res screens
                const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
                cv.width = Math.round(w * dpr);
                cv.height = Math.round(h * dpr);
                cv.className = "lcg-canvas";
                cv.style.aspectRatio = `${w} / ${h}`;
                const g = cv.getContext("2d", { alpha: false })!;
                g.scale(dpr, dpr);
                // Speed: canvas glow (shadowBlur) is the most expensive effect, so cap it and turn it off in low graphics
                const sb = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "shadowBlur")!;
                Object.defineProperty(g, "shadowBlur", {
                    get() { return sb.get!.call(this); },
                    set(v: number) { sb.set!.call(this, quality.low ? 0 : Math.min(v, 16)); },
                });
                root.appendChild(cv);
                return {
                    cv, g,
                    toLocal(e) {
                        const r = cv.getBoundingClientRect();
                        return { x: (e.clientX - r.left) * (w / r.width), y: (e.clientY - r.top) * (h / r.height) };
                    }
                };
            },
            el(tag, cls, text, parent) {
                const e = document.createElement(tag);
                if (cls) e.className = cls;
                if (text != null) e.textContent = text;
                (parent ?? root).appendChild(e);
                return e;
            },
            restart() {
                session?.close();
                startSession();
            },
        };

        session = {
            close() {
                if (closed) return;
                closed = true;
                for (const fn of cleanups.splice(0)) {
                    try { fn(); } catch { }
                }
                area.innerHTML = "";
            }
        };

        try {
            def.start(api);
        } catch (err) {
            console.error("[LumenCord Games]", def.id, err);
            root.innerHTML = '<div class="lcg-error">This game hit an error. Press Restart to try again.</div>';
        }
        area.focus({ preventScroll: true });
    }

    // click sounds for DOM games (canvas games make their own)
    if (!def.selfSound) {
        area.addEventListener("pointerdown", e => {
            const t = e.target as HTMLElement;
            if (t.closest(".lcg-card, .lcg-mem")) sfx.card();
            else if (t.closest("button, .lcg-sq, .lcg-c4-hole, .lcg-ttt-cell")) sfx.select();
        });
    }

    bar.querySelector(".lcg-restart")!.addEventListener("click", () => {
        session?.close();
        startSession();
    });

    startSession();

    return () => {
        session?.close();
        frame.remove();
    };
}
