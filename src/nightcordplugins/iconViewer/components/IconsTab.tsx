/*
 * Nightcord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { SettingsTab, wrapTab } from "@components/settings";
import { TooltipContainer } from "@components/TooltipContainer";
import { iconsModule } from "@plugins/_core/concatenatedModules";
import { debounce } from "@shared/debounce";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useIntersection } from "@utils/react";
import { findAll } from "@webpack";
import { Clickable, TextInput, useCallback, useEffect, useMemo, useState } from "@webpack/common";

import { IconsDef } from "../types";
import { openIconModal } from "./Modals";

let cachedIcons: IconsDef | null = null;

function collectIcons(source: any, into: IconsDef) {
    if (!source || typeof source !== "object") return;
    for (const name of Object.keys(source)) {
        try {
            const fn = source[name];
            if (typeof fn === "function" && name.endsWith("Icon") && !(name in into)) into[name] = fn;
        } catch { }
    }
}

// LumenCord: never crash the tab. If Discord changed its code and the normal hook missed,
// look through Discord's loaded modules for icon sets instead.
function getIcons(): IconsDef {
    if (cachedIcons && Object.keys(cachedIcons).length) return cachedIcons;

    const icons: IconsDef = {};
    collectIcons(iconsModule, icons);

    if (Object.keys(icons).length < 50) {
        try {
            const isIconSet = (m: any) => {
                if (!m || typeof m !== "object") return false;
                let count = 0;
                for (const key in m) {
                    if (key.endsWith("Icon") && typeof m[key] === "function" && ++count >= 10) return true;
                }
                return false;
            };
            for (const mod of findAll(isIconSet)) collectIcons(mod, icons);
        } catch { }
    }

    cachedIcons = icons;
    return icons;
}

function searchMatch(search: string, name: string, Icon: any, searchByFunction: boolean): boolean {
    if (!search) return true;

    if (searchByFunction) return String(Icon).includes(search);

    const words = name.replace(/([A-Z]([a-z]+)?)/g, " $1").toLowerCase().split(" ");
    const keywords = search.toLowerCase().split(" ");
    return keywords.every(k => words.includes(k)) ||
        words.every(w => keywords.includes(w)) ||
        name.toLowerCase().includes(search.toLowerCase());
}

function IconItem({ iconName, Icon }: { iconName: string; Icon: any; }) {
    const fill = iconName === "CircleShieldIcon" ? "var(--background-base-low)" : "var(--interactive-icon-default)";

    return (
        <div className="vc-icon-box">
            <Clickable onClick={() => openIconModal(iconName, Icon)}>
                <div className="vc-icon-container">
                    <Icon className="vc-icon-icon" size="lg" width={32} height={32} color="var(--interactive-icon-default)" fill={fill} />
                </div>
            </Clickable>
            <Heading className="vc-icon-title" tag="h3">{iconName}</Heading>
        </div>
    );
}

function IconsTab() {
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [searchByFunction, setSearchByFunction] = useState(false);

    const icons = useMemo(() => getIcons(), []);

    const debouncedSetSearch = useMemo(
        () => debounce((query: string) => setSearch(query), 150),
        []
    );

    const onSearch = useCallback((query: string) => {
        setSearchInput(query);
        debouncedSetSearch(query);
    }, [debouncedSetSearch]);

    const filteredIcons = useMemo(() =>
        Object.entries(icons).filter(([name, Icon]) => searchMatch(search, name, Icon, searchByFunction)),
        [icons, search, searchByFunction]
    );

    const iconsToLoad = 120;
    const [visibleCount, setVisibleCount] = useState(iconsToLoad);

    useEffect(() => {
        setVisibleCount(iconsToLoad);
    }, [search, searchByFunction]);

    const loadMore = useCallback(() => {
        setVisibleCount(v => Math.min(v + iconsToLoad, filteredIcons.length));
    }, [filteredIcons.length]);

    const [sentinelRef, isSentinelVisible] = useIntersection();

    useEffect(() => {
        if (isSentinelVisible && visibleCount < filteredIcons.length) {
            loadMore();
        }
    }, [isSentinelVisible, visibleCount, filteredIcons.length, loadMore]);

    const visibleIcons = filteredIcons.slice(0, visibleCount);

    if (!Object.keys(icons).length) {
        return (
            <SettingsTab>
                <Heading className={Margins.top16} tag="h3">Icon Finder</Heading>
                <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5 }}>
                    Discord changed how it stores its icons, so the Icon Finder can't load them in this Discord version.
                    Everything else keeps working. This will be fixed in a future LumenCord update.
                </p>
            </SettingsTab>
        );
    }

    return (
        <SettingsTab>
            <div className={classes(Margins.top16, "vc-icon-tab-search-bar-grid")}>
                <TextInput autoFocus value={searchInput} placeholder={`Search ${Object.keys(icons).length} icons...`} onChange={onSearch} />
                <TooltipContainer text="Search by function context">
                    <Button
                        size="small"
                        aria-label="Search by function context"
                        className="vc-icon-search-func-btn"
                        variant={searchByFunction ? "positive" : "primary"}
                        onClick={() => setSearchByFunction(!searchByFunction)}
                    >
                        Func
                    </Button>
                </TooltipContainer>
            </div>
            <div className="vc-icons-tab-grid-container">
                {visibleIcons.map(([iconName, Icon]) => (
                    <IconItem key={iconName} iconName={iconName} Icon={Icon} />
                ))}
            </div>
            {visibleCount < filteredIcons.length && (
                <div ref={sentinelRef} className="vc-icon-sentinel" />
            )}
        </SettingsTab>
    );
}

export default wrapTab(IconsTab, "Icon Finder");
