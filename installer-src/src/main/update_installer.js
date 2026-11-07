/*
 * LumenCord: the installer no longer checks any outside server for its own updates.
 * It always downloads the newest lumencord-dist.zip from github.com/8wmc/LumenCord when you click Install,
 * so a separate "new installer version" check is not needed.
 */
/* eslint-disable no-console */
const {version} = require("../../package.json");

export default async function () {
    console.info(`LumenCord Installer ${version}`);
}
