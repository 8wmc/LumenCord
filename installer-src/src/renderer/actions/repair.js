import {log, lognewline} from "./utils/log";
import install from "./install";

/**
 * Repair = put a fresh copy of LumenCord back in place.
 * Re-downloads the latest package and re-patches Discord (your settings and plugins are kept).
 */
export default async function(paths) {
    log("Starting Repair...");
    log("Repair downloads a fresh copy of LumenCord and patches Discord again. Your settings are kept.");
    const ok = await install(paths);
    lognewline(ok ? "Repair complete!" : "❌ Repair failed");
    return ok;
}
