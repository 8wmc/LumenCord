<script>
    import page from "../transitions/page.js";
    import {canGoBack, canGoForward, nextPage, hasLoaded} from "../stores/navigation";
    import {onMount} from "svelte";
    import {LOGO} from "../common/brand.js";

    onMount(() => {
        hasLoaded.set(true); // avoids the first-load slide caused by the router
    });

    canGoBack.set(false);
    canGoForward.set(true);
    nextPage.set("/license");
</script>

<section class="page welcome" in:page="{{duration: $hasLoaded ? undefined : 0}}" out:page="{{out: true}}">
    <div class="logo-wrap">
        <div class="halo"></div>
        <img class="logo" src={LOGO} alt="LumenCord logo" draggable="false" />
    </div>
    <h1 class="title">Welcome to <span class="brand">LumenCord</span></h1>
    <p class="tagline">A brighter Discord. Plugins, themes and badges, all in one.</p>
    <ul class="points">
        <li><span class="dot"></span>Hundreds of plugins, ready to switch on</li>
        <li><span class="dot"></span>The LumenCord theme built in (turn it off anytime)</li>
        <li><span class="dot"></span>LumenCord badges that level up the longer you use it</li>
    </ul>
    <p class="hint">Click <b>Next</b> to get started.</p>
</section>

<style>
    .welcome {
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 6px;
    }

    .logo-wrap {
        position: relative;
        width: 118px;
        height: 118px;
        margin-bottom: 8px;
    }

    .halo {
        position: absolute;
        top: -22px;
        right: -22px;
        bottom: -22px;
        left: -22px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(192, 132, 252, 0.45) 0%, rgba(124, 58, 237, 0.18) 45%, rgba(124, 58, 237, 0) 70%);
        animation: pulse 3.2s ease-in-out infinite;
    }

    .logo {
        position: relative;
        width: 118px;
        height: 118px;
        border-radius: 28px;
        filter: drop-shadow(0 0 14px rgba(168, 85, 247, 0.6));
        animation: float 5s ease-in-out infinite;
    }

    .title {
        margin: 4px 0 0;
        font-size: 26px;
        font-weight: 700;
        color: var(--text-light);
        letter-spacing: 0.2px;
    }

    .brand {
        background: var(--accent-gradient);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        filter: drop-shadow(0 0 10px rgba(192, 132, 252, 0.45));
    }

    .tagline {
        margin: 0 0 10px;
        color: var(--text-normal);
        font-size: 14px;
    }

    .points {
        list-style: none;
        margin: 0;
        padding: 12px 18px;
        text-align: left;
        border-radius: 10px;
        background: var(--bg3);
        border: 1px solid var(--surface-border);
    }

    .points li {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--text-normal);
        font-size: 13px;
        padding: 3px 0;
    }

    .dot {
        flex: 0 0 auto;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--accent-gradient);
        box-shadow: var(--accent-glow);
    }

    .hint {
        margin: 12px 0 0;
        color: var(--text-muted);
        font-size: 12px;
    }

    @keyframes pulse {
        0%, 100% { opacity: 0.65; transform: scale(0.96); }
        50% { opacity: 1; transform: scale(1.04); }
    }

    @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
    }
</style>
