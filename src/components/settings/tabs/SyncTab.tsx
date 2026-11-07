import {
    addBadgeVisibilityListener,
    BadgeSource,
    getOwnHiddenBadgeSources,
    removeBadgeVisibilityListener,
    setOwnHiddenBadgeSources,
} from "@api/BadgeVisibility";
import { useSettings } from "@api/Settings";
import { beginDiscordOAuth, checkOAuthToken, clearToken, getStoredToken, storeToken } from "@api/OAuth2";
import { authorizeCloud, deauthorizeCloud } from "@api/SettingsSync/cloudSetup";
import { deleteCloudSettings, eraseAllCloudData, getCloudSettings, putCloudSettings } from "@api/SettingsSync/cloudSync";

import { Button } from "@components/Button";
import { CheckedTextInput } from "@components/CheckedTextInput";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { CloudDownloadIcon, CloudUploadIcon, DeleteIcon } from "@components/Icons";
import { Link } from "@components/Link";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";

import { localStorage } from "@utils/localStorage";
import { Margins } from "@utils/margins";
import { openModal } from "@utils/modal";
import { useForceUpdater } from "@utils/react";
import { findComponentByCodeLazy } from "@webpack";
import { Alerts, React, useState, OAuth2AuthorizeModal } from "@webpack/common";
import { SafeSearchableSelect } from "@components/SafeSearchableSelect";
import { t } from "@api/i18n";
import { ILLEGALCORD_ICON_DATA_URI } from "@api/illegalcord_base64";

const ICON_STYLE: React.CSSProperties = { width: 20, height: 20, borderRadius: 4, verticalAlign: "middle" };
const NIGHTCORD_ICON_STYLE: React.CSSProperties = { width: 20, height: 20, borderRadius: 4, verticalAlign: "middle" };

const NIGHTCORD_ICON_DATA_URI = "data:image/png;base64,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"

function NightcordIcon() {
    return <img src={NIGHTCORD_ICON_DATA_URI} alt="LumenCord" style={NIGHTCORD_ICON_STYLE} />;
}

function EquicordIcon() {
    return <img src="https://equicord.org/assets/favicon.png" alt="Equicord" style={ICON_STYLE} />;
}

function VencordIcon() {
    return <img src="https://equicord.org/assets/icons/vencord/icon-light.png" alt="Vencord" style={ICON_STYLE} />;
}

function GlobalBadgesIcon() {
    return <img src="https://equicord.org/assets/icons/misc/userplugin.png" alt="GlobalBadges" style={ICON_STYLE} />;
}

function IllegalcordIcon() {
    return <img src={ILLEGALCORD_ICON_DATA_URI} alt="Illegalcord" style={ICON_STYLE} />;
}

const RefreshIcon = findComponentByCodeLazy("M4 12a8 8 0 0 1 14.93-4H15");
const TrashIcon = findComponentByCodeLazy("2.81h8.36a3");

function validateUrl(url: string) {
    try {
        new URL(url);
        return true;
    } catch {
        return "Invalid URL";
    }
}

const cloudBackendOptions = [
    { label: "Equicord Cloud", value: "https://cloud.equicord.org/" },
    { label: "Vencord Cloud", value: "https://api.vencord.dev/" }
];

const syncDirectionOptions = [
    { label: "Two-way sync (changes go both directions)", value: "both" },
    { label: "This device is the source (upload only)", value: "push" },
    { label: "The cloud is the source (download only)", value: "pull" },
    { label: "Do not sync automatically (manual sync via buttons below only)", value: "manual" }
];

const BADGE_OPTIONS: Array<{ label: string; value: BadgeSource }> = [
    { label: "LumenCord Badges", value: "nightcord" },
    { label: "Equicord Badges", value: "equicord" },
    { label: "Vencord Badges", value: "vencord" },
    { label: "GlobalBadges", value: "globalbadges" },
    { label: "Illegalcord Badges", value: "illegalcord" },
];

