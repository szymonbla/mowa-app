# 15 - Packaging: electron-builder config and Mac install instructions

## Goal

Szymon clones the repo on his Mac in the morning, runs two commands, and
gets a DMG and a zip of `mowa` for Apple Silicon, with README telling him
what to do when Gatekeeper complains.

## Workspace

Integration branch: `byok`. Follow `roles/_common.md`.
Worktree id: `15-packaging`. No dependency on other tickets; land as early
as possible, before tickets 10, 11, 13 and 14.

## What is already known

- `package.json` has `"build:mac": "npm run build && electron-builder --mac
  --arm64"` and `"build": null`. `electron-builder` 26.x is a devDependency.
- `electron-builder.yml` at the repo root already holds a mac config: `appId
  com.szymon.mowa`, `productName mowa`, `directories.buildResources: build`,
  `files: out/**, package.json`, mac `category`, dmg target arm64,
  `extendInfo` (LSUIElement, microphone and Apple Events usage strings),
  `hardenedRuntime`, entitlements from `build/entitlements.mac.plist`,
  `identity: SimpleWhisper Local`, `notarize: false`, and a dmg
  `artifactName`. Szymon wants this config in `package.json`, so move it,
  do not duplicate it.
- `build/icon.png` and `build/entitlements.mac.plist` exist.
- README section "Build lokalny" explains why the build uses a self-signed
  certificate named `SimpleWhisper Local`: macOS pins TCC permissions
  (microphone, Accessibility) to the code signature, and an ad-hoc signature
  changes on every build. Keep that explanation and that path; it is the
  recommended one.
- This machine is Linux. `npm run build` (electron-vite) works here;
  `electron-builder --mac` does not. There is no `gh` and no GitHub
  credentials here, so the workflow cannot be tried today.

## Design

1. Move the whole mac config into `package.json` under `"build"` and delete
   `electron-builder.yml`. Targets: `dmg` and `zip`, both `arm64`. Keep
   `appId`, `productName`, `directories.buildResources`, `files`,
   `category`, `extendInfo`, `hardenedRuntime`, entitlements, `notarize:
   false`, the dmg `artifactName`, and add a matching zip artifact name.
   Icon: `build/icon.png` is picked up from `buildResources`; set
   `mac.icon` explicitly only if the docs say it is required. Verify every
   key against the current electron-builder docs (`https://www.electron.build/`
   configuration and mac pages) and note the URLs.
2. Signing stays on the self-signed identity by default. Add one line to
   README showing how to build without that certificate:
   `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac` with
   `identity` overridden to null on the command line
   (`--config.mac.identity=null`), or whichever form the docs confirm works
   with electron-builder 26. Check the docs; do not guess.
3. README, new section "Instalacja na Macu" placed before "Build lokalny":
   `git clone`, `git checkout byok` (or `main` once merged), `npm ci`,
   `npm run build:mac`, where the DMG and zip land (`dist/`), how to install
   (drag to Applications), and what to do when Gatekeeper refuses an app
   that came from a download or another machine:
   `xattr -dr com.apple.quarantine /Applications/mowa.app`. Note that a DMG
   built on the same Mac carries no quarantine flag, so that step is only
   for copied or downloaded builds. Polish without diacritics, same voice as
   the rest of README.
4. `.github/workflows/release.yml`: `on: workflow_dispatch` plus tag push
   `v*`, runner `macos-14`, steps: checkout, setup-node 22 with npm cache,
   `npm ci`, `npm run typecheck`, `npm test`, `npm run build:mac` with
   `CSC_IDENTITY_AUTO_DISCOVERY=false` and `identity` null (unsigned CI
   build, Gatekeeper step in README covers it), `actions/upload-artifact`
   with `dist/*.dmg` and `dist/*.zip`. This file is for later; nobody runs
   it tonight and it blocks nothing.
5. Test `test/packaging.test.ts`: reads `package.json` and asserts
   `build.appId`, `build.productName`, mac targets include `dmg` and `zip`
   each with `arm64`, `extendInfo.NSMicrophoneUsageDescription` is present,
   entitlements file and `build/icon.png` exist, and `electron-builder.yml`
   is gone. Also assert the workflow file exists and contains `macos-14`,
   `npm ci`, `build:mac`, `upload-artifact`.

## Done when

- `package.json` holds the whole electron-builder config, dmg and zip for
  arm64, and `electron-builder.yml` is deleted; `test/packaging.test.ts`
  pins it.
- README has "Instalacja na Macu" with clone, `npm ci`, `npm run
  build:mac`, output location, and the Gatekeeper `xattr` step; the
  workflow file exists and is described in README as not yet exercised.
- `npm run typecheck`, `npm test`, `npm run build` pass. A real
  `build:mac` is not possible here; say so in notes.

## Scope edge

No code signing certificates, no notarization, no Intel build, no
auto-update, no version bump. Do not run the workflow. Do not touch
`src/`.

## Evidence bar

Command tails, docs URLs, test names, landed commit range, the final
`build` block quoted in notes.

## Deliverable

Append handoff to `/home/szymon/mowa/specs/superwhisper-byok/notes.md`, then
stop.
