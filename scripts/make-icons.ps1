# =============================================================================
#  Generates the PWA PNG icons from the same barbell mark as icon.svg.
#  Uses System.Drawing so it needs nothing installed. Re-run after changing
#  the colours below.
#
#    powershell -ExecutionPolicy Bypass -File scripts\make-icons.ps1
# =============================================================================

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot '..\web\icons'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$flameA = [System.Drawing.Color]::FromArgb(255, 107, 44)
$flameB = [System.Drawing.Color]::FromArgb(255, 159, 28)
$ink    = [System.Drawing.Color]::FromArgb(20, 16, 10)
$night  = [System.Drawing.Color]::FromArgb(12, 14, 19)

function New-RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x,        $y,        $d, $d, 180, 90)
  $p.AddArc($x+$w-$d,  $y,        $d, $d, 270, 90)
  $p.AddArc($x+$w-$d,  $y+$h-$d,  $d, $d,   0, 90)
  $p.AddArc($x,        $y+$h-$d,  $d, $d,  90, 90)
  $p.CloseFigure()
  return $p
}

# glyph is drawn in a 512-unit space then scaled to the target size
function New-Icon([int]$size, [string]$file, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode   = 'HighQuality'

  $s = $size / 512.0

  # Background
  if ($maskable) {
    # Full bleed: the OS crops this into whatever shape it likes.
    $rect  = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $flameA, $flameB, 45.0)
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()
    $scale = 0.68   # keep the barbell inside the maskable safe zone
  } else {
    $g.Clear($night)
    $outer = New-RoundedPath 0 0 $size $size (112 * $s)
    $inner = New-RoundedPath (24*$s) (24*$s) (464*$s) (464*$s) (92*$s)
    $rect  = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $flameA, $flameB, 45.0)
    $g.SetClip($outer)
    $g.FillPath($brush, $inner)
    $g.ResetClip()
    $brush.Dispose(); $outer.Dispose(); $inner.Dispose()
    $scale = 1.0
  }

  # Barbell, centred and scaled
  $ib = New-Object System.Drawing.SolidBrush($ink)
  $bars = @(
    @(150, 240, 212,  32, 16),
    @(160, 186,  44, 140, 16),
    @(308, 186,  44, 140, 16),
    @(112, 210,  38,  92, 14),
    @(362, 210,  38,  92, 14)
  )
  foreach ($b in $bars) {
    # scale each rect about the 256,256 centre
    $x = (256 + ($b[0] - 256) * $scale) * $s
    $y = (256 + ($b[1] - 256) * $scale) * $s
    $w = $b[2] * $scale * $s
    $h = $b[3] * $scale * $s
    $r = [Math]::Min($b[4] * $scale * $s, [Math]::Min($w, $h) / 2)
    $path = New-RoundedPath $x $y $w $h $r
    $g.FillPath($ib, $path)
    $path.Dispose()
  }
  $ib.Dispose()

  $path = Join-Path $outDir $file
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "  wrote $file ($size x $size)"
}

Write-Host "Generating RepClash icons..."
New-Icon 192 'icon-192.png'          $false
New-Icon 512 'icon-512.png'          $false
New-Icon 512 'icon-maskable-512.png' $true
New-Icon 180 'apple-touch-icon.png'  $false
Write-Host "Done."
