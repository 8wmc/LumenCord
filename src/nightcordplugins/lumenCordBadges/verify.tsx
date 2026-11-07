/*
 * LumenCord, a Discord client mod
 * Copyright (c) 2026 8wmc and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openModal } from "@utils/modal";
import { OAuth2AuthorizeModal, showToast, Toasts, UserStore } from "@webpack/common";

import { finishVerify, logger, ping } from "./api";
import { CLIENT_ID, REDIRECT_URI } from "./defs";

/**
 * Opens Discord's own "Authorize" popup. Discord confirms who you are and the
 * badge server gives LumenCord a private login. Your Discord password and token
 * are never seen or stored.
 */
export function openVerifyModal(onDone?: (ok: boolean) => void) {
    openModal((props: any) => (
        <OAuth2AuthorizeModal
            {...props}
            scopes={["identify"]}
            responseType="code"
            redirectUri={REDIRECT_URI}
            permissions={0n}
            clientId={CLIENT_ID}
            cancelCompletesFlow={false}
            callback={async ({ location }: { location?: string; }) => {
                if (!location) {
                    logger.error("No redirect location returned");
                    onDone?.(false);
                    return;
                }

                const auth = await finishVerify(location);
                const me = UserStore.getCurrentUser();

                if (auth && me && auth.id === me.id) {
                    await ping(me.id, me.username, (me as any).globalName || me.username);
                    showToast("Verified! Your LumenCord badges are on.", Toasts.Type.SUCCESS);
                    onDone?.(true);
                } else {
                    showToast("Couldn't verify with Discord. Please try again.", Toasts.Type.FAILURE);
                    onDone?.(false);
                }
            }}
        />
    ));
}
