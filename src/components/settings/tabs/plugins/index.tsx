/*
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

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { isPluginEnabled, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings, useSettings } from "@api/Settings";
import { openUserPluginsFolder, syncAllUserPlugins } from "@api/UserPlugins";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Notice } from "@components/Notice";
import { Divider } from "@components/Divider";
import ErrorBoundary from "@components/ErrorBoundary";
import { HeadingTertiary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab } from "@components/settings";
import { debounce } from "@shared/debounce";
import { ChangeList } from "@utils/ChangeList";
import { classNameFactory } from "@utils/css";
import { isTruthy } from "@utils/guards";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { relaunch, showItemInFolder } from "@utils/native";
import { useAwaiter } from "@utils/react";
import { Alerts, lodash, Parser, React, Select as DiscordSelect, showToast, TextInput, Toasts, Tooltip, useCallback, useMemo, useState } from "@webpack/common";
import { SafeSearchableSelect } from "@components/SafeSearchableSelect";
import { JSX } from "react";
import { t } from "@api/i18n";

import Plugins, { ExcludedPlugins, PluginMeta } from "~plugins";
import { fetchPluginRatings, PluginRatings } from "@api/PluginLikes";
import { authorizeLikeSystem, LIKE_AUTH_EVENT } from "@api/PluginLikesAuth";
import { getStoredToken } from "@api/OAuth2";

import { PluginCard } from "./PluginCard";
import { openPluginModal, openResetDefaultsModal, openApplyBasicConfigModal, openWarningModal } from "./PluginModal";
import { StockPluginsCard } from "./PluginStatCards";
import { TUTORIAL_PLUGIN_NAMES } from "./tutorialList";
import { UIElementsButton } from "./UIElements";

export const BASIC_CONFIG_PLUGINS: Set<string> = new Set([
    "FakeVoice",
    "SilentDelete",
    "MessageCleaner",
    "ShowHiddenChannels",
    "CallTimer",
    "FollowUser",
    "UserVoiceShow",
    "ViewIcons",
    "VoiceMessages",
    "VolumeBooster",
    "ValidUser",
    "ValidSearch",
    "CrashHandler",
    "WhosWatching",
    "DisableCallIdle",
    "ShowHiddenThings",
    "MultiInstance",
    "ImageZoom",
    "MemberCount",
    "UnlimitedAccounts",
    "BigFileUpload",
    "MessageLogger",
    "MessageLoggerEnhanced",
    "SpotifyCrack",
    "IconViewer",
    "EventLogs",
    "Translate",
    "DoubleEmoji",
    "VoiceDownload",
    "PinDMs",
    "PrevNames",
    "CancelFriendRequest",
    "ReverseImageSearch",
    "FastPing",
    "AutoMute",
    "AutoDeco",
    "RealtimeTimestamps",
    "SavedMessages",
    "SaveGroups",
    "QuickDM",
    "CopyProfileId"
]);



const NIGHTCORD_TAB_ICON = "data:image/png;base64,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";
const VENCORD_EQUICORD_TAB_ICON = "data:image/png;base64,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";

function NightcordTabIcon() {
    return <img src={NIGHTCORD_TAB_ICON} alt="LumenCord" style={{ width: 18, height: 18, borderRadius: 4 }} />;
}

function VencordEquicordTabIcon() {
    return <img src={VENCORD_EQUICORD_TAB_ICON} alt="Vencord & Equicord" style={{ width: 18, height: 18, borderRadius: 4 }} />;
}

function UserPluginsTabIcon() {
    return <img src="https://equicord.org/assets/icons/misc/userplugin.png" alt={t("User Plugins")} style={{ width: 18, height: 18, borderRadius: 4 }} />;
}

function LikedPluginsTabIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="#fff" d="M12.47 21.73a.92.92 0 0 1-.94 0C9.43 20.48 1 15.09 1 8.75A5.75 5.75 0 0 1 6.75 3c2.34 0 3.88.9 5.25 2.26A6.98 6.98 0 0 1 17.25 3 5.75 5.75 0 0 1 23 8.75c0 6.34-8.42 11.73-10.53 12.98Z" />
        </svg>
    );
}

function EnabledPluginsTabIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill="var(--status-positive, #23a55a)" fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm4.53 8.28a.75.75 0 0 0-1.06-1.06L10.5 14.19l-1.97-1.97a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5.5-5.5Z" clipRule="evenodd" />
        </svg>
    );
}

const makeCategoryOptions = (othersCount?: number) => [
    { label: "Vencord & Equicord", value: SearchStatus.OTHERS },
    { label: "LumenCord", value: SearchStatus.NIGHTCORD },
    { label: t("Enabled Plugins"), value: SearchStatus.ENABLED },
    { label: t("User Plugins"), value: SearchStatus.USER_PLUGINS },
    { label: t("Liked Plugins"), value: SearchStatus.LIKED_PLUGINS },
    { label: t("Community Plugins"), value: "community", disabled: true }
];
export const cl = classNameFactory("vc-plugins-");
export const logger = new Logger("PluginSettings", "#a6d189");

function showErrorToast(message: string) {
    Toasts.show({
        message,
        type: Toasts.Type.FAILURE,
        id: Toasts.genId(),
        options: {
            position: Toasts.Position.BOTTOM
        }
    });
}

function ReloadRequiredCard({ required, enabledPlugins, openWarningModal, resetCheckAndDo, applyDefaultConfigCheckAndDo }) {
    return (
        <Card className={classes(cl("info-card"), required && "vc-warning-card")}>
            {required ? (
                <>
                    <HeadingTertiary>{t("Quick Reload Required")}</HeadingTertiary>
                    <Paragraph className={cl("dep-text")}>
                        {t("Reload now to apply new plugins and their settings in 1 second")}
                    </Paragraph>
                    <Button variant="primary" className={cl("restart-button")} onClick={() => relaunch()}>
                        {t("Quick Reload")}
                    </Button>
                </>
            ) : (
                <>
                    <HeadingTertiary>{t("Plugin Management")}</HeadingTertiary>
                    <Paragraph>{t("Press the cog wheel or info icon to get more info on a plugin")}</Paragraph>
                    <Paragraph>{t("Plugins with a cog wheel have settings you can modify!")}</Paragraph>
                </>
            )}
            <div style={{ display: "flex", gap: "8px" }}>
                {enabledPlugins.length > 0 && !required && (
                    <Button
                        variant="secondary"
                        size="small"
                        className={"vc-plugins-disable-warning vc-modal-align-reset"}
                        onClick={() => {
                            return openWarningModal(null, undefined, false, enabledPlugins.length, resetCheckAndDo);
                        }}
                    >
                        {t("Disable All Plugins")}
                    </Button>
                )}
                {!required && (
                    <Button
                        variant="secondary"
                        size="small"
                        className={"vc-plugins-disable-warning vc-modal-align-reset"}
                        onClick={() => {
                            return openResetDefaultsModal(applyDefaultConfigCheckAndDo);
                        }}
                    >
                        {t("Apply Default Config")}
                    </Button>
                )}
            </div>
        </Card>
    );
}

export const ExcludedReasons: Record<"web" | "discordDesktop" | "vesktop" | "equibop" | "desktop" | "dev", string> = {
    desktop: "Discord Desktop app or Vesktop/Equibop",
    discordDesktop: "Discord Desktop app",
    vesktop: "Vesktop/Equibop apps",
    equibop: "Vesktop/Equibop apps",
    web: "Vesktop/Equibop apps & Discord web",
    dev: "Developer version of LumenCord"
};

function ExcludedPluginsList({ search }: { search: string; }) {
    const matchingExcludedPlugins = search
        ? Object.entries(ExcludedPlugins)
            .filter(([name]) => name.toLowerCase().includes(search))
        : [];

    return (
        <Paragraph className={Margins.top16}>
            {matchingExcludedPlugins.length
                ? <>
                    <Paragraph>{t("Are you looking for:")}</Paragraph>
                    <ul>
                        {matchingExcludedPlugins.map(([name, reason]) => (
                            <li key={name}>
                                <b>{name}</b>: Only available on the {ExcludedReasons[reason]}
                            </li>
                        ))}
                    </ul>
                </>
                : t("No plugins meet the search criteria.")
            }
        </Paragraph>
    );
}

import { SearchStatus, TUTORIAL_CACHE } from "./components/Common";

// Fallback select natif si le composant Discord n'est pas trouvé
function NativeSelect({ options, select, isSelected }: any) {
    const currentVal = options.find((o: any) => isSelected(o.value))?.value ?? options.find((o: any) => o.default)?.value ?? options[0]?.value;
    return (
        <select
            style={{
                background: "var(--background-secondary)",
                color: "var(--text-normal)",
                border: "1px solid var(--background-modifier-accent)",
                borderRadius: 4,
                padding: "6px 10px",
                fontSize: 14,
                cursor: "pointer",
                outline: "none",
            }}
            value={currentVal}
            onChange={e => select(Number(e.target.value))}
        >
            {options.map((o: any) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}

const Select = DiscordSelect || NativeSelect;
interface PluginSettingsProps {
    premiumOnly?: boolean;
}

export default function PluginSettings({ premiumOnly = false }: PluginSettingsProps) {
    const settings = useSettings();
    const changes = React.useMemo(() => new ChangeList<string>(), []);

    // Expand Discord's content column to fill the full available width
    React.useEffect(() => {
        const col = document.querySelector<HTMLElement>('[class*="contentColumn"]');
        if (!col) return;
        const prevPaddingLeft = col.style.paddingLeft;
        const prevPaddingRight = col.style.paddingRight;
        const prevMaxWidth = col.style.maxWidth;
        col.style.paddingLeft = "16px";
        col.style.paddingRight = "16px";
        col.style.maxWidth = "none";
        return () => {
            col.style.paddingLeft = prevPaddingLeft;
            col.style.paddingRight = prevPaddingRight;
            col.style.maxWidth = prevMaxWidth;
        };
    }, []);

    // Static list — no fetch, no CORS issues.
    // Also populate TUTORIAL_CACHE so the SearchStatus.TUTORIAL filter works.
    const tutorialPlugins = useMemo(() => {
        for (const name of Object.values(Plugins).map(p => p.name).filter(Boolean)) {
            TUTORIAL_CACHE.set(name, TUTORIAL_PLUGIN_NAMES.has(name));
        }
        return TUTORIAL_PLUGIN_NAMES;
    }, []);

    React.useEffect(() => {
        return () => {
            if (!changes.hasChanges) return;

            const allChanges = [...changes.getChanges()];
            const pluginNames = [...new Set(allChanges.map(s => s.split(":")[0]))];
            const maxDisplay = 15;
            const displayed = pluginNames.slice(0, maxDisplay);
            const remainingCount = pluginNames.length - displayed.length;

            Alerts.show({
                title: t("Quick Reload Required"),
                body: (
                    <div>
                        {displayed.map((s, i) => (
                            <span key={i}>
                                {i > 0 && ", "}
                                {Parser.parse("`" + s + "`")}
                            </span>
                        ))}
                        {remainingCount > 0 && <span> and {remainingCount} more</span>}
                    </div>
                ),
                confirmText: t("Quick Reload Now"),
                cancelText: t("Later"),
                onConfirm: () => relaunch()
            });
        };
    }, []);

    const depMap = useMemo(() => {
        const o = {} as Record<string, string[]>;
        for (const plugin in Plugins) {
            const deps = Plugins[plugin].dependencies;
            if (deps) {
                for (const dep of deps) {
                    o[dep] ??= [];
                    o[dep].push(plugin);
                }
            }
        }
        return o;
    }, []);

    const [ratings, setRatings] = React.useState<PluginRatings>({});
    React.useEffect(() => {
        fetchPluginRatings().then(setRatings).catch(() => {});
    }, []);

    const [isLikeLoggedIn, setIsLikeLoggedIn] = React.useState(true);
    const [likeLoginLoading, setLikeLoginLoading] = React.useState(false);
    React.useEffect(() => {
        let cancelled = false;
        const refresh = () => getStoredToken().then(token => { if (!cancelled) setIsLikeLoggedIn(!!token); });
        refresh();
        window.addEventListener(LIKE_AUTH_EVENT, refresh);
        return () => {
            cancelled = true;
            window.removeEventListener(LIKE_AUTH_EVENT, refresh);
        };
    }, []);

    const handleLikeLogin = useCallback(async () => {
        if (likeLoginLoading) return;
        setLikeLoginLoading(true);
        try {
            const token = await authorizeLikeSystem();
            if (token) {
                setIsLikeLoggedIn(true);
                fetchPluginRatings(true).then(setRatings).catch(() => {});
            }
        } finally {
            setLikeLoginLoading(false);
        }
    }, [likeLoginLoading]);

    const sortedPlugins = useMemo(() => Object.values(Plugins)
        .filter(p => typeof p.name === "string")
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")), []);

    const hasUserPlugins = useMemo(() => !IS_STANDALONE && Object.values(PluginMeta).some(m => m.userPlugin), []);

    const [searchValue, setSearchValue] = useState({ value: "", status: SearchStatus.NIGHTCORD });
    const [searchInput, setSearchInput] = useState("");

    const debouncedSetSearch = useMemo(
        () => debounce((query: string) => setSearchValue(prev => ({ ...prev, value: query })), 150),
        []
    );

    const search = searchValue.value.toLowerCase();
    const onSearch = useCallback((query: string) => {
        setSearchInput(query);
        debouncedSetSearch(query);
    }, [debouncedSetSearch]);

    const BATCH_SIZE = 40;
    const [visibleCount, setVisibleCount] = React.useState(BATCH_SIZE);

    const observer = React.useRef<IntersectionObserver>();
    const sentinelRef = React.useCallback((node: HTMLDivElement | null) => {
        if (observer.current) observer.current.disconnect();
        if (node) {
            observer.current = new IntersectionObserver(
                entries => {
                    if (entries[0].isIntersecting) {
                        const total = allDataLengthRef.current;
                        React.startTransition(() => {
                            setVisibleCount(v => Math.min(v + BATCH_SIZE, total));
                        });
                    }
                },
                { rootMargin: "400px" } // trigger loading before it comes into view
            );
            observer.current.observe(node);
        }
    }, []);

    const onStatusChange = useCallback((status: SearchStatus) => {
        setVisibleCount(BATCH_SIZE);
        React.startTransition(() => {
            setSearchValue(prev => ({ ...prev, status }));
        });
    }, []);

    const pluginFilter = useCallback((plugin: typeof Plugins[keyof typeof Plugins], newPluginsSet: Set<string> | null) => {
        // Filter by premium status first
        const isPremiumPlugin = !!plugin.premium;
        if (premiumOnly) {
            if (!isPremiumPlugin) return false;
        } else {
            if (isPremiumPlugin) return false;
        }

        const { status } = searchValue;
        const enabled = isPluginEnabled(plugin.name);

        const pluginMeta = PluginMeta[plugin.name];

        switch (status) {
            case SearchStatus.DISABLED:
                if (enabled) return false;
                break;
            case SearchStatus.ENABLED:
                if (!enabled) return false;
                break;
            case SearchStatus.NIGHTCORD:
                if (!pluginMeta?.folderName?.startsWith("src/nightcordplugins/")) return false;
                break;
            case SearchStatus.OTHERS:
                if (pluginMeta?.folderName?.startsWith("src/nightcordplugins/") || pluginMeta?.folderName?.startsWith("src/plugins/_")) return false;
                if (!pluginMeta?.folderName?.startsWith("src/plugins/")) return false;
                break;
            case SearchStatus.VENCORD:
                if (!pluginMeta?.folderName?.startsWith("src/plugins/")) return false;
                break;
            case SearchStatus.NEW:
                if (!newPluginsSet?.has(plugin.name)) return false;
                break;
            case SearchStatus.USER_PLUGINS:
                if (!pluginMeta?.userPlugin && !(plugin as any)?.isUserPlugin) return false;
                break;
            case SearchStatus.API_PLUGINS:
                if (!plugin.name.endsWith("API")) return false;
                break;
            case SearchStatus.TUTORIAL:
                if (!TUTORIAL_CACHE.get(plugin.name)) return false;
                break;
            case SearchStatus.LIKED_PLUGINS:
                if (!pluginMeta?.folderName?.startsWith("src/nightcordplugins/")) return false;
                if (!ratings[plugin.name]?.likedByMe) return false;
                break;
        }

        if (!search.length) return true;

        const isIllegalcordPartner = (
            plugin.name === "DynamicIslande" ||
            plugin.name === "StereoInstaller" ||
            plugin.name === "ClientDiagnostics" ||
            plugin.name === "SecureBookmarks" ||
            plugin.name === "StatusCycler" ||
            plugin.name === "MutualScanner"
        );

        if ((search.includes("illegalcord") || search.includes("illegal")) && isIllegalcordPartner) {
            return true;
        }

        return (
            plugin.name.toLowerCase().includes(search.replace(/\s+/g, "")) ||
            (plugin.description ?? "").toLowerCase().includes(search) ||
            plugin.tags?.some(t => t.toLowerCase().includes(search))
        );
    }, [searchValue, search, ratings]);

    const [newPluginsSet] = useAwaiter(() => DataStore.get("Vencord_existingPlugins").then((cachedPlugins: Record<string, number> | undefined) => {
        const now = Date.now() / 1000;
        const existingTimestamps: Record<string, number> = {};
        const sortedPluginNames = Object.values(sortedPlugins).map(plugin => plugin.name);

        const newPlugins: string[] = [];
        for (const { name: p } of sortedPlugins) {
            const time = existingTimestamps[p] = cachedPlugins?.[p] ?? now;
            if ((time + 60 * 60 * 24 * 2) > now) {
                newPlugins.push(p);
            }
        }
        DataStore.set("Vencord_existingPlugins", existingTimestamps);

        return lodash.isEqual(newPlugins, sortedPluginNames) ? null : new Set(newPlugins);
    }));

    const handleRestartNeeded = useCallback((name: string, key: string) => changes.handleChange(`${name}:${key}`), [changes]);

    // Only filter/categorize plugin DATA here — no JSX created yet
        const { nightcordData, othersData, requiredData } = useMemo(() => {
        const nightcordData: typeof sortedPlugins = [];
        const othersData: typeof sortedPlugins = [];
        const requiredData: typeof sortedPlugins = [];

        const showApi = searchValue.status === SearchStatus.API_PLUGINS;
        for (const p of sortedPlugins) {
            if (p.hidden || (!p.settings?.def && p.name.endsWith("API") && !showApi))
                continue;

            if (!pluginFilter(p, newPluginsSet)) continue;

            const isRequired = searchValue.status === SearchStatus.ENABLED
                ? p.required
                : (p.required || p.isDependency || depMap[p.name]?.some(d => isPluginEnabled(d)));

            if (isRequired) {
                requiredData.push(p);
            } else if (searchValue.status === SearchStatus.ENABLED) {
                nightcordData.push(p);
            } else {
                const folderName = PluginMeta[p.name]?.folderName ?? "";
                if (folderName.startsWith("src/nightcordplugins/")) {
                    nightcordData.push(p);
                } else {
                    othersData.push(p);
                }
            }
        }
        // Toujours trier par nombre de likes décroissant, mais forcer AutoCallRecorder en premier
        const byLikes = (a: typeof sortedPlugins[number], b: typeof sortedPlugins[number]) => {
            if (a.name === "AutoCallRecorder") return -1;
            if (b.name === "AutoCallRecorder") return 1;
            const diff = (ratings[b.name]?.likes ?? 0) - (ratings[a.name]?.likes ?? 0);
            if (diff !== 0) return diff;
            return a.name.localeCompare(b.name);
        };
        nightcordData.sort(byLikes);
        othersData.sort(byLikes);

        return { nightcordData, othersData, requiredData };
    }, [sortedPlugins, searchValue, newPluginsSet, depMap, pluginFilter, ratings, settings.plugins]);

    const allDataLength = nightcordData.length + othersData.length;
    const hasMore = visibleCount < allDataLength;

    // Store allDataLength in a ref so the observer callback always sees the latest value
    // without needing it as a dependency (which would cause reconnect loops).
    const allDataLengthRef = React.useRef(allDataLength);
    allDataLengthRef.current = allDataLength;

    // Sentinel ref and observer are now defined using a callback ref above.

    function resetCheckAndDo() {
        let restartNeeded = false;

        for (const plugin of enabledPlugins) {
            const pluginSettings = settings.plugins[plugin];

            if (Plugins[plugin].patches?.length) {
                pluginSettings.enabled = false;
                changes.handleChange(plugin);
                restartNeeded = true;
                continue;
            }

            const result = stopPlugin(Plugins[plugin]);

            if (!result) {
                logger.error(`Error while stopping plugin ${plugin}`);
                showErrorToast(`Error while stopping plugin ${plugin}`);
                continue;
            }

            pluginSettings.enabled = false;
        }

        if (restartNeeded) {
            Alerts.show({
                title: t("Quick Reload Required"),
                body: (
                    <>
                        <p style={{ textAlign: "center" }}>{t("Some plugins require a quick reload to fully disable.")}</p>
                        <p style={{ textAlign: "center" }}>{t("Would you like to reload now?")}</p>
                    </>
                ),
                confirmText: t("Quick Reload Now"),
                cancelText: t("Later"),
                onConfirm: () => relaunch()
            });
        }
    }

    function applyDefaultConfigCheckAndDo() {
        try {
            let restartNeeded = false;
            let modifiedCount = 0;

            for (const pluginName in Plugins) {
                const plugin = Plugins[pluginName];

                // Les plugins APIs ne peuvent pas être configurés directement
                if (pluginName.endsWith("API")) continue;

                const shouldBeEnabled = Boolean(plugin.required) || Boolean(plugin.enabledByDefault);
                const currentlyEnabled = isPluginEnabled(pluginName);

                if (currentlyEnabled !== shouldBeEnabled) {
                    const pluginSettings = settings.plugins[pluginName];

                    if (plugin.patches?.length) {
                        pluginSettings.enabled = shouldBeEnabled;
                        changes.handleChange(pluginName);
                        restartNeeded = true;
                        modifiedCount++;
                        continue;
                    }

                    if (shouldBeEnabled) {
                        const result = startPlugin(plugin);
                        if (!result) {
                            logger.error(`Error while starting plugin ${pluginName}`);
                            showErrorToast(`Error while starting plugin ${pluginName}`);
                        } else {
                            pluginSettings.enabled = true;
                            modifiedCount++;
                        }
                    } else {
                        const result = stopPlugin(plugin);
                        if (!result) {
                            logger.error(`Error while stopping plugin ${pluginName}`);
                            showErrorToast(`Error while stopping plugin ${pluginName}`);
                        } else {
                            pluginSettings.enabled = false;
                            modifiedCount++;
                        }
                    }
                }
            }

            if (restartNeeded) {
                Alerts.show({
                    title: t("Quick Reload Required"),
                    body: (
                        <>
                            <p style={{ textAlign: "center" }}>{t("Some plugins require a quick reload to apply their default configuration.")}</p>
                            <p style={{ textAlign: "center" }}>{t("Would you like to reload now?")}</p>
                        </>
                    ),
                    confirmText: t("Quick Reload Now"),
                    cancelText: t("Later"),
                    onConfirm: () => relaunch()
                });
            } else {
                Toasts.show({
                    message: `Default config applied. ${modifiedCount} plugin(s) modified.`,
                    type: Toasts.Type.SUCCESS,
                    id: Toasts.genId(),
                    options: { position: Toasts.Position.BOTTOM }
                });
            }
        } catch (err: any) {
            Toasts.show({
                message: `Failed: ${err?.message ?? err}`,
                type: Toasts.Type.FAILURE,
                id: Toasts.genId(),
                options: { position: Toasts.Position.BOTTOM }
            });
            logger.error("Apply Default Config crashed:", err);
        }
    }

    function applyBasicConfigCheckAndDo() {
        try {
            let restartNeeded = false;
            let modifiedCount = 0;

            for (const pluginName in Plugins) {
                const plugin = Plugins[pluginName];

                // Les plugins APIs ne peuvent pas être configurés directement
                if (pluginName.endsWith("API")) continue;

                const shouldBeEnabled = Boolean(plugin.required) || BASIC_CONFIG_PLUGINS.has(pluginName);
                const currentlyEnabled = isPluginEnabled(pluginName);

                if (currentlyEnabled !== shouldBeEnabled) {
                    const pluginSettings = settings.plugins[pluginName];

                    if (plugin.patches?.length) {
                        pluginSettings.enabled = shouldBeEnabled;
                        changes.handleChange(pluginName);
                        restartNeeded = true;
                        modifiedCount++;
                        continue;
                    }

                    if (shouldBeEnabled) {
                        const result = startPlugin(plugin);
                        if (!result) {
                            logger.error(`Error while starting plugin ${pluginName}`);
                            showErrorToast(`Error while starting plugin ${pluginName}`);
                        } else {
                            pluginSettings.enabled = true;
                            modifiedCount++;
                        }
                    } else {
                        const result = stopPlugin(plugin);
                        if (!result) {
                            logger.error(`Error while stopping plugin ${pluginName}`);
                            showErrorToast(`Error while stopping plugin ${pluginName}`);
                        } else {
                            pluginSettings.enabled = false;
                            modifiedCount++;
                        }
                    }
                }
            }

            if (restartNeeded) {
                Alerts.show({
                    title: t("Quick Reload Required"),
                    body: (
                        <>
                            <p style={{ textAlign: "center" }}>{t("Some plugins require a quick reload to apply the basic configuration.")}</p>
                            <p style={{ textAlign: "center" }}>{t("Would you like to reload now?")}</p>
                        </>
                    ),
                    confirmText: t("Quick Reload Now"),
                    cancelText: t("Later"),
                    onConfirm: () => relaunch()
                });
            } else {
                Toasts.show({
                    message: `Basic config applied. ${modifiedCount} plugin(s) modified.`,
                    type: Toasts.Type.SUCCESS,
                    id: Toasts.genId(),
                    options: { position: Toasts.Position.BOTTOM }
                });
            }
        } catch (err: any) {
            Toasts.show({
                message: `Failed: ${err?.message ?? err}`,
                type: Toasts.Type.FAILURE,
                id: Toasts.genId(),
                options: { position: Toasts.Position.BOTTOM }
            });
            logger.error("Apply Basic Config crashed:", err);
        }
    }


    // Code directly taken from supportHelper.tsx
    const { totalStockPlugins, totalUserPlugins, enabledStockPlugins, enabledUserPlugins, enabledPlugins } = useMemo(() => {
        const isApiPlugin = (plugin: string) => plugin.endsWith("API") || Plugins[plugin]?.required;

        const totalPlugins = Object.keys(Plugins).filter(p => !isApiPlugin(p));
        const enabledPlugins = Object.keys(Plugins).filter(p => isPluginEnabled(p) && !isApiPlugin(p));

        const totalStockPlugins = totalPlugins.filter(p => !PluginMeta[p]?.userPlugin && !(Plugins[p] as any)?.isUserPlugin && !Plugins[p]?.hidden).length;
        const totalUserPlugins = totalPlugins.filter(p => PluginMeta[p]?.userPlugin || (Plugins[p] as any)?.isUserPlugin).length;
        const enabledStockPlugins = enabledPlugins.filter(p => !PluginMeta[p]?.userPlugin && !(Plugins[p] as any)?.isUserPlugin).length;
        const enabledUserPlugins = enabledPlugins.filter(p => PluginMeta[p]?.userPlugin || (Plugins[p] as any)?.isUserPlugin).length;
        return { totalStockPlugins, totalUserPlugins, enabledStockPlugins, enabledUserPlugins, enabledPlugins };
    }, [settings.plugins]);

    // Slice DATA first, then create JSX only for visible items
    const nightcordVisibleData = nightcordData.slice(0, Math.min(visibleCount, nightcordData.length));
    const othersVisibleData = othersData.slice(0, Math.max(0, visibleCount - nightcordData.length));

    const makeCard = (p: typeof sortedPlugins[number]) => (
        <ErrorBoundary fallback={<div style={{ color: "red", padding: 8 }}>Failed to render {p.name}.</div>} key={`${p.name}_${(p as any)?.isUserPlugin ? "user" : "stock"}`}>
            <PluginCard
                onRestartNeeded={handleRestartNeeded}
                disabled={false}
                plugin={p}
                isNew={newPluginsSet?.has(p.name)}
                hasTutorial={tutorialPlugins.has(p.name)}
            />
        </ErrorBoundary>
    );

    const makeRequiredCard = (p: typeof sortedPlugins[number]) => {
        const tooltipText = p.required || !depMap[p.name]
            ? "This plugin is required for LumenCord to function."
            : <PluginDependencyList deps={depMap[p.name]?.filter(d => isPluginEnabled(d))} />;
        return (
            <ErrorBoundary fallback={<div style={{ color: "red", padding: 8 }}>Failed to render {p.name}.</div>} key={`${p.name}_${(p as any)?.isUserPlugin ? "user" : "stock"}`}>
                <Tooltip text={tooltipText}>
                    {({ onMouseLeave, onMouseEnter }) => (
                        <PluginCard
                            onMouseLeave={onMouseLeave}
                            onMouseEnter={onMouseEnter}
                            onRestartNeeded={handleRestartNeeded}
                            disabled={true}
                            plugin={p}
                            hasTutorial={tutorialPlugins.has(p.name)}
                        />
                    )}
                </Tooltip>
            </ErrorBoundary>
        );
    };

    const nightcordPlugins = nightcordVisibleData.map(makeCard);
    const othersVisible = othersVisibleData.map(makeCard);
    const requiredPlugins = requiredData.map(makeRequiredCard);

    const totalNightcordPlugins = React.useMemo(() => {
        return Object.values(Plugins).filter(p => PluginMeta[p.name]?.folderName?.startsWith("src/nightcordplugins/")).length;
    }, []);

    const totalOtherPlugins = React.useMemo(() => {
        const isNightcordPlugin = (p: string) => PluginMeta[p]?.folderName?.startsWith("src/nightcordplugins/");
        const isCorePlugin = (p: string) => PluginMeta[p]?.folderName?.startsWith("src/plugins/_");
        return Object.values(Plugins).filter(p => !isNightcordPlugin(p.name) && !isCorePlugin(p.name)).length;
    }, []);

    // Category-aware stats for the "ENABLED PLUGINS" card: reflects whichever tab
    // (NIGHTCORD / OTHERS / all) is currently selected, instead of always being global.
    const categoryStats = useMemo(() => {
        const isApiPlugin = (plugin: string) => plugin.endsWith("API") || Plugins[plugin]?.required;
        const isNightcordPlugin = (p: string) => PluginMeta[p]?.folderName?.startsWith("src/nightcordplugins/") && !PluginMeta[p]?.userPlugin && !(Plugins[p] as any)?.isUserPlugin;
        const isUserPlugin = (p: string) => PluginMeta[p]?.userPlugin === true || (Plugins[p] as any)?.isUserPlugin;

        let plugins = Object.keys(Plugins).filter(p => !isApiPlugin(p) && !Plugins[p]?.hidden);

        if (searchValue.status === SearchStatus.NIGHTCORD) {
            plugins = plugins.filter(isNightcordPlugin);
        } else if (searchValue.status === SearchStatus.OTHERS) {
            plugins = plugins.filter(p => !isNightcordPlugin(p) && !isUserPlugin(p));
        } else if (searchValue.status === SearchStatus.USER_PLUGINS) {
            plugins = plugins.filter(isUserPlugin);
        } else if (searchValue.status === SearchStatus.LIKED_PLUGINS) {
            plugins = plugins.filter(p => isNightcordPlugin(p) && ratings[p]?.likedByMe);
        }

        const total = plugins.length;
        const enabled = plugins.filter(p => isPluginEnabled(p)).length;
        return { total, enabled };
    }, [settings.plugins, searchValue.status, ratings]);

    const percent = categoryStats.total > 0 ? Math.round((categoryStats.enabled / categoryStats.total) * 100) : 0;
    const strokeDashoffset = 62.83 - (62.83 * percent / 100);

    return (
        <SettingsTab>
            <div className="vc-plugins-full-width-container">
                {!premiumOnly && (
                    <div className={cl("ecosystem-banner")}>
                        <div className={cl("ecosystem-banner-text")}>
                            <HeadingTertiary>{t("Plugin Ecosystem Management")}</HeadingTertiary>
                            <Paragraph>{t("Manage your LumenCord and community plugins here. Enable, disable, and configure them to your liking.")}</Paragraph>
                            <button
                                type="button"
                                className={cl("reset-btn")}
                                onClick={() => openWarningModal(null, undefined, false, enabledPlugins.length, resetCheckAndDo)}
                            >
                                {t("RESET")}
                            </button>
                        </div>

                        <div className={cl("ecosystem-banner-buttons")}>
                            {!isLikeLoggedIn && (
                                <Button
                                    variant="primary"
                                    size="small"
                                    disabled={likeLoginLoading}
                                    onClick={handleLikeLogin}
                                >
                                    {t("Log in to like")}
                                </Button>
                            )}
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => openResetDefaultsModal(applyDefaultConfigCheckAndDo)}
                            >
                                {t("APPLY DEFAULT CONFIG")}
                            </Button>
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => openApplyBasicConfigModal(applyBasicConfigCheckAndDo)}
                            >
                                {t("APPLY BASIC CONFIG")}
                            </Button>
                        </div>


                    </div>
                )}

                {!premiumOnly && (
                    <div className={cl("stats-banner")}>
                        <div className={cl("stat-item")}>
                            <div className={cl("stat-title")}>{t("TOTAL PLUGINS")}</div>
                            <div className={cl("stat-value")}>{totalStockPlugins + totalUserPlugins}</div>
                        </div>
                        <div 
                            className={cl("stat-item")}
                            style={{ cursor: "pointer", transition: "0.2s" }}
                            onClick={() => onStatusChange(SearchStatus.ENABLED)}
                            title={t("Click to view enabled plugins")}
                        >
                            <div className={cl("stat-title")}>{t("ENABLED PLUGINS")}</div>
                            <div className={cl("stat-value")}>
                                {categoryStats.enabled} <span className={cl("stat-percent")}>({percent}%)</span>
                                <div className={cl("stat-chart")}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: "rotate(-90deg)" }}>
                                        <circle cx="12" cy="12" r="10" fill="transparent" stroke="var(--background-modifier-active)" strokeWidth="4" />
                                        <circle cx="12" cy="12" r="10" fill="transparent" stroke="var(--text-link)" strokeWidth="4" strokeDasharray="62.83" strokeDashoffset={strokeDashoffset} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div 
                            className={cl("stat-item")} 
                            style={searchValue.status === SearchStatus.USER_PLUGINS ? { cursor: "pointer", transition: "0.2s" } : {}}
                            onClick={() => {
                                if (searchValue.status !== SearchStatus.USER_PLUGINS) return;
                                openUserPluginsFolder();
                            }}
                            title={searchValue.status === SearchStatus.USER_PLUGINS ? t("Click to open folder") : ""}
                        >
                            <div className={cl("stat-title")}>
                                {searchValue.status === SearchStatus.USER_PLUGINS ? t("USER PLUGINS") : 
                                 searchValue.status === SearchStatus.OTHERS ? t("VENCORD & EQUICORD PLUGINS") : 
                                 searchValue.status === SearchStatus.LIKED_PLUGINS ? t("LIKED PLUGINS") :
                                 searchValue.status === SearchStatus.ENABLED ? t("ALL ENABLED PLUGINS") :
                                 t("LumenCord PLUGINS")}
                            </div>
                            <div className={cl("stat-value")}>
                                {searchValue.status === SearchStatus.USER_PLUGINS ? totalUserPlugins : 
                                 searchValue.status === SearchStatus.OTHERS ? totalOtherPlugins : 
                                 searchValue.status === SearchStatus.LIKED_PLUGINS ? categoryStats.total :
                                 searchValue.status === SearchStatus.ENABLED ? categoryStats.enabled :
                                 totalNightcordPlugins}
                            </div>
                        </div>
                    </div>
                )}

                <div className={classes(Margins.bottom20, cl("filter-controls"))}>
                    <ErrorBoundary noop>
                        <TextInput autoFocus value={searchInput} placeholder={t("Find a plugin, tag, or author...")} onChange={onSearch} />
                    </ErrorBoundary>
                    <div className={cl("filter-buttons")} style={{ minWidth: 220 }}>
                        <SafeSearchableSelect
                            options={makeCategoryOptions(totalOtherPlugins)}
                            value={makeCategoryOptions(totalOtherPlugins).find(o => o.value === searchValue.status)?.value ?? SearchStatus.NIGHTCORD}
                            onChange={(v: any) => {
                                if (v === "community") return;
                                onStatusChange(v);
                            }}
                            closeOnSelect={true}
                            renderOptionPrefix={(o: any) => {
                                if (o?.value === SearchStatus.NIGHTCORD) return <NightcordTabIcon />;
                                if (o?.value === SearchStatus.OTHERS) return <VencordEquicordTabIcon />;
                                if (o?.value === SearchStatus.ENABLED) return <EnabledPluginsTabIcon />;
                                if (o?.value === SearchStatus.USER_PLUGINS) return <UserPluginsTabIcon />;
                                if (o?.value === SearchStatus.LIKED_PLUGINS) return <LikedPluginsTabIcon />;
                                return null;
                            }}
                        />
                    </div>
                </div>

            {premiumOnly ? (
                <>
                    <HeadingTertiary className={Margins.top20}>Premium Plugins</HeadingTertiary>
                    {nightcordData.length || othersData.length
                        ? (
                            <div className={cl("grid")}>
                                {[...nightcordPlugins, ...othersVisible].length
                                    ? [...nightcordPlugins, ...othersVisible]
                                    : <Paragraph>{t("No plugins meet the search criteria.")}</Paragraph>
                                }
                            </div>
                        )
                        : <ExcludedPluginsList search={search} />
                    }
                </>
            ) : (
                <>
                    {nightcordData.length > 0 && searchValue.status === SearchStatus.NIGHTCORD && (
                        <div className={cl("grid")}>
                            {nightcordPlugins}
                        </div>
                    )}
                    


                    {othersData.length > 0 && searchValue.status === SearchStatus.OTHERS && (
                        <div className={cl("grid")}>
                            {othersVisible}
                        </div>
                    )}

                    {searchValue.status === SearchStatus.USER_PLUGINS && (
                        <>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, padding: "8px 0" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <UserPluginsTabIcon />
                                    <span style={{ color: "var(--header-primary)", fontWeight: 600, fontSize: 15 }}>
                                        {t("User Plugins — Local Folder")}
                                    </span>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        onClick={() => openUserPluginsFolder()}
                                    >
                                        {t("Open Folder")}
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="primary"
                                        onClick={async () => {
                                            await syncAllUserPlugins();
                                            showToast(t("User plugins reloaded"), Toasts.Type.SUCCESS);
                                        }}
                                    >
                                        {t("Reload Plugins")}
                                    </Button>
                                </div>
                            </div>
                            <div style={{
                                background: "rgba(88, 101, 242, 0.08)",
                                border: "1px solid rgba(88, 101, 242, 0.25)",
                                borderRadius: 8,
                                padding: "12px 16px",
                                marginBottom: 16,
                                fontSize: 13,
                                color: "var(--text-normal)",
                                display: "flex",
                                alignItems: "center",
                                gap: 12
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: "var(--brand-500)" }}>
                                    <path fill="currentColor" fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 5a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 7Zm1 10h-2v-6h2v6Z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    {t("Dynamic UserPlugin Engine: Drop any .tsx, .ts, or .js plugin into your local folder. LumenCord compiles and loads them automatically in real-time without client rebuilds.")}
                                </div>
                            </div>
                            {nightcordPlugins.length > 0 || othersVisible.length > 0 ? (
                                <div className={cl("grid")}>
                                    {[...nightcordPlugins, ...othersVisible]}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
                                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ color: "var(--interactive-normal)" }}>
                                            <path fill="currentColor" d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                                        </svg>
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: "var(--header-primary)" }}>{t("No user plugins found")}</div>
                                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                                        {t("Add .tsx, .ts, or .js files to your")} <code style={{ background: "var(--background-secondary)", padding: "2px 6px", borderRadius: 4, color: "var(--header-secondary)" }}>Documents/Nightcord/userplugins/</code> {t("folder. They will be compiled and loaded automatically.")}
                                    </div>
                                    <Button
                                        size={Button.Sizes.MEDIUM}
                                        color={Button.Colors.BRAND}
                                        onClick={() => openUserPluginsFolder()}
                                    >
                                        {t("Open Folder")}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}

                    {(searchValue.status !== SearchStatus.NIGHTCORD && searchValue.status !== SearchStatus.OTHERS && searchValue.status !== SearchStatus.USER_PLUGINS) && (
                        <div className={cl("grid")}>
                            {nightcordPlugins}
                            {othersVisible}
                        </div>
                    )}

                    {nightcordData.length === 0 && othersData.length === 0 && searchValue.status === SearchStatus.LIKED_PLUGINS && (
                        <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto" }}>
                                    <path fill="currentColor" fillRule="evenodd" d="M12 8.07 10.6 6.7A5 5 0 0 0 6.75 5 3.75 3.75 0 0 0 3 8.75c0 2.32 1.59 4.76 3.87 6.96A31.87 31.87 0 0 0 12 19.67c1.2-.74 3.26-2.14 5.13-3.96 2.28-2.2 3.87-4.64 3.87-6.96A3.75 3.75 0 0 0 17.25 5a5 5 0 0 0-3.85 1.69L12 8.07Zm0-2.8A6.98 6.98 0 0 0 6.75 3 5.75 5.75 0 0 0 1 8.75c0 6.34 8.42 11.73 10.53 12.98.29.17.65.17.94 0C14.57 20.48 23 15.09 23 8.75A5.75 5.75 0 0 0 17.25 3c-2.34 0-3.88.9-5.25 2.26Z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{t("No liked plugins yet")}</div>
                            <div style={{ fontSize: 13 }}>{t("Like a LumenCord plugin from its card to see it here.")}</div>
                        </div>
                    )}

                    {nightcordData.length === 0 && othersData.length === 0 && searchValue.status === SearchStatus.ENABLED && !search.length && (
                        <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
                            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ color: "var(--interactive-normal)" }}>
                                    <path fill="currentColor" fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm4.53 8.28a.75.75 0 0 0-1.06-1.06L10.5 14.19l-1.97-1.97a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5.5-5.5Z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, color: "var(--header-primary)" }}>{t("No enabled plugins")}</div>
                            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("Enable any plugin to see it listed here.")}</div>
                        </div>
                    )}

                    {nightcordData.length === 0 && othersData.length === 0 && searchValue.status !== SearchStatus.USER_PLUGINS && searchValue.status !== SearchStatus.LIKED_PLUGINS && !(searchValue.status === SearchStatus.ENABLED && !search.length) && (
                        <ExcludedPluginsList search={search} />
                    )}

                    {/* Sentinel: only rendered when there are more items to load */}
                    {hasMore && (
                        <div
                            ref={sentinelRef}
                            style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}
                        >
                            {t("Loading more plugins…")}
                        </div>
                    )}
                </>
            )}

            {!premiumOnly && requiredPlugins.length > 0 && (
                <>
                    <Divider className={Margins.top20} />

                    <HeadingTertiary className={classes(Margins.top20, Margins.bottom8)}>
                        {t("Required Plugins")}
                    </HeadingTertiary>
                    <div className={cl("grid")}>
                        {requiredPlugins.length
                            ? requiredPlugins
                            : <Paragraph>{t("No plugins meet the search criteria.")}</Paragraph>
                        }
                    </div>
                </>
            )}
            </div>
        </SettingsTab>
    );
}

export function PluginDependencyList({ deps }: { deps: string[]; }) {
    return (
        <>
            <Paragraph>{t("This plugin is required by:")}</Paragraph>
            {deps.map((dep: string) => <Paragraph key={dep} className={cl("dep-text")}>{dep}</Paragraph>)}
        </>
    );
}
