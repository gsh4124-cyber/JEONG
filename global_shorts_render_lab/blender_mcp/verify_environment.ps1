$ErrorActionPreference = "Stop"

Write-Host "== Global Shorts Blender MCP environment check =="

$blender = Get-Command blender -ErrorAction SilentlyContinue
if (-not $blender) {
  Write-Host "BLENDER_NOT_ON_PATH"
  Write-Host "Open Blender 5.2 LTS manually or add blender.exe to PATH."
  exit 2
}

$version = & blender --version | Select-Object -First 1
Write-Host $version

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpeg) {
  Write-Host "FFMPEG_FOUND"
  & ffmpeg -version | Select-Object -First 1
} else {
  Write-Host "FFMPEG_NOT_FOUND_OPTIONAL_UNTIL_FINAL_MUX"
}

Write-Host "NEXT: launch Blender, connect official Blender MCP, then execute smoke_scene.py"
Write-Host "EXPECTED PASS LABEL: BLENDER_MCP_LOCAL_SMOKE_PASS"
