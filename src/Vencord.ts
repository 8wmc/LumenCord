/*!
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// DO NOT REMOVE UNLESS YOU WISH TO FACE THE WRATH OF THE CIRCULAR DEPENDENCY DEMON!!!!!!!
import "~plugins";
import "./fixWeirdAppRegionBug.css";

export * as Api from "./api";
export * as DataStore from "./api/DataStore";
export * as Plugins from "./api/PluginManager";
export * as Components from "./components";
export * as Util from "./utils";
export * as Updater from "./utils/updater";
export * as Webpack from "./webpack";
export * as WebpackPatcher from "./webpack/patchWebpack";
export { PlainSettings, Settings };

import { coreStyleRootNode, initStyles } from "@api/Styles";
import { openSettingsTabModal, UpdaterTab } from "@components/settings";
import { addHeaderBarButton, HeaderBarButton } from "@api/HeaderBar";
import { debounce } from "@shared/debounce";
import { IS_WINDOWS } from "@utils/constants";
import { createAndAppendStyle } from "@utils/css";
import { StartAt } from "@utils/types";
import { SettingsRouter } from "@webpack/common";

import { get as dsGet } from "./api/DataStore";
import { popNotice, showNotice } from "./api/Notices";
import { showNotification } from "./api/Notifications";
import { initPluginManager, PMLogger, startAllPlugins } from "./api/PluginManager";
import { initUserPluginsEngine } from "./api/UserPlugins";
import { PlainSettings, Settings, SettingsStore } from "./api/Settings";
import { getCloudSettings, putCloudSettings, shouldCloudSync } from "./api/SettingsSync/cloudSync";
import { localStorage } from "./utils/localStorage";
import { relaunch } from "./utils/native";
import { checkForUpdates, isOutdated as getIsOutdated, rebuild, update, UpdateLogger } from "./utils/updater";
import { onceReady } from "./webpack";
import { patches } from "./webpack/patchWebpack";

if (IS_REPORTER) {
    require("./debug/runReporter");
}

async function syncSettings() {
    // Check if cloud auth exists for current user before attempting sync
    if (localStorage.Vencord_cloudSyncDirection === undefined) {
        // by default, sync bi-directionally
        localStorage.Vencord_cloudSyncDirection = "both";
    }
    const hasCloudAuth = await dsGet("Vencord_cloudSecret");
    if (!hasCloudAuth) {
        if (Settings.cloud.authenticated) {
            // User switched to an account that isn't connected to cloud
            showNotification({
                title: "Cloud Settings",
                body: "Cloud sync was disabled because this account isn't connected to the cloud App. You can enable it again by connecting this account in Cloud Settings. (note: it will store your preferences separately)",
                color: "var(--yellow-360)",
                onClick: () => SettingsRouter.openUserSettings("equicord_cloud_panel")
            });
            // Disable cloud sync globally
            Settings.cloud.authenticated = false;
        }
        return;
    }

    // pre-check for local shared settings
    if (
        Settings.cloud.authenticated &&
        !hasCloudAuth // this has been enabled due to local settings share or some other bug
    ) {
        // show a notification letting them know and tell them how to fix it
        showNotification({
            title: "Cloud Integrations",
            body: "We've noticed you have cloud integrations enabled in another client! Due to limitations, you will " +
                "need to re-authenticate to continue using them. Click here to go to the settings page to do so!",
            color: "var(--yellow-360)",
            onClick: () => SettingsRouter.openUserSettings("equicord_cloud_panel")
        });
        return;
    }

    if (
        Settings.cloud.settingsSync && // if it's enabled
        Settings.cloud.authenticated && // if cloud integrations are enabled
        localStorage.Vencord_cloudSyncDirection !== "manual" // if we're not in manual mode
    ) {
        if (localStorage.Vencord_settingsDirty && shouldCloudSync("push")) {
            await putCloudSettings();
        } else if (shouldCloudSync("pull") && await getCloudSettings(false)) { // if we synchronized something (false means no sync)
            // we show a notification here instead of allowing getCloudSettings() to show one to declutter the amount of
            // potential notifications that might occur. getCloudSettings() will always send a notification regardless if
            // there was an error to notify the user, but besides that we only want to show one notification instead of all
            // of the possible ones it has (such as when your settings are newer).
            showNotification({
                title: "Cloud Settings",
                body: "Your settings have been updated! Click here to restart to fully apply changes!",
                color: "var(--green-360)",
                onClick: relaunch
            });
        }
    }

    const saveSettingsOnFrequentAction = debounce(async () => {
        if (Settings.cloud.settingsSync && Settings.cloud.authenticated && shouldCloudSync("push")) {
            await putCloudSettings();
        }
    }, 60_000);

    SettingsStore.addGlobalChangeListener(() => {
        localStorage.Vencord_settingsDirty = true;
        saveSettingsOnFrequentAction();
    });
}

const NIGHTCORD_LOGO_URI = "data:image/png;base64,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";

let stagedThisSession = false;

/**
 * Downloads and stages the update silently in the background.
 * No banner, no user interaction needed.
 * nightcord-index.js will apply the staged files on the next restart.
 */
