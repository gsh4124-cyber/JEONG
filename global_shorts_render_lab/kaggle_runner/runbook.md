# Kaggle Runner Runbook

## One-time user dependency
Kaggle account authentication is required once. Do not paste API tokens into chat.

Official safe options:
- kaggle auth login (browser OAuth)
- Kaggle API token stored locally by the user

## After auth
1. Copy kernel-metadata.template.json -> kernel-metadata.json
2. Replace YOUR_KAGGLE_USERNAME
3. Run:
   kaggle kernels push -p global_shorts_render_lab/kaggle_runner
4. Poll:
   kaggle kernels status USER/global-shorts-blender-remote-worker
5. Download outputs:
   kaggle kernels output USER/global-shorts-blender-remote-worker -p out

## Pass
Expected markers:
- KAGGLE_BLENDER_REMOTE_SMOKE_PASS
- KAGGLE_REMOTE_WORKER_PASS

Expected files:
- global_shorts_blender/output/kaggle_blender_smoke.png
- global_shorts_blender/output/kaggle_blender_smoke.blend
- global_shorts_blender/output/result.json

## Promotion
Only after an actual remote pass:
KAGGLE_REMOTE_BLENDER_GPU_PROVED

Then replace smoke payload with MorphMint 005 production script.
