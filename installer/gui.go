//go:build !cli

/*
 * SPDX-License-Identifier: GPL-3.0
 * LumenCord Installer, a cross platform gui/cli app for installing LumenCord
 * Based on Vencord Installer, Copyright (c) 2023 Vendicated and Vencord contributors
 */

package main

import (
	"bytes"
	_ "embed"
	"errors"
	"image"
	"image/color"
	"image/draw"
	"math"
	"sync"
	"time"
	"vencordinstaller/buildinfo"

	g "github.com/AllenDang/giu"
	"github.com/AllenDang/imgui-go"

	// png decoder for icon
	_ "image/png"
	"os"
	path "path/filepath"
	"runtime"
	"strconv"
	"strings"
)

// ---------- LumenCord theme ----------

var (
	ColBg           = color.RGBA{0x12, 0x0a, 0x24, 0xff} // deep purple-navy
	ColPanel        = color.RGBA{0x1d, 0x12, 0x3a, 0xff}
	ColPanelHover   = color.RGBA{0x2a, 0x1b, 0x52, 0xff}
	ColPanelActive  = color.RGBA{0x36, 0x23, 0x6a, 0xff}
	ColBorder       = color.RGBA{0x3b, 0x2a, 0x6e, 0xff}
	ColText         = color.RGBA{0xf1, 0xec, 0xff, 0xff}
	ColTextMuted    = color.RGBA{0xb3, 0xa6, 0xd9, 0xff}
	ColTextFaint    = color.RGBA{0xff, 0xff, 0xff, 0x45}
	ColAccent       = color.RGBA{0x8b, 0x5c, 0xf6, 0xff} // violet
	ColAccentHover  = color.RGBA{0x7c, 0x3a, 0xed, 0xff}
	ColAccentActive = color.RGBA{0x6d, 0x28, 0xd9, 0xff}
	ColIndigo       = color.RGBA{0x63, 0x66, 0xf1, 0xff}
	ColIndigoHover  = color.RGBA{0x4f, 0x46, 0xe5, 0xff}
	ColRose         = color.RGBA{0xe1, 0x1d, 0x48, 0xff}
	ColRoseHover    = color.RGBA{0xbe, 0x12, 0x3c, 0xff}
	ColSlate        = color.RGBA{0x3b, 0x2f, 0x5c, 0xff}
	ColSlateHover   = color.RGBA{0x4a, 0x3b, 0x73, 0xff}
	ColSuccess      = color.RGBA{0x34, 0xd3, 0x99, 0xff}
	ColError        = color.RGBA{0xfb, 0x71, 0x85, 0xff}
)

var (
	discords        []any
	radioIdx        int
	customChoiceIdx int

	customDir              string
	autoCompleteDir        string
	autoCompleteFile       string
	autoCompleteCandidates []string
	autoCompleteIdx        int
	lastAutoComplete       string
	didAutoComplete        bool

	modalId          = 0
	modalTitle       = "Oh No :("
	modalMessage     = "You should never see this"
	modalExtra       = ""
	modalSupportLink = ""

	acceptedOpenAsar   bool
	showedUpdatePrompt bool
	browsing           bool

	logoImg *image.RGBA

	win *g.MasterWindow
)

// ---------- progress page state ----------

const (
	pageMain = iota
	pageProgress
)

var (
	page         = pageMain
	taskMu       sync.Mutex
	taskTitle    string
	taskSuccess  string
	taskLines    []string
	taskRunning  bool
	taskErr      error
	taskStart    time.Time
	taskScrolled int
)

//go:embed winres/icon.png
var iconBytes []byte

func init() {
	LogLevel = LevelDebug
}

func main() {
	InitGithubDownloader()
	discords = FindDiscords()
	customChoiceIdx = len(discords)

	go func() {
		<-GithubDoneChan
		g.Update()
	}()

	go func() {
		<-SelfUpdateCheckDoneChan
		g.Update()
	}()

	win = g.NewMasterWindow("LumenCord Installer", 1200, 820, 0)
	win.SetBgColor(ColBg)

	icon, _, err := image.Decode(bytes.NewReader(iconBytes))
	if err != nil {
		Log.Warn("Failed to load application icon", err)
	} else {
		win.SetIcon([]image.Image{icon})
		rgba := image.NewRGBA(icon.Bounds())
		draw.Draw(rgba, rgba.Bounds(), icon, icon.Bounds().Min, draw.Src)
		logoImg = rgba
	}

	win.Run(loop)
}

