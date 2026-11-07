/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import definePlugin, { OptionType } from "@utils/types";

import themeStyle from "./lumencord.css?managed";

let running = false;

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
    },

    stop() {
        running = false;
        apply();
    },
});
