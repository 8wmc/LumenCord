<script>
    import {remote} from "electron";
    import quit from "../actions/quit";

    export let macButtons;

    const pkgVersion = remote.app.getVersion();
    const displayVersion = pkgVersion;
    const logo = "data:image/png;base64,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";


    function minimize() {
        remote.BrowserWindow.getFocusedWindow().minimize();
    }
</script>

<header class="titlebar {macButtons === true ? "type-mac" : "type-standard"}">
    <div class="brand">
        <img class="brand-logo" src={logo} alt="" draggable="false" />
        <span class="brand-name">LumenCord</span>
        <span class="brand-sub">Installer v{displayVersion}</span>
    </div>
    <div class="window-controls">
        {#if macButtons === true}
            <button tabindex="-1" on:click={quit} id="close">
                <svg width="12" height="12" viewBox="0 0 12 12">
                    <path stroke="#4c0000" fill="none" d="M8.5,3.5 L6,6 L3.5,3.5 L6,6 L3.5,8.5 L6,6 L8.5,8.5 L6,6 L8.5,3.5 Z"></path>
                </svg>
            </button>
            <button tabindex="-1" on:click={minimize} id="minimize">
                <svg width="12" height="12" viewBox="0 0 12 12">
                    <rect fill="#975500" width="6" height="1" x="3" y="5.5" fill-rule="evenodd"></rect>
                </svg>
            </button>
            <button id="maximize" disabled></button>
        {:else}
            <button tabindex="-1" on:click={minimize} id="minimize">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M2 9.75C2 9.33579 2.33579 9 2.75 9H17.25C17.6642 9 18 9.33579 18 9.75C18 10.1642 17.6642 10.5 17.25 10.5H2.75C2.33579 10.5 2 10.1642 2 9.75Z"/>
                </svg>
            </button>
            <button tabindex="-1" on:click={quit} id="close">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M3.52499 3.71761L3.61612 3.61612C4.07173 3.1605 4.79155 3.13013 5.28239 3.52499L5.38388 3.61612L14 12.233L22.6161 3.61612C23.1043 3.12796 23.8957 3.12796 24.3839 3.61612C24.872 4.10427 24.872 4.89573 24.3839 5.38388L15.767 14L24.3839 22.6161C24.8395 23.0717 24.8699 23.7915 24.475 24.2824L24.3839 24.3839C23.9283 24.8395 23.2085 24.8699 22.7176 24.475L22.6161 24.3839L14 15.767L5.38388 24.3839C4.89573 24.872 4.10427 24.872 3.61612 24.3839C3.12796 23.8957 3.12796 23.1043 3.61612 22.6161L12.233 14L3.61612 5.38388C3.1605 4.92827 3.13013 4.20845 3.52499 3.71761L3.61612 3.61612L3.52499 3.71761Z"/>
                </svg>
            </button>
        {/if}
    </div>
</header>

<style>
    .titlebar {
        background: linear-gradient(90deg, rgba(124, 58, 237, 0.22), rgba(13, 10, 36, 0.95) 45%, var(--bg2));
        border-bottom: 1px solid var(--surface-border);
        color: white;
        height: 32px;
        display: flex;
        align-items: center;
        -webkit-app-region: drag;
    }

    .brand {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-left: 10px;
    }

    .type-mac .brand {
        position: absolute;
        left: 50%;
        transform: translate(-50%, 0);
        padding-left: 0;
    }

    .brand-logo {
        width: 18px;
        height: 18px;
        border-radius: 5px;
        filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.7));
    }

    .brand-name {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.2px;
        background: linear-gradient(90deg, #f5f3ff, #d8b4fe 60%, #e879f9);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    .brand-sub {
        font-size: 11px;
        color: rgba(233, 222, 255, 0.72);
    }

    .window-controls {
        display: flex;
        align-items: center;
        margin-left: auto;
        -webkit-app-region: no-drag;
    }

    .window-controls button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
    }

    /* Standard Titlebar */
    .type-standard button {
        height: 32px;
        width: 40px;
        transition: 50ms ease;
        background-color: transparent;
        color: var(--text-muted);
    }

    .type-standard button svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
    }

    .type-standard button:hover {
        background-color: var(--bg3);
    }

    .type-standard button:active {
        background-color: var(--bg3-alt);
    }

    .type-standard button#close:hover {
        background-color: #d13d3d;
        color: #fff;
    }

    .type-standard button#close:active {
        background-color: #b12a2a;
        color: #fff;
    }

    /* Mac Titlebar */
    .type-mac {
        justify-content: space-between;
    }

    .type-mac .window-controls {
        order: -1;
        margin: 0 3px;
    }

    .type-mac .window-controls button {
        margin: 0 4px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-size: auto 12px;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12);
    }

    .type-mac .window-controls svg {
        visibility: hidden;
        width: 12px;
        height: 12px;
    }

    .type-mac .window-controls:hover svg {
        visibility: visible;
    }

    .type-mac .window-controls button:not([disabled]):active {
        box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12), inset 0 0 0 12px rgba(0,0,0,0.25);
    }

    .type-mac .window-controls #close {
        margin-left: 6px;
        background-color: #ff5e57;
    }

    .type-mac .window-controls #minimize {
        background-color: #ffbb2e;
    }

    .type-mac .window-controls button[disabled] {
        background-color: var(--bg3-alt);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,0.012);
    }
</style>