type CondWidget struct {
	predicate  bool
	ifWidget   func() g.Widget
	elseWidget func() g.Widget
}

func (w *CondWidget) Build() {
	if w.predicate {
		w.ifWidget().Build()
	} else if w.elseWidget != nil {
		w.elseWidget().Build()
	}
}

func getChosenInstall() *DiscordInstall {
	if radioIdx != customChoiceIdx {
		return discords[radioIdx].(*DiscordInstall)
	}

	if discord := ParseDiscord(customDir, ""); discord != nil {
		return discord
	}

	if discord := ParseDiscordNew(customDir, "", strings.Contains(customDir, "com.discordapp")); discord != nil {
		return discord
	}

	g.OpenPopup("#invalid-custom-location")
	return nil
}

// InstallLatestBuilds is used by patch(). Errors are shown on the progress page.
func InstallLatestBuilds() (err error) {
	if IsDevInstall {
		return
	}
	return installLatestBuilds()
}

// ---------- tasks (install / repair / uninstall) ----------

func addTaskLine(s string) {
	taskMu.Lock()
	taskLines = append(taskLines, s)
	taskMu.Unlock()
	g.Update()
}

func friendlyErr(err error) error {
	if errors.Is(err, os.ErrPermission) {
		switch runtime.GOOS {
		case "windows":
			return errors.New("Permission denied. Make sure Discord is fully closed (right-click it in the tray and Quit), then try again.")
		case "darwin":
			return errors.New("Permission denied. Give the installer Full Disk Access in System Settings > Privacy & Security, then try again.")
		default:
			return errors.New("Permission denied. Maybe try running me as Administrator/Root?")
		}
	}
	return err
}

func runTask(title, success string, fn func() error) {
	taskMu.Lock()
	page = pageProgress
	taskTitle = title
	taskSuccess = success
	taskLines = nil
	taskErr = nil
	taskRunning = true
	taskStart = time.Now()
	taskScrolled = 0
	taskMu.Unlock()

	OnLog = func(level Level, msg string) {
		prefix := "  "
		switch level {
		case LevelWarn:
			prefix = "! "
		case LevelError, LevelFatal:
			prefix = "x "
		}
		addTaskLine(prefix + msg)
	}

	// keep the progress bar animating while the task runs
	go func() {
		for {
			taskMu.Lock()
			running := taskRunning
			taskMu.Unlock()
			if !running {
				return
			}
			g.Update()
			time.Sleep(33 * time.Millisecond)
		}
	}()

	go func() {
		err := fn()
		if err != nil {
			err = friendlyErr(err)
		}
		taskMu.Lock()
		taskErr = err
		taskRunning = false
		taskMu.Unlock()
		OnLog = nil
		g.Update()
	}()
}

func chosenForTask() *DiscordInstall {
	choice := getChosenInstall()
	if choice == nil {
		return nil
	}
	if CheckScuffedInstall() {
		return nil
	}
	return choice
}

func handlePatch() {
	di := chosenForTask()
	if di == nil {
		return
	}
	runTask("Installing LumenCord", "LumenCord is installed! Restart Discord to start using it.", func() error {
		addTaskLine("> Target: " + di.path)
		return di.patch()
	})
}

func handleRepair() {
	di := chosenForTask()
	if di == nil {
		return
	}
	runTask("Repairing LumenCord", "LumenCord was reinstalled and updated! Restart Discord to apply it.", func() error {
		addTaskLine("> Target: " + di.path)
		if !IsDevInstall {
			if err := installLatestBuilds(); err != nil {
				return errors.New("Failed to download the latest LumenCord files: " + err.Error())
			}
		}
		return di.patch()
	})
}

func handleUnpatch() {
	di := getChosenInstall()
	if di == nil {
		return
	}
	runTask("Uninstalling LumenCord", "LumenCord has been removed. Restart Discord to go back to normal.", func() error {
		addTaskLine("> Target: " + di.path)
		return di.unpatch()
	})
}

func handleOpenAsar() {
	choice := getChosenInstall()
	if choice == nil {
		return
	}
	if acceptedOpenAsar || choice.IsOpenAsar() {
		handleOpenAsarConfirmed()
		return
	}

	g.OpenPopup("#openasar-confirm")
}

