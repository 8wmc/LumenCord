<p align="center"><img src="assets/lumencord-logo.png" width="160" alt="LumenCord logo"></p>

<h1 align="center">LumenCord</h1>

<p align="center">A sleek Discord client mod with tons of built-in plugins, gorgeous themes and a chill, polished design.</p>

## What this is

LumenCord is built on [Nightcord](https://source.nightcord.st/nightcord/nightcord) (itself a fork of
[Equicord](https://github.com/Equicord/Equicord), which builds on [Vencord](https://github.com/Vendicated/Vencord)).

A few things were changed from upstream Nightcord before this was rebranded:

- **Removed:** DM Bomb, Mass DM, Flood Panel, Surveillance, and the fake "official DM" plugin that injected
  messages pretending to be from Nightcord's team. These either exist purely to spam/harass other people, or to
  impersonate an official source.
- **Removed:** every bit of code that silently talked to Nightcord's own servers — the 2FA cloud sync, the
  account-linking OAuth gateway, the background status pinger, and the runtime code downloader. LumenCord only
  talks to Discord's servers and, when checking for updates, GitHub.
- **Removed:** the build-time code scrambling (obfuscation), so the source stays readable.
- **Removed:** hidden invisible-character watermarking that was in the original licence text.
- **Kept:** every other plugin, including some that only affect your own account and are used at your own risk
  (things like FakeVoice and Server Cloner) — see `installer-src/assets/license.txt` for the terms.

## Installing

1. Upload this project to a GitHub repo (see `push-to-github.bat`).
2. GitHub Actions builds LumenCord, then builds the Windows installer, and puts both on the **latest** release.
3. Download **LumenCord-Installer.exe** from the [Releases page](https://github.com/8wmc/LumenCord/releases),
   run it, accept the licence, pick your Discord, and click Install.

The installer is Windows-only for now. Updates inside the app come only from this repo's GitHub releases.

## Building from source (Windows)

Double-click `build.bat`. It installs pnpm and builds LumenCord. The installer itself is built separately by
GitHub Actions (it needs Electron + native modules that are easiest to build in CI).

## Credits & licence

LumenCord is based on Nightcord, Equicord and Vencord, all free software licensed under the GNU General Public
License v3.0 or later. See [LICENSE](LICENSE). You're free to use, study, modify and redistribute LumenCord's
source code under those same terms.
