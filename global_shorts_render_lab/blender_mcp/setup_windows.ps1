$ErrorActionPreference = "Stop"

$root = Join-Path $HOME "GlobalShorts"
$dirs = @("blender","renders","assets","audio","exports","logs","scripts")
foreach ($d in $dirs) {
  $p = Join-Path $root $d
  New-Item -ItemType Directory -Force -Path $p | Out-Null
}

Write-Host "== Global Shorts Blender MCP bootstrap =="
Write-Host "Workspace: $root"

$blender = Get-Command blender -ErrorAction SilentlyContinue
if ($blender) {
  Write-Host "BLENDER_FOUND"
  (& blender --version | Select-Object -First 1)
} else {
  Write-Host "BLENDER_NOT_ON_PATH"
  Write-Host "Install Blender 5.2 LTS (5.1+ required for official Blender MCP) and launch it manually."
}

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpeg) {
  Write-Host "FFMPEG_FOUND"
  (& ffmpeg -version | Select-Object -First 1)
} else {
  Write-Host "FFMPEG_NOT_FOUND"
  Write-Host "Optional until final mux, but recommended before production."
}

Write-Host ""
Write-Host "Manual MCP step required:"
Write-Host "1) Open Blender."
Write-Host "2) Install/enable the official Blender Lab MCP add-on/server."
Write-Host "3) Start the Blender-side MCP server."
Write-Host "4) Connect an MCP-capable agent/client using the official Blender MCP server setup."
Write-Host "5) Run probe_mcp_port.ps1, then smoke_scene.py."
Write-Host ""
Write-Host "Expected final smoke label: BLENDER_MCP_LOCAL_SMOKE_PASS"
