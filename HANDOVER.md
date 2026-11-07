# LumenCord: handover notes (paste into a new chat with the latest LumenCord.zip)

Read this, then wait for me to say "go" before big changes.

## About me
- Not very technical. Simple, one-step-at-a-time Windows instructions. Tell me exactly what to click.
- I use voice sometimes. "go" = start the build. "join voice again" = reply only "Okay, join voice again".
- Be honest about what's broken or untested.
- GitHub: 8wmc. Repo: https://github.com/8wmc/LumenCord (public). I upload with `push-to-github.bat`.

## The project
LumenCord (capital L and C) is my Discord client mod, built from Nightcord (Equicord / Vencord fork), free to share.
Look: deep purple / navy with violet accent. Logo: glowing "L" with a ring on a dark purple rounded square.

## Current state (works)
- GitHub Actions "Release" builds the mod (`lumencord-dist.zip`) and the Windows installer (`LumenCord-Installer.exe`)
  and uploads both to the "latest" release. Version is set automatically to 1.32.<run number>; the release title holds it.
- Installed and tested by me in Discord: it works.
- Installer restyled in LumenCord colours with logo; its links go to my GitHub.
- All on-screen "Nightcord" text rebranded to LumenCord (~1,100 strings plus translations). Plugin author credits and the
  small GPL credit line still name Nightcord / Equicord / Vencord on purpose.
- Nightcord server calls removed: cloud sync, OAuth, profile lookups, plugin likes, badges, tutorial videos, changelog.
- Changelog and both updaters read my GitHub. "LumenCord Badges" read `badges.json` in my repo.
- Removed for safety: GhostClient, GhostInstaller (downloaded and ran programs from Nightcord's server),
  MultiInstance and TokenImporter (stored Discord tokens in plain files). Rule: LumenCord never stores tokens.
- Installer downloads and the DM Purger email login now verify HTTPS certificates.
- Icon Finder no longer crashes; if Discord's icons can't be found it shows a message.

## Rules agreed
- Keep GPL credit visible but small. Don't hide the code's origin.
- Internal names ("vencord", "equicord", "nightcord" in code, keys, folders) stay: renaming breaks things.
- Won't build: storing Discord tokens, IP bans/tracking, spam/harassment/spying plugins (DM Bomb, Mass DM, Flood Panel,
  Surveillance). Still open: if I want a safe version of something those did, I'll say what.

## Known gaps / to-do
- No LumenCord cloud server, so Customization (stories/songs/effects) is local-only and Cloud Sync uses Equicord's or
  Vencord's server. A self-hosted server would be a separate project.
- Icon Finder may show "can't load icons" if Discord changed its code; needs the ConcatenatedModules patch updated.
- Stereo plugin removed (its voice files were missing).
- The "Test" workflow (code-style checks) fails; it doesn't block releases.
