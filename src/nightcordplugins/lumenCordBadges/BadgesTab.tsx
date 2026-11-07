/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { Margins } from "@utils/margins";
import { useForceUpdater } from "@utils/react";
import { Alerts, React, showToast, Toasts, UserStore } from "@webpack/common";

import { forgetMe, getAuth, getEntry, isAuthFor, onBadgesChange, prefetch, reportGame } from "./api";
import { formatAge, GAME_STAGES, iconFor, MANUAL_BADGES, MEMBER_STAGES, nextStage, Stage, stageFor } from "./defs";
import { resync } from "./index";
import { PRIVACY_TEXT } from "./privacy";
import { settings } from "./settings";
import { openVerifyModal } from "./verify";


const GRID: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10 };
const CELL: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", width: 84, textAlign: "center", gap: 4 };
const ICON: React.CSSProperties = { width: 40, height: 40, borderRadius: "50%" };
const LABEL: React.CSSProperties = { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.2 };
const ROW: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12 };

function BadgeCell({ src, name, sub }: { src: string; name: string; sub?: string; }) {
    return (
        <div style={CELL} title={sub ? `${name} · ${sub}` : name}>
            <img src={src} alt={name} style={ICON} />
            <span style={{ ...LABEL, color: "var(--text-normal)" }}>{name}</span>
            {sub && <span style={LABEL}>{sub}</span>}
        </div>
    );
}

function stageWhen(stage: Stage, kind: "member" | "game") {
    const mins = Math.round(stage.at / 60000);
    if (kind === "game") return mins < 60 ? `${mins}m` : `${mins / 60}h`;
    const days = Math.round(mins / 1440);
    return days === 0 ? "Day 1" : days === 1 ? "1 day" : `${days} days`;
}

