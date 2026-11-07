/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync } from "fs";
import { join } from "path";

import { USER_AGENT } from "../constants";
import { VENCORD_DIR } from "../vencordDir";
import { downloadFile, fetchie } from "./http";
import { domain } from "../../../../DOMAIN.json";

const API_BASE = `https://git.${domain}/api/v1`;

export interface ReleaseData {
    name: string;
    tag_name: string;
    html_url: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
    }>;
}

// LumenCord: no remote asar download. The app files ship inside LumenCord
// itself (built via GitHub Actions) rather than being fetched at runtime.
export async function githubGet(_endpoint: string): Promise<never> {
    throw new Error("LumenCord does not download code at runtime.");
}

export async function downloadVencordAsar() {
    throw new Error("LumenCord does not download code at runtime.");
}

export function isValidVencordInstall(dir: string) {
    return existsSync(join(dir, "Nightcord/main.js"));
}

export async function ensureVencordFiles() {
    if (!existsSync(VENCORD_DIR)) {
        console.error("Bundled nightcord.asar not found at", VENCORD_DIR);
    }
}
