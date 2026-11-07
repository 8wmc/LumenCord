<script>
    export let type = "secondary";

    const types = ["primary", "secondary"];
</script>

<button
    class="button {types.includes(type) ? `type-${type}` : "type-secondary"}"
    type="button"
    on:keypress
    on:click|preventDefault|stopPropagation
    {...$$restProps}
>
    <span>
        <slot></slot>
    </span>
</button>

<style>
    .button {
        width: auto;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        transition: 150ms ease;
        cursor: pointer;
        padding: 0 16px;
        height: 30px;
        white-space: nowrap;
        font-size: 12px;
        font-weight: 600;
        border-radius: 8px;
    }

    .button[disabled] {
        opacity: .5;
        pointer-events: none;
    }

    .button span {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .button.type-primary {
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: var(--accent-gradient);
        color: #ffffff;
        box-shadow: var(--accent-glow);
        animation: lumen-glow 3.2s ease-in-out infinite;
    }

    .button.type-primary[disabled] {
        animation: none;
    }

    @keyframes lumen-glow {
        0%, 100% { box-shadow: 0 0 14px rgba(168, 85, 247, 0.35); }
        50% { box-shadow: 0 0 24px rgba(217, 70, 239, 0.6); }
    }

    .button.type-primary:hover {
        filter: brightness(1.12);
        box-shadow: 0 0 24px rgba(192, 132, 252, 0.6);
    }

    .button.type-primary:active {
        transform: translateY(1px);
    }

    .button.type-secondary {
        background-color: rgba(124, 92, 255, 0.08);
        border: 1px solid var(--surface-border);
        color: var(--text-normal);
    }

    .button.type-secondary:hover {
        border-color: var(--surface-border-strong);
        color: var(--text-light);
    }
</style>