function BadgesTab() {
    const update = useForceUpdater();
    React.useEffect(() => onBadgesChange(update), []);

    const me = UserStore.getCurrentUser();
    const auth = getAuth();
    const verified = !!me && isAuthFor(me.id);
    const { shareBadges, pauseBadges } = settings.use(["shareBadges", "pauseBadges"]);

    if (me) prefetch(me.id);
    const entry = me ? getEntry(me.id) : undefined;
    const age = entry?.firstSeen ? Date.now() - entry.firstSeen : null;
    const current = age != null ? stageFor(MEMBER_STAGES, age) : null;
    const next = age != null ? nextStage(MEMBER_STAGES, age) : null;

    async function onPause(value: boolean) {
        if (value) {
            // clear the live game badge before going quiet
            if (me && isAuthFor(me.id)) await reportGame(me.id, null);
            settings.store.pauseBadges = true;
            showToast("Badges paused. Your progress is kept.", Toasts.Type.SUCCESS);
        } else {
            settings.store.pauseBadges = false;
            resync();
        }
    }

    function onToggle(value: boolean) {
        if (value) {
            settings.store.shareBadges = true;
            resync();
            return;
        }
        Alerts.show({
            title: "Turn off LumenCord badges?",
            body: "Your member stage, game badges and everything the badge server knows about you will be deleted. If you turn badges back on later, your member stage starts again from Day 1.",
            confirmText: "Turn off and delete",
            cancelText: "Keep badges",
            onConfirm: async () => {
                settings.store.shareBadges = false;
                if (getAuth()) {
                    const ok = await forgetMe();
                    showToast(ok ? "Done. Your badge data was deleted." : "Badges are off, but the server couldn't be reached. Try again later to delete your data.", ok ? Toasts.Type.SUCCESS : Toasts.Type.FAILURE);
                } else {
                    showToast("Badges are off.", Toasts.Type.SUCCESS);
                }
                update();
            },
        });
    }

    return (
        <SettingsTab>
            <Heading>LumenCord Badges</Heading>
            <Paragraph className={Margins.bottom16}>
                Badges that only LumenCord users can see: staff and hand-out badges, a member stage that levels up over your first year, and a live badge for how long you've been playing a game.
            </Paragraph>

            <Notice.Info className={Margins.bottom16}>
                <b>What LumenCord stores and why:</b> {PRIVACY_TEXT}
            </Notice.Info>

            <FormSwitch
                title="Pause my badges"
                description="Stops updating your badges for now (no game badges) and keeps all your progress. Your member stage still shows on your profile."
                value={pauseBadges}
                disabled={!shareBadges}
                onChange={onPause}
            />
            <FormSwitch
                title="Share my LumenCord badges"
                description="Turn this off to delete your badge data from the server. If you turn it back on later, your member stage starts again from Day 1."
                value={shareBadges}
                onChange={onToggle}
            />

            <div className={Margins.top8} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--background-secondary, rgba(0,0,0,.2))" }}>
                <Paragraph><b>Want to fully disconnect?</b> Turn off "Share my LumenCord badges" above, then in Discord go to <b>Settings</b> → <b>Authorized Apps</b>, find <b>LumenCord</b>, and click <b>Deauthorize</b>.</Paragraph>
            </div>

            <Heading className={Margins.top20}>Your status</Heading>
            {!shareBadges ? (
                <Paragraph className={Margins.bottom16}>Badges are off. Turn the switch above on to start earning them again.</Paragraph>
            ) : verified ? (
                <>
                    <Paragraph className={Margins.bottom8}>✅ Verified with Discord.{pauseBadges ? " ⏸ Badges are paused." : ""}</Paragraph>
                    {current ? (
                        <div style={{ ...ROW, marginBottom: 16 }}>
                            <img src={current.icon} alt={current.name} style={{ ...ICON, width: 56, height: 56 }} />
                            <div>
                                <Paragraph><b>{current.name}</b> · stage {current.index + 1} of {MEMBER_STAGES.length}</Paragraph>
                                <Paragraph>LumenCord member for {formatAge(age!)}</Paragraph>
                                {next
                                    ? <Paragraph>Next: <b>{next.name}</b> in {formatAge(Math.max(0, next.at - age!))}</Paragraph>
                                    : <Paragraph>You've reached the final stage. Legend!</Paragraph>}
                            </div>
                        </div>
                    ) : (
                        <Paragraph className={Margins.bottom16}>{entry === undefined ? "Loading your stage…" : "Your stage will show up in a minute."}</Paragraph>
                    )}
                    <Button size="small" variant="secondary" onClick={() => openVerifyModal(() => { resync(); update(); })}>
                        Verify again
                    </Button>
                </>
            ) : (
                <>
                    <Notice.Warning className={Margins.bottom8}>
                        {auth ? "You're verified as a different Discord account. Verify again with this one." : "You're not verified yet. Verify with Discord so the badge server knows this is really your account."}
                    </Notice.Warning>
                    <Paragraph className={Margins.bottom8}>
                        This only asks Discord for your user ID and username. LumenCord never sees your password or your Discord token.
                    </Paragraph>
                    <Button variant="primary" onClick={() => openVerifyModal(() => { resync(); update(); })}>
                        Verify with Discord
                    </Button>
                </>
            )}

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Staff badges</Heading>
            <div style={GRID} className={Margins.bottom16}>
                {MANUAL_BADGES.filter(b => b.staff).map(b => <BadgeCell key={b.id} src={iconFor(b.id)} name={b.name} />)}
            </div>

            <Heading>Hand-out badges</Heading>
            <Paragraph className={Margins.bottom8}>Given out by the LumenCord team.</Paragraph>
            <div style={GRID} className={Margins.bottom16}>
                {MANUAL_BADGES.filter(b => !b.staff).map(b => <BadgeCell key={b.id} src={iconFor(b.id)} name={b.name} />)}
            </div>

            <Heading>Game session stages</Heading>
            <Paragraph className={Margins.bottom8}>Shows while you play any game. After you stop, a "Last session" badge stays until you start a different game.</Paragraph>
            <div style={GRID} className={Margins.bottom16}>
                {GAME_STAGES.map(s => <BadgeCell key={s.index} src={s.icon} name={s.name} sub={stageWhen(s, "game")} />)}
            </div>

            <Heading>Member stages</Heading>
            <Paragraph className={Margins.bottom8}>Levels up automatically over your first year, fast at the start.</Paragraph>
            <div style={GRID} className={Margins.bottom16}>
                {MEMBER_STAGES.map(s => (
                    <div key={s.index} style={{ opacity: current && s.index > current.index ? 0.45 : 1 }}>
                        <BadgeCell src={s.icon} name={s.name} sub={stageWhen(s, "member")} />
                    </div>
                ))}
            </div>
        </SettingsTab>
    );
}

export default wrapTab(BadgesTab, "LumenCord Badges");
