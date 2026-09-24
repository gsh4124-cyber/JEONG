# Global Shorts Public Render Runner

Public-safe execution wrapper for free standard GitHub-hosted runners.

## Purpose
Run Blender headless remotely without consuming private-repo Actions minutes.

## Security / disclosure boundary
Only put files here that are safe to be public.
Do not include:
- Vault documents
- private business notes
- credentials/tokens
- unpublished strategy documents
- private customer/user data

## Smoke path
1. GitHub public repository
2. ubuntu-latest standard runner
3. download Blender 5.2.2 Linux portable
4. render one 256x256 Eevee smoke frame
5. commit only the PNG and JSON result back to the public repository
6. no upload-artifact usage

Expected marker:
PUBLIC_GITHUB_BLENDER_SMOKE_PASS
