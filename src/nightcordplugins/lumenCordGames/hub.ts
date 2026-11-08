/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/* The games window: a grid of game cards, and a play view. Plain DOM so nothing runs until it's opened. */

import { ARCADE } from "./games/arcade";
import { BOARD } from "./games/board";
import { CARDS } from "./games/cards";
import { Category, formatScore, GameDef, mountGame, ScoreStore } from "./games/core";
import { PUZZLE } from "./games/puzzle";

export const GAMES: GameDef[] = [...ARCADE, ...CARDS, ...PUZZLE, ...BOARD];
const CATEGORIES: Array<"All" | Category> = ["All", "Arcade", "Cards", "Puzzle", "Board", "Word"];

export function mountHub(host: HTMLElement, scores: ScoreStore, onClose: () => void): () => void {
    let stopGame: (() => void) | null = null;
    let tab: "All" | Category = "All";
    let query = "";

    const shell = document.createElement("div");
    shell.className = "lcg-shell";
    host.appendChild(shell);

    function header(title: string, sub: string, back: boolean) {
        const h = document.createElement("div");
        h.className = "lcg-head";
        h.innerHTML = `
            ${back ? '<button class="lcg-mini lcg-back">← All games</button>' : '<div class="lcg-logo">🎮</div>'}
            <div class="lcg-head-text"><div class="lcg-title"></div><div class="lcg-sub"></div></div>
            <button class="lcg-close" title="Close">✕</button>`;
        h.querySelector(".lcg-title")!.textContent = title;
        h.querySelector(".lcg-sub")!.textContent = sub;
        h.querySelector(".lcg-close")!.addEventListener("click", onClose);
        h.querySelector(".lcg-back")?.addEventListener("click", showList);
        return h;
    }

    function showList() {
        stopGame?.();
        stopGame = null;
        shell.innerHTML = "";
        shell.appendChild(header("LumenCord Games", `${GAMES.length} games · your best scores are saved on this device`, false));

        const tools = document.createElement("div");
        tools.className = "lcg-tools";
        const tabs = document.createElement("div");
        tabs.className = "lcg-tabs";
        for (const c of CATEGORIES) {
            const count = c === "All" ? GAMES.length : GAMES.filter(g => g.category === c).length;
            if (!count) continue;
            const b = document.createElement("button");
            b.className = "lcg-tab" + (c === tab ? " on" : "");
            b.textContent = `${c} ${count}`;
            b.onclick = () => { tab = c; showList(); };
            tabs.appendChild(b);
        }
        const search = document.createElement("input");
        search.className = "lcg-search";
        search.placeholder = "Search games…";
        search.value = query;
        tools.append(tabs, search);
        shell.appendChild(tools);

        const grid = document.createElement("div");
        grid.className = "lcg-grid";
        shell.appendChild(grid);

        const fill = () => {
            grid.innerHTML = "";
            const q = query.trim().toLowerCase();
            const list = GAMES.filter(g => (tab === "All" || g.category === tab) && (!q || g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)));
            if (!list.length) {
                grid.innerHTML = '<div class="lcg-empty">No games match that search.</div>';
                return;
            }
            for (const g of list) {
                const best = scores.get(g.id);
                const card = document.createElement("button");
                card.className = "lcg-gcard";
                card.style.setProperty("--game-color", g.color);
                card.innerHTML = `<div class="lcg-gicon"></div><div class="lcg-gname"></div><div class="lcg-gdesc"></div><div class="lcg-gfoot"><span class="lcg-gcat"></span><span class="lcg-gbest"></span></div>`;
                card.querySelector(".lcg-gicon")!.textContent = g.icon;
                card.querySelector(".lcg-gname")!.textContent = g.name;
                card.querySelector(".lcg-gdesc")!.textContent = g.description;
                card.querySelector(".lcg-gcat")!.textContent = g.category;
                card.querySelector(".lcg-gbest")!.textContent = best ? `🏆 ${formatScore(g, best)}` : "New";
                card.onclick = () => play(g);
                grid.appendChild(card);
            }
        };
        search.addEventListener("input", () => { query = search.value; fill(); });
        fill();
    }

    function play(g: GameDef) {
        shell.innerHTML = "";
        shell.appendChild(header(`${g.icon} ${g.name}`, g.controls, true));
        const stage = document.createElement("div");
        stage.className = "lcg-stage";
        shell.appendChild(stage);
        stopGame = mountGame(g, stage, scores);
    }

    showList();

    return () => {
        stopGame?.();
        stopGame = null;
        shell.remove();
    };
}
