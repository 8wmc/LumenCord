/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";

import { BADGES_FILE, isUserId, MANUAL_BY_ID, normaliseBadgeId, SERVER } from "./defs";

export const logger = new Logger("LumenCordBadges", "#a855f7");

const AUTH_KEY = "LumenCordBadges_auth";
const REQUEST_TIMEOUT = 10_000;

// ───────────────────────── change listeners (settings page re-renders) ─────────────────────────

const listeners = new Set<() => void>();

export function onBadgesChange(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
}

function notify() {
    for (const fn of listeners) {
        try { fn(); } catch { }
    }
}

// ───────────────────────── login (Verify with Discord) ─────────────────────────

export interface Auth {
    token: string;
    /** Discord user id this login belongs to */
    id: string;
}

let auth: Auth | null = null;

export async function loadAuth() {
    try {
        const stored = await DataStore.get<Auth>(AUTH_KEY);
        auth = stored && typeof stored.token === "string" && isUserId(stored.id) ? stored : null;
    } catch {
        auth = null;
    }
    notify();
    return auth;
}

export function getAuth() {
    return auth;
}

export async function setAuth(next: Auth | null) {
    auth = next;
    try {
        if (next) await DataStore.set(AUTH_KEY, next);
        else await DataStore.del(AUTH_KEY);
    } catch (e) {
        logger.error("Could not save login", e);
    }
    notify();
}

