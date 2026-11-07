<script>
    import page from "../transitions/page.js";
    import PageHeader from "../common/PageHeader.svelte";
    import {canGoBack, canGoForward, nextPage} from "../stores/navigation";
    import {OWNER_CARD} from "../common/brand.js";

    canGoBack.set(true);
    canGoForward.set(true);
    nextPage.set("/actions");

    // Same number as the title bar (set by the build), shown short: "V2"
    const {remote} = require("electron");
    const fullVersion = String(remote.app.getVersion() || "");
    const version = fullVersion ? `V${fullVersion.split(".")[0]}` : "";
</script>

<section class="page" in:page out:page="{{out: true}}">
    <PageHeader>
        <svg slot="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path d="M12 2.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.5l-5.4 2.9 1-6.1L3.2 9l6.1-.9L12 2.5z"/>
        </svg>
        Credits
    </PageHeader>

    <div class="credits">
        <img class="card" src={OWNER_CARD} alt="LumenCord owner card: 8wmc" draggable="false" />

        <p class="made">
            LumenCord was built with a lot of time and effort by <b class="name">8wmc</b>.
        </p>
        <p class="thanks">Thank you for using it. It's free, and it always will be.</p>

        <div class="version">
            <span class="label">Version</span>
            <span class="value">{version || "V2"}</span>
        </div>
    </div>
</section>

<style>
    .credits {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 8px;
        padding-bottom: 6px;
    }

    .card {
        width: 300px;
        max-width: 100%;
        height: auto;
        filter: drop-shadow(0 6px 22px rgba(124, 58, 237, 0.45));
        margin-bottom: 4px;
    }

    .made {
        margin: 0;
        color: var(--text-light);
        font-size: 15px;
    }

    .name {
        background: var(--accent-gradient);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    .thanks {
        margin: 0;
        color: var(--text-normal);
        font-size: 13px;
    }

    .version {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 6px;
        padding: 5px 12px;
        border-radius: 999px;
        background: var(--bg3-alt);
        border: 1px solid var(--surface-border-strong);
        font-size: 12px;
    }

    .label {
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-size: 10px;
    }

    .value {
        color: var(--text-light);
        font-weight: 600;
    }

</style>