function renderPrefix(option: { value: BadgeSource }) {
    switch (option.value) {
        case "nightcord": return <NightcordIcon />;
        case "equicord": return <EquicordIcon />;
        case "vencord": return <VencordIcon />;
        case "globalbadges": return <GlobalBadgesIcon />;
        case "illegalcord": return <IllegalcordIcon />;
        default: return null;
    }
}

function CustomProfileSyncToggle() {
    const settings = useSettings();
    const [token, setToken] = React.useState<string | null>(null);
    const [checking, setChecking] = React.useState(true);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        let isMounted = true;
        getStoredToken().then(async t => {
            if (!isMounted) return;
            if (t) {
                const check = await checkOAuthToken(t);
                if (!isMounted) return;
                if (check?.valid) {
                    setToken(t);
                    settings.syncOwnCustomProfile = true;
                    settings.seeAllCustomProfile = true;
                } else {
                    await clearToken();
                    if (!isMounted) return;
                    settings.syncOwnCustomProfile = false;
                    settings.seeAllCustomProfile = false;
                }
            } else {
                settings.syncOwnCustomProfile = false;
                settings.seeAllCustomProfile = false;
            }
            setChecking(false);
        });
        return () => { isMounted = false; };
    }, []);

    const isEnabled = !!token;

    async function handleToggle(on: boolean) {
        if (busy) return;
        if (on) {
            setBusy(true);
            let oauthData: { url: string; redirectUri: string; scopes: string[]; clientId?: string; } | null = null;
            try {
                oauthData = await beginDiscordOAuth();
            } catch (e) {
                console.error("[CustomProfileSync] Failed to fetch OAuth config:", e);
                setBusy(false);
                return;
            }
            setBusy(false);

            let clientId = oauthData.clientId;
            if (!clientId) {
                try {
                    clientId = new URL(oauthData.url).searchParams.get("client_id") ?? undefined;
                } catch { }
            }
            if (!clientId) return;

            openModal(oauthProps => <OAuth2AuthorizeModal
                {...oauthProps}
                scopes={oauthData!.scopes}
                responseType="code"
                redirectUri={oauthData!.redirectUri}
                permissions={0n}
                clientId={clientId!}
                cancelCompletesFlow={false}
                callback={async ({ location }: any) => {
                    if (!location) return;
                    try {
                        const res = await fetch(location, { headers: { Accept: "application/json" } });
                        const { token: newToken } = await res.json();
                        if (newToken) {
                            await storeToken(newToken);
                            setToken(newToken);
                            settings.syncOwnCustomProfile = true;
                            settings.seeAllCustomProfile = true;
                        }
                    } catch (e) {
                        console.error("[CustomProfileSync] OAuth callback failed:", e);
                    }
                }}
            />);
        } else {
            setBusy(true);
            await clearToken();
            setToken(null);
            settings.syncOwnCustomProfile = false;
            settings.seeAllCustomProfile = false;
            setBusy(false);
        }
    }

    if (checking) return null;

    return (
        <div style={{ marginBottom: 16 }}>
            <FormSwitch
                value={isEnabled}
                onChange={handleToggle}
                title={t("LumenCord Sync")}
                description={isEnabled
                    ? t("Your custom profile is synced. Other LumenCord users can see your profile, and you can see theirs.")
                    : t("Enable to share your custom profile with other LumenCord users and see their profiles.")}
                disabled={busy}
            />

            {isEnabled && (
                <div style={{ marginTop: 4 }}>
                    <a role="button" onClick={async () => {
                        await clearToken();
                        setToken(null);
                        settings.syncOwnCustomProfile = false;
                        settings.seeAllCustomProfile = false;
                    }} style={{ fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
                        {t("Disconnect account")}
                    </a>
                </div>
            )}
        </div>
    );
}

function CloudIntegrationSection() {
    const settings = useSettings(["cloud.authenticated", "cloud.url", "cloud.settingsSync"]);
    const [inputKey, setInputKey] = useState(0);
    const forceUpdate = useForceUpdater();

    const { cloud } = settings;
    const isAuthenticated = cloud.authenticated;
    const syncEnabled = isAuthenticated && cloud.settingsSync;

    async function changeUrl(url: string) {
        cloud.url = url;
        cloud.authenticated = false;

        await deauthorizeCloud();
        await authorizeCloud();

        setInputKey(prev => prev + 1);
    }

    return (
        <>
            <Heading className={Margins.top16}>{t("Cloud Integration")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Cloud integration lets you sync your settings across devices. It is off unless you turn it on.")}
            </Paragraph>

            <Notice.Info className={Margins.bottom16}>
                {t("LumenCord doesn't run its own cloud server. If you turn this on, your settings are stored by the server you pick below (Equicord's or Vencord's), under their privacy policy.")}
            </Notice.Info>

            <FormSwitch
                title={t("Enable Cloud Integration")}
                description={t("Connect to the cloud backend for settings synchronization. This will request authorization if you haven't set up cloud integration yet.")}
                value={isAuthenticated}
                onChange={v => {
                    if (v)
                        authorizeCloud();
                    else
                        cloud.authenticated = v;
                }}
                hideBorder
            />

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("Cloud Backend")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Choose which cloud backend to use for storing your settings.")}
            </Paragraph>

            <div className={Margins.bottom8}>
                <SafeSearchableSelect
                    options={cloudBackendOptions}
                    value={cloudBackendOptions.find(o => o.value === cloud.url)?.value}
                    onChange={v => changeUrl(v)}
                    closeOnSelect={true}
                    renderOptionPrefix={o => {
                        if (o?.value?.includes("nightcord")) return <NightcordIcon />;
                        if (o?.value?.includes("equicord")) return <EquicordIcon />;
                        return <VencordIcon />;
                    }}
                />
            </div>

            <Flex gap="8px" alignItems="center">
                <div style={{ flex: 1 }}>
                    <CheckedTextInput
                        key={"backendUrl-" + inputKey}
                        value={cloud.url}
                        onChange={async v => {
                            cloud.url = v;
                            cloud.authenticated = false;
                            await deauthorizeCloud();
                        }}
                        validate={validateUrl}
                    />
                </div>
                <Button
                    disabled={!isAuthenticated}
                    onClick={async () => {
                        cloud.authenticated = false;
                        await deauthorizeCloud();
                        await authorizeCloud();
                    }}
                >
                    <Flex gap="8px" alignItems="center">
                        <RefreshIcon color="currentColor" />
                        {t("Reauthorize")}
                    </Flex>
                </Button>
            </Flex>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("Settings Sync")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Synchronize your LumenCord settings to the cloud. This makes it easy to keep your configuration consistent across multiple devices without manual import/export.")}
            </Paragraph>

            <FormSwitch
                title={t("Enable Settings Sync")}
                description={t("When enabled, your settings can be synced to and from the cloud. Use the actions below to manually sync.")}
                value={cloud.settingsSync}
                onChange={v => { cloud.settingsSync = v; }}
                disabled={!isAuthenticated}
                hideBorder
            />

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("Sync Rules for This Device")}</Heading>
            <Paragraph className={Margins.bottom16}>
                <span dangerouslySetInnerHTML={{ __html: t("This setting controls how settings move between <strong>this device</strong> and the cloud. You can let changes flow both ways, or choose one place to be the main source of truth.") }} />
            </Paragraph>

            <SafeSearchableSelect
                options={syncDirectionOptions}
                value={localStorage.Vencord_cloudSyncDirection ?? "both"}
                onChange={v => {
                    localStorage.Vencord_cloudSyncDirection = v;
                    forceUpdate();
                }}
                disabled={!syncEnabled}
                closeOnSelect={true}
            />

            <Flex gap="8px" className={Margins.top16}>
                <Button
                    style={{ flex: 1 }}
                    disabled={!syncEnabled}
                    onClick={() => putCloudSettings(true)}
                >
                    <Flex gap="8px" alignItems="center">
                        <CloudUploadIcon />
                        {t("Sync to Cloud")}
                    </Flex>
                </Button>
                <Button
                    style={{ flex: 1 }}
                    disabled={!syncEnabled}
                    onClick={() => getCloudSettings(true, true)}
                >
                    <Flex gap="8px" alignItems="center">
                        <CloudDownloadIcon />
                        {t("Sync from Cloud")}
                    </Flex>
                </Button>
            </Flex>

            {!isAuthenticated && (
                <Notice.Warning className={Margins.top8}>
                    {t("Enable cloud integration above to use settings sync features.")}
                </Notice.Warning>
            )}

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("Danger Zone")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Permanently delete all your data from the cloud. This action cannot be undone and will remove all synced settings and any other data stored on the cloud backend.")}
            </Paragraph>

            <Flex gap="8px">
                <Button
                    variant="dangerPrimary"
                    size="medium"
                    disabled={!syncEnabled}
                    onClick={() => deleteCloudSettings()}
                >
                    <Flex gap="8px" alignItems="center">
                        <TrashIcon color="currentColor" />
                        {t("Delete Cloud Settings")}
                    </Flex>
                </Button>
                <Button
                    variant="dangerSecondary"
                    size="medium"
                    disabled={!isAuthenticated}
                    onClick={() => Alerts.show({
                        title: t("Delete Cloud Account"),
                        body: t("Are you sure you want to permanently delete your cloud account and all associated data? This action cannot be undone."),
                        onConfirm: eraseAllCloudData,
                        confirmText: t("Delete Cloud Account"),
                        confirmColor: "vc-cloud-erase-data-danger-btn",
                        cancelText: t("Cancel")
                    })}
                >
                    <Flex gap="8px" alignItems="center">
                        <DeleteIcon />
                        {t("Delete Cloud Account")}
                    </Flex>
                </Button>
            </Flex>
        </>
    );
}

function SyncTab() {
    const [hidden, setHidden] = useState<BadgeSource[]>(getOwnHiddenBadgeSources());
    const [saving, setSaving] = useState(false);

    React.useEffect(() => {
        const listener = () => setHidden([...getOwnHiddenBadgeSources()]);
        addBadgeVisibilityListener(listener);
        return () => removeBadgeVisibilityListener(listener);
    }, []);

    async function onChange(next: BadgeSource[]) {
        setHidden(next);
        setSaving(true);
        try {
            await setOwnHiddenBadgeSources(next);
        } finally {
            setSaving(false);
        }
    }

    return (
        <SettingsTab>
            <CustomProfileSyncToggle />

            <Divider className={Margins.bottom16} />

            <CloudIntegrationSection />

            <Divider className={Margins.bottom16} />

            <Heading className={Margins.top16}>{t("Badges")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t("Choose which badge sources to hide on your own profile. Selected sources disappear from your profile for everyone — including yourself — wherever it's viewed.")}
            </Paragraph>

            <Notice.Info className={Margins.bottom16}>
                {t("This only affects your own profile. The first time you select a badge to hide, you'll be asked to sign in with Discord so your preference can be shared with others viewing your profile.")}
            </Notice.Info>

            <Divider className={Margins.bottom16} />

            <Heading className={Margins.bottom8} style={{ fontSize: 14 }}>{t("Hidden Badge Sources")}</Heading>
            <div className={Margins.bottom8}>
                <SafeSearchableSelect
                    multi
                    closeOnSelect={false}
                    options={BADGE_OPTIONS}
                    value={hidden}
                    placeholder={t("None hidden")}
                    onChange={onChange}
                    renderOptionPrefix={renderPrefix}
                />
            </div>

            {saving && (
                <Paragraph className={Margins.top8} style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {t("Saving...")}
                </Paragraph>
            )}
        </SettingsTab>
    );
}

export default wrapTab(SyncTab, "Synchronization");

