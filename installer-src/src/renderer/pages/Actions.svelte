<script>
    import page from "../transitions/page.js";
    import PageHeader from "../common/PageHeader.svelte";
    import {canGoBack, canGoForward, nextPage} from "../stores/navigation";
    import {radioSelectedIndex} from "../stores/controls";
    import {action} from "../stores/installation";

    const options = [
        {value: "install", title: "Install LumenCord", text: "Add LumenCord to your Discord, or update it.", icon: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>`, danger: false},
        {value: "repair", title: "Repair LumenCord", text: "Fixes LumenCord if it stopped loading after a Discord update.", icon: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>`, danger: false},
        {value: "uninstall", title: "Uninstall LumenCord", text: "Removes LumenCord and puts Discord back to normal.", icon: `<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>`, danger: true},
        {value: "uninject_thirdparty", title: "Remove Other Mods", text: "Takes Vencord or Equicord off so they don't clash.", icon: `<path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line>`, danger: true}
    ];

    canGoBack.set(true);

    function choose(i) {
        radioSelectedIndex.set(i);
        action.set(options[i].value);
        nextPage.set(`/setup/${options[i].value}`);
        canGoForward.set(true);
    }

    function onKey(event) {
        const i = $radioSelectedIndex;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") choose((i + 1) % options.length);
        else if (event.key === "ArrowUp" || event.key === "ArrowLeft") choose((i + options.length - 1) % options.length);
    }

    choose($radioSelectedIndex || 0);
</script>

<section class="page" in:page out:page="{{out: true}}">
    <PageHeader>
        <svg slot="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M8.75 13.5C10.2869 13.5 11.5747 14.5668 11.9131 16.0003L21.25 16C21.6642 16 22 16.3358 22 16.75C22 17.1297 21.7178 17.4435 21.3518 17.4932L21.25 17.5L11.9129 17.5007C11.5741 18.9337 10.2866 20 8.75 20C7.21345 20 5.92594 18.9337 5.58712 17.5007L2.75 17.5C2.33579 17.5 2 17.1642 2 16.75C2 16.3703 2.28215 16.0565 2.64823 16.0068L2.75 16L5.58688 16.0003C5.92534 14.5668 7.21309 13.5 8.75 13.5ZM15.25 4C16.7869 4 18.0747 5.06682 18.4131 6.50034L21.25 6.5C21.6642 6.5 22 6.83579 22 7.25C22 7.6297 21.7178 7.94349 21.3518 7.99315L21.25 8L18.4129 8.00066C18.0741 9.43368 16.7866 10.5 15.25 10.5C13.7134 10.5 12.4259 9.43368 12.0871 8.00066L2.75 8C2.33579 8 2 7.66421 2 7.25C2 6.8703 2.28215 6.55651 2.64823 6.50685L2.75 6.5L12.0869 6.50034C12.4253 5.06682 13.7131 4 15.25 4Z"/>
                </svg>
        Choose an Action
    </PageHeader>

    <div class="cards" tabindex="0" on:keydown={onKey}>
        {#each options as option, i}
            <button
                class="card"
                class:selected={$radioSelectedIndex === i}
                class:danger={option.danger}
                on:click={() => choose(i)}
            >
                <span class="icon">{@html `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${option.icon}</svg>`}</span>
                <span class="words">
                    <span class="title">{option.title}</span>
                    <span class="text">{option.text}</span>
                </span>
                <span class="check" aria-hidden="true"></span>
            </button>
        {/each}
    </div>
</section>

<style>
    .cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        outline: none;
    }

    .card {
        position: relative;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 11px;
        padding: 12px 30px 12px 12px;
        font: inherit;
        text-align: left;
        border-radius: 12px;
        border: 1px solid var(--surface-border);
        background: var(--bg3);
        color: var(--text-normal);
        cursor: pointer;
        transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease, transform 150ms ease;
    }

    .card:hover {
        border-color: var(--surface-border-strong);
        background: var(--bg3-alt);
        transform: translateY(-1px);
    }

    .card.selected {
        border-color: rgba(232, 121, 249, 0.75);
        background: linear-gradient(135deg, rgba(124, 58, 237, 0.42) 0%, rgba(168, 85, 247, 0.26) 55%, rgba(217, 70, 239, 0.22) 100%);
        box-shadow: 0 0 0 1px rgba(192, 132, 252, 0.35), 0 0 22px rgba(168, 85, 247, 0.45);
        color: var(--text-light);
    }

    .icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 34px;
        height: 34px;
        border-radius: 10px;
        background: rgba(139, 92, 246, 0.18);
        border: 1px solid rgba(192, 132, 252, 0.3);
        color: #d8b4fe;
    }

    .card.selected .icon {
        background: var(--accent-gradient);
        border-color: transparent;
        color: #fff;
        box-shadow: var(--accent-glow);
    }

    .card.danger .icon {
        color: #f0abfc;
    }

    .card.danger.selected .icon {
        color: #fff;
    }

    .icon :global(svg) {
        width: 18px;
        height: 18px;
        margin: 0;
    }

    .words {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .title {
        font-size: 13.5px;
        font-weight: 600;
        color: var(--text-light);
    }

    .text {
        font-size: 11.5px;
        line-height: 1.35;
        color: var(--text-muted);
    }

    .card.selected .text {
        color: var(--text-normal);
    }

    .check {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid rgba(192, 132, 252, 0.4);
        transition: 150ms ease;
    }

    .card.selected .check {
        border-color: #fff;
        background: radial-gradient(circle, #fff 0 35%, transparent 40%);
        box-shadow: 0 0 10px rgba(240, 171, 252, 0.8);
    }
</style>
