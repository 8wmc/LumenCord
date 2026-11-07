import LoadingPage from "./pages/Loading.svelte";
import WelcomePage from "./pages/Welcome.svelte";
import LicensePage from "./pages/License.svelte";
import CreditsPage from "./pages/Credits.svelte";
import ActionsPage from "./pages/Actions.svelte";
import PlatformsPage from "./pages/Platforms.svelte";
import PerformActionPage from "./pages/PerformAction.svelte";

export default {
    "/": WelcomePage,
    "/license": LicensePage,
    "/credits": CreditsPage,
    "/actions": ActionsPage,
    "/setup/:action": PlatformsPage,
    "/install": PerformActionPage,
    "/repair": PerformActionPage,
    "/uninstall": PerformActionPage,
    "/uninject_thirdparty": PerformActionPage,
    "*": LoadingPage,
};