func handleOpenAsarConfirmed() {
	choice := getChosenInstall()
	if choice != nil {
		if choice.IsOpenAsar() {
			if err := choice.UninstallOpenAsar(); err != nil {
				handleErr(choice, err, "uninstall OpenAsar from")
			} else {
				g.OpenPopup("#openasar-unpatched")
				g.Update()
			}
		} else {
			if err := choice.InstallOpenAsar(); err != nil {
				handleErr(choice, err, "install OpenAsar on")
			} else {
				g.OpenPopup("#openasar-patched")
				g.Update()
			}
		}
	}
}

func handleErr(di *DiscordInstall, err error, action string) {
	ShowErrorModal("Failed to "+action+" this Install.", friendlyErr(err).Error(), SupportUrl)
}

func HandleScuffedInstall() {
	g.OpenPopup("#scuffed-install")
}

func HandleInsufficientPermissions() {
	g.OpenPopup("#insufficient-permissions")
}

func handleBrowse() {
	if browsing {
		return
	}
	browsing = true
	go func() {
		defer func() {
			browsing = false
			g.Update()
		}()
		dir, err := PickFolder("Select your Discord folder")
		if err != nil {
			Log.Warn("Folder picker failed:", err)
			return
		}
		if dir == "" {
			return
		}
		customDir = dir
		radioIdx = customChoiceIdx
	}()
}

func onCustomInputChanged() {
	p := customDir
	if len(p) != 0 {
		// Select the custom option for people
		radioIdx = customChoiceIdx
	}

	dir := path.Dir(p)

	isNewDir := strings.HasSuffix(p, "/")
	wentUpADir := !isNewDir && dir != autoCompleteDir

	if isNewDir || wentUpADir {
		autoCompleteDir = dir
		autoCompleteIdx = 0
		lastAutoComplete = ""
		autoCompleteFile = ""
		autoCompleteCandidates = nil

		files, err := os.ReadDir(dir)
		if err == nil {
			for _, file := range files {
				autoCompleteCandidates = append(autoCompleteCandidates, file.Name())
			}
		}
	} else if !didAutoComplete {
		autoCompleteFile = path.Base(p)
		lastAutoComplete = ""
	}

	if wentUpADir {
		autoCompleteFile = path.Base(p)
	}

	didAutoComplete = false
}

func makeAutoComplete() []any {
	input := strings.ToLower(autoCompleteFile)

	var candidates []any
	for _, e := range autoCompleteCandidates {
		file := strings.ToLower(e)
		if autoCompleteFile == "" || strings.HasPrefix(file, input) {
			candidates = append(candidates, e)
		}
	}
	return candidates
}

func makeRadioOnChange(i int) func() {
	return func() {
		radioIdx = i
	}
}

// ---------- shared widgets ----------

func renderFilesDirErr() g.Widget {
	return g.Layout{
		g.Dummy(0, 50),
		g.Style().
			SetColor(g.StyleColorText, ColError).
			SetFontSize(30).
			To(
				g.Align(g.AlignCenter).To(
					g.Label("Error: Failed to create: "+FilesDirErr.Error()),
					g.Label("Resolve this error, then restart me!"),
				),
			),
	}
}

func Tooltip(label string) g.Widget {
	return g.Style().
		SetStyle(g.StyleVarWindowPadding, 10, 8).
		SetStyleFloat(g.StyleVarWindowRounding, 8).
		To(
			g.Tooltip(label),
		)
}

func ColoredButton(label string, col, hover color.Color, width float32, onClick func(), disabled bool, tip string) g.Widget {
	return g.Style().
		SetColor(g.StyleColorButton, col).
		SetColor(g.StyleColorButtonHovered, hover).
		SetColor(g.StyleColorButtonActive, hover).
		SetColor(g.StyleColorText, color.White).
		SetStyle(g.StyleVarFrameRounding, 10, 10).
		SetDisabled(disabled).
		To(
			g.Button(label).OnClick(onClick).Size(width, 56),
			Tooltip(tip),
		)
}

func renderHeader() g.Widget {
	return g.Row(
		&CondWidget{logoImg != nil, func() g.Widget {
			return g.ImageWithRgba(logoImg).Size(72, 72)
		}, nil},
		g.Dummy(8, 0),
		g.Column(
			g.Style().SetFontSize(38).SetColor(g.StyleColorText, ColText).To(
				g.Label("LumenCord Installer"),
			),
			g.Style().SetFontSize(18).SetColor(g.StyleColorText, ColTextMuted).To(
				g.Label("Plugins, themes and a chill new look for Discord."),
			),
		),
	)
}

