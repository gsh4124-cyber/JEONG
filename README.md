# actions — support / recovery repository

> ROLE LOCK — 2026-10-03

This repository is **not a primary project owner or default production repository** for the 황제 Project.

## Current role

`gsh4124-cyber/actions` is a **support / recovery / fallback repository**.

Use it only when:
1. the primary `gsh4124-cyber/hwangje-vault` GitHub Actions path has a verified blocker,
2. diagnosis, recovery, or temporary execution support is needed,
3. the support scope is explicit,
4. the workflow is intended to return to the 황제 primary path after recovery.

## Primary owner

- 황제 Canonical + default project execution + default GitHub Actions: `gsh4124-cyber/hwangje-vault`
- Independent software products: their explicitly assigned technical repositories

## Existing assets here

Historical Global Shorts Blender/render/QA/factory assets may be reused as **support and recovery assets**. Their existence or past successful runs do **not** make `actions` the current production source or PRIMARY execution route.

The repository was previously named `JEONG`. That name is historical only and must not be used as a current path.

## Prohibited interpretation

Do not treat this repository as:
- the general 황제 workspace,
- a Global Shorts primary execution repo,
- a second Canonical,
- the default place for new content factories or automation,
- a reason to bypass `hwangje-vault` because code already exists here.

Expected route:

`HWANGJE PRIMARY -> VERIFIED BLOCKER -> actions SUPPORT -> RECOVERY / PROOF -> RETURN TO HWANGJE PRIMARY`
