package com.mkt88.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * One-tap in-app updates.
 *
 * Every content change already reaches the app instantly because the WebView
 * loads the live website. This class only handles a new native build (icon,
 * permissions, plugins, app name): it checks a small manifest on the website,
 * and when a newer build exists it offers to download and install it right
 * inside the app - the user never has to find an APK link again.
 */
public final class AppUpdater {

  private static final String MANIFEST_URL = "https://www.mkt88.my/app-version.json";
  private static final Handler UI = new Handler(Looper.getMainLooper());

  private static long downloadId = -1L;
  private static BroadcastReceiver receiver;
  private static String pendingUrl;
  private static String pendingName;

  private AppUpdater() {}

  /** Quiet check, run once the app is usable. */
  public static void check(Activity activity) { check(activity, false); }

  /** Check and tell the user something when nothing happens (manual button). */
  public static void check(Activity activity, boolean manual) {
    new Thread(() -> {
      JSONObject manifest = null;
      try { manifest = fetchManifest(); } catch (Exception ignored) { }
      final JSONObject found = manifest;
      UI.post(() -> {
        if (activity.isFinishing() || activity.isDestroyed()) return;
        if (found == null) {
          if (manual) toast(activity, "Could not check for updates.");
          return;
        }
        int latest = found.optInt("versionCode", 0);
        if (latest <= installedVersionCode(activity)) {
          if (manual) toast(activity, "You already have the latest version.");
          return;
        }
        offer(activity, found);
      });
    }).start();
  }

  /** Continue a download that was paused for the "install unknown apps" prompt. */
  public static void onResume(Activity activity) {
    if (pendingUrl == null) return;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        && !activity.getPackageManager().canRequestPackageInstalls()) {
      return;
    }
    String url = pendingUrl;
    String name = pendingName;
    pendingUrl = null;
    pendingName = null;
    startDownload(activity, url, name, "");
  }

  /** Drop the download receiver when the activity goes away. */
  public static void stop(Activity activity) {
    if (receiver == null) return;
    try { activity.getApplicationContext().unregisterReceiver(receiver); } catch (Exception ignored) { }
    receiver = null;
  }

  // ---------------------------------------------------------------- internals

  private static JSONObject fetchManifest() throws Exception {
    HttpURLConnection conn = (HttpURLConnection) new URL(MANIFEST_URL + "?t=" + System.currentTimeMillis()).openConnection();
    conn.setConnectTimeout(8000);
    conn.setReadTimeout(8000);
    conn.setRequestProperty("Cache-Control", "no-cache");
    try {
      if (conn.getResponseCode() != 200) return null;
      StringBuilder sb = new StringBuilder();
      try (BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"))) {
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
      }
      return new JSONObject(sb.toString());
    } finally {
      conn.disconnect();
    }
  }

  private static int installedVersionCode(Activity activity) {
    try {
      PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
      return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? (int) info.getLongVersionCode() : info.versionCode;
    } catch (Exception e) {
      return 0;
    }
  }

  private static void offer(Activity activity, JSONObject manifest) {
    String name = manifest.optString("versionName", "");
    String notes = manifest.optString("notes", "");
    String message = "A new version of MKT 4D is ready.";
    if (!name.isEmpty()) message = "MKT 4D " + name + " is ready to install.";
    if (!notes.isEmpty()) message += "\n\n" + notes;

    new AlertDialog.Builder(activity)
        .setTitle("Update available")
        .setMessage(message)
        .setCancelable(true)
        .setPositiveButton("Update now", (d, w) -> begin(activity, manifest))
        .setNegativeButton("Later", null)
        .show();
  }

  private static void begin(Activity activity, JSONObject manifest) {
    String url = manifest.optString("apkUrl", "");
    if (url.isEmpty()) return;
    String name = "mkt88-4d-" + manifest.optString("versionName", "latest") + ".apk";

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        && !activity.getPackageManager().canRequestPackageInstalls()) {
      pendingUrl = url;
      pendingName = name;
      toast(activity, "Allow \"Install unknown apps\", then tap Update again.");
      try {
        Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + activity.getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(i);
      } catch (Exception ignored) { }
      return;
    }
    startDownload(activity, url, name, manifest.optString("versionName", ""));
  }

  private static void startDownload(Activity activity, String url, String fileName, String version) {
    try {
      DownloadManager dm = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
      if (dm == null) return;
      DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
      req.setTitle("MKT 4D update");
      if (!version.isEmpty()) req.setDescription("Version " + version);
      req.setMimeType("application/vnd.android.package-archive");
      req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
      req.setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, fileName);
      downloadId = dm.enqueue(req);
      watch(activity);
      toast(activity, "Downloading the update…");
    } catch (Exception e) {
      toast(activity, "Could not start the update. Please try again.");
    }
  }

  private static void watch(Activity activity) {
    if (receiver != null) return;
    receiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
        if (id != downloadId) return;
        downloadId = -1L;
        finish(context, id);
      }
    };
    IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
    try {
      if (Build.VERSION.SDK_INT >= 33) {
        activity.getApplicationContext().registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
      } else {
        activity.getApplicationContext().registerReceiver(receiver, filter);
      }
    } catch (Exception ignored) { }
  }

  private static void finish(Context context, long id) {
    try {
      DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
      if (dm == null) return;
      try (Cursor c = dm.query(new DownloadManager.Query().setFilterById(id))) {
        if (c == null || !c.moveToFirst()) return;
        int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
        String local = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));
        if (status != DownloadManager.STATUS_SUCCESSFUL || local == null) {
          UI.post(() -> toast(context, "The update download failed."));
          return;
        }
        File apk = new File(Uri.parse(local).getPath());
        if (!apk.exists()) {
          UI.post(() -> toast(context, "The update file is missing."));
          return;
        }
        Uri apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk);
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(apkUri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        UI.post(() -> {
          try { context.startActivity(install); }
          catch (Exception e) { toast(context, "Open the notification to finish installing."); }
        });
      }
    } catch (Exception e) {
      UI.post(() -> toast(context, "Open the notification to finish installing."));
    }
  }

  private static void toast(Context context, String message) {
    try { Toast.makeText(context, message, Toast.LENGTH_LONG).show(); } catch (Exception ignored) { }
  }
}
