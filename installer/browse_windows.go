/*
 * SPDX-License-Identifier: GPL-3.0
 * LumenCord Installer - native "Browse..." folder picker (Windows)
 */

package main

import (
	"os/exec"
	"strings"
	"syscall"
)

// PickFolder opens the Windows folder picker and returns the chosen path ("" if cancelled).
func PickFolder(title string) (string, error) {
	script := `Add-Type -AssemblyName System.Windows.Forms;` +
		`$f = New-Object System.Windows.Forms.FolderBrowserDialog;` +
		`$f.Description = '` + strings.ReplaceAll(title, "'", "''") + `';` +
		`$f.ShowNewFolderButton = $false;` +
		`$f.SelectedPath = [Environment]::GetFolderPath('LocalApplicationData');` +
		`$top = New-Object System.Windows.Forms.Form -Property @{TopMost = $true};` +
		`if ($f.ShowDialog($top) -eq 'OK') { [Console]::Out.Write($f.SelectedPath) }`

	cmd := exec.Command("powershell.exe", "-NoProfile", "-STA", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
