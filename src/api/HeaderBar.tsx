/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { Logger } from "@utils/Logger";
import { classes } from "@utils/misc";
import { findComponentByCodeLazy, findCssClassesLazy } from "@webpack";
import { Clickable, Tooltip, useEffect, useState, Popout, useRef, showToast, Toasts, React } from "@webpack/common";
import type { ComponentType, JSX, MouseEventHandler, ReactNode } from "react";
import { Settings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
let _HeaderPluginContext: React.Context<string | null> | null = null;
export function getHeaderPluginContext() {
    if (!_HeaderPluginContext && React?.createContext) {
        _HeaderPluginContext = React.createContext<string | null>(null);
    }
    return _HeaderPluginContext;
}

function openHeaderPluginSettingsModal(id?: string | null) {
    if (!id) return;
    try {
        const { openPluginModal } = require("@components/settings/tabs/plugins/PluginModal");
        const pluginModule = require("~plugins");
        const allPlugins = pluginModule.default ?? pluginModule;
        const plugin =
            allPlugins[id] ??
            allPlugins[id.toLowerCase()] ??
            allPlugins[id.charAt(0).toUpperCase() + id.slice(1)] ??
            Object.values(allPlugins).find((p: any) => p?.name?.toLowerCase() === id.toLowerCase());
        if (plugin) {
            openPluginModal(plugin);
        }
    } catch (e) {
        console.error("Failed to open header plugin settings modal:", e);
    }
}

const NIGHTCORD_LOGO_URI = "data:image/png;base64,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";

const logger = new Logger("HeaderBarAPI");

const HeaderBarClasses = findCssClassesLazy("clickable", "selected", "badge", "badgeContainer");
const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_TOP:", '"aria-haspopup":') as ComponentType<ChannelToolbarButtonProps>;

export interface HeaderBarButtonProps {
    icon: ComponentType<any>;
    tooltip: ReactNode;
    onClick?: MouseEventHandler<HTMLDivElement>;
    onContextMenu?: MouseEventHandler<HTMLDivElement>;
    className?: string;
    iconSize?: number;
    position?: "top" | "bottom" | "left" | "right";
    selected?: boolean;
    "aria-label"?: string;
}

export interface ChannelToolbarButtonProps extends HeaderBarButtonProps {
    iconClassName?: string;
    position?: "top" | "bottom" | "left" | "right";
    selected?: boolean;
    disabled?: boolean;
    showBadge?: boolean;
    badgePosition?: "top" | "bottom";
}

export type HeaderBarButtonFactory = () => JSX.Element | null;

export interface HeaderBarButtonData {
    render: HeaderBarButtonFactory;
    icon: ComponentType<any>;
    priority?: number;
    location?: "headerbar" | "channeltoolbar";
}

interface ButtonEntry {
    render: HeaderBarButtonFactory;
    priority: number;
}

export function HeaderBarButton(props: HeaderBarButtonProps & { ref?: React.RefObject<any>; }) {
    const {
        icon: Icon,
        tooltip,
        onClick,
        onContextMenu,
        className,
        iconSize = 18,
        position = "bottom",
        selected,
        ref,
        "aria-label": ariaLabel,
    } = props;

    const HeaderPluginContext = getHeaderPluginContext();
    const pluginKey = HeaderPluginContext ? React.useContext(HeaderPluginContext) : null;
    const label = ariaLabel ?? (typeof tooltip === "string" ? tooltip : undefined);

    if (!Tooltip || !Clickable || !Icon) {
        return null;
    }

    const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
        if (onContextMenu) {
            onContextMenu(e);
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (!e.defaultPrevented && pluginKey) {
            e.preventDefault();
            openHeaderPluginSettingsModal(pluginKey);
        }
    };

    return (
        <Tooltip text={tooltip ?? ""} position={position} shouldShow={tooltip != null}>
            {({ onMouseEnter, onMouseLeave }) => (
                <Clickable
                    {...{ innerRef: ref } as any}
                    className={classes(HeaderBarClasses.clickable, "nightcord-header-btn", className)}
                    style={{ justifyContent: "center", cursor: "pointer" }}
                    onClick={onClick}
                    onContextMenu={handleContextMenu}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    aria-expanded={selected}
                >
                    <Icon width={iconSize} height={iconSize} color="currentColor" />
                </Clickable>
            )}
        </Tooltip>
    );
}

export function ChannelToolbarButton(props: ChannelToolbarButtonProps) {
    return <HeaderBarIcon {...props} />;
}

const headerBarButtons = new Map<string, ButtonEntry>();
const channelToolbarButtons = new Map<string, ButtonEntry>();

const headerBarListeners = new Set<() => void>();
const channelToolbarListeners = new Set<() => void>();

export function addHeaderBarButton(id: string, render: HeaderBarButtonFactory, priority = 0) {
    headerBarButtons.set(id, { render, priority });
    headerBarListeners.forEach(listener => listener());
}

export function removeHeaderBarButton(id: string) {
    headerBarButtons.delete(id);
    headerBarListeners.forEach(listener => listener());
}

export function addChannelToolbarButton(id: string, render: HeaderBarButtonFactory, priority = 0) {
    channelToolbarButtons.set(id, { render, priority });
    channelToolbarListeners.forEach(listener => listener());
}

export function removeChannelToolbarButton(id: string) {
    channelToolbarButtons.delete(id);
    channelToolbarListeners.forEach(listener => listener());
}

// ══════════════════════════════════════════════════════════════════
// STEALTH MODE
// ══════════════════════════════════════════════════════════════════

import { isStealthModeEnabled, setStealthActive } from "./stealthState";
export { isStealthModeEnabled };

let _stealthActive = isStealthModeEnabled();

function persistStealth(v: boolean) {
    try { v ? localStorage.setItem("Nightcord_stealthMode", "1") : localStorage.removeItem("Nightcord_stealthMode"); } catch { }
}

const NON_REACT_SELECTORS = [
    "#nightcord-titlebar-btn",
    "#nightcord-titlebar-link-style",
    ".nai-nav-item",
];

function hideSettingsSidebarElements(hide: boolean) {
    try {
        // Direct modern Discord settings sidebar targeting
        document.querySelectorAll('li:has([data-settings-sidebar-item*="equicord"]), li:has([data-settings-sidebar-item*="nightcord"]), li:has([data-settings-sidebar-item*="illegalcord"]), li:has([data-list-item-id*="settings-sidebar___equicord"]), li:has([data-list-item-id*="settings-sidebar___nightcord"]), li:has([data-list-item-id*="settings-sidebar___illegalcord"])').forEach(el => {
            (el as HTMLElement).style.display = hide ? "none" : "";
        });

        document.querySelectorAll('[data-settings-sidebar-item*="equicord"], [data-settings-sidebar-item*="nightcord"], [data-settings-sidebar-item*="illegalcord"], [data-list-item-id*="settings-sidebar___equicord"], [data-list-item-id*="settings-sidebar___nightcord"], [data-list-item-id*="settings-sidebar___illegalcord"]').forEach(el => {
            (el as HTMLElement).style.display = hide ? "none" : "";
        });

        // Sidebar headers and sections fallback
        const sidebars = document.querySelectorAll("[class*='sidebar_'], [class*='side_'], [role='tablist'], [class*='sectionList_']");
        sidebars.forEach(sidebar => {
            const items = Array.from(sidebar.querySelectorAll("[class*='item_'], [class*='header_'], [class*='separator_'], [class*='sectionLabel_'], [role='tab']"));
            let isNightcordSection = false;
            for (const el of items) {
                const text = el.textContent?.trim()?.toLowerCase() || "";
                const isHeader = el.getAttribute("class")?.includes("header") || el.getAttribute("class")?.includes("sectionLabel") || el.getAttribute("role") === "heading";
                const isSeparator = el.getAttribute("class")?.includes("separator");

                if (text.includes("nightcord settings") || text.includes("paramètres de nightcord") || text.includes("equicord settings") || text.includes("parametres de nightcord")) {
                    isNightcordSection = true;
                    (el as HTMLElement).style.display = hide ? "none" : "";
                    const parentLi = el.closest("li, [class*='section_']");
                    if (parentLi) (parentLi as HTMLElement).style.display = hide ? "none" : "";
                    continue;
                }

                if (isNightcordSection) {
                    if (isHeader) {
                        isNightcordSection = false;
                        continue;
                    }
                    if (isSeparator) {
                        (el as HTMLElement).style.display = hide ? "none" : "";
                        isNightcordSection = false;
                        continue;
                    }
                    (el as HTMLElement).style.display = hide ? "none" : "";
                }
            }
        });
    } catch { }
}

function hideNonReactElements(hide: boolean) {
    for (const sel of NON_REACT_SELECTORS) {
        try {
            document.querySelectorAll(sel).forEach(el => {
                (el as HTMLElement).style.display = hide ? "none" : "";
            });
        } catch { }
    }
    hideSettingsSidebarElements(hide);
}

export function syncStealthBodyClass() {
    try { if (_stealthActive) document.body?.classList.add("nightcord-stealth"); else document.body?.classList.remove("nightcord-stealth"); } catch { }
    hideNonReactElements(_stealthActive);
}

export function toggleStealthMode() {
    _stealthActive = !_stealthActive;
    setStealthActive(_stealthActive);
    persistStealth(_stealthActive);
    hideNonReactElements(_stealthActive);
    _notifyStealthChange();
    try {
        if (_stealthActive) {
            document.body?.classList.add("nightcord-stealth");
            showNotification({
                id: "nightcord-stealth-mode",
                title: "Stealth Mode Activated",
                body: "All LumenCord visual elements and settings are hidden. Press Ctrl+Shift+H to restore LumenCord.",
                icon: "nightcord",
                type: "info",
                duration: 6000
            });
        } else {
            document.body?.classList.remove("nightcord-stealth");
            showNotification({
                id: "nightcord-stealth-mode",
                title: "Stealth Mode Deactivated",
                body: "LumenCord visual elements and settings have been restored.",
                icon: "nightcord",
                type: "success",
                duration: 4000
            });
        }
    } catch { }
    return _stealthActive;
}

if (_stealthActive) {
    try { hideNonReactElements(true); } catch { }
    try { document.body?.classList.add("nightcord-stealth"); } catch { }
}

try {
    document.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyH") {
            e.preventDefault();
            e.stopPropagation();
            toggleStealthMode();
        }
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyG") {
            e.preventDefault();
            e.stopPropagation();
            const newVal = !Settings.streamProof;
            Settings.streamProof = newVal;
            if (typeof window !== "undefined" && (window as any).VencordNative?.setContentProtection) {
                (window as any).VencordNative.setContentProtection(newVal);
            }
            try {
                if (newVal) {
                    showNotification({
                        id: "nightcord-streamproof-mode",
                        title: "StreamProof Activated",
                        body: "Window content protection is enabled. Press Ctrl+Shift+G to disable.",
                        icon: "nightcord",
                        type: "info",
                        duration: 6000
                    });
                } else {
                    showNotification({
                        id: "nightcord-streamproof-mode",
                        title: "StreamProof Deactivated",
                        body: "Window content protection is now disabled.",
                        icon: "nightcord",
                        type: "success",
                        duration: 4000
                    });
                }
            } catch {}
        }
    }, true);
} catch { }

