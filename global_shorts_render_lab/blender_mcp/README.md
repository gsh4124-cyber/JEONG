# Global Shorts Blender MCP Bootstrap

Purpose: portable local Blender + MCP production environment for Global Shorts.

Canonical Vault:
- 직장/콘텐츠/글로벌 숏츠/Blender_MCP_로컬_제작환경.md

## Required
- Blender 5.2 LTS recommended (5.1+ required by official Blender MCP)
- Official Blender MCP add-on/server
- MCP-capable agent/client
- FFmpeg for final mux/encode when needed

## Smoke test
1. Launch Blender with a blank scene.
2. Ensure official Blender MCP is connected.
3. Run `smoke_scene.py` through the connected agent or Blender scripting.
4. Confirm:
   - UV sphere exists
   - camera and area light exist
   - 64x64 Eevee still renders
   - scene can be saved and reopened
5. Agent re-reads scene and reports object/material/camera state.

Pass label:
`BLENDER_MCP_LOCAL_SMOKE_PASS`

## MorphMint 005 path
- Run `morphmint_005_scene.py` to build the initial vertical scene.
- Refine ceramic/chrome/crystal shader/geometry through the MCP agent.
- Build transition motion.
- Render proxy before full vertical output.
- Do not hand to Emperor below internal 90/100 viewer-facing quality.

## Safety
Use a dedicated work folder. Do not expose sensitive personal folders. Do not let agent-generated scripts delete/move system or unrelated files.
