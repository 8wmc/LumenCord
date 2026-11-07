# LumenCord Privacy Policy

LumenCord is a free Discord client modification. Plugins, themes, settings and keybinds run on your own
device and are not sent to LumenCord.

## What LumenCord stores and why

To give out badges, we store your Discord user ID, username, display name, the date you first opened
LumenCord, and your current game session (game name and time played). This is only used to show badges.
It's kept privately and never sold or shared. You can turn badges off in Settings anytime, and your data
is deleted.

Details:

- **When it starts:** only after you press **Verify with Discord** in Settings → LumenCord Badges.
  Verifying asks Discord for the `identify` scope only (your user ID and username). LumenCord never sees
  your password, and never stores your Discord token.
- **Where it lives:** the LumenCord badge server (a Cloudflare Worker with a private database). It is
  never put in the public GitHub repo.
- **What other people can see:** other LumenCord users only get your badge info (the date you started
  and your current or last game session) when they look at your profile, never your username or display
  name from our server.
- **Game sessions:** only the game name and how long you've played this session. After you stop, your
  last session stays until you start a different game, then it's replaced.
- **Turning it off:** switch off "Share my LumenCord badges" in Settings → LumenCord Badges. Everything
  the badge server has about you is deleted straight away.
- **Hand-out and staff badges:** these are listed by Discord user ID in the public `badges.json` file in
  the GitHub repo, because the LumenCord team adds them by hand. Ask the team if you want yours removed.

## Other connections

LumenCord also talks to GitHub (updates, changelog and the badge list), and to outside services only when
you turn on a plugin that needs one. Cloudflare, which hosts the badge server, handles normal web request
data (like IP addresses) to deliver the service; LumenCord itself does not save IP addresses.

All messaging, calls and server activity still go through Discord and are covered by
[Discord's Privacy Policy](https://discord.com/privacy/).

Source code: https://github.com/8wmc/LumenCord
