#Requires -Version 5.1
<#
.SYNOPSIS
    Baut einen Windows-Installer (.exe) für die DFM Data Check Desktop-App.

.DESCRIPTION
    Führt npm install und npx tauri build aus.
    Das Ergebnis ist eine .exe-Datei unter src-tauri\target\release\bundle\nsis\

.EXAMPLE
    .\build-windows.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DFM Data Check - Windows Installer Build" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Voraussetzungen prüfen ---
Write-Host "--- Voraussetzungen prüfen ---" -ForegroundColor Yellow

$missing = @()

foreach ($cmd in @("rustc", "cargo", "node", "npm")) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "  [OK] $cmd" -ForegroundColor Green
    } else {
        Write-Host "  [FEHLT] $cmd" -ForegroundColor Red
        $missing += $cmd
    }
}

if ($missing.Count -gt 0) {
    Write-Host ""
    Write-Host "Fehlende Tools: $($missing -join ', ')" -ForegroundColor Red
    Write-Host ""
    Write-Host "Bitte installiere:" -ForegroundColor White
    Write-Host "  - Rust:        https://rustup.rs" -ForegroundColor White
    Write-Host "  - Node.js:     https://nodejs.org (Version 22+)" -ForegroundColor White
    Write-Host "  - C++ Build:   https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor White
    Write-Host "    (Haken bei 'Desktop development with C++')" -ForegroundColor White
    Write-Host ""
    Write-Host "Starte das Skript danach erneut." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "--- npm install ---" -ForegroundColor Yellow
Push-Location $ScriptDir
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install fehlgeschlagen (Exit Code $LASTEXITCODE)" }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "--- npx tauri build ---" -ForegroundColor Yellow
Write-Host "  (Dies kann 5-15 Minuten dauern...)" -ForegroundColor DarkGray
Push-Location $ScriptDir
try {
    npx tauri build
    if ($LASTEXITCODE -ne 0) { throw "tauri build fehlgeschlagen (Exit Code $LASTEXITCODE)" }
} finally {
    Pop-Location
}

# --- Ergebnis ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Build erfolgreich!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

$nsisDir = Join-Path $ScriptDir "src-tauri\target\release\bundle\nsis"
$msiDir  = Join-Path $ScriptDir "src-tauri\target\release\bundle\msi"

if (Test-Path $nsisDir) {
    Write-Host "NSIS-Installer (.exe):" -ForegroundColor Cyan
    Get-ChildItem $nsisDir -Filter "*.exe" | ForEach-Object {
        $sizeMB = [math]::Round($_.Length / 1MB, 1)
        Write-Host "  $($_.Name)  ($sizeMB MB)" -ForegroundColor White
        Write-Host "  Pfad: $($_.FullName)" -ForegroundColor DarkGray
    }
}

if (Test-Path $msiDir) {
    Write-Host ""
    Write-Host "MSI-Installer (.msi):" -ForegroundColor Cyan
    Get-ChildItem $msiDir -Filter "*.msi" | ForEach-Object {
        $sizeMB = [math]::Round($_.Length / 1MB, 1)
        Write-Host "  $($_.Name)  ($sizeMB MB)" -ForegroundColor White
        Write-Host "  Pfad: $($_.FullName)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Die .exe-Datei kannst du auf jedem Windows-PC ausführen, um die App zu installieren." -ForegroundColor Green
Write-Host ""
