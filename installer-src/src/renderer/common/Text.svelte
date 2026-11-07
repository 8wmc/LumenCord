<script>
    export let hasMargin = undefined; // eslint-disable-line no-undef-init
    export let type = "paragraph";
    let className = undefined; // eslint-disable-line no-undef-init
    export {className as class};
</script>

{#if type === "header"}
    <h3 class="header {className}" class:has-margin={hasMargin} {...$$restProps}>
        <slot/>
    </h3>
    {:else if type === "paragraph"}
    <p class="paragraph {className}" class:has-margin={hasMargin} {...$$restProps}>
        <slot/>
    </p>
    {:else if type === "subtext"}
    <span class="subtext {className}" class:has-margin={hasMargin} {...$$restProps}>
        <slot/>
    </span>
{/if}

<style>
    .header,
    .paragraph,
    .subtext {
        margin: 0;
        line-height: normal;
    }

    .has-margin {
        margin-bottom: 10px;
    }

    .header {
        color: var(--text-light);
        font-weight: 700;
        font-size: 17px;
        letter-spacing: 0.2px;
        background: linear-gradient(90deg, #ffffff 0%, #e9d5ff 55%, #f0abfc 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .paragraph {
        color: var(--text-normal);
        font-weight: 400;
        font-size: 14px;
    }

    .subtext {
        color: var(--text-muted);
        font-weight: 400;
        font-size: 12px;
    }
</style>