async function request(path: string, init: RequestInit = {}, withAuth = false): Promise<Response | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
        const headers: Record<string, string> = {};
        if (init.body) headers["Content-Type"] = "application/json";
        if (withAuth && auth) headers.Authorization = auth.token;

        const res = await fetch(SERVER + path, { ...init, headers, signal: controller.signal });

        // Login no longer valid (deleted on the server, or opted out elsewhere)
        if (withAuth && res.status === 401) {
            logger.warn("Login expired, please verify again");
            await setAuth(null);
            return null;
        }
        return res;
    } catch (e) {
        logger.warn(`Request to ${path} failed`, e);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** Called with the redirect URL Discord gives after the user clicks Authorize */
export async function finishVerify(location: string): Promise<Auth | null> {
    try {
        const url = new URL(location);
        if (url.origin !== new URL(SERVER).origin) {
            logger.error("Unexpected redirect", url.origin);
            return null;
        }
        const res = await fetch(url.href, { headers: { Accept: "application/json" } });
        const data = await res.json().catch(() => null);
        if (res.ok && data && typeof data.token === "string" && isUserId(data.id)) {
            await setAuth({ token: data.token, id: data.id });
            return auth;
        }
        logger.error("Verify failed", res.status, data);
    } catch (e) {
        logger.error("Verify failed", e);
    }
    return null;
}

// ───────────────────────── reporting (only with a valid login for this account) ─────────────────────────

export function isAuthFor(userId: string | undefined) {
    return !!auth && !!userId && auth.id === userId;
}

export async function ping(userId: string, username: string, displayName: string) {
    if (!isAuthFor(userId)) return null;
    const res = await request("/ping", { method: "POST", body: JSON.stringify({ username, displayName }) }, true);
    if (!res?.ok) return null;
    const data = await res.json().catch(() => null);
    if (data && typeof data.firstSeen === "number") {
        // Show our own stage straight away
        const cached = cache.get(userId);
        cache.set(userId, {
            entry: { ...(cached?.entry ?? {}), firstSeen: data.firstSeen },
            receivedAt: Date.now(),
        });
        notify();
    }
    return data;
}

export async function reportGame(userId: string, game: string | null) {
    if (!isAuthFor(userId)) return false;
    const res = await request("/game", { method: "POST", body: JSON.stringify({ game }) }, true);
    if (res?.ok) {
        cache.delete(userId); // refresh our own game badge next time it's shown
        return true;
    }
    return false;
}

/** Opt-out: deletes everything the server has about this user */
export async function forgetMe(): Promise<boolean> {
    if (!auth) return true;
    const res = await request("/forget", { method: "POST", body: "{}" }, true);
    const ok = !!res?.ok;
    if (ok) {
        cache.delete(auth.id);
        await setAuth(null);
    }
    return ok;
}

// ───────────────────────── stage + game data for any user (public lookup) ─────────────────────────

export interface ServerEntry {
    firstSeen?: number;
    playing?: { name: string; ms: number; };
    last?: { name: string; ms: number; };
}

interface CacheItem {
    entry: ServerEntry | null;
    receivedAt: number;
}

const cache = new Map<string, CacheItem>();
const CACHE_TTL = 3 * 60 * 1000;
const queue = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function schedule(id: string) {
    if (!isUserId(id)) return;
    queue.add(id);
    flushTimer ??= setTimeout(flush, 120);
}

async function flush() {
    flushTimer = null;
    const ids = [...queue].slice(0, 50);
    ids.forEach(id => queue.delete(id));
    if (queue.size) flushTimer = setTimeout(flush, 120);
    if (!ids.length) return;

    // Mark as fetched now so we don't ask again while waiting
    const now = Date.now();
    for (const id of ids) {
        if (!cache.has(id)) cache.set(id, { entry: null, receivedAt: now });
    }

    const res = await request(`/dates?ids=${ids.join(",")}`);
    if (!res?.ok) return;
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") return;

    const at = Date.now();
    for (const id of ids) {
        const raw = data[id];
        cache.set(id, { entry: sanitiseEntry(raw), receivedAt: at });
    }
    notify();
}

function sanitiseEntry(raw: any): ServerEntry | null {
    if (!raw || typeof raw !== "object") return null;
    const entry: ServerEntry = {};
    if (typeof raw.firstSeen === "number" && raw.firstSeen > 0) entry.firstSeen = raw.firstSeen;
    for (const key of ["playing", "last"] as const) {
        const g = raw[key];
        if (g && typeof g.name === "string" && typeof g.ms === "number" && g.ms >= 0) {
            entry[key] = { name: g.name.slice(0, 80), ms: g.ms };
        }
    }
    return entry;
}

/** Ask the server about this user soon (e.g. when their profile is opening) */
export function prefetch(id: string) {
    const cached = cache.get(id);
    if (!cached || Date.now() - cached.receivedAt > CACHE_TTL) schedule(id);
}

/**
 * Cached data for a user, with live play time kept up to date.
 * Returns undefined while it hasn't been fetched yet (and starts fetching).
 */
export function getEntry(id: string): ServerEntry | null | undefined {
    const cached = cache.get(id);
    if (!cached || Date.now() - cached.receivedAt > CACHE_TTL) schedule(id);
    if (!cached?.entry) return cached ? null : undefined;

    const { entry } = cached;
    if (!entry.playing) return entry;
    return {
        ...entry,
        playing: { ...entry.playing, ms: entry.playing.ms + (Date.now() - cached.receivedAt) },
    };
}

// ───────────────────────── hand-out badges from badges.json ─────────────────────────

let manual = new Map<string, string[]>();
let manualLoadedAt = 0;

/**
 * Reads the "people" list. Only entries with a real Discord user id count;
 * username / displayName are just labels for the owner and are ignored.
 */
export function parseBadgesFile(data: any): Map<string, string[]> {
    const out = new Map<string, string[]>();
    const add = (userId: unknown, badges: unknown) => {
        const id = String(userId ?? "").trim();
        if (!isUserId(id) || !Array.isArray(badges)) return;
        const list = out.get(id) ?? [];
        for (const b of badges) {
            const badgeId = normaliseBadgeId(b);
            if (MANUAL_BY_ID.has(badgeId) && !list.includes(badgeId)) list.push(badgeId);
        }
        if (list.length) out.set(id, list);
    };

    if (data && Array.isArray(data.people)) {
        for (const person of data.people) {
            if (person && typeof person === "object") add(person.userId, person.badges);
        }
    }
    return out;
}

export async function loadManualBadges() {
    try {
        const res = await fetch(`${BADGES_FILE}?t=${Math.floor(Date.now() / 60_000)}`);
        if (!res.ok) return;
        const data = await res.json();
        manual = parseBadgesFile(data);
        manualLoadedAt = Date.now();
        notify();
    } catch (e) {
        logger.warn("Could not load badges.json", e);
    }
}

export function getManualBadges(userId: string): string[] {
    return manual.get(userId) ?? [];
}

export function manualBadgesLoaded() {
    return manualLoadedAt > 0;
}
