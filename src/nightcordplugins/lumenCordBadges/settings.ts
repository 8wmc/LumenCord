/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    shareBadges: {
        type: OptionType.BOOLEAN,
        description: "Share my LumenCord stage and game badges (needs Verify with Discord). Turning this off deletes your badge data.",
        default: true,
    },
    pauseBadges: {
        type: OptionType.BOOLEAN,
        description: "Pause my badges: stop updating them but keep my progress",
        default: false,
    },
});

/** True when this device should send your stage / game updates to the badge server */
export const isSharing = () => settings.store.shareBadges && !settings.store.pauseBadges;