try {
    let stealthObserver: MutationObserver | null = null;
    let stealthRaf: number | null = null;
    const startObserver = () => {
        if (stealthObserver) return;
        stealthObserver = new MutationObserver(() => {
            if (!_stealthActive) return;
            if (stealthRaf !== null) return;
            stealthRaf = requestAnimationFrame(() => {
                stealthRaf = null;
                if (_stealthActive) hideNonReactElements(true);
            });
        });
        const target = document.body || document.documentElement;
        if (target) {
            stealthObserver.observe(target, { childList: true, subtree: true });
        }
    };
    const stopObserver = () => {
        if (stealthRaf !== null) {
            cancelAnimationFrame(stealthRaf);
            stealthRaf = null;
        }
        if (stealthObserver) { stealthObserver.disconnect(); stealthObserver = null; }
    };
    if (_stealthActive) {
        if (document.body) startObserver();
        else document.addEventListener("DOMContentLoaded", startObserver);
    }
    window.addEventListener("nightcord-stealth-change", () => {
        if (_stealthActive) startObserver();
        else stopObserver();
    });
} catch { }

const stealthListeners = new Set<() => void>();
export function _notifyStealthChange() {
    stealthListeners.forEach(fn => fn());
    window.dispatchEvent(new Event("nightcord-stealth-change"));
}
export function addStealthListener(fn: () => void) { stealthListeners.add(fn); }
export function removeStealthListener(fn: () => void) { stealthListeners.delete(fn); }


