# 服务器推送（Firebase FCM）设置步骤

目标：**手机把 App 完全关闭时，某个游戏成绩一出炉，也能收到通知。**

程序码已经写好并上线了。剩下的是「开通 Firebase 帐号设定」这件事 —— 那需要你的
Google 帐号，我没办法代你做。照着下面做一次就好（大约 15 分钟）。

---

## 1) 建立 Firebase 专案（免费）

1. 打开 https://console.firebase.google.com/
2. **Add project** → 名字例如 `MKT88 4D` → 一路 Continue（Google Analytics 可以关掉）。

## 2) 加入 Android App

1. 专案首页点 **Android** 图示。
2. **Android package name** 一定要填：`com.mkt88.app`
3. 下载 **`google-services.json`**。
4. 把这个档案放到：
   `C:\dev\GONGXIFACAI\mkt88-app\android\app\google-services.json`

   （Android 专案已经写好：档案存在时会自动套用 Google Services 外挂。）

## 3) 打开 Firestore（用来存手机清单）

1. Firebase 左侧 → **Build → Firestore Database** → **Create database**
2. 选 **Production mode**，地区选 `asia-southeast1`（新加坡）即可。
3. 不需要自己建 collection —— 程式会自动建立 `devices` 和 `state`。

## 4) 产生服务器金钥（让网站能发通知）

1. Firebase → 齿轮 **Project settings** → **Service accounts**
2. 点 **Generate new private key** → 下载 JSON 档。
3. 这个档案是机密：**不要**放进 git、不要上传到任何公开地方。

## 5) 在 Vercel 设定环境变数

Vercel → 你的专案 → **Settings → Environment Variables** 新增：

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | 第 4 步那个 JSON 档的**全部内容**（或把它转成 base64 也可以） |
| `PUSH_TICK_KEY`（可选） | 随便一串密码，用来保护手动测试用的 `?force=1` |

> 存成一整行 JSON 最方便；如果面板不接受换行，就把档案转成 base64：
> PowerShell：`[Convert]::ToBase64String([IO.File]::ReadAllBytes("下载的服务帐号.json"))`
> 然后把那串字贴进 `FIREBASE_SERVICE_ACCOUNT`。

设定完请 **Redeploy** 一次。

## 6) 重新打包 App（v2.21）

在 `C:\dev\GONGXIFACAI\mkt88-app` 底下：

```powershell
npm install                # 装上 @capacitor/push-notifications
npx cap sync android       # 把外挂加入 Android 专案
```

接着照原本的打包流程产生 `MKT88-4D-v2.21.aab`，上传 Google Play。
（`google-services.json` 已放在 `android/app/`，打包时会自动套用。）

---

## 怎么确认成功

1. 手机装好新版 App、打开一次、允许通知。
2. Firebase → Firestore → `devices` collection 应该出现一笔文件（里面有 `token`、`lang`）。
3. 浏览器打开（把 `<KEY>` 换成你设的 `PUSH_TICK_KEY`）：
   `https://www.mkt88.my/api/push/tick?force=1&key=<KEY>`
   - 还没设定 Firebase 时它会回：`{"ok":false,"configured":false,...}`
   - 设定好后回：`{"ok":true,"sent":<数量>,"games":[...]}`
4. 平常不用手动呼叫：`/api/home-live` 每次被 App 或 Keep Warm 打开时都会自动检查一次
   （同一个开彩只发一次；隔一期新开彩会再发一次）。

## 运作方式（简述）

- App 把 FCM token 连同语言 POST 到 `/api/push/register` → 存进 Firestore `devices`。
- 服务器每次建立快照时检查「1st / 2nd / 3rd 是否都出了」；刚出的游戏会推
  「游戏名称 + 成绩已出炉 · 点击打开」给所有已注册手机，语言跟着用户设定。
- 已通知过的开彩记在 Firestore `state/live`，不会重复发；FCM 回报失效的 token 会自动删除。
- App 内建的「成绩出炉提醒」开关（设置页）同时控制两边：关掉它，App 开着时的提醒会停，
  服务器也不会再推给这台手机（开关状态会跟着 token 一起送回服务器）。

## 还没做／要注意

- 我这边**无法测试**推送，因为还没有你的 Firebase 金钥（`google-services.json` 和服务帐号）。
  设定好之后如果 `tick` 回传错误，把回传内容贴给我，我来修。
- 若之后想「只推某些游戏」或「只推大奖」，跟我说，加一张筛选清单即可。
