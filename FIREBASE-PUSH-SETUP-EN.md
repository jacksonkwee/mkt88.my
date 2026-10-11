# Server push (Firebase FCM) - setup steps

Goal: **when a game's result is out, a phone whose app is fully closed still gets
the notification.**

The code is written and deployed. What is left is opening a Firebase project,
which needs your own Google account - I cannot do that part for you. Do it once,
it takes about 15 minutes.

---

## 1) Create the Firebase project (free)

1. Open https://console.firebase.google.com/
2. **Add project** -> name it `MKT88 4D` -> keep clicking Continue
   (Google Analytics can be turned off).

## 2) Add the Android app

1. On the project home page, click the **Android** icon.
2. **Android package name** must be exactly: `com.mkt88.app`
3. Download **`google-services.json`**.
4. Put that file at:
   `C:\dev\GONGXIFACAI\mkt88-app\android\app\google-services.json`

   (The Android project is already set up: when that file exists, the Google
   Services plugin is applied automatically.)

## 3) Turn on Firestore (this is where the phone list lives)

1. Firebase left menu -> **Build -> Firestore Database** -> **Create database**
2. Choose **Production mode**, location `asia-southeast1` (Singapore) is fine.
3. Do not create any collection by hand - the code makes `devices` and `state`.

## 4) Create the server key (so the website can send pushes)

1. Firebase -> gear icon **Project settings** -> **Service accounts**
2. Click **Generate new private key** -> a JSON file downloads.
3. Keep it secret: do **not** put it in git, do not upload it anywhere public.

## 5) Set the environment variables on Vercel

Vercel -> your project -> **Settings -> Environment Variables**, add:

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the **whole contents** of the JSON from step 4 (or its base64) |
| `PUSH_TICK_KEY` (optional) | any password you like, to protect the manual `?force=1` test |

> Pasting it as one line of JSON is easiest. If the dashboard refuses newlines,
> convert the file to base64:
> PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("the-service-account.json"))`
> then paste that string into `FIREBASE_SERVICE_ACCOUNT`.

After saving, **Redeploy** the project once.

## 6) Rebuild the app (v2.21)

In `C:\dev\GONGXIFACAI\mkt88-app`:

```powershell
npm install                # installs @capacitor/push-notifications
npx cap sync android       # adds the plugin to the Android project
```

Then build `MKT88-4D-v2.21.aab` the way you always do and upload it to Google
Play. (`google-services.json` is already in `android/app/`, so the build picks it
up automatically.)

---

## How to check it worked

1. Install the new app build, open it once, allow notifications.
2. Firebase -> Firestore -> the `devices` collection should now have one document
   per phone (with `token`, `lang`, `alerts`).
3. Open this in a browser (replace `<KEY>` with your `PUSH_TICK_KEY`):
   `https://www.mkt88.my/api/push/tick?force=1&key=<KEY>`
   - Before Firebase is set up it answers: `{"ok":false,"configured":false,...}`
   - Once it is set up it answers: `{"ok":true,"sent":<count>,"games":[...]}`
4. You do not have to call that by hand in normal use: `/api/home-live` runs the
   same check every time an app (or the PC's Keep Warm job) polls it - once per
   draw, and again for the next draw on a later date.

## How it works, briefly

- The app POSTs its FCM token plus the chosen language and the alert switch to
  `/api/push/register`, which stores it in Firestore `devices`.
- Every snapshot build checks whether a game's 1st / 2nd / 3rd prizes are all
  published; a game that has just finished is pushed as
  "<game name> + Result ready - tap to open", in the user's language.
- What has already been sent is remembered in Firestore `state/live`, so a draw
  is never announced twice; FCM tokens it reports as dead are deleted.
- The app's own switch (Settings -> Result alerts) controls both sides: switched
  off, the in-app reminder stops and the server stops pushing to that phone.

## Not done yet / notes

- I could not test an actual push, because your Firebase keys
  (`google-services.json` and the service-account JSON) do not exist yet. After
  step 5, paste the output of the `tick` URL above to me and I will fix whatever
  it reports.
- The check is driven by traffic: every open app, plus the PC's Keep Warm job
  every 5 minutes. So a result is pushed within seconds while anyone is using the
  app, and within a few minutes at the very worst. If you want a guaranteed
  one-minute beat even with nobody online, we can add Vercel Cron (paid plan) or
  a separate scheduled job - I left your two existing scheduled tasks untouched.
