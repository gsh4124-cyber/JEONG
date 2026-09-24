# Global Shorts — Kaggle Remote Blender Runner

Purpose: free remote Blender execution without requiring Blender on the Emperor's PC and without Codex credits.

## Why Kaggle
- Remote notebook VM
- Free GPU quota subject to Kaggle limits
- Internet-enabled notebooks can download Blender
- Notebook versions can run headlessly and preserve outputs
- Kaggle CLI/API can push and execute kernels after one-time user authentication

## Canonical technical source
This folder is the source of truth for the Kaggle runner.
Vault owner: 직장/콘텐츠/글로벌 숏츠/

## Current target
1. Remote runner smoke
2. Blender 5.2.2 headless launch
3. Cycles CUDA render
4. Persist PNG + BLEND + JSON result
5. Only then wire MorphMint 005

## Important
- Runway forbidden.
- This is a free remote executor candidate.
- Do not call the route production-ready until the actual Kaggle smoke passes.
- Kaggle quotas/availability are not guaranteed.
