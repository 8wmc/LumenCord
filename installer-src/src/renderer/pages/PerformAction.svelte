<script>
    import page from "../transitions/page.js";
    import PageHeader from "../common/PageHeader.svelte";
    import logs from "../stores/logs";
    import install from "../actions/install";
    import repair from "../actions/repair";
    import uninstall from "../actions/uninstall";
    import uninjectThirdParty from "../actions/uninjectThirdParty";
    import debug from "../actions/debug";
    import {startDiscord} from "../actions/utils/kill";
    import {canGoBack, canGoForward, nextPage} from "../stores/navigation";
    import {action, paths, progress, platforms, status} from "../stores/installation";
    import {afterUpdate, onMount} from "svelte";

    const {shell} = require("electron");
    const ISSUES_URL = "https://github.com/8wmc/LumenCord/issues";

    canGoForward.set(false);
    canGoBack.set(false);
    status.set("");
    progress.set(0);

    const currentAction = $action;
    logs.set([]);

    const installPaths = {};
    for (const channel in $paths) {
        if ($platforms[channel]) installPaths[channel] = $paths[channel];
    }

    const ICONS = {
        install: `<path xmlns="http://www.w3.org/2000/svg" d="M18.2498 20.4999C18.664 20.4998 19 20.8355 19 21.2497C19 21.6639 18.6644 21.9998 18.2502 21.9999L5.25022 22.0037C4.836 22.0038 4.5 21.6681 4.5 21.2539C4.5 20.8397 4.83557 20.5038 5.24978 20.5037L18.2498 20.4999ZM11.6482 2.01173L11.75 2.00488C12.1297 2.00488 12.4435 2.28704 12.4932 2.65311L12.5 2.75488L12.499 16.4399L16.2208 12.7196C16.4871 12.4533 16.9038 12.4291 17.1974 12.647L17.2815 12.7197C17.5477 12.986 17.5719 13.4026 17.354 13.6962L17.2814 13.7803L12.2837 18.7769C12.0176 19.043 11.6012 19.0673 11.3076 18.8498L11.2235 18.7772L6.22003 13.7806C5.92694 13.4879 5.92661 13.0131 6.21931 12.72C6.48539 12.4535 6.90204 12.429 7.1958 12.6467L7.27997 12.7192L10.999 16.4329L11 2.75488C11 2.37519 11.2822 2.06139 11.6482 2.01173L11.75 2.00488L11.6482 2.01173Z"/>`,
        repair: `<path d="M10.5001 7.75146C10.5001 4.57583 13.0745 2.00146 16.2501 2.00146C17.196 2.00146 18.0906 2.23045 18.8794 2.63666C19.0924 2.74632 19.2401 2.95107 19.2771 3.18771C19.314 3.42435 19.2358 3.66441 19.0664 3.83377L16.3006 6.59955L17.3613 7.66021L20.1398 4.88166C20.3081 4.71343 20.5461 4.635 20.7814 4.67029C21.0167 4.70557 21.2213 4.85039 21.3327 5.06057C21.759 5.86423 22.0001 6.7808 22.0001 7.75146C22.0001 10.9271 19.4258 13.5015 16.2501 13.5015C15.7895 13.5015 15.3408 13.4472 14.9104 13.3444L7.54552 20.9633C6.42372 22.1237 4.59212 22.2096 3.36665 21.1592C2.03293 20.016 1.93771 17.9855 3.15859 16.7226L10.6339 8.98949C10.5462 8.5902 10.5001 8.17585 10.5001 7.75146ZM16.2501 3.50146C13.9029 3.50146 12.0001 5.40425 12.0001 7.75146C12.0001 8.18343 12.0643 8.59903 12.1832 8.98998C12.2624 9.25056 12.1942 9.53361 12.0049 9.72943L4.23708 17.7651C3.61648 18.4071 3.66488 19.4392 4.34283 20.0203C4.96577 20.5543 5.8968 20.5106 6.46704 19.9207L14.1435 11.9796C14.3435 11.7727 14.6443 11.6985 14.9176 11.7886C15.3358 11.9265 15.7834 12.0015 16.2501 12.0015C18.5973 12.0015 20.5001 10.0987 20.5001 7.75146C20.5001 7.40932 20.4598 7.07709 20.3838 6.75903L17.8916 9.2512C17.5987 9.54409 17.1238 9.54409 16.831 9.2512L14.7096 7.12988C14.4167 6.83699 14.4167 6.36211 14.7096 6.06922L17.1763 3.60252C16.8785 3.53638 16.5686 3.50146 16.2501 3.50146Z"/>`,
        uninstall: `<path xmlns="http://www.w3.org/2000/svg" d="M12 1.75C13.733 1.75 15.1492 3.10645 15.2449 4.81558L15.25 5H20.5C20.9142 5 21.25 5.33579 21.25 5.75C21.25 6.1297 20.9678 6.44349 20.6018 6.49315L20.5 6.5H19.704L18.4239 19.5192C18.2912 20.8683 17.1984 21.91 15.8626 21.9945L15.6871 22H8.31293C6.95734 22 5.81365 21.0145 5.59883 19.6934L5.57614 19.5192L4.295 6.5H3.5C3.1203 6.5 2.80651 6.21785 2.75685 5.85177L2.75 5.75C2.75 5.3703 3.03215 5.05651 3.39823 5.00685L3.5 5H8.75C8.75 3.20507 10.2051 1.75 12 1.75ZM18.197 6.5H5.802L7.06893 19.3724C7.12768 19.9696 7.60033 20.4343 8.18585 20.4936L8.31293 20.5H15.6871C16.2872 20.5 16.7959 20.0751 16.9123 19.4982L16.9311 19.3724L18.197 6.5ZM13.75 9.25C14.1297 9.25 14.4435 9.53215 14.4932 9.89823L14.5 10V17C14.5 17.4142 14.1642 17.75 13.75 17.75C13.3703 17.75 13.0565 17.4678 13.0068 17.1018L13 17V10C13 9.58579 13.3358 9.25 13.75 9.25ZM10.25 9.25C10.6297 9.25 10.9435 9.53215 10.9932 9.89823L11 10V17C11 17.4142 10.6642 17.75 10.25 17.75C9.8703 17.75 9.55651 17.4678 9.50685 17.1018L9.5 17V10C9.5 9.58579 9.83579 9.25 10.25 9.25ZM12 3.25C11.0818 3.25 10.3288 3.95711 10.2558 4.85647L10.25 5H13.75C13.75 4.0335 12.9665 3.25 12 3.25Z"/>`
    };
    const pageIcon = ICONS[currentAction] || ICONS.uninstall;

    // What each action looks like on screen. "at" = progress % where that step is finished.
    const INFO = {
        install: {
            working: "Installing LumenCord",
            done: "LumenCord is installed!",
            doneText: "Discord should open with LumenCord. If it doesn't, open it below.",
            steps: [{name: "Prepare", at: 5}, {name: "Download", at: 75}, {name: "Unpack", at: 90}, {name: "Patch Discord", at: 99}, {name: "Done", at: 100}]
        },
        repair: {
            working: "Repairing LumenCord",
            done: "LumenCord is repaired!",
            doneText: "Everything is patched back in. Open Discord to check it out.",
            steps: [{name: "Close Discord", at: 30}, {name: "Repair files", at: 90}, {name: "Restart", at: 99}, {name: "Done", at: 100}]
        },
        uninstall: {
            working: "Uninstalling LumenCord",
            done: "LumenCord was removed",
            doneText: "Discord is back to normal. You can reinstall LumenCord any time.",
            steps: [{name: "Close Discord", at: 30}, {name: "Remove files", at: 90}, {name: "Restore Discord", at: 99}, {name: "Done", at: 100}]
        },
        uninject_thirdparty: {
            working: "Removing other mods",
            done: "Other mods removed",
            doneText: "Vencord and Equicord are gone. Install LumenCord next if you haven't yet.",
            steps: [{name: "Close Discord", at: 30}, {name: "Remove mods", at: 90}, {name: "Restore Discord", at: 99}, {name: "Done", at: 100}]
        }
    };
    const info = INFO[currentAction] || INFO.install;

    let result = null; // null = running, true = worked, false = failed
    let showLog = true;
    let copied = false;
    let logBox;
    const startedAt = Date.now();
    let seconds = 0;
    const timer = setInterval(() => seconds = Math.round((Date.now() - startedAt) / 1000), 1000);

    $: percent = Math.max(0, Math.min(100, Math.round($progress || 0)));
    $: activeStep = result === true ? info.steps.length : info.steps.findIndex(s => percent < s.at);
    $: detail = typeof $status === "string" && $status && $status !== "success" && $status !== "error" ? $status : "";

    function lineKind(line) {
        if (!line) return "blank";
        if (/❌|\[Error\]|failed/i.test(line)) return "bad";
        if (/⚠️|warning|notice/i.test(line)) return "warn";
        if (/✅|\[Success\]|complete|successful/i.test(line)) return "good";
        if (/^(Starting|Creating|Downloading|Injecting|Extracting|Deleting|Cleaning)\b/.test(line)) return "head";
        return "plain";
    }

    afterUpdate(() => {
        if (logBox) logBox.scrollTop = logBox.scrollHeight;
    });

    function copyLog() {
        const text = $logs.join("\n");
        try {
            require("electron").clipboard.writeText(text);
        } catch {
            navigator.clipboard?.writeText(text);
        }
        copied = true;
        setTimeout(() => copied = false, 1200);
    }

    function openDiscord() {
        for (const p of Object.values(installPaths)) {
            try { startDiscord(p); } catch {}
        }
    }

    function report() {
        shell.openExternal(ISSUES_URL);
    }

    function finish(ok) {
        clearInterval(timer);
        result = !!ok;
        if (ok) {
            progress.set(100);
            status.set("success");
            showLog = false;
        } else {
            status.set("error");
            showLog = true;
            logs.update(a => [...a, "", `Something went wrong. If it keeps happening, report it here: ${ISSUES_URL}`]);
        }
        nextPage.set(null);
        canGoForward.set(true);
        canGoBack.set(true);
    }

    // Start once the page slide-in has finished (250ms)
    onMount(() => {
        const t = setTimeout(() => {
            let runner;
            if (currentAction === "install") runner = install(installPaths);
            else if (currentAction === "repair") runner = repair(installPaths);
            else if (currentAction === "uninstall") runner = uninstall(installPaths);
            else if (currentAction === "uninject_thirdparty") runner = uninjectThirdParty(installPaths);
            else runner = debug(Object.values(installPaths));

            Promise.resolve(runner).then(ok => finish(ok !== false)).catch(() => finish(false));
        }, 260);
        return () => {
            clearTimeout(t);
            clearInterval(timer);
        };
    });
