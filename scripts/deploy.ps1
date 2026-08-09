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

# Read and write UTF-8 explicitly. Get-Content/Set-Content default to the
# system ANSI codepage here, which would mangle every non-ASCII character in
# the file a little more on each deploy. WriteAllText with UTF8Encoding($false)
# also avoids adding a BOM.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$sw = [System.IO.File]::ReadAllText($swPath, [System.Text.Encoding]::UTF8)

if ($sw -match "const CACHE = 'repclash-v(\d+)';") {
  $next = [int]$Matches[1] + 1
  $sw = $sw -replace "const CACHE = 'repclash-v\d+';", "const CACHE = 'repclash-v$next';"
  [System.IO.File]::WriteAllText($swPath, $sw, $utf8NoBom)
  Write-Host "Cache bumped to repclash-v$next" -ForegroundColor DarkGray
} else {
  Write-Warning "Could not find the CACHE constant in web/sw.js - skipping bump."
}

# --- 1b. Sanity check the file we just rewrote --------------------------------
# A stray byte at the top of sw.js makes the service worker fail to evaluate,
# which is silent: the app still loads, it just never updates itself again.
# That shipped once. Never again.
$swBytes = [System.IO.File]::ReadAllBytes($swPath)
if ($swBytes[0] -ne 0x2F -or $swBytes[1] -ne 0x2A) {
  $head = ($swBytes[0..3] | ForEach-Object { '{0:X2}' -f $_ }) -join ' '
  throw "web/sw.js does not start with '/*' (first bytes: $head). Refusing to deploy a broken service worker."
}
$swText = [System.IO.File]::ReadAllText($swPath, [System.Text.Encoding]::UTF8)
if ($swText -notmatch "const CACHE = 'repclash-v\d+';") {
  throw "web/sw.js is missing its CACHE constant. Refusing to deploy."
}
if ($swText.Contains([char]0xFFFD)) {
  throw "web/sw.js contains a replacement character - the encoding is damaged. Refusing to deploy."
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
