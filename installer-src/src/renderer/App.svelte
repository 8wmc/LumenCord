<script>
    import "focus-visible";

    // import Page from "./containers/Page.svelte";
    import Titlebar from "./common/Titlebar.svelte";
    import Footer from "./common/Footer.svelte";
    import Router from "svelte-spa-router";
    import routes from "./routes";
</script>

<div class="main-window platform-{process.platform || "win32"}">
    <Titlebar macButtons={process.platform === "darwin"} />
    <main class="installer-body">
        <div class="sections">
            <Router {routes} />
        </div>
        <Footer />
    </main>
</div>

<style>
    :global([data-focus-visible-added]) {
        box-shadow: 0 0 0 4px var(--accent-faded) !important;
    }

    :root {

        /* LumenCord palette: deep purple / navy with a violet glow */
        --bg1: #07051a;
        --bg2: #0d0a24;
        --bg2-alt: #140e33;
        --bg3: rgba(124, 92, 255, 0.08);
        --bg3-alt: rgba(124, 92, 255, 0.14);
        --bg4: #241a55;
        --surface-border: rgba(167, 139, 250, 0.16);
        --surface-border-strong: rgba(192, 132, 252, 0.45);

        /* Text Colors */
        --text-light: #f6f2ff;
        --text-normal: #d6cff5;
        --text-muted: #9c94c4;
        --text-link: #c4b5fd;

        /* Accent colors */
        --accent: #8b5cf6;
        --accent-2: #c026d3;
        --accent-hover: #7c3aed;
        --accent-faded: rgba(139, 92, 246, 0.4);
        --accent-gradient: linear-gradient(135deg, #7c3aed 0%, #a855f7 55%, #d946ef 100%);
        --accent-glow: 0 0 18px rgba(168, 85, 247, 0.45);

        /* Danger colors */
        --danger: #c13a3a;
        --danger-hover: #992e2e;
        --danger-faded: rgb(193, 58, 58, 0.4);
    }

    :global(html),
    :global(body),
    :global(#app) {
        overflow: hidden;
        margin: 0;
        height: 100%;
        width: 100%;
    }

    :global(*),
    :global(*::after),
    :global(*::before) {
        box-sizing: border-box;
        -webkit-user-drag: none;
        font-family: "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
        user-select: none;
        outline: none;
    }

    :global(a) {
        color: var(--accent);
        text-decoration: none;
    }

    :global(::selection) {
        background-color: var(--accent-faded);
        color: var(--text-normal);
    }

    :global(::-webkit-scrollbar) {
        width: 4px;
        height: 4px;
    }

    :global(::-webkit-scrollbar-thumb) {
        background-color: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
    }

    :global(::-webkit-scrollbar-thumb:hover) {
        background-color: rgba(255, 255, 255, 0.075);
    }

    :global(::-webkit-scrollbar-thumb:active) {
        background-color: rgba(255, 255, 255, 0.1);
    }

    :global(::-webkit-scrollbar-corner) {
        display: none;
    }

    .main-window {
        display: flex;
        flex-direction: column;
        /* border-radius: 3px; */
        overflow: hidden;
        contain: strict;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
        /* margin: 11.5px 7.5px; */
        width: 100%;
        height: 100%;
        word-break: break-word;
    }

    .main-window.platform-darwin {
        border-radius: 0;
        box-shadow: none;
        width: 100%;
        height: 100%;
        margin: 0;
    }

    .installer-body {
        overflow: hidden;
        position: relative;
        display: flex;
        flex-direction: column;
        z-index: 1;
        padding: 20px;
        background:
            radial-gradient(120% 70% at 85% 115%, rgba(124, 58, 237, 0.38) 0%, rgba(124, 58, 237, 0) 60%),
            radial-gradient(90% 60% at 0% 110%, rgba(192, 38, 211, 0.22) 0%, rgba(192, 38, 211, 0) 55%),
            radial-gradient(70% 55% at 50% -10%, rgba(139, 92, 246, 0.18) 0%, rgba(139, 92, 246, 0) 70%),
            linear-gradient(180deg, var(--bg2) 0%, var(--bg1) 100%);
        flex: 1;
    }

    /* Soft wave along the bottom, echoing the logo */
    .installer-body::before {
        content: "";
        position: absolute;
        left: -10%;
        right: -10%;
        bottom: -60px;
        height: 120px;
        border-radius: 50%;
        border-top: 1px solid rgba(192, 132, 252, 0.18);
        background: linear-gradient(180deg, rgba(124, 58, 237, 0.10), rgba(124, 58, 237, 0));
        pointer-events: none;
        z-index: 0;
    }

    :global(.page) {
        flex: 1 1 auto;
        overflow: visible;
        display: flex;
        flex-direction: column;
        position: absolute;
        width: 100%;
        height: 100%;
    }

    .sections {
        flex: 1 1 auto;
        overflow: visible;
        position: relative;
        z-index: 1;
    }
</style>