/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
import * as DataStore from "@api/DataStore";
import { disableStyle, enableStyle } from "@api/Styles";
import definePlugin from "@utils/types";
import { PresenceStore, React, UserStore } from "@webpack/common";

import { getAuth, getEntry, getManualBadges, isAuthFor, loadAuth, loadManualBadges, ping, prefetch, reportGame } from "./api";
import { formatAge, formatDuration, GAME_STAGES, iconFor, MANUAL_BADGES, MEMBER_STAGES, MINUTE, stageFor } from "./defs";
import { openFirstLaunchPopup } from "./FirstLaunch";
import glowStyle from "./glow.css?managed";
import { isSharing, settings } from "./settings";

export const BADGES_SETTINGS_KEY = "lumencord_badges";
// v2: everyone who isn't verified sees the new first-launch popup once
const PROMPTED_KEY = "LumenCordBadges_prompted_v2";

const BADGE_STYLE = { borderRadius: "50%", filter: "drop-shadow(0 0 1.5px rgb(192 132 252 / 70%))" };

// Staff and special badges glow and pulse (keyframes live in glow.css)
const GLOWS: Record<string, string> = {
    owner: "lc-glow-owner 2.4s ease-in-out infinite",
    admin: "lc-glow-admin 2.6s ease-in-out infinite",
    helper: "lc-glow-helper 2.8s ease-in-out infinite",
    lemon: "lc-glow-lemon 2.2s ease-in-out infinite",
    developer: "lc-glow-cool 3s ease-in-out infinite",
    donator: "lc-glow-cool 2.6s ease-in-out infinite",
};

function manualStyle(id: string): React.CSSProperties {
    const animation = GLOWS[id];
    return animation ? { borderRadius: id === "admin" ? 0 : "50%", animation } : BADGE_STYLE;
}
const LAST_SESSION_STYLE = { borderRadius: "50%", opacity: 0.75, filter: "saturate(0.55)" };

function badgesFor({ userId }: BadgeUserArgs): ProfileBadge[] {
    const out: ProfileBadge[] = [];
    if (!userId) return out;

    // Hand-out badges (badges.json), staff first
    const manual = getManualBadges(userId);
    const ordered = MANUAL_BADGES.filter(def => manual.includes(def.id));
    for (const def of ordered) {
        out.push({
            key: `lumencord-${def.id}`,
            description: def.description,
            iconSrc: iconFor(def.id),
            position: BadgePosition.START,
            props: { style: manualStyle(def.id) },
        });
    }

    // Member stage + game stage (badge server)
    const entry = getEntry(userId);
    if (entry?.firstSeen) {
        const age = Math.max(0, Date.now() - entry.firstSeen);
        const stage = stageFor(MEMBER_STAGES, age);
        if (stage) {
            out.push({
                key: `lumencord-member-${stage.index + 1}`,
                description: `${stage.name} · LumenCord member for ${formatAge(age)} (stage ${stage.index + 1}/${MEMBER_STAGES.length})`,
                iconSrc: stage.icon,
                position: BadgePosition.START,
                props: { style: BADGE_STYLE },
            });
        }
    }

    if (entry?.playing) {
        const stage = stageFor(GAME_STAGES, entry.playing.ms);
        if (stage) {
            out.push({
                key: `lumencord-game-${stage.index + 1}`,
                description: `${stage.name} · playing ${entry.playing.name} for ${formatDuration(entry.playing.ms)}`,
                iconSrc: stage.icon,
                position: BadgePosition.START,
                props: { style: BADGE_STYLE },
            });
        }
    } else if (entry?.last) {
        const stage = stageFor(GAME_STAGES, entry.last.ms);
        if (stage) {
            out.push({
                key: `lumencord-lastgame-${stage.index + 1}`,
                description: `Last session: ${stage.name} · ${formatDuration(entry.last.ms)} of ${entry.last.name}`,
                iconSrc: stage.icon,
                position: BadgePosition.START,
                props: { style: LAST_SESSION_STYLE },
            });
        }
    }

    return out;
}

// ───────────────────────── reporting your own status ─────────────────────────

let lastGame: string | null = null;
let lastGameSentAt = 0;
let gameTimer: ReturnType<typeof setInterval> | null = null;
let manualTimer: ReturnType<typeof setInterval> | null = null;
let pingedFor: string | null = null;

const HEARTBEAT = 4.5 * MINUTE;

function me() {
    try {
        return UserStore.getCurrentUser();
    } catch {
        return undefined;
    }
}

function canReport() {
    const user = me();
    return isSharing() && !!user && isAuthFor(user.id);
}

function currentGame(): string | null {
    const user = me();
    if (!user) return null;
    try {
        const activities: any[] = (PresenceStore as any)?.getActivities?.(user.id) ?? [];
        const game = activities.find(a => a?.type === 0 && typeof a.name === "string" && a.name.trim());
        return game ? String(game.name).trim().slice(0, 80) : null;
    } catch {
        return null;
    }
}

async function checkGame() {
    if (!canReport()) return;
    const user = me()!;
    const game = currentGame();
    const now = Date.now();

    if (game !== lastGame) {
        const ok = await reportGame(user.id, game);
        if (ok) {
            lastGame = game;
            lastGameSentAt = now;
        }
    } else if (game && now - lastGameSentAt > HEARTBEAT) {
        // still playing: keep the live badge alive
        if (await reportGame(user.id, game)) lastGameSentAt = now;
    }
}

async function onConnected() {
    const user = me();
    if (!user) return;

    if (canReport() && pingedFor !== user.id) {
        pingedFor = user.id;
        await ping(user.id, user.username, (user as any).globalName || user.username);
    }

    // First launch: ask once whether they want badges (they can say no)
    if (!getAuth()) {
        try {
            if (await DataStore.get(PROMPTED_KEY)) return;
            await DataStore.set(PROMPTED_KEY, true);
            openFirstLaunchPopup(() => resync());
        } catch { }
    }
}

/** Re-sync after the settings page changes something (verify / opt back in) */
export function resync() {
    pingedFor = null;
    lastGame = null;
    void onConnected().then(checkGame);
}

export default definePlugin({
    name: "LumenCordBadges",
    description: "LumenCord badges: staff and hand-out badges, member stages that level up over time, and live game-session badges. Only LumenCord users can see them.",
    authors: [{ name: "8wmc", id: 470592025394413597n }],
    enabledByDefault: true,
    required: true,
    dependencies: ["BadgeAPI"],
    settings,

    userProfileBadges: [{
        position: BadgePosition.START,
        getBadges: badgesFor,
    }],

    flux: {
        USER_PROFILE_FETCH_START({ userId }: { userId?: string; }) {
            if (userId) prefetch(userId);
        },
        RUNNING_GAMES_CHANGE() {
            setTimeout(() => void checkGame(), 3000);
        },
        CONNECTION_OPEN() {
            void onConnected();
        },
    },

    async start() {
        enableStyle(glowStyle);
        await loadAuth();
        void loadManualBadges();
        manualTimer = setInterval(() => void loadManualBadges(), 30 * MINUTE);
        gameTimer = setInterval(() => void checkGame(), MINUTE);
        setTimeout(() => void onConnected().then(checkGame), 5000);
    },

    stop() {
        disableStyle(glowStyle);
        if (gameTimer) clearInterval(gameTimer);
        if (manualTimer) clearInterval(manualTimer);
        gameTimer = manualTimer = null;
        const user = me();
        if (lastGame && user && canReport()) void reportGame(user.id, null);
        lastGame = null;
        pingedFor = null;
    },
});

