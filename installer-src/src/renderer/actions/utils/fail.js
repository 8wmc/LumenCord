import {log} from "./log";
import {action, status} from "../../stores/installation";

const supportURL = "https://github.com/8wmc/LumenCord/issues";

export default function fail() {
    log("");
    log(`The ${action.value} seems to have failed. If this problem is recurring, report it here: ${supportURL}`);
    status.set("error");
}