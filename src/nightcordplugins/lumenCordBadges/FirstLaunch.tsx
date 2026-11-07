/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Margins } from "@utils/margins";
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { React } from "@webpack/common";

import { GAME_STAGES, iconFor, MANUAL_BADGES, MEMBER_STAGES } from "./defs";
import { PRIVACY_TEXT } from "./privacy";
import { openVerifyModal } from "./verify";

const PREVIEW: React.CSSProperties = { display: "flex", justifyContent: "center", gap: 10, margin: "4px 0 14px" };
const ICON: React.CSSProperties = { width: 44, height: 44, borderRadius: "50%", filter: "drop-shadow(0 0 8px rgba(168,85,247,.55))" };
const BOX: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 8,
    background: "var(--background-secondary, rgba(0,0,0,.2))",
    border: "1px solid var(--background-modifier-accent, rgba(255,255,255,.08))",
};
const STEPS: React.CSSProperties = { margin: "6px 0 0", paddingLeft: 20, lineHeight: 1.5 };

/** Steps for turning badges off later. Shared with the Settings page. */
export function TurnOffSteps() {
    return (
        <ol style={STEPS}>
            <li>Open <b>Settings</b> (the cog next to your name).</li>
            <li>Click <b>LumenCord Badges</b> on the left.</li>
            <li>Turn on <b>Pause my badges</b> to stop them for now, or turn off <b>Share my LumenCord badges</b> to delete your data.</li>
            <li>To fully disconnect, also go to Discord <b>Settings</b> → <b>Authorized Apps</b>, find <b>LumenCord</b>, and click <b>Deauthorize</b>.</li>
        </ol>
    );
}

function FirstLaunchModal({ modalProps, onVerified }: { modalProps: ModalProps; onVerified(): void; }) {
    const preview = [iconFor("friend"), MEMBER_STAGES[0].icon, MEMBER_STAGES[15].icon, GAME_STAGES[2].icon, MEMBER_STAGES[49].icon];

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Heading tag="h2" style={{ margin: 0 }}>Turn on LumenCord badges?</Heading>
            </ModalHeader>
            <ModalContent>
                <div style={PREVIEW}>
                    {preview.map((src, i) => <img key={i} src={src} alt="" style={ICON} />)}
                </div>
                <Paragraph className={Margins.bottom8}>
                    Earn badges that only LumenCord users can see: a member stage that levels up over your first year
                    ({MEMBER_STAGES.length} stages), live game-session badges, and {MANUAL_BADGES.length} special badges from the team.
                </Paragraph>
                <Paragraph className={Margins.bottom8}>
                    To start, verify with Discord. This only shares your user ID and username. LumenCord never sees your password or token.
                </Paragraph>
                <div style={BOX} className={Margins.bottom8}>
                    <Paragraph><b>What LumenCord stores and why:</b> {PRIVACY_TEXT}</Paragraph>
                </div>
                <div style={BOX} className={Margins.bottom16}>
                    <Paragraph><b>Changed your mind later?</b></Paragraph>
                    <TurnOffSteps />
                </div>
            </ModalContent>
            <ModalFooter>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
                    <Button variant="secondary" onClick={modalProps.onClose}>No thanks</Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            modalProps.onClose();
                            openVerifyModal(ok => { if (ok) onVerified(); });
                        }}
                    >
                        Verify with Discord
                    </Button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}

export function openFirstLaunchPopup(onVerified: () => void) {
    openModal(props => <FirstLaunchModal modalProps={props} onVerified={onVerified} />);
}
