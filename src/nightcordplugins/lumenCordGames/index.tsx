/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { disableStyle, enableStyle } from "@api/Styles";
import { ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { React } from "@webpack/common";

import type { ScoreStore } from "./games/core";
import { GAMES, mountHub } from "./hub";
import gamesStyle from "./styles.css?managed";

const SCORES_KEY = "LumenCordGames_scores";
const ROW_ATTR = "data-lumencord-games";

// ───────────────────────── high scores (saved on this device) ─────────────────────────

let scoreCache: Record<string, number> | null = null;

const scores: ScoreStore = {
    get: id => scoreCache?.[id] ?? 0,
    set(id, value) {
        scoreCache = { ...scoreCache, [id]: value };
        void DataStore.set(SCORES_KEY, scoreCache);
    },
};

// ───────────────────────── the games window ─────────────────────────

function GamesWindow({ onClose }: { onClose(): void; }) {
    const ref = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (!ref.current) return;
        return mountHub(ref.current, scores, onClose);
    }, []);
    return <div ref={ref} className="lcg-host" />;
}

let openCount = 0;

export async function openGames() {
    if (!scoreCache) scoreCache = (await DataStore.get(SCORES_KEY)) ?? {};
    // styles only exist while the window is open
    if (openCount++ === 0) enableStyle(gamesStyle);
    openModal(
        props => (
            <ModalRoot {...props} size={ModalSize.DYNAMIC} className="lcg-modal">
                <GamesWindow onClose={props.onClose} />
            </ModalRoot>
        ),
        {
            onCloseCallback() {
                if (--openCount <= 0) {
                    openCount = 0;
                    disableStyle(gamesStyle);
                }
            }
        }
    );
}

// ───────────────────────── "LumenCord Games" row in the DM list ─────────────────────────

const GAMEPAD = '<path fill="currentColor" d="M6.5 6h11A4.5 4.5 0 0 1 22 10.5v4.2a3.3 3.3 0 0 1-5.8 2.1L14.8 15H9.2l-1.4 1.8A3.3 3.3 0 0 1 2 14.7v-4.2A4.5 4.5 0 0 1 6.5 6Zm1 3.2a.8.8 0 0 0-.8.8v1H5.7a.8.8 0 0 0 0 1.6h1v1a.8.8 0 0 0 1.6 0v-1h1a.8.8 0 0 0 0-1.6h-1v-1a.8.8 0 0 0-.8-.8Zm8.8.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm2 2.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>';

let observer: MutationObserver | null = null;

/** Finds the row to sit under: LumenCord AI if it's there, otherwise the row above Quests. */
function findAnchorRow(): { row: HTMLElement; after: boolean; } | null {
    const ai = document.querySelector<HTMLElement>('[data-nightcord-ai="true"]');
    const aiRow = ai?.closest<HTMLElement>('li, [role="listitem"]');
    if (aiRow) return { row: aiRow, after: true };
    const quests = document.querySelector<HTMLElement>('a[href="/quest-home"], [data-list-item-id*="quest"]');
    const questRow = quests?.closest<HTMLElement>('li, [role="listitem"]');
    if (questRow) return { row: questRow, after: false };
    return null;
}

function buildRow(template: HTMLElement): HTMLElement {
    const row = template.cloneNode(true) as HTMLElement;
    row.setAttribute(ROW_ATTR, "true");
    row.querySelectorAll("[data-nightcord-ai]").forEach(e => e.removeAttribute("data-nightcord-ai"));
    row.querySelectorAll<HTMLElement>('[class*="selected"]').forEach(e => {
        e.className = e.className.split(" ").filter(c => !c.includes("selected")).join(" ");
    });

    const link = row.querySelector<HTMLAnchorElement>("a") ?? row;
    if (link instanceof HTMLAnchorElement) link.setAttribute("href", "#");
    link.setAttribute("data-list-item-id", "private-channels___lumencord-games");
    link.removeAttribute("aria-current");

    const name = row.querySelector<HTMLElement>('div[class*="name__"]:not([class*="nameAndDecorators"])')
        ?? Array.from(row.querySelectorAll<HTMLElement>("div")).find(d => !d.children.length && d.textContent?.trim());
    if (name) name.textContent = "LumenCord Games";

    const svg = row.querySelector("svg");
    if (svg) {
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.innerHTML = GAMEPAD;
    }

    const badge = row.querySelector<HTMLElement>('[class*="label_"]') ?? row.querySelector<HTMLElement>('[class*="badge"] span');
    if (badge) badge.textContent = "PLAY";
    row.querySelectorAll<HTMLElement>('[class*="marketingButtonBackground"]').forEach(e => e.style.display = "none");

    row.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        void openGames();
    }, true);
    return row;
}

function placeRow() {
    const anchor = findAnchorRow();
    const existing = document.querySelector<HTMLElement>(`[${ROW_ATTR}]`);
    if (!anchor) return;
    const wanted = anchor.after ? anchor.row.nextElementSibling : anchor.row.previousElementSibling;
    if (existing && existing === wanted) return;
    existing?.remove();
    const row = buildRow(anchor.row);
    anchor.row.parentElement?.insertBefore(row, anchor.after ? anchor.row.nextSibling : anchor.row);
}

export default definePlugin({
    name: "LumenCordGames",
    description: `LumenCord Games: ${GAMES.length} free games right inside Discord, from the "LumenCord Games" button in your DM list. Nothing runs until you open a game.`,
    authors: [{ name: "8wmc", id: 470592025394413597n }],
    enabledByDefault: true,

    toolboxActions: {
        "LumenCord Games"() {
            void openGames();
        },
    },

    start() {
        // Reacts right away, then at most twice a second while the page is busy (e.g. chatting)
        let lastRun = 0;
        let pending: ReturnType<typeof setTimeout> | null = null;
        observer = new MutationObserver(() => {
            if (pending) return;
            pending = setTimeout(() => {
                pending = null;
                lastRun = Date.now();
                if (observer) placeRow();
            }, Math.max(0, 400 - (Date.now() - lastRun)));
        });
        observer.observe(document.body, { childList: true, subtree: true });
        placeRow();
    },

    stop() {
        observer?.disconnect();
        observer = null;
        document.querySelectorAll(`[${ROW_ATTR}]`).forEach(e => e.remove());
        disableStyle(gamesStyle);
        openCount = 0;
    },
});