// ══════════════════════════════════════════════════════════════════
// COMPACT MODE
// ══════════════════════════════════════════════════════════════════

function readPersistedCompact(): boolean {
    try {
        const fromSettings = (Settings?.plugins as Record<string, { active?: boolean; }> | undefined)?.CompactMode?.active;
        if (typeof fromSettings === "boolean") return fromSettings;
    } catch { }
    try { return localStorage.getItem("Nightcord_compactMode") === "1"; } catch { }
    return false;
}

let _compactActive = false;
try { _compactActive = readPersistedCompact(); } catch { }

export function isCompactModeEnabled(): boolean {
    return _compactActive;
}

function persistCompact(v: boolean) {
    try { v ? localStorage.setItem("Nightcord_compactMode", "1") : localStorage.removeItem("Nightcord_compactMode"); } catch { }
    try {
        const plugins = Settings?.plugins as Record<string, { active?: boolean; }> | undefined;
        if (plugins?.CompactMode) plugins.CompactMode.active = v;
    } catch { }
}

export function syncCompactBodyClass() {
    _compactActive = readPersistedCompact();
    persistCompact(_compactActive);

    try {
        if (_compactActive) {
            document.body?.classList.add("nightcord-compact");
        } else {
            document.body?.classList.remove("nightcord-compact");
        }
    } catch { }

    _notifyCompactChange();
}