func renderFooter() g.Widget {
	return g.Style().SetFontSize(13).SetColor(g.StyleColorText, ColTextFaint).To(
		g.Align(g.AlignCenter).To(
			g.Label("LumenCord Installer" + Ternary(buildinfo.InstallerTag != buildinfo.VersionUnknown, " "+buildinfo.InstallerTag, "") + "  -  based on Vencord Installer by Vendicated and contributors (GPL-3.0)"),
		),
	)
}

func InfoModal(id, title, description string) g.Widget {
	return RawInfoModal(id, title, description, "", false)
}

func InfoModalExtra(id, title, description, extra string) g.Widget {
	return RawInfoModal(id, title, description, extra, false)
}

func ErrorModal(id, title, error, supportLink string) g.Widget {
	return g.Style().
		SetStyle(g.StyleVarWindowPadding, 30, 30).
		SetStyleFloat(g.StyleVarWindowRounding, 14).
		To(
			g.PopupModal(id).
				Flags(g.WindowFlagsNoTitleBar|g.WindowFlagsAlwaysAutoResize).
				Layout(
					g.Style().SetFontSize(32).To(g.Label(title)),
					g.Dummy(0, 5),
					g.Style().SetFontSize(22).To(
						g.Row(
							g.Label("If this keeps happening, visit"),
							g.Style().
								SetColor(g.StyleColorButton, ColAccent).
								SetColor(g.StyleColorButtonHovered, ColAccentHover).
								SetStyle(g.StyleVarFramePadding, 6, 4).
								To(
									g.Button("our support page").OnClick(func() {
										g.OpenURL(supportLink)
									}),
								),
						),
					),
					g.Dummy(0, 20),
					g.Style().SetFontSize(20).To(g.Label("Error Information")),
					g.Style().SetFontSize(18).SetColor(g.StyleColorText, ColTextMuted).To(g.Label(error)),
					g.Dummy(0, 20),
					g.Button("Ok").
						OnClick(func() { g.CloseCurrentPopup() }).
						Size(110, 34),
				),
		)
}