async function silentlyStageUpdate() {
    if (stagedThisSession) return;
    stagedThisSession = true;

    try {
        UpdateLogger.info("Silently staging update in background...");
        // checkForUpdates() already set pendingDownloadUrl via IpcEvents.GET_UPDATES → getUpdates() → fetchUpdates()
        // So we call rebuild() (= stageUpdate) directly — no redundant API call needed.
        await rebuild(); // downloads zip to %temp%, extracts to staging dir, writes marker — no locked files touched
        UpdateLogger.info("Update staged successfully. Will be applied on next Discord restart.");

        // Notify user in the top-right corner that the update is ready to be applied on restart
        showNotification({
            id: "nightcord-update-downloaded",
            title: "Update Downloaded",
            body: "A new update has been downloaded. Restart your client to apply and discover what's new.",
            icon: "nightcord",
            type: "info",
            duration: 9000,
            actions: [
                {
                    label: "Restart Now",
                    onClick: () => relaunch()
                }
            ]
        });
    } catch (e) {
        UpdateLogger.error("Silent update staging failed", e);
        stagedThisSession = false; // allow retry on next check interval
    }
}

async function runUpdateCheck() {
    if (IS_UPDATER_DISABLED || Settings.disableAutoUpdate) return;

    try {
        const isOutdated = await checkForUpdates();
        if (IS_DISCORD_DESKTOP) VencordNative.tray.setUpdateState(isOutdated);
        if (!isOutdated) return;

        // Stage silently — no banner shown, update applies on next restart
        silentlyStageUpdate();
    } catch (err) {
        UpdateLogger.error("Failed to check for updates", err);
    }
}

function initTrayIpc() {
    if (IS_WEB || IS_UPDATER_DISABLED) return;

    VencordNative.tray.onCheckUpdates(async () => {
        try {
            const isOutdated = await checkForUpdates();
            VencordNative.tray.setUpdateState(isOutdated);

            if (isOutdated) {
                showNotice("A LumenCord update is available!", "View Update", () => openSettingsTabModal(UpdaterTab!));
            } else {
                showNotice("No updates available, you're on the latest version!", "OK", popNotice);
            }
        } catch (err) {
            UpdateLogger.error("Failed to check for updates from tray", err);
            showNotice("Failed to check for updates, check the console for more info", "OK", popNotice);
        }
    });

    VencordNative.tray.onRepair(async () => {
        try {
            await update();
            relaunch();
        } catch (err) {
            UpdateLogger.error("Failed to repair LumenCord", err);
        }
    });

    VencordNative.tray.setUpdateState(getIsOutdated);
}

import { ReactDOM } from "@webpack/common";
import { initCustomization, registerCustomizationPatches } from "customization";
import { initGlobalFont } from "customization/globalFonts/globalFontManager";

async function init() {
    await onceReady;

    // LumenCord: older installs may still point settings sync at Nightcord's server. Move them off it.
    try {
        if (typeof Settings.cloud?.url === "string" && Settings.cloud.url.includes("nightcord.st")) {
            Settings.cloud.url = "https://cloud.equicord.org/";
            Settings.cloud.authenticated = false;
            Settings.cloud.settingsSync = false;
        }
    } catch { }

    void initCustomization();
    initGlobalFont();

    startAllPlugins(StartAt.WebpackReady);
    initUserPluginsEngine();

    syncSettings();
    initTrayIpc();

    if (!IS_WEB && !IS_UPDATER_DISABLED) {
        setTimeout(runUpdateCheck, 8000);
        setInterval(runUpdateCheck, 1000 * 60 * 30); // 30 minutes
    }

    // Only notify when an update has actually been applied / on new version
    try {
        const currentVersion = `v${VERSION}`;
        const LS_KEY = "nightcord_installed_version";
        const lastVersion = localStorage.getItem(LS_KEY);

        if (lastVersion !== currentVersion) {
            localStorage.setItem(LS_KEY, currentVersion);
            setTimeout(() => {
                showNotification({
                    id: "nightcord-update-notify",
                    title: "LumenCord Updated",
                    body: `LumenCord updated to ${currentVersion}. Open settings to discover what's new.`,
                    icon: "nightcord",
                    type: "success",
                    duration: 6000,
                    actions: [
                        {
                            label: "Settings",
                            onClick: () => {
                                try { SettingsRouter.open("equicord_general"); } catch {}
                            }
                        }
                    ]
                });
            }, 1200);
        }
    } catch {}

    if (IS_DEV) {
        const pendingPatches = patches.filter(p => !p.all && p.predicate?.() !== false);
        if (pendingPatches.length)
            PMLogger.warn(
                "Webpack has finished initialising, but some patches haven't been applied yet.",
                "This might be expected since some Modules are lazy loaded, but please verify",
                "that all plugins are working as intended.",
                "You are seeing this warning because this is a Development build of LumenCord.",
                "\nThe following patches have not been applied:",
                "\n\n" + pendingPatches.map(p => `${p.plugin}: ${p.find}`).join("\n")
            );
    }
}

if ((window as any).__NIGHTCORD_INITIALIZED__) {
    console.warn("[LumenCord] Renderer already initialized — skipping duplicate execution.");
} else {
    (window as any).__NIGHTCORD_INITIALIZED__ = true;

    try {
        const g: any = typeof window !== "undefined" ? window : globalThis;
        g.Equicord = g.Vencord;
        g.Nightcord = g.Vencord;
        g.VencordNative ??= g.EquicordNative ?? g.NightcordNative;
        g.EquicordNative ??= g.VencordNative;
        g.NightcordNative ??= g.VencordNative;
    } catch {}

    registerCustomizationPatches();
    initPluginManager();
    initStyles();
    initGlobalFont();
    startAllPlugins(StartAt.Init);
    init();

    document.addEventListener("DOMContentLoaded", () => {
        startAllPlugins(StartAt.DOMContentLoaded);
    }, { once: true });
}