export function toggleCompactMode() {
    _compactActive = !_compactActive;
    persistCompact(_compactActive);
    _notifyCompactChange();
    try { if (_compactActive) document.body?.classList.add("nightcord-compact"); else document.body?.classList.remove("nightcord-compact"); } catch { }
    return _compactActive;
}

if (_compactActive) {
    try { document.body?.classList.add("nightcord-compact"); } catch { }
}

export const compactListeners = new Set<() => void>();
export function _notifyCompactChange() {
    compactListeners.forEach(fn => fn());
    window.dispatchEvent(new Event("nightcord-compact-change"));
}
export function addCompactListener(fn: () => void) { compactListeners.add(fn); }
export function removeCompactListener(fn: () => void) { compactListeners.delete(fn); }

// ══════════════════════════════════════════════════════════════════
// ICONS
// ══════════════════════════════════════════════════════════════════

const GridVerticalIcon = (props: any) => (
    <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill={props.color || "currentColor"} {...props}>
        <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />
    </svg>
);

const GearIcon = (props: any) => (
    <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill={props.color || "currentColor"} {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d="M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 2.88 0c.46-.06.7-.54.64-.99-.18-1.16.19-2.2.98-2.53.8-.33 1.79.14 2.49 1.1.27.36.78.52 1.14.24.77-.59 1.45-1.27 2.04-2.04.28-.36.12-.87-.24-1.14-.96-.7-1.43-1.7-1.1-2.49.33-.8 1.37-1.16 2.53-.98.45.07.93-.18.99-.64a11.1 11.1 0 0 0 0-2.88c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
    </svg>
);

// ══════════════════════════════════════════════════════════════════
// COMPACT POPOUTS
// ══════════════════════════════════════════════════════════════════

function CompactHeaderPopout({ type, closePopout }: { type: "header" | "channel", closePopout: () => void; }) {
    const map = type === "header" ? headerBarButtons : channelToolbarButtons;
    return (
        <div className="compact-popout-container">
            <div className="compact-popout-grid">
                {Array.from(map)
                    .sort(([, a], [, b]) => a.priority - b.priority)
                    .map(([id, { render: Button }]) => (
                        <div key={id} style={{ display: "contents" }} onClick={closePopout}>
                            <ErrorBoundary noop>
                                <Button />
                            </ErrorBoundary>
                        </div>
                    ))}
            </div>
            <div className="compact-popout-divider" />
            <div className="compact-popout-disable" onClick={() => { toggleCompactMode(); closePopout(); }}>
                Disable Compact Mode
            </div>
        </div>
    );
}

function CompactSettingsPopout({ closePopout }: { closePopout: () => void; }) {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        compactListeners.add(listener);
        stealthListeners.add(listener);
        window.addEventListener("nightcord-compact-change", listener);
        window.addEventListener("nightcord-stealth-change", listener);
        return () => {
            compactListeners.delete(listener);
            stealthListeners.delete(listener);
            window.removeEventListener("nightcord-compact-change", listener);
            window.removeEventListener("nightcord-stealth-change", listener);
        };
    }, []);

    const compact = isCompactModeEnabled();
    const stealth = isStealthModeEnabled();

    return (
        <div className="nc-settings-popout">
            <div className="nc-settings-popout-title">Quick Settings</div>

            <div className="nc-settings-popout-section-label">Appearance</div>

            <div className="nc-settings-popout-row" onClick={() => toggleCompactMode()}>
                <div className="nc-settings-popout-row-info">
                    <div className="nc-settings-popout-row-name">Compact Mode</div>
                    <div className="nc-settings-popout-row-desc">Hide plugin buttons behind a single icon</div>
                </div>
                <div className={`nc-settings-popout-toggle ${compact ? "nc-on" : ""}`} onClick={e => { e.stopPropagation(); toggleCompactMode(); }}>
                    <div className="nc-settings-popout-toggle-knob" />
                </div>
            </div>

            <div className="nc-settings-popout-row" onClick={() => toggleStealthMode()}>
                <div className="nc-settings-popout-row-info">
                    <div className="nc-settings-popout-row-name">Stealth Mode</div>
                    <div className="nc-settings-popout-row-desc">Hide all LumenCord UI elements</div>
                </div>
                <div className={`nc-settings-popout-toggle ${stealth ? "nc-on" : ""}`} onClick={e => { e.stopPropagation(); toggleStealthMode(); }}>
                    <div className="nc-settings-popout-toggle-knob" />
                </div>
            </div>

            <div className="nc-settings-popout-divider" />

            <div className="nc-settings-popout-section-label">Plugin Buttons</div>
            <div className="nc-settings-popout-grid">
                {Array.from(headerBarButtons)
                    .sort(([, a], [, b]) => a.priority - b.priority)
                    .map(([id, { render: Button }]) => {
                        const HeaderPluginContext = getHeaderPluginContext();
                        const content = (
                            <ErrorBoundary noop>
                                <Button />
                            </ErrorBoundary>
                        );
                        return (
                            <div
                                key={id}
                                style={{ display: "contents" }}
                                onContextMenu={e => {
                                    if (e.defaultPrevented) return;
                                    e.preventDefault();
                                    openHeaderPluginSettingsModal(id);
                                }}
                            >
                                {HeaderPluginContext ? (
                                    <HeaderPluginContext.Provider value={id}>
                                        {content}
                                    </HeaderPluginContext.Provider>
                                ) : (
                                    content
                                )}
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// TOGGLE COMPONENTS
// ══════════════════════════════════════════════════════════════════

function CompactHeaderBarToggle() {
    const [, forceUpdate] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const popoutRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        compactListeners.add(listener);
        window.addEventListener("nightcord-compact-change", listener);
        return () => {
            compactListeners.delete(listener);
            window.removeEventListener("nightcord-compact-change", listener);
        };
    }, []);

    return (
        <div style={{ display: "flex", alignItems: "center" }}>
            <Popout
                targetElementRef={popoutRef}
                renderPopout={() => <CompactHeaderPopout type="header" closePopout={() => setIsOpen(false)} />}
                shouldShow={isOpen}
                onRequestClose={() => setIsOpen(false)}
                position="bottom"
                align="right"
                spacing={8}
            >
                {() => (
                    <div ref={popoutRef as any} style={{ display: "flex" }}>
                        <HeaderBarButton
                            icon={GridVerticalIcon}
                            tooltip="Compact Mode"
                            onClick={() => setIsOpen(v => !v)}
                            selected={isOpen}
                        />
                    </div>
                )}
            </Popout>
        </div>
    );
}

function CompactChannelToolbarToggle() {
    const [, forceUpdate] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const popoutRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        compactListeners.add(listener);
        window.addEventListener("nightcord-compact-change", listener);
        return () => {
            compactListeners.delete(listener);
            window.removeEventListener("nightcord-compact-change", listener);
        };
    }, []);

    return (
        <Popout
            targetElementRef={popoutRef}
            renderPopout={() => <CompactHeaderPopout type="channel" closePopout={() => setIsOpen(false)} />}
            shouldShow={isOpen}
            onRequestClose={() => setIsOpen(false)}
            position="bottom"
            align="right"
            spacing={8}
        >
            {() => (
                <div ref={popoutRef as any} style={{ display: "flex" }}>
                    <ChannelToolbarButton
                        icon={GridVerticalIcon}
                        tooltip="Compact Mode"
                        onClick={() => setIsOpen(v => !v)}
                        selected={isOpen}
                    />
                </div>
            )}
        </Popout>
    );
}

// ══════════════════════════════════════════════════════════════════
// MAIN RENDER COMPONENTS
// ══════════════════════════════════════════════════════════════════

function HeaderBarButtons() {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        headerBarListeners.add(listener);
        stealthListeners.add(listener);
        compactListeners.add(listener);
        window.addEventListener("nightcord-stealth-change", listener);
        window.addEventListener("nightcord-compact-change", listener);
        return () => {
            headerBarListeners.delete(listener);
            stealthListeners.delete(listener);
            compactListeners.delete(listener);
            window.removeEventListener("nightcord-stealth-change", listener);
            window.removeEventListener("nightcord-compact-change", listener);
        };
    }, []);

    if (isStealthModeEnabled()) return null;

    if (isCompactModeEnabled()) {
        return (
            <div className="vc-header-bar-btns" style={{ display: "contents" }}>
                <CompactHeaderBarToggle />
            </div>
        );
    }

    return (
        <div className="vc-header-bar-btns" style={{ display: "contents" }}>
            <style>{`
                .nightcord-header-btn svg,
                .vc-header-bar-btns svg {
                    transform-origin: 50% 50%;
                    will-change: transform;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                }
                .nightcord-header-btn:hover svg:not(.nc-multi-instance-icon):not(.nc-soundcord-icon):not(.nc-sway-icon):not(.nc-cleaner-icon):not(.nc-no-anim),
                .vc-header-bar-btns [class*="clickable"]:hover svg:not(.nc-multi-instance-icon):not(.nc-soundcord-icon):not(.nc-sway-icon):not(.nc-cleaner-icon):not(.nc-no-anim),
                .vc-header-bar-btns [class*="iconWrapper"]:hover svg:not(.nc-multi-instance-icon):not(.nc-soundcord-icon):not(.nc-sway-icon):not(.nc-cleaner-icon):not(.nc-no-anim) {
                    animation: nc-header-btn-spring 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
                }
                @keyframes nc-header-btn-spring {
                    0% {
                        transform: translate3d(0, 0, 0) scale(1);
                    }
                    35% {
                        transform: translate3d(0, 0, 0) scale(1.18);
                    }
                    70% {
                        transform: translate3d(0, 0, 0) scale(0.96);
                    }
                    100% {
                        transform: translate3d(0, 0, 0) scale(1);
                    }
                }

                /* ── Sway Animations (SoundCord, CustomProfile, VoiceSearch, MessageCleaner) ── */
                .nc-sway-icon,
                .nc-soundcord-icon,
                .nc-cleaner-icon {
                    transform-origin: 50% 90%;
                    will-change: transform;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                }

                :hover > .nc-sway-icon,
                [class*="iconWrapper"]:hover .nc-sway-icon,
                [class*="clickable"]:hover .nc-sway-icon,
                .nightcord-header-btn:hover .nc-sway-icon,
                button:hover .nc-sway-icon,
                .nc-sway-icon:hover,
                :hover > .nc-soundcord-icon,
                [class*="iconWrapper"]:hover .nc-soundcord-icon,
                [class*="clickable"]:hover .nc-soundcord-icon,
                .nightcord-header-btn:hover .nc-soundcord-icon,
                button:hover .nc-soundcord-icon,
                .nc-soundcord-icon:hover,
                :hover > .nc-cleaner-icon,
                [class*="iconWrapper"]:hover .nc-cleaner-icon,
                [class*="clickable"]:hover .nc-cleaner-icon,
                .nightcord-header-btn:hover .nc-cleaner-icon,
                button:hover .nc-cleaner-icon,
                .nc-cleaner-icon:hover {
                    animation: nc-soundcord-sway 0.52s cubic-bezier(0.25, 1, 0.5, 1) 1;
                }

                @keyframes nc-soundcord-sway {
                    0% {
                        transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
                    }
                    22% {
                        transform: translate3d(0, 0, 0) rotate(-16deg) scale(1.12);
                    }
                    48% {
                        transform: translate3d(0, 0, 0) rotate(13deg) scale(1.1);
                    }
                    72% {
                        transform: translate3d(0, 0, 0) rotate(-5deg) scale(1.03);
                    }
                    88% {
                        transform: translate3d(0, 0, 0) rotate(2deg) scale(1.01);
                    }
                    100% {
                        transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
                    }
                }

                /* ── MessageCleaner Jumping Trash Lid Animation ── */
                .nc-trash-lid {
                    transform-origin: 50% 25%;
                    will-change: transform;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                }

                :hover > .nc-cleaner-icon .nc-trash-lid,
                [class*="iconWrapper"]:hover .nc-cleaner-icon .nc-trash-lid,
                [class*="clickable"]:hover .nc-cleaner-icon .nc-trash-lid,
                .nightcord-header-btn:hover .nc-cleaner-icon .nc-trash-lid,
                button:hover .nc-cleaner-icon .nc-trash-lid,
                .nc-cleaner-icon:hover .nc-trash-lid {
                    animation: nc-trash-lid-jump 0.52s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
                }

                @keyframes nc-trash-lid-jump {
                    0% {
                        transform: translate3d(0, 0, 0) rotate(0deg);
                    }
                    25% {
                        transform: translate3d(1px, -4.5px, 0) rotate(-14deg);
                    }
                    55% {
                        transform: translate3d(-0.5px, -3px, 0) rotate(8deg);
                    }
                    78% {
                        transform: translate3d(0, -1px, 0) rotate(-2deg);
                    }
                    100% {
                        transform: translate3d(0, 0, 0) rotate(0deg);
                    }
                }

            `}</style>
            {Array.from(headerBarButtons)
                .sort(([, a], [, b]) => a.priority - b.priority)
                .map(([id, entry]) => {
                    const Button = entry?.render;
                    if (!Button) return null;
                    const HeaderPluginContext = getHeaderPluginContext();
                    const content = (
                        <ErrorBoundary noop key={id}>
                            <Button />
                        </ErrorBoundary>
                    );
                    return (
                        <div
                            key={id}
                            style={{ display: "contents" }}
                            onContextMenu={e => {
                                if (e.defaultPrevented) return;
                                e.preventDefault();
                                openHeaderPluginSettingsModal(id);
                            }}
                        >
                            {HeaderPluginContext ? (
                                <HeaderPluginContext.Provider value={id}>
                                    {content}
                                </HeaderPluginContext.Provider>
                            ) : (
                                content
                            )}
                        </div>
                    );
                })}
        </div>
    );
}

