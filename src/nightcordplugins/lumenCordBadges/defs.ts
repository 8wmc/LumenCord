/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ART, GAME_MINUTES, GAME_NAMES, MEMBER_DAYS, MEMBER_NAMES } from "./art";

/** LumenCord's badge server (Cloudflare Worker) */
export const SERVER = "https://lumencord-badges.8wmc.workers.dev";
/** Discord application used for "Verify with Discord" */
export const CLIENT_ID = "1568720402858115165";
export const REDIRECT_URI = `${SERVER}/callback`;
/** Hand-out badges live in this public file; only the repo owner can edit it */
export const BADGES_FILE = "https://raw.githubusercontent.com/8wmc/LumenCord/main/badges.json";

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export interface ManualBadgeDef {
    /** id used in badges.json, e.g. "hot_dog_lover" */
    id: string;
    name: string;
    description: string;
    /** staff badges are shown first */
    staff: boolean;
}

export const MANUAL_BADGES: ManualBadgeDef[] = [
    { id: "owner", name: "Owner", description: "LumenCord Owner", staff: true },
    { id: "developer", name: "Developer", description: "LumenCord Developer", staff: true },
    { id: "admin", name: "Admin", description: "LumenCord Admin", staff: true },
    { id: "helper", name: "Helper", description: "LumenCord Helper", staff: true },
    { id: "donator", name: "Donator", description: "LumenCord Donator, thank you for the support!", staff: true },
    { id: "friend", name: "Friend", description: "Friend of LumenCord", staff: false },
    { id: "met_the_owner", name: "Met the Owner", description: "Met the LumenCord Owner", staff: false },
    { id: "met_staff", name: "Met Staff", description: "Met the LumenCord Staff", staff: false },
    { id: "trusted_member", name: "Trusted Member", description: "Trusted LumenCord Member", staff: false },
    { id: "hot_dog_lover", name: "Hot Dog Lover", description: "Hot Dog Lover", staff: false },
    { id: "big_back", name: "Big Back", description: "Big Back", staff: false },
    { id: "that_one_kid", name: "That One Kid", description: "That One Kid", staff: false },
    { id: "meat_rider", name: "Meat Rider", description: "Meat Rider", staff: false },
    { id: "glazer", name: "Glazer", description: "Glazer", staff: false },
    { id: "lemon", name: "Lemon", description: "Lemon", staff: false },
];

export const MANUAL_BY_ID = new Map(MANUAL_BADGES.map(b => [b.id, b]));

/** "Hot Dog Lover", "hot-dog-lover" and "hot_dog_lover" all mean the same badge */
export function normaliseBadgeId(raw: unknown): string {
    return String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function iconFor(id: string): string {
    return ART[id] ?? "";
}

export interface Stage {
    /** 0-based position */
    index: number;
    name: string;
    icon: string;
    /** time needed to reach this stage, in ms */
    at: number;
}

export const MEMBER_STAGES: Stage[] = MEMBER_DAYS.map((days, i) => ({
    index: i,
    name: MEMBER_NAMES[i],
    icon: ART[`member_${i + 1}`],
    at: days * DAY,
}));

export const GAME_STAGES: Stage[] = GAME_MINUTES.map((minutes, i) => ({
    index: i,
    name: GAME_NAMES[i],
    icon: ART[`game_${i + 1}`],
    at: minutes * MINUTE,
}));

/** Highest stage reached after `ms`, or null if not even the first one */
export function stageFor(stages: Stage[], ms: number): Stage | null {
    let found: Stage | null = null;
    for (const stage of stages) {
        if (ms >= stage.at) found = stage;
        else break;
    }
    return found;
}

export function nextStage(stages: Stage[], ms: number): Stage | null {
    return stages.find(s => s.at > ms) ?? null;
}

/** 2h 14m, 45m, 1d 3h */
export function formatDuration(ms: number): string {
    const totalMinutes = Math.max(0, Math.floor(ms / MINUTE));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return hours ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${minutes}m`;
}

/** today, 1 day, 12 days, 3 months, 1 year */
export function formatAge(ms: number): string {
    const days = Math.floor(ms / DAY);
    if (days < 1) return "less than a day";
    if (days < 60) return days === 1 ? "1 day" : `${days} days`;
    if (days < 365) {
        const months = Math.floor(days / 30);
        return months === 1 ? "1 month" : `${months} months`;
    }
    const years = Math.floor(days / 365);
    return years === 1 ? "1 year" : `${years} years`;
}

export const isUserId = (s: unknown): s is string => typeof s === "string" && /^\d{17,20}$/.test(s);
