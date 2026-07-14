# Massa-Camus update feed — publishing note

**Client:** `massa_camus_abogados`
**Target OS:** windows
**Channel:** staging
**Signed:** yes (Ed25519, product key `1249894b…f3ea`)

## What is published here

| File | Size | Published |
|------|------|-----------|
| `manifest.json` | ~1.2 KB | ✅ yes (signed) |
| `botpack-windows-massa_camus_abogados-f2578def875c-9b9504f97891.zip` | ~2.5 MB | ✅ yes |
| `core-windows-61037cb-61037cb1b559.zip` | ~209 MB | ❌ **intentionally NOT published** |

## Why the core zip is not here

GitHub rejects any single file larger than 100 MB, and this static feed is
served from GitHub Pages (`nanainest.com`). The core artifact is ~209 MB, so it
cannot be committed/pushed to this repo without Git LFS or an external host.

This is safe for the current first-install rollout:

- The signed `manifest.json` still lists the core's `version`, `sha256` and
  `size_bytes`, so the manifest remains complete and verifiable.
- For a **first same-core install**, the installed app's core version already
  equals `core.version` in the manifest (both are `61037cb-61037cb1b559`, the
  core shipped inside `MassaCamusAbogados_Setup.exe`). When installed core
  version == manifest core version the app has no reason to download the core
  artifact — it only needs to fetch the bot pack. So the missing core zip does
  not block the first update check.
- The bot pack **is** published, so bot-only updates work end to end today.

## Plan for real core updates (when core.version changes)

When a future core release bumps `core.version`, the core zip **must** be
reachable. Options, in order of preference:

1. **Object store behind the licensed auth proxy** (recommended): host
   `core-windows-*.zip` on S3/Cloudflare R2/Backblaze B2 and have the app fetch
   it via the same license-gated proxy described in `ci/feed_tool.py` (valid
   license, `client_id` == path). Keeps the trust model identical; only the
   storage backend changes. The manifest's `core.artifact` can then be an
   absolute URL or a proxy path instead of a sibling filename.
2. **Git LFS** in this repo for `core-windows-*.zip` — simplest but couples
   large binaries to the website repo and GitHub Pages LFS bandwidth limits.
3. **GitHub Releases asset** (up to 2 GB per file) referenced by URL from the
   manifest — cheap, but public unless gated.

Until one of the above is in place, only **same-core (bot-pack-only)** updates
should be advertised on this channel.

_Generated during the Mac signing/publishing pass. The private signing key
never leaves the signing Mac and is not in any repo._
