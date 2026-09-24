# MorphMint 005 — Agent Execution Brief

You are controlling Blender through the official Blender MCP route.

## Goal
Create a vertical 9:16 material-transformation short whose payoff is the physical transformation of one exact emblem/medallion through:
1. warm ceramic
2. reflective liquid-like chrome
3. transparent/faceted blue crystal

## Locked identity
The object identity must remain recognizably the same through every state:
- circular medallion body
- central vertical rounded bar
- circular inner emblem/ring relationship
Do not redesign the silhouette between materials.

## Viewer-facing quality target
Internal threshold: 90/100 before Emperor review.

## Required material behavior
Ceramic:
- warm tactile matte surface
- believable roughness/microtexture
- grounded contact shadow

Chrome:
- actual environment reflections
- moving/bending highlights tied to geometry/camera
- no painted white-stripe fake reflection grammar as the main cue
- surface takeover should read as physical material spreading over the object

Crystal:
- genuine transparency/transmission cue
- refraction/internal depth
- irregular facets
- caustic/highlight behavior where feasible
- no flat cyan wheel/grid look

## Transition
Do not use a simple crossfade.
Preferred structure:
- ceramic surface begins to liquefy or glaze
- chrome spreads directionally across the same body
- chrome shell fractures or crystallizes
- crystal growth completes the same object identity

## Camera / light
- vertical hero framing
- object large in frame
- subtle camera push
- reactive key/fill/rim light
- background stays subordinate
- no UI/progress dots/pedestal-demo interface

## Production sequence
1. Run/inspect morphmint_005_scene.py base scene.
2. Produce stills for ceramic/chrome/crystal states.
3. Compare readability at normal viewing size.
4. Build shader/geometry transition.
5. Render 2–3s low-res proxy.
6. Fix hard gaps before full render.
7. Render 1080x1920 final.
8. Preserve .blend/source/proxy/final/hash/QA evidence.

## Fail conditions
- identity changes
- chrome reads like graphic stripes
- crystal reads like neon icon
- flat/static A→B→C slideshow
- no physical consequence from transformation
- candidate scores below 90 internally
