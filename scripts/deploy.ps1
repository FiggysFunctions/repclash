# =============================================================================
#  Ship it.
#
#    powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 "what changed"
#
#  Bumps the service worker cache version (so everyone's phone picks up the
#  new code instead of the copy it already has), commits, and pushes. GitHub
#  Actions does the rest - live in about a minute.
#
#  Keep this file pure ASCII. Windows PowerShell 5.1 reads .ps1 as ANSI unless
#  there's a UTF-8 BOM, so a stray em dash decodes into a smart quote and
#  silently terminates the next string literal.
# =============================================================================

param(
  [Parameter(Position = 0)]
  [string]$Message = "Update RepClash"
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

# --- 1. Bump the service worker cache -----------------------------------------
$swPath = Join-Path $root 'web\sw.js'
$sw = Get-Content $swPath -Raw

if ($sw -match "const CACHE = 'repclash-v(\d+)';") {
  $next = [int]$Matches[1] + 1
  $sw = $sw -replace "const CACHE = 'repclash-v\d+';", "const CACHE = 'repclash-v$next';"
  Set-Content $swPath $sw -NoNewline -Encoding utf8
  Write-Host "Cache bumped to repclash-v$next" -ForegroundColor DarkGray
} else {
  Write-Warning "Could not find the CACHE constant in web/sw.js - skipping bump."
}

# --- 2. Anything to ship? -----------------------------------------------------
$changes = git status --porcelain
if (-not $changes) {
  Write-Host "Nothing has changed. Not deploying." -ForegroundColor Yellow
  exit 0
}

Write-Host ""
Write-Host "Changes to deploy:" -ForegroundColor Cyan
git status --short
Write-Host ""

# --- 3. Commit and push -------------------------------------------------------
git add -A
git commit -m $Message | Out-Null

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
git push origin $branch

Write-Host ""
Write-Host "Pushed to $branch." -ForegroundColor Green

$remote = $null
try { $remote = (git remote get-url origin) } catch { }
if ($remote) {
  $slug = $remote -replace '^.*github\.com[:/]', '' -replace '\.git$', ''
  Write-Host "Build progress: https://github.com/$slug/actions"
  $parts = $slug -split '/'
  if ($parts.Count -eq 2) {
    Write-Host "Live in ~1 min at: https://$($parts[0]).github.io/$($parts[1])/"
  }
}
