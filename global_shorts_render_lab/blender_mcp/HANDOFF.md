# Blender MCP Portable Handoff

Use this when a new Chat, agent, or PC has to continue Global Shorts Blender production.

## Canonical first
Read:
1. Vault START_HERE.md
2. 직장/_INDEX.md
3. 직장/콘텐츠/_INDEX.md
4. 직장/콘텐츠/글로벌 숏츠/_INDEX.md
5. 직장/콘텐츠/글로벌 숏츠/Blender_MCP_로컬_제작환경.md
6. Supabase content_portfolio / global_shorts current state

## Technical source
Repo: gsh4124-cyber/JEONG
Branch: global-shorts-render-lab
Root: global_shorts_render_lab/blender_mcp/

## Do not infer readiness
Source persistence is not execution proof.

Required gate sequence:
1. Blender 5.1+ present; 5.2.2 LTS recommended.
2. Official Blender MCP add-on/server connected.
3. Execute smoke_scene.py.
4. Confirm PNG + BLEND files exist.
5. Confirm output contains BLENDER_MCP_LOCAL_SMOKE_PASS.
6. Reopen/read scene through the MCP agent.
7. Only then mark LOCAL_SMOKE_PASS.

## MorphMint 005
After smoke:
1. Execute morphmint_005_scene.py.
2. Inspect ceramic/chrome/crystal states separately.
3. Replace placeholder state markers with real shader/geometry transition.
4. Render proxy with render_proxy.py.
5. Internal viewer-facing QA.
6. Do not expose candidate below 90/100.
7. Persist .blend/source/proxy/final/hash/QA evidence and read back exact final binary before handoff/publish gate.

## Locked constraints
- Runway forbidden.
- Python/Pillow 2.5D remains fallback only.
- No simple crossfade as material transformation.
- Same object identity must survive all states.
