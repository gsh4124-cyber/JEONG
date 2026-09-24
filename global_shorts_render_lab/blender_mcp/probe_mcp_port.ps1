$ErrorActionPreference = "Stop"

$hostName = "127.0.0.1"
$port = 9876

Write-Host "== Blender MCP TCP probe =="
Write-Host ("Target: {0}:{1}" -f $hostName,$port)

$client = New-Object System.Net.Sockets.TcpClient
try {
  $iar = $client.BeginConnect($hostName,$port,$null,$null)
  if (-not $iar.AsyncWaitHandle.WaitOne(2500,$false)) {
    throw "timeout"
  }
  $client.EndConnect($iar)
  Write-Host "BLENDER_MCP_TCP_PORT_OPEN"
  exit 0
} catch {
  Write-Host "BLENDER_MCP_TCP_PORT_CLOSED"
  Write-Host "Open Blender, enable the official Blender MCP add-on/server, and start the server."
  exit 3
} finally {
  $client.Close()
}
