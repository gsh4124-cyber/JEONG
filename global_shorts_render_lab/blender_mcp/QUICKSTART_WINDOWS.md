# Windows Quickstart — Global Shorts Blender MCP

This is the fastest portable recovery path for a new Windows PC or new agent.

## 1. Bootstrap folders / checks
Run PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File setup_windows.ps1
```

## 2. Blender
Install Blender 5.2 LTS (official MCP requires Blender 5.1+).

## 3. Official Blender MCP
Follow the current official Blender MCP Server installation page:
https://www.blender.org/lab/mcp-server/

The official page states the required pieces are:
- Blender 5.1+
- Blender MCP Add-on
- MCP-capable LLM Client
- MCP Server

Install the current official add-on/server package from the Blender Lab page. Do not substitute an unrelated community Blender-MCP implementation unless explicitly revalidated.

## 4. Start Blender-side MCP
Open Blender, enable/start the official MCP integration, then test the local TCP endpoint:
```powershell
powershell -ExecutionPolicy Bypass -File probe_mcp_port.ps1
```

Expected:
`BLENDER_MCP_TCP_PORT_OPEN`

## 5. Smoke test
Execute `smoke_scene.py` through Blender scripting or the connected MCP agent.

Expected:
- blender_mcp_smoke.png
- blender_mcp_smoke.blend
- console output: `BLENDER_MCP_LOCAL_SMOKE_PASS`

## 6. MorphMint 005
Read `morphmint_005_agent_prompt.md`, then execute `morphmint_005_scene.py`.

Do not move to production until smoke PASS.
Do not expose a candidate below internal 90/100.