func RawInfoModal(id, title, description, extra string, isOpenAsar bool) g.Widget {
	isDynamic := strings.HasPrefix(id, "#modal") && extra != ""
	return g.Style().
		SetStyle(g.StyleVarWindowPadding, 30, 30).
		SetStyleFloat(g.StyleVarWindowRounding, 14).
		To(
			g.PopupModal(id).
				Flags(g.WindowFlagsNoTitleBar|Ternary(isDynamic, g.WindowFlagsAlwaysAutoResize, 0)).
				Layout(
					g.Style().SetFontSize(30).To(
						g.Label(title),
					),
					g.Dummy(0, 5),
					g.Style().SetFontSize(20).SetColor(g.StyleColorText, ColTextMuted).To(
						g.Label(description),
					),
					&CondWidget{extra != "", func() g.Widget {
						return g.Column(
							g.Dummy(0, 10),
							g.Style().SetFontSize(20).To(
								g.Label(extra).Wrapped(true),
							),
						)
					}, nil},
					&CondWidget{id == "#scuffed-install", func() g.Widget {
						return g.Column(
							g.Dummy(0, 10),
							g.Button("Take me there!").OnClick(func() {
								username := os.Getenv("USERNAME")
								programData := os.Getenv("PROGRAMDATA")
								g.OpenURL("file://" + path.Join(programData, username))
							}).Size(200, 34),
						)
					}, nil},
					g.Dummy(0, 20),
					&CondWidget{id == "#insufficient-permissions", func() g.Widget {
						return g.Column(
							g.Dummy(0, 10),
							g.Button("Open Settings").OnClick(func() {
								g.OpenURL("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
							}).Size(200, 34),
						)
					}, nil},
					&CondWidget{isOpenAsar,
						func() g.Widget {
							return g.Row(
								g.Button("Accept").
									OnClick(func() {
										acceptedOpenAsar = true
										g.CloseCurrentPopup()
									}).
									Size(110, 34),
								g.Button("Cancel").
									OnClick(func() {
										g.CloseCurrentPopup()
									}).
									Size(110, 34),
							)
						},
						func() g.Widget {
							return g.Button("Ok").
								OnClick(func() {
									g.CloseCurrentPopup()
								}).
								Size(110, 34)
						},
					},
				),
		)
}

func UpdateModal() g.Widget {
	return g.Style().
		SetStyle(g.StyleVarWindowPadding, 30, 30).
		SetStyleFloat(g.StyleVarWindowRounding, 14).
		To(
			g.PopupModal("#update-prompt").
				Flags(g.WindowFlagsNoTitleBar | g.WindowFlagsAlwaysAutoResize).
				Layout(
					g.Align(g.AlignCenter).To(
						g.Style().SetFontSize(30).To(
							g.Label("A new LumenCord Installer is out!"),
						),
						g.Style().SetFontSize(20).To(
							g.Label(
								"Would you like to update now?\n\n"+
									"The new installer will download automatically and reopen when it's done.\n"+
									"It might look frozen for a moment. Just wait!",
							),
						),
						g.Row(
							g.Button("Update Now").
								OnClick(func() {
									if runtime.GOOS == "darwin" {
										g.CloseCurrentPopup()
										g.OpenURL(GetInstallerDownloadLink())
										return
									}

									err := UpdateSelf()
									g.CloseCurrentPopup()

									if err != nil {
										ShowModal("Failed to update!", "Please download the latest Installer manually.", err.Error())
									} else {
										if err = RelaunchSelf(); err != nil {
											ShowModal("Failed to restart!", "Please restart the Installer manually.", err.Error())
										}
									}
								}).
								Size(120, 34),
							g.Button("Later").
								OnClick(func() {
									g.CloseCurrentPopup()
								}).
								Size(120, 34),
						),
					),
				),
		)
}

func ShowModal(title, desc, extra string) {
	modalTitle = title
	modalMessage = desc
	modalExtra = extra
	modalId++
	g.OpenPopup("#modal" + strconv.Itoa(modalId))
}

func ShowErrorModal(title, extra, supportLink string) {
	modalTitle = title
	modalExtra = extra
	modalSupportLink = supportLink
	modalId++
	g.OpenPopup("#error-modal" + strconv.Itoa(modalId))
}

func renderCard(bgColor color.Color, textColor color.Color, message string, height float32) g.Widget {
	return g.Style().
		SetColor(g.StyleColorChildBg, bgColor).
		SetStyle(g.StyleVarWindowPadding, 14, 12).
		SetStyleFloat(g.StyleVarChildRounding, 10).
		To(
			g.Child().
				Size(g.Auto, height).
				Layout(
					g.Row(
						g.Style().SetColor(g.StyleColorText, textColor).To(
							g.Markdown(&message),
						),
					),
				),
		)
}

// ---------- main page ----------

func renderInstaller() g.Widget {
	candidates := makeAutoComplete()

	wi, _ := win.GetSize()
	w := float32(wi) - 96

	var currentDiscord *DiscordInstall
	if radioIdx != customChoiceIdx {
		currentDiscord = discords[radioIdx].(*DiscordInstall)
	}
	var isOpenAsar = currentDiscord != nil && currentDiscord.IsOpenAsar()

	if CanUpdateSelf() && !showedUpdatePrompt {
		showedUpdatePrompt = true
		g.OpenPopup("#update-prompt")
	}

	listHeight := float32(len(discords))*38 + 30
	if len(discords) == 0 {
		listHeight = 70
	}

	btnW := (w - 3*14) / 4

	layout := g.Layout{
		g.Style().SetFontSize(18).To(
			renderCard(
				ColPanel,
				ColTextMuted,
				"Only download LumenCord from **github.com/8wmc/LumenCord**. Any other site claiming to be us could be malicious.",
				48,
			),
		),

		g.Dummy(0, 22),

		g.Style().SetFontSize(28).SetColor(g.StyleColorText, ColText).To(
			g.Label("Choose your Discord"),
		),
		g.Dummy(0, 8),

		g.Style().
			SetColor(g.StyleColorChildBg, ColPanel).
			SetStyle(g.StyleVarWindowPadding, 16, 14).
			SetStyleFloat(g.StyleVarChildRounding, 12).
			SetFontSize(20).
			To(
				g.Child().Size(g.Auto, listHeight).Layout(
					&CondWidget{len(discords) == 0, func() g.Widget {
						s := "No Discord installs found. Install Discord first, or pick its folder below."
						if runtime.GOOS == "linux" {
							s += " Snap is not supported."
						}
						return g.Style().SetColor(g.StyleColorText, ColTextMuted).To(g.Label(s))
					}, nil},
					g.RangeBuilder("Discords", discords, func(i int, v any) g.Widget {
						d := v.(*DiscordInstall)
						var text string
						switch d.branch {
						case "ptb":
							text = "Discord PTB"
						case "canary":
							text = "Discord Canary"
						case "development":
							text = "Discord Development"
						default:
							text = "Discord"
						}

						if d.isPatched {
							text += "  (LumenCord installed)"
						}

						return g.Row(
							g.RadioButton(text, radioIdx == i).OnChange(makeRadioOnChange(i)),
							g.Style().SetColor(g.StyleColorText, ColTextFaint).To(g.Label("  "+d.path)),
						)
					}),
				),
			),

		g.Dummy(0, 14),

		g.Style().SetFontSize(20).To(
			g.RadioButton("Custom location", radioIdx == customChoiceIdx).OnChange(makeRadioOnChange(customChoiceIdx)),
		),
		g.Dummy(0, 4),
		g.Style().
			SetStyle(g.StyleVarFramePadding, 14, 14).
			SetStyle(g.StyleVarFrameRounding, 10, 10).
			SetFontSize(20).
			To(
				g.Row(
					g.InputText(&customDir).Hint("Path to your Discord folder (or click Browse)").
						Size(w-170).
						Flags(g.InputTextFlagsCallbackCompletion).
						OnChange(onCustomInputChanged).
						Callback(
							func(data imgui.InputTextCallbackData) int32 {
								if len(candidates) == 0 {
									return 0
								}
								if autoCompleteIdx >= len(candidates) {
									autoCompleteIdx = 0
								}

								didAutoComplete = true

								start := len(customDir)
								if lastAutoComplete != "" {
									start -= len(lastAutoComplete)
									data.DeleteBytes(start, len(lastAutoComplete))
								} else if autoCompleteFile != "" {
									start -= len(autoCompleteFile)
									data.DeleteBytes(start, len(autoCompleteFile))
								}

								lastAutoComplete = candidates[autoCompleteIdx].(string)
								data.InsertBytes(start, []byte(lastAutoComplete))
								autoCompleteIdx++

								return 0
							},
						),
					g.Style().
						SetColor(g.StyleColorButton, ColSlate).
						SetColor(g.StyleColorButtonHovered, ColSlateHover).
						SetColor(g.StyleColorButtonActive, ColSlateHover).
						SetDisabled(browsing).
						To(
							g.Button(Ternary(browsing, "Opening...", "Browse...")).OnClick(handleBrowse).Size(155, 0),
						),
				),
			),

		g.Dummy(0, 28),

		g.Style().SetFontSize(21).To(
			g.Row(
				ColoredButton("Install", ColAccent, ColAccentHover, btnW, handlePatch, GithubError != nil, "Add LumenCord to the selected Discord"),
				g.Dummy(6, 0),
				ColoredButton("Reinstall / Repair", ColIndigo, ColIndigoHover, btnW, handleRepair, GithubError != nil, "Download the newest LumenCord and reinstall it"),
				g.Dummy(6, 0),
				ColoredButton("Uninstall", ColRose, ColRoseHover, btnW, handleUnpatch, false, "Remove LumenCord from the selected Discord"),
				g.Dummy(6, 0),
				ColoredButton(
					Ternary(isOpenAsar, "Uninstall OpenAsar", Ternary(currentDiscord != nil, "Install OpenAsar", "(Un-)Install OpenAsar")),
					ColSlate, ColSlateHover, btnW, handleOpenAsar, false, "Manage OpenAsar (optional, faster Discord startup)",
				),
			),
		),

		g.Dummy(0, 30),
		renderFooter(),

		InfoModal("#scuffed-install", "Hold On!", "You have a broken Discord Install.\n"+
			"Sometimes Discord decides to install to the wrong location for some reason!\n"+
			"You need to fix this before installing, otherwise LumenCord will likely not work.\n\n"+
			"Use the button below to jump there and delete any folder called Discord or Squirrel.\n"+
			"If the folder is now empty, feel free to go back a step and delete that folder too.\n"+
			"Then see if Discord still starts. If not, reinstall it"),
		RawInfoModal("#openasar-confirm", "OpenAsar", "OpenAsar is an open-source alternative of Discord desktop's app.asar.\n"+
			"LumenCord is in no way affiliated with OpenAsar.\n"+
			"You're installing OpenAsar at your own risk. If you run into issues with OpenAsar,\n"+
			"no support will be provided, join the OpenAsar Server instead!\n\n"+
			"To install OpenAsar, press Accept and click 'Install OpenAsar' again.", "", true),
		InfoModal("#insufficient-permissions", "Insufficient Permissions", "Permission denied. Please grant the installer permissions in the settings."),
		InfoModal("#openasar-patched", "Successfully Installed OpenAsar", "If Discord is still open, fully close it first. Then start it again and verify OpenAsar installed successfully!"),
		InfoModal("#openasar-unpatched", "Successfully Uninstalled OpenAsar", "If Discord is still open, fully close it first. Then start it again and it should be back to stock!"),
		InfoModal("#invalid-custom-location", "Invalid Location", "That folder doesn't look like a Discord install.\nMake sure you pick the main Discord folder.\n\nOn Windows it's usually: C:\\Users\\<you>\\AppData\\Local\\Discord\n\nHint: Discord snap is not supported. use flatpak or .deb"),
		InfoModalExtra("#modal"+strconv.Itoa(modalId), modalTitle, modalMessage, modalExtra),
		ErrorModal("#error-modal"+strconv.Itoa(modalId), modalTitle, modalExtra, modalSupportLink),
		UpdateModal(),
	}

	return layout
}

// ---------- progress page ----------

func renderProgress() g.Widget {
	taskMu.Lock()
	title := taskTitle
	success := taskSuccess
	lines := append([]string(nil), taskLines...)
	running := taskRunning
	err := taskErr
	elapsed := time.Since(taskStart).Seconds()
	taskMu.Unlock()

	wi, hi := win.GetSize()
	w := float32(wi) - 96
	logH := float32(hi) - 440
	if logH < 160 {
		logH = 160
	}

	var fraction float32
	var overlay string
	barCol := color.Color(ColAccent)
	statusCol := color.Color(ColTextMuted)
	status := "Working on it... keep this window open."

	switch {
	case running:
		// eases towards 95% so it always looks like it's moving
		fraction = float32(0.95 * (1 - math.Exp(-elapsed/1.6)))
		overlay = strconv.Itoa(int(fraction*100)) + "%"
	case err != nil:
		fraction = 1
		overlay = "Failed"
		barCol = ColRose
		statusCol = ColError
		status = err.Error()
		title = "Something went wrong"
	default:
		fraction = 1
		overlay = "Done"
		barCol = ColSuccess
		statusCol = ColSuccess
		status = success
		title = "All done!"
	}

	return g.Layout{
		g.Style().SetFontSize(30).SetColor(g.StyleColorText, ColText).To(g.Label(title)),
		g.Dummy(0, 6),
		g.Style().SetFontSize(19).SetColor(g.StyleColorText, statusCol).To(g.Label(status).Wrapped(true)),
		g.Dummy(0, 16),

		g.Style().
			SetColor(g.StyleColorPlotHistogram, barCol).
			SetColor(g.StyleColorFrameBg, ColPanel).
			SetColor(g.StyleColorText, color.White).
			SetStyle(g.StyleVarFrameRounding, 10, 10).
			SetFontSize(18).
			To(g.ProgressBar(fraction).Size(w, 30).Overlay(overlay)),

		g.Dummy(0, 16),
		g.Style().SetFontSize(18).SetColor(g.StyleColorText, ColTextMuted).To(g.Label("Details")),
		g.Dummy(0, 4),

		g.Style().
			SetColor(g.StyleColorChildBg, ColPanel).
			SetStyle(g.StyleVarWindowPadding, 14, 12).
			SetStyleFloat(g.StyleVarChildRounding, 12).
			SetFontSize(17).
			To(
				g.Child().Size(g.Auto, logH).Layout(
					g.RangeBuilder("TaskLog", toAny(lines), func(i int, v any) g.Widget {
						s := v.(string)
						col := color.Color(ColTextMuted)
						if strings.HasPrefix(s, "x ") {
							col = ColError
						} else if strings.HasPrefix(s, "! ") {
							col = color.RGBA{0xfb, 0xbf, 0x24, 0xff}
						} else if strings.HasPrefix(s, "> ") {
							col = ColText
						}
						return g.Style().SetColor(g.StyleColorText, col).To(g.Label(s).Wrapped(true))
					}),
					g.Custom(func() {
						// auto-scroll to the newest line
						if len(lines) != taskScrolled {
							taskScrolled = len(lines)
							imgui.SetScrollHereY(1.0)
						}
					}),
				),
			),

		g.Dummy(0, 18),

		&CondWidget{!running, func() g.Widget {
			return g.Style().SetFontSize(20).To(
				g.Row(
					ColoredButton("Back", ColSlate, ColSlateHover, 180, func() {
						// re-scan so "(LumenCord installed)" labels are fresh
						discords = FindDiscords()
						customChoiceIdx = len(discords)
						if radioIdx > customChoiceIdx {
							radioIdx = 0
						}
						page = pageMain
					}, false, "Go back to the installer"),
					g.Dummy(6, 0),
					ColoredButton("Close", ColAccent, ColAccentHover, 180, func() { os.Exit(0) }, false, "Close the installer"),
					&CondWidget{err != nil, func() g.Widget {
						return g.Row(
							g.Dummy(6, 0),
							ColoredButton("Get help", ColIndigo, ColIndigoHover, 180, func() { g.OpenURL(SupportUrl) }, false, "Open the LumenCord issues page"),
						)
					}, nil},
				),
			)
		}, nil},

		g.Dummy(0, 20),
		renderFooter(),
	}
}

func toAny(s []string) []any {
	out := make([]any, len(s))
	for i, v := range s {
		out[i] = v
	}
	return out
}

// ---------- main loop ----------

func pushTheme() (colors, vars int) {
	set := func(id imgui.StyleColorID, c color.Color) {
		imgui.PushStyleColor(id, g.ToVec4Color(c))
		colors++
	}
	set(imgui.StyleColorWindowBg, ColBg)
	set(imgui.StyleColorChildBg, ColPanel)
	set(imgui.StyleColorPopupBg, ColPanel)
	set(imgui.StyleColorBorder, ColBorder)
	set(imgui.StyleColorText, ColText)
	set(imgui.StyleColorFrameBg, ColPanel)
	set(imgui.StyleColorFrameBgHovered, ColPanelHover)
	set(imgui.StyleColorFrameBgActive, ColPanelActive)
	set(imgui.StyleColorButton, ColAccent)
	set(imgui.StyleColorButtonHovered, ColAccentHover)
	set(imgui.StyleColorButtonActive, ColAccentActive)
	set(imgui.StyleColorCheckMark, ColAccent)
	set(imgui.StyleColorPlotHistogram, ColAccent)
	set(imgui.StyleColorSeparator, ColBorder)

	setF := func(id imgui.StyleVarID, v float32) {
		imgui.PushStyleVarFloat(id, v)
		vars++
	}
	setF(imgui.StyleVarFrameRounding, 10)
	setF(imgui.StyleVarChildRounding, 12)
	setF(imgui.StyleVarPopupRounding, 12)
	setF(imgui.StyleVarWindowRounding, 14)
	return
}

func loop() {
	nColors, nVars := pushTheme()
	g.PushWindowPadding(48, 40)

	g.SingleWindow().
		RegisterKeyboardShortcuts(
			g.WindowShortcut{Key: g.KeyUp, Callback: func() {
				if page == pageMain && radioIdx > 0 {
					radioIdx--
				}
			}},
			g.WindowShortcut{Key: g.KeyDown, Callback: func() {
				if page == pageMain && radioIdx < customChoiceIdx {
					radioIdx++
				}
			}},
		).
		Layout(
			renderHeader(),
			g.Dummy(0, 26),

			&CondWidget{
				GithubError != nil && page == pageMain,
				func() g.Widget {
					return g.Column(
						g.Style().SetFontSize(19).To(renderCard(ColRose, color.White, "Couldn't reach GitHub to get the latest LumenCord. Check your internet, or visit **github.com/8wmc/LumenCord/issues** for help.", 46)),
						g.Dummy(0, 12),
					)
				},
				nil,
			},

			&CondWidget{
				predicate: FilesDirErr != nil,
				ifWidget:  renderFilesDirErr,
				elseWidget: func() g.Widget {
					if page == pageProgress {
						return renderProgress()
					}
					return renderInstaller()
				},
			},
		)

	g.PopStyle()
	imgui.PopStyleVarV(nVars)
	imgui.PopStyleColorV(nColors)
}
