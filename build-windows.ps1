#Requires -Version 5.1

<#
.SYNOPSIS
    Simple Windows Build Script for Dofus Organizer
.DESCRIPTION
    Builds the Dofus Organizer application for Windows
.PARAMETER Clean
    Clean build (removes node_modules and dist)
.EXAMPLE
    .\build-windows.ps1
    .\build-windows.ps1 -Clean
#>

[CmdletBinding()]
param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Message, [string]$Color = "Cyan")
    Write-Host "► $Message" -ForegroundColor $Color
}

try {
    Write-Host "=== Dofus Organizer - Windows Build ===" -ForegroundColor Magenta
    Write-Host ""

    # Check prerequisites
    Write-Status "Checking prerequisites..."
    if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        throw "Node.js not found. Please install Node.js from https://nodejs.org/"
    }
    if (-not (Test-Path "package.json")) {
        throw "package.json not found. Run this script from project root."
    }

    # Clean if requested
    if ($Clean) {
        Write-Status "Cleaning previous build..." "Yellow"
        if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
        if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }
    }

    # Install dependencies
    if (-not (Test-Path "node_modules") -or $Clean) {
        Write-Status "Installing dependencies..."
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    }

    # Build
    Write-Status "Building for Windows..."
    npm run build-win
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }

    # Show results
    Write-Status "Build completed!" "Green"
    if (Test-Path "dist") {
        $files = Get-ChildItem "dist" -File
        Write-Host ""
        Write-Host "Build artifacts:" -ForegroundColor Green
        foreach ($file in $files) {
            $size = [math]::Round($file.Length / 1MB, 2)
            Write-Host "  • $($file.Name) ($size MB)" -ForegroundColor Gray
        }
    }

    Write-Host ""
    Write-Status "Success! Check the 'dist' folder for your builds." "Green"
}
catch {
    Write-Host ""
    Write-Host "❌ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