function ChannelToolbarButtons() {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        channelToolbarListeners.add(listener);
        stealthListeners.add(listener);
        compactListeners.add(listener);
        window.addEventListener("nightcord-stealth-change", listener);
        window.addEventListener("nightcord-compact-change", listener);
        return () => {
            channelToolbarListeners.delete(listener);
            stealthListeners.delete(listener);
            compactListeners.delete(listener);
            window.removeEventListener("nightcord-stealth-change", listener);
            window.removeEventListener("nightcord-compact-change", listener);
        };
    }, []);

    if (isStealthModeEnabled()) return null;

    if (isCompactModeEnabled()) {
        return (
            <div className="vc-channel-toolbar-btns" style={{ display: "contents" }}>
                <CompactChannelToolbarToggle />
            </div>
        );
    }

    return (
        <div className="vc-channel-toolbar-btns" style={{ display: "contents" }}>
            {Array.from(channelToolbarButtons)
                .sort(([, a], [, b]) => a.priority - b.priority)
                .map(([id, entry]) => {
                    const Button = entry?.render;
                    if (!Button) return null;
                    const HeaderPluginContext = getHeaderPluginContext();
                    const content = (
                        <ErrorBoundary noop key={id}>
                            <Button />
                        </ErrorBoundary>
                    );
                    return (
                        <div
                            key={id}
                            style={{ display: "contents" }}
                            onContextMenu={e => {
                                if (e.defaultPrevented) return;
                                e.preventDefault();
                                openHeaderPluginSettingsModal(id);
                            }}
                        >
                            {HeaderPluginContext ? (
                                <HeaderPluginContext.Provider value={id}>
                                    {content}
                                </HeaderPluginContext.Provider>
                            ) : (
                                content
                            )}
                        </div>
                    );
                })}
        </div>
    );
}

