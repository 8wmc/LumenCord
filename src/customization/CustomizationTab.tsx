/*
 * Nightcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@api/i18n";
import { FormSwitch } from "@components/FormSwitch";
import { Button, React, useEffect, useState } from "@webpack/common";
import { FavSongsSettingsSection } from "./components/FavSongsSettingsSection";
import { ProfileEffectsSettingsSection } from "./components/ProfileEffectsSettingsSection";
import { StoriesSettingsSection } from "./components/StoriesSettingsSection";
import {
    getCachedPremiumSettings,
    getPremiumSettings,
    setPremiumSettings
} from "./sync";
import type { NightcordPremiumSettings } from "./types";

const CameraIcon = () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
    </svg>
);

const MusicIcon = () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
);

const SparklesIcon = () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8 }}>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
);

type ActiveTab = "stories" | "songs" | "effects";

export function CustomizationTab() {
    const [settings, setSettings] = useState<NightcordPremiumSettings>(getCachedPremiumSettings);
    const [activeTab, setActiveTab] = useState<ActiveTab>("stories");

    useEffect(() => {
        void getPremiumSettings().then(setSettings);
    }, []);

    const updateSt = async (patch: Partial<NightcordPremiumSettings>) => {
        const next = await setPremiumSettings({ ...patch, enabled: true });
        setSettings(next);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "8px 0 32px 0" }}>
            {/* Header */}
            <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--header-primary, #ffffff)", margin: "0 0 6px 0" }}>
                    {t("Customization")}
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-muted, #949ba4)", margin: 0, lineHeight: 1.5 }}>
                    {t("Customize your profile and presence on LumenCord with exclusive options: Stories, Favorite Music Player, and Animated Visual Effects.")}
                </p>
            </div>

            {/* LumenCord: no cloud server, so customization is saved on this computer only */}
            <div style={{
                background: "var(--background-secondary, #2b2d31)",
                border: "1px solid rgba(167, 139, 250, 0.35)",
                borderRadius: 8,
                padding: "14px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 4
            }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--header-primary, #ffffff)" }}>
                    {t("Saved on this computer")}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted, #949ba4)", lineHeight: 1.45 }}>
                    {t("Your stories, songs and profile effects are stored locally and show for you. LumenCord has no cloud server, so other people won't see them, and nothing is uploaded anywhere.")}
                </div>
            </div>

            {/* The 3 Options Overview Cards */}
            <div style={{
                background: "var(--background-secondary, #2b2d31)",
                padding: "16px 20px",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))"
            }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--header-secondary, #b5bac1)" }}>
                    {t("Customization Options")}
                </div>

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 16
                }}>
                    {/* Option 1: Stories */}
                    <div style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        padding: "14px 16px",
                        borderRadius: 8,
                        border: activeTab === "stories" ? "1px solid var(--brand-500, #5865f2)" : "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: 12
                    }}>
                        <FormSwitch
                            title={t("Stories")}
                            description={t("Avatar borders and Story tab on Discord profiles.")}
                            value={settings.storiesEnabled}
                            onChange={(v: boolean) => updateSt({ storiesEnabled: v })}
                            hideBorder
                        />
                        <Button
                            color={activeTab === "stories" ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                            size={Button.Sizes.SMALL}
                            onClick={() => setActiveTab("stories")}
                        >
                            <CameraIcon />
                            {t("Manage Stories")}
                        </Button>
                    </div>

                    {/* Option 2: Musiques Favorites */}
                    <div style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        padding: "14px 16px",
                        borderRadius: 8,
                        border: activeTab === "songs" ? "1px solid var(--brand-500, #5865f2)" : "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: 12
                    }}>
                        <FormSwitch
                            title={t("Favorite Musics")}
                            description={t("Song tab on profile with interactive SoundCord player.")}
                            value={settings.favSongsEnabled}
                            onChange={(v: boolean) => updateSt({ favSongsEnabled: v })}
                            hideBorder
                        />
                        <Button
                            color={activeTab === "songs" ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                            size={Button.Sizes.SMALL}
                            onClick={() => setActiveTab("songs")}
                        >
                            <MusicIcon />
                            {t("Manage Musics")}
                        </Button>
                    </div>

                    {/* Option 3: Effets de Profil */}
                    <div style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        padding: "14px 16px",
                        borderRadius: 8,
                        border: activeTab === "effects" ? "1px solid var(--brand-500, #5865f2)" : "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: 12
                    }}>
                        <FormSwitch
                            title={t("Profile Effects")}
                            description={t("Custom username text effects (glow, glitch, typewriter, rainbow).")}
                            value={settings.profileEffectsEnabled}
                            onChange={(v: boolean) => updateSt({ profileEffectsEnabled: v })}
                            hideBorder
                        />
                        <Button
                            color={activeTab === "effects" ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                            size={Button.Sizes.SMALL}
                            onClick={() => setActiveTab("effects")}
                        >
                            <SparklesIcon />
                            {t("Manage Effects")}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Active Selected Option View */}
            <div>
                {activeTab === "stories" && <StoriesSettingsSection />}
                {activeTab === "songs" && <FavSongsSettingsSection />}
                {activeTab === "effects" && <ProfileEffectsSettingsSection />}
            </div>
        </div>
    );
}
