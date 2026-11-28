# MKT88 AI handoff

Read `AGENTS.md` before changing the live-results pipeline or the Android app.
This repository is a worktree; `git rev-parse --show-toplevel` is the reliable
way to find the active checkout.

## System map

- Public site: `https://www.mkt88.my`
- Production VPS: `187.127.214.151`
- Production directory: `/srv/mkt88-site`
- Website: Next.js 15.5.25, React 19, Node.js 20+
- Android: Capacitor 6 shell around the live website, API 36 target,
  `com.mkt88.app`, version `2.33` / version code `43`
- Current APK and AAB: `public/mkt88-4d-v2.33.apk` and
  `public/mkt88-4d-v2.33.aab`
- Repositories:
  - GitHub: `https://github.com/jacksonkwee/mkt88.my.git`
  - GitLab: `https://gitlab.com/jacksonkwee/mkt88.my.git`

The production redeploy script clones the GitHub `main` branch.

## What must not regress

1. `GamePager` mounts only the active slide and its immediate neighbours. Do not
   restore a timer that mounts all eleven game slides together.
2. Game pages do not receive the entire past-results date archive as client
   props. `/api/game-past-dates?slug=...` loads one game's dates on demand.
3. Portable Android HTML must have an exact `Content-Length`. Caddy sends
   Android user agents to the `mkt88-android-doc` proxy on `127.0.0.1:3001`.
4. The public listener uses HTTP/1.1 and HTTP/2 and returns `Alt-Svc: clear`.
   Cached HTTP/3 requests reproduced blank, permanently loading WebView pages.
5. Run the full app pager test after navigation changes: start Grand Dragon,
   swipe through the last game, swipe back to Magnum, click a result control,
   then tap the MKT logo and confirm the app home returns.
6. Live result values are written into the DOM outside React. `GamePager`
   snapshots those values in `rememberCardDom()` before a virtualised slide is
   unmounted and restores their stamps in `restoreLiveStamps()`. Snapshot writes
   must call `copyMayWrite()` so an older copy cannot put the previous value back
   on the first frame after remount. Do not move this state into `LotteryCard`:
   that file must remain server-render compatible.

Native regression checks, with the emulator running and App WebView forwarded to
`tcp:9223`:

```powershell
node qa-scripts/check-native-live-flicker.js
node qa-scripts/check-native-all-swipe.js
```

Expected results are respectively `ok: true` while the card is
`unmounted: true`, and `ok: true` for all eleven slides plus the home return.

## Environment variables

Production values live only in the private handoff archive. Required names:

- `FIREBASE_SERVICE_ACCOUNT`
- `GIT_COMMIT_SHA`
- `SG_INGEST_SECRET`
- `MKT88_PAST_STORE`

Do not put real values in this public source tree or in the safe source archive.

## Local website

```powershell
npm install
npm run dev
```

Useful checks:

```powershell
npx tsc --noEmit
$env:MKT88_DEPLOYMENT_BUILD="1"; npm run prebuild
```

The deployment build skips the PC-only recent-30-day archive check because the
VPS does not run the Windows harvesting tasks.

## Production deployment

The safe archive includes the deployment key separately only in the private
archive. On a trusted owner machine:

```powershell
ssh -i PATH_TO_PRIVATE_KEY root@187.127.214.151 "cd /srv/mkt88-site && bash deploy/hostinger/redeploy.sh"
```

`redeploy.sh` builds on the VPS with temporary swap, installs the Android HTML
proxy, restarts Caddy after the directory swap, verifies `Content-Length` and
`Alt-Svc: clear`, and rolls the website back if startup fails.

The installed `mkt88-auto-deploy.timer` checks GitHub `main` every five minutes
and runs the same script when the commit changes. Build failures roll back to
the previous directory; concurrent manual and automatic deploys share one lock.
Verified on the production VPS on 28 Nov 2026.

Production services:

- `mkt88-site.service`
- `mkt88-android-doc.service`
- Docker container `mkt88-site-caddy-1`

## Android build

Prerequisites: JDK 17+, Android SDK with API 36, and the original upload
keystore. The keystore and `keystore.properties` are in the private archive.

```powershell
$env:JAVA_HOME="C:\Users\dabom\Android\jdk"
$env:ANDROID_HOME="C:\Users\dabom\.android-sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
cd mkt88-app\android
.\gradlew.bat assembleRelease
```

The signed keystore is required to publish updates over the installed app. Do
not generate a replacement signing key once the app is on Google Play.

## Restore outline

1. Extract the safe source archive.
2. Restore the private environment file and Android keystore only on a trusted
   machine.
3. Run `npm install` and `npm run build`.
4. Install the Next.js and Android-proxy systemd units, copy the Caddyfile to
   the path mounted by `deploy/hostinger/docker-compose.yml`, and start Caddy.
5. Restore the server `data` and `public/uploads` snapshot from the safe archive
   before the first production start.
6. Run the deployment and app pager verification described above.

See `BACKUP-README.md` in the handoff archive for exact archive contents,
checksums, and the sensitive-file split.
