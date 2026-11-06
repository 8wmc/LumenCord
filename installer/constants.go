/*
 * SPDX-License-Identifier: GPL-3.0
 * LumenCord Installer, a cross platform gui/cli app for installing LumenCord
 * Based on Vencord Installer, Copyright (c) 2023 Vendicated and Vencord contributors
 */

package main

import (
	"image/color"
	"vencordinstaller/buildinfo"
)

const RepoUrl = "https://github.com/8wmc/LumenCord"
const SupportUrl = RepoUrl + "/issues"
const ReleaseUrl = "https://api.github.com/repos/8wmc/LumenCord/releases/latest"
const ReleaseUrlFallback = ReleaseUrl
const InstallerReleaseUrl = ReleaseUrl
const InstallerReleaseUrlFallback = ReleaseUrl

var UserAgent = "LumenCordInstaller/" + buildinfo.InstallerGitHash + " (" + RepoUrl + ")"

var (
	DiscordGreen        = color.RGBA{0, 133, 69, 0xff}
	DiscordGreenHovered = color.RGBA{0, 108, 55, 0xff}
	DiscordRed          = color.RGBA{210, 45, 57, 0xff}
	DiscordRedHovered   = color.RGBA{169, 35, 46, 0xff}
	DiscordBlue         = color.RGBA{88, 101, 242, 0xff}
	DiscordBlueHovered  = color.RGBA{68, 82, 187, 0xff}
	DiscordYellow       = color.RGBA{0xfe, 0xe7, 0x5c, 0xff}
)

var LinuxDiscordNames = []string{
	"Discord",
	"DiscordPTB",
	"DiscordCanary",
	"DiscordDevelopment",
	"discord",
	"discordptb",
	"discordcanary",
	"discorddevelopment",
	"discord-ptb",
	"discord-canary",
	"discord-development",
	// Flatpak
	"com.discordapp.Discord",
	"com.discordapp.DiscordPTB",
	"com.discordapp.DiscordCanary",
	"com.discordapp.DiscordDevelopment",
}