</script>

<section class="page" in:page out:page="{{out: true}}">
    <PageHeader>
        <svg slot="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
            {@html pageIcon}
        </svg>
        {result === true ? info.done : result === false ? "Something went wrong" : info.working}
    </PageHeader>

    <ol class="steps">
        {#each info.steps as step, i}
            <li class:done={i < activeStep || result === true} class:active={i === activeStep && result === null} class:failed={i === activeStep && result === false}>
                <span class="bubble">
                    {#if i < activeStep || result === true}✓{:else if i === activeStep && result === false}!{:else}{i + 1}{/if}
                </span>
                <span class="label">{step.name}</span>
            </li>
            {#if i < info.steps.length - 1}<span class="link" class:lit={i < activeStep || result === true}></span>{/if}
        {/each}
    </ol>

    <div class="bar-row">
        <div class="bar" class:error={result === false} class:success={result === true}>
            <div class="fill" style="width: {result === false ? Math.max(percent, 8) : percent}%"></div>
        </div>
        <span class="pct">{percent}%</span>
    </div>
    <div class="detail">
        {#if result === null}{detail || "Working…"} · {seconds}s{:else if result === true}Finished in {seconds}s{:else}Stopped after {seconds}s{/if}
    </div>

    {#if result === true && !showLog}
        <div class="finish">
            <div class="check-big">✓</div>
            <div class="finish-text">
                <div class="finish-title">{info.done}</div>
                <div class="finish-sub">{info.doneText}</div>
            </div>
            <div class="finish-buttons">
                {#if currentAction !== "uninstall" && currentAction !== "uninject_thirdparty"}
                    <button class="btn primary" on:click={openDiscord}>Open Discord</button>
                {/if}
                <button class="btn" on:click={() => showLog = true}>Show log</button>
            </div>
        </div>
    {:else}
        <div class="console">
            <div class="console-bar">
                <span class="dots"><i></i><i></i><i></i></span>
                <span class="console-title">Log</span>
                <span class="console-actions">
                    {#if result === false}<button class="mini danger" on:click={report}>Report problem</button>{/if}
                    {#if result === true}<button class="mini" on:click={() => showLog = false}>Hide</button>{/if}
                    <button class="mini" on:click={copyLog}>{copied ? "Copied!" : "Copy"}</button>
                </span>
            </div>
            <div class="console-body" bind:this={logBox} tabindex="0">
                {#each $logs as line}
                    <div class="line {lineKind(line)}">{line || " "}</div>
                {/each}
                {#if result === null}<div class="line cursor">▍</div>{/if}
            </div>
        </div>
    {/if}
</section>

<style>
    .steps {
        list-style: none;
        display: flex;
        align-items: center;
        margin: 0 0 9px;
        padding: 0;
    }

    .steps li {
        display: flex;
        align-items: center;
        gap: 5px;
        flex: 0 0 auto;
        color: var(--text-muted);
        font-size: 11px;
        transition: color 200ms ease;
    }

    .bubble {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        font-size: 10px;
        font-weight: 700;
        border: 1px solid var(--surface-border-strong);
        background: var(--bg3);
        color: var(--text-muted);
        transition: 200ms ease;
    }

    .steps li.done { color: var(--text-normal); }
    .steps li.done .bubble {
        border-color: transparent;
        background: var(--accent-gradient);
        color: #fff;
    }

    .steps li.active { color: var(--text-light); }
    .steps li.active .bubble {
        border-color: #e879f9;
        color: #fff;
        box-shadow: 0 0 0 3px rgba(232, 121, 249, 0.18), 0 0 12px rgba(168, 85, 247, 0.6);
        animation: breathe 1.4s ease-in-out infinite;
    }

    .steps li.failed { color: #fda4af; }
    .steps li.failed .bubble {
        background: var(--danger, #ef4444);
        border-color: transparent;
        color: #fff;
    }

    .link {
        flex: 1 1 auto;
        height: 2px;
        min-width: 8px;
        margin: 0 6px;
        border-radius: 2px;
        background: var(--surface-border);
        transition: background 300ms ease;
    }

    .link.lit { background: var(--accent-gradient); }

    .bar-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .bar {
        flex: 1;
        height: 8px;
        border-radius: 8px;
        overflow: hidden;
        background: var(--bg3);
        border: 1px solid var(--surface-border);
    }

    .fill {
        position: relative;
        height: 100%;
        border-radius: 8px;
        background: var(--accent-gradient);
        box-shadow: var(--accent-glow);
        transition: width 450ms ease;
        overflow: hidden;
    }

    .fill::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        width: 40%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent);
        animation: sweep 1.6s linear infinite;
    }

    .bar.success .fill { background: linear-gradient(90deg, #22c55e, #a855f7); }
    .bar.success .fill::after, .bar.error .fill::after { display: none; }
    .bar.error .fill { background: #ef4444; box-shadow: none; }

    .pct {
        width: 36px;
        text-align: right;
        font-size: 12px;
        font-weight: 700;
        color: var(--text-light);
        font-variant-numeric: tabular-nums;
    }

    .detail {
        margin: 4px 0 8px;
        font-size: 11px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .console {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        border-radius: 10px;
        overflow: hidden;
        background: rgba(6, 4, 18, 0.72);
        border: 1px solid var(--surface-border);
    }

    .console-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        background: rgba(139, 92, 246, 0.12);
        border-bottom: 1px solid var(--surface-border);
    }

    .dots { display: flex; gap: 4px; }
    .dots i { width: 7px; height: 7px; border-radius: 50%; background: #f472b6; opacity: .8; }
    .dots i:nth-child(2) { background: #c084fc; }
    .dots i:nth-child(3) { background: #67e8f9; }

    .console-title {
        flex: 1;
        font-size: 10px;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--text-muted);
    }

    .console-actions { display: flex; gap: 6px; }

    .mini, .btn {
        font: inherit;
        cursor: pointer;
        border-radius: 6px;
        border: 1px solid var(--surface-border-strong);
        background: var(--bg3-alt);
        color: var(--text-normal);
        transition: 150ms ease;
    }

    .mini { font-size: 10px; padding: 2px 8px; }
    .mini:hover, .btn:hover { color: var(--text-light); border-color: rgba(232, 121, 249, 0.6); }
    .mini.danger { border-color: rgba(239, 68, 68, 0.6); color: #fecaca; }

    .console-body {
        flex: 1;
        overflow-y: auto;
        padding: 6px 10px;
        font-family: "Cascadia Code", Consolas, "Courier New", monospace;
        font-size: 11px;
        line-height: 1.45;
        outline: none;
        user-select: text;
    }

    .line { white-space: pre-wrap; word-break: break-word; color: #c4bfd9; }
    .line.blank { height: 5px; }
    .line.head { color: #e9d5ff; font-weight: 600; }
    .line.good { color: #86efac; }
    .line.warn { color: #fde68a; }
    .line.bad { color: #fca5a5; }
    .line.cursor { color: #e879f9; animation: blink 1s steps(1) infinite; }

    .finish {
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.14), rgba(168, 85, 247, 0.22));
        border: 1px solid rgba(134, 239, 172, 0.35);
        animation: pop 350ms ease-out;
    }

    .check-big {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        font-size: 24px;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(135deg, #22c55e, #a855f7);
        box-shadow: 0 0 18px rgba(134, 239, 172, 0.5);
    }

    .finish-text { flex: 1; min-width: 0; }
    .finish-title { font-size: 16px; font-weight: 700; color: var(--text-light); }
    .finish-sub { font-size: 12px; color: var(--text-normal); margin-top: 2px; }

    .finish-buttons { display: flex; flex-direction: column; gap: 6px; }
    .btn { font-size: 12px; padding: 6px 12px; white-space: nowrap; }
    .btn.primary {
        border-color: transparent;
        background: var(--accent-gradient);
        color: #fff;
        box-shadow: var(--accent-glow);
    }

    @keyframes breathe { 50% { box-shadow: 0 0 0 5px rgba(232, 121, 249, 0.08), 0 0 16px rgba(168, 85, 247, 0.8); } }
    @keyframes sweep { from { transform: translateX(-100%); } to { transform: translateX(260%); } }
    @keyframes blink { 50% { opacity: 0; } }
    @keyframes pop { from { transform: scale(.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
