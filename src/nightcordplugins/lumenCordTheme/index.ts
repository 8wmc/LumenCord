/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { definePluginSettings, Settings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import definePlugin, { OptionType } from "@utils/types";

import themeStyle from "./lumencord.css?managed";

let running = false;

// Plugins that do heavy work all the time (watch every page change, log or translate every message...).
// They're off by default now; older installs get them switched off once, and can turn them back on.
const HEAVY_PLUGINS = ["MessageLoggerEnhanced", "VoiceDictation", "EventLogs", "SoundCordPlayer", "CustomProfile", "QuickDM", "CopyProfileId", "ValidSearch"];
const SPEED_KEY = "LumenCord_speedUp_v1";

async function speedUpOnce() {
    try {
        if (await DataStore.get(SPEED_KEY)) return;
        await DataStore.set(SPEED_KEY, true);
        const turnedOff: string[] = [];
        for (const name of HEAVY_PLUGINS) {
            const ps = Settings.plugins[name];
            if (ps?.enabled) {
                ps.enabled = false;
                turnedOff.push(name);
            }
        }
        if (!turnedOff.length) return;
        showNotification({
            title: "LumenCord is faster now",
            body: `Turned off ${turnedOff.length} heavy plugins (${turnedOff.join(", ")}). Restart Discord to finish. You can turn any back on in Settings → Plugins.`,
            permanent: true,
        });
    } catch { }
}

function apply() {
    if (running && settings.store.showTheme) enableStyle(themeStyle);
    else disableStyle(themeStyle);
}

export const settings = definePluginSettings({
    showTheme: {
        type: OptionType.BOOLEAN,
        description: "Use the built-in LumenCord theme",
        default: true,
        onChange: apply,
    },
});

export function setLumenCordThemeEnabled(value: boolean) {
    settings.store.showTheme = value;
    apply();
}

export default definePlugin({
    name: "LumenCordTheme",
    description: "The official LumenCord theme, built in. Turn it off in Settings → Themes if you'd rather use your own.",
    authors: [{ name: "8wmc", id: 470592025394413597n }],
    enabledByDefault: true,
    required: true,
    settings,

    start() {
        running = true;
        apply();
        setTimeout(() => void speedUpOnce(), 4000);
    },

    stop() {
        running = false;
        apply();
    },
});
