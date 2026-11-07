<script>
    import {tooltip} from "./tooltip";

    const repoUrl = "https://github.com/8wmc/LumenCord";
    const issuesUrl = "https://github.com/8wmc/LumenCord/issues";
    const releasesUrl = "https://github.com/8wmc/LumenCord/releases";
</script>

<div class="social-links">
    <!-- GitHub source code -->
    <a use:tooltip={{text: "Source code"}} aria-label="Source code" class="social" target="_blank" href={repoUrl}>
        <svg tabindex="-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="currentColor" d="M16 1.5C7.99 1.5 1.5 7.99 1.5 16c0 6.41 4.15 11.84 9.92 13.76.73.13.99-.32.99-.7v-2.46c-4.03.88-4.88-1.94-4.88-1.94-.66-1.68-1.61-2.12-1.61-2.12-1.32-.9.1-.88.1-.88 1.46.1 2.22 1.5 2.22 1.5 1.29 2.22 3.39 1.58 4.22 1.21.13-.94.5-1.58.92-1.94-3.22-.37-6.6-1.61-6.6-7.16 0-1.58.56-2.88 1.49-3.89-.15-.37-.65-1.84.14-3.83 0 0 1.22-.39 3.98 1.48a13.8 13.8 0 0 1 7.25 0c2.76-1.87 3.98-1.48 3.98-1.48.79 1.99.29 3.46.14 3.83.93 1.01 1.49 2.31 1.49 3.89 0 5.57-3.39 6.79-6.62 7.15.52.45.98 1.33.98 2.69v3.98c0 .39.26.84 1 .7C26.36 27.83 30.5 22.4 30.5 16 30.5 7.99 24.01 1.5 16 1.5z"/></svg>
    </a>

    <!-- Report a problem -->
    <a use:tooltip={{text: "Report a problem"}} aria-label="Report a problem" class="social" target="_blank" href={issuesUrl}>
        <svg class="outline" tabindex="-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </a>

    <!-- Releases / downloads -->
    <a use:tooltip={{text: "Releases"}} aria-label="Releases" class="social" target="_blank" href={releasesUrl}>
        <svg class="outline" tabindex="-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </a>
</div>

<style>
    .social-links {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        margin-top: -5px;
        margin-right: -5px;
    }

    .social {
        width: 28px;
        height: 28px;
        margin-top: 5px;
        margin-right: 5px;
        background-color: var(--bg3-alt);
        border: 1px solid var(--surface-border);
        border-radius: 50%;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: 150ms ease;
        outline: none;
    }

    .social:hover {
        color: var(--text-normal);
    }

    .social:active {
        background-color: var(--bg4);
    }

    .social svg {
        width: 14px;
        height: auto;
        fill: currentColor;
    }

    .social svg.outline {
        fill: none;
        stroke: currentColor;
    }
</style>