const HEADER_STYLE_ID = "nightcord-headerbar-style";
const HEADER_STYLE_CSS = `
    div[role="button"][aria-label="Boîte de réception"],
    div[role="button"][aria-label="Inbox"],
    div[role="button"][aria-label="Bandeja de entrada"],
    div[role="button"][aria-label="Posteingang"],
    div[role="button"][aria-label="Входящие"],
    div[role="button"][aria-label*="Inbox" i],
    div[role="button"][aria-label*="réception" i],
    .nightcord-header-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        align-self: center !important;
        height: 24px !important;
        min-height: 24px !important;
        max-height: 24px !important;
        width: 24px !important;
        min-width: 24px !important;
        max-width: 24px !important;
        margin: 0 2px !important;
        margin-left: 2px !important;
        margin-right: 2px !important;
        margin-inline: 2px !important;
        padding: 0 !important;
        border-radius: 4px !important;
        box-sizing: border-box !important;
        vertical-align: middle !important;
        line-height: normal !important;
        flex: 0 0 24px !important;
        position: relative !important;
        color: var(--interactive-normal, oklab(0.745437 0.00131872 -0.00849736)) !important;
        transition: background-color 0.15s ease-out, color 0.15s ease-out !important;
    }

    div[role="button"][aria-label="Boîte de réception"]:hover,
    div[role="button"][aria-label="Inbox"]:hover,
    div[role="button"][aria-label="Bandeja de entrada"]:hover,
    div[role="button"][aria-label="Posteingang"]:hover,
    div[role="button"][aria-label="Входящие"]:hover,
    div[role="button"][aria-label*="Inbox" i]:hover,
    div[role="button"][aria-label*="réception" i]:hover,
    .nightcord-header-btn:hover {
        background-color: var(--background-modifier-hover, rgba(78, 80, 88, 0.3)) !important;
        color: var(--interactive-hover, oklab(0.89908 -0.00192902 -0.01033)) !important;
    }

    div[role="button"][aria-label="Boîte de réception"] svg,
    div[role="button"][aria-label="Inbox"] svg,
    div[role="button"][aria-label="Bandeja de entrada"] svg,
    div[role="button"][aria-label="Posteingang"] svg,
    div[role="button"][aria-label="Входящие"] svg,
    div[role="button"][aria-label*="Inbox" i] svg,
    div[role="button"][aria-label*="réception" i] svg,
    .nightcord-header-btn svg {
        width: 18px !important;
        height: 18px !important;
        min-width: 18px !important;
        min-height: 18px !important;
        max-width: 18px !important;
        max-height: 18px !important;
        display: block !important;
        margin: auto !important;
        flex-shrink: 0 !important;
    }
`;

function ensureHeaderStyles() {
    if (typeof document === "undefined") return;
    if (!document.getElementById(HEADER_STYLE_ID)) {
        const style = document.createElement("style");
        style.id = HEADER_STYLE_ID;
        style.textContent = HEADER_STYLE_CSS;
        document.head.appendChild(style);
    }
}
try { ensureHeaderStyles(); } catch {}

/** @internal Injected by HeaderBarAPI patch (do NOT call directly) */
export function _addHeaderBarButtons() {
    ensureHeaderStyles();
    return [
        <HeaderBarButtons key="vc-header-bar-buttons" />
    ];
}

/** @internal Injected by HeaderBarAPI patch (do NOT call directly) */
export function _addChannelToolbarButtons(children: any[]) {
    ensureHeaderStyles();
    children.push(<ChannelToolbarButtons key="vc-channel-toolbar-buttons" />);
}

