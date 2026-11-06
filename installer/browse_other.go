//go:build !windows

/*
 * SPDX-License-Identifier: GPL-3.0
 * LumenCord Installer - native "Browse..." folder picker (macOS / Linux)
 */

package main

import (
	"errors"
	"os/exec"
	"runtime"
	"strings"
)

// PickFolder opens a native folder picker and returns the chosen path ("" if cancelled).
func PickFolder(title string) (string, error) {
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("osascript", "-e", `POSIX path of (choose folder with prompt "`+title+`")`)
	} else if _, err := exec.LookPath("zenity"); err == nil {
		cmd = exec.Command("zenity", "--file-selection", "--directory", "--title="+title)
	} else if _, err := exec.LookPath("kdialog"); err == nil {
		cmd = exec.Command("kdialog", "--getexistingdirectory", "~", "--title", title)
	} else {
		return "", errors.New("no folder picker found (install zenity or kdialog), type the path instead")
	}
	out, err := cmd.Output()
	if err != nil {
		// cancelled dialogs exit non-zero
		return "", nil
	}
	return strings.TrimRight(strings.TrimSpace(string(out)), "/"), nil
}
