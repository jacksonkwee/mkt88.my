package com.mkt88.app;

import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.RenderProcessGoneDetail;
import android.widget.FrameLayout;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * MKT 4D app.
 *
 * AdMob is used for in-app advertising. AdSense is intentionally skipped on the
 * website when it is opened inside this app (see the web-side app detector).
 */
public class MainActivity extends BridgeActivity {
  private static final int APP_UPDATE_REQUEST = 1001;
  private volatile boolean webViewReady = false;
  private AppUpdateManager appUpdateManager;
  private final Handler appHandler = new Handler(Looper.getMainLooper());
  private AdView bannerAd;
  private static final String HOME_URL = "https://www.mkt88.my/";
  private boolean stalePageRecoveryStarted = false;
  private boolean homeClassRepairSent = false;

  private final class MktWebViewClient extends BridgeWebViewClient {
    MktWebViewClient(Bridge bridge) {
      super(bridge);
    }

    private static boolean isAppHost(Uri url) {
      String host = url.getHost();
      return "mkt88.my".equals(host) || "www.mkt88.my".equals(host);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
      if (isAppHost(request.getUrl())) return false;
      return super.shouldOverrideUrlLoading(view, request);
    }

    @Override
    @SuppressWarnings("deprecation")
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
      if (isAppHost(Uri.parse(url))) return false;
      return super.shouldOverrideUrlLoading(view, url);
    }

    /**
     * A crashed WebView renderer leaves the Activity alive but shows a blank,
     * unresponsive page. Users previously had to force-close the app. Recreate
     * the single Activity instead, which runs loadFreshHome() and restores a
     * working page automatically.
     */
    @Override
    public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
      if (!isFinishing()) appHandler.postDelayed(MainActivity.this::recreate, 250);
      return true;
    }
  }

  /**
   * Retry delays for a banner that failed to load, then a steady 10-minute retry.
   *
   * AdMob answers "no ad" for a brand-new app much more often than it fills, and the
   * old code gave up for the whole session on the first empty answer - so the app
   * could show nothing all evening even though ads were working. The view is now
   * kept alive and asked again instead of being destroyed.
   */
  private static final long[] AD_RETRY_MS = { 30_000L, 60_000L, 120_000L, 300_000L, 600_000L };
  private int adAttempts = 0;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
    splashScreen.setKeepOnScreenCondition(() -> !webViewReady);

    super.onCreate(savedInstanceState);
    showSplashBackground();
    configureWebView();
    loadFreshHome();
    checkForAppUpdate();
    startWebViewReadyCheck();
    installResultBridge();
    registerBackCallback();

    // Keep the launch logo up until the page has actually painted.
    // WebViewReadyCheck below releases it as soon as the page has real content,
    // which normally happens well before this delay. The delay is only a safety
    // net: without it, a page that never loads would leave the app sitting on
    // the logo forever. It used to be 1500ms, which dropped the logo onto the
    // bare red backdrop about a second before the page appeared.
    appHandler.postDelayed(this::markWebViewReady, 15000);
    // Ads wait ten seconds now. At 2.5s the AdMob initialisation and the first
    // banner load landed exactly when people tap their first game, and on a
    // slower phone that first tap felt dead while the ad SDK worked. Nothing
    // about the first ten seconds needs an ad.
    appHandler.postDelayed(this::initializeAds, 10000);
  }

  @Override
  public void onStart() {
    super.onStart();
    // Do not clear the WebView cache here. The website sends no-cache for live
    // data, while static assets should stay cached for a fast app.
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    loadFreshHome();
  }

  @Override
  public void onResume() {
    super.onResume();
    if (bannerAd != null) bannerAd.resume();
  }

  @Override
  public void onPause() {
    if (bannerAd != null) bannerAd.pause();
    super.onPause();
  }

  @Override
  public void onDestroy() {
    appHandler.removeCallbacksAndMessages(null);
    if (bannerAd != null) {
      bannerAd.destroy();
      bannerAd = null;
    }
    super.onDestroy();
  }

  /**
   * Where the page says it is, for the back key.
   *
   * "home"  - the app's own first screen is open, so back may leave the app.
   * "page"  - a results page is open, so back should show the first screen.
   * "none"  - the page does not carry the hooks (an older cached copy), in which
   *           case the key keeps its old behaviour instead of doing nothing.
   */
  private static final String JS_BACK_STATE =
      "(function(){try{"
      + "if(!window.__mktAtHome||!window.__mktGoHome)return 'none';"
      + "return window.__mktAtHome()?'home':'page';"
      + "}catch(e){return 'none';}})()";
  private static final String JS_GO_HOME =
      "(function(){try{window.__mktGoHome&&window.__mktGoHome();}catch(e){}})()";
  private static final String JS_PAGE_STATE =
      "(function(){try{"
      + "var h=document.querySelector('.mkt-app-home');"
      + "var d=h?getComputedStyle(h).display:'none';"
      + "var t=h?(h.innerText||'').trim().length:0;"
      + "return [document.readyState,h?1:0,d,t].join('|');"
      + "}catch(e){return 'error|0|none|0';}})()";
  private static final String JS_REPAIR_HOME_CLASS =
      "(function(){try{document.body.classList.add('mkt-in-app','mkt-home-open');"
      + "return document.body.className;}catch(e){return '';}})()";

  /**
   * The phone's back key always lands on the app's own first screen.
   *
   * Capacitor has no back handling of its own here, so the key used to close the
   * app from whatever page was open. The page reports which screen it is on: on
   * the first screen the key leaves the app, and anywhere else it asks the page
   * to show that screen first (asked for 14 Oct 2026).
   */
  /**
   * One handler for both back systems.
   *
   * Android 13+ delivers back through OnBackInvokedCallback once it is enabled
   * in the manifest, and from Android 15 (apps targeting 35+) that is the only
   * path - onBackPressed() is not called any more, so the key closed the app
   * instead of showing the first screen (reported 17 Oct 2026). The legacy
   * override stays for phones below 13.
   */
  private void handleBack() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) {
      finish();
      return;
    }
    try {
      webView.evaluateJavascript(JS_BACK_STATE, value -> {
        String state = value == null ? "" : value;
        if (state.contains("page")) {
          webView.evaluateJavascript(JS_GO_HOME, null);
        } else if (state.contains("home")) {
          // Already on the first screen: this is the press that leaves the app.
          finish();
        } else {
          // No hooks yet (still loading, or an old cached copy). Go to the
          // first screen - back should never be what closes the app.
          webView.evaluateJavascript("(function(){try{location.href='/';}catch(e){}})()", null);
        }
      });
    } catch (Exception ignored) {
      finish();
    }
  }

  /** Android 13+: register the callback the system uses instead of onBackPressed. */
  private void registerBackCallback() {
    if (Build.VERSION.SDK_INT >= 33) {
      getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
          android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
    }
  }

  @Override
  public void onBackPressed() {
    handleBack();
  }

  /**
   * Fill behind the transparent WebView after the launch screen goes away.
   *
   * This used to be R.drawable.splash_screen, which draws the same logo as the
   * launch screen - so people saw the logo, then saw it again a moment later.
   * A flat brand-red fill keeps the same look without repeating the artwork.
   */
  private void showSplashBackground() {
    View root = findViewById(android.R.id.content);
    if (root != null) {
      root.setBackgroundColor(getColor(R.color.splashBackground));
    }
  }

  /** Google Play in-app update: Play-installed users update directly in the app. */
  private void checkForAppUpdate() {
    try {
      if (appUpdateManager == null) appUpdateManager = AppUpdateManagerFactory.create(this);
      appUpdateManager.getAppUpdateInfo().addOnSuccessListener(info -> {
        if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
            && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
          try {
            appUpdateManager.startUpdateFlowForResult(
                info,
                this,
                AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                APP_UPDATE_REQUEST
            );
          } catch (Exception ignored) {
            // Update check must never block the live results.
          }
        }
      });
    } catch (Exception ignored) {
      // Sideloaded APKs simply do not receive Play updates.
    }
  }
  private void configureWebView() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;
    if (getBridge() != null) {
      getBridge().setWebViewClient(new MktWebViewClient(getBridge()));
    }

    webView.setBackgroundColor(Color.TRANSPARENT);
    webView.setVisibility(View.VISIBLE);
    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
    webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
    webView.setHorizontalScrollBarEnabled(false);
    webView.setVerticalScrollBarEnabled(false);
    webView.setScrollbarFadingEnabled(true);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      try {
        webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
      } catch (Exception ignored) {
        // not fatal on devices that do not support renderer priority
      }
    }

    WebSettings settings = webView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setLoadsImagesAutomatically(true);
    settings.setBlockNetworkImage(false);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    settings.setSupportZoom(false);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setMediaPlaybackRequiresUserGesture(true);
    // Android's system font scale (Settings > Display > Font size) multiplies
    // WebView text on top of our CSS. The result cards are fixed 5-column
    // tables sized for 22-24px numbers, so a Large font setting pushes the
    // numbers past the card and off the page. Pin web text to 100% - only the
    // web content, the app's own chrome still follows the system setting.
    settings.setTextZoom(100);

    // Used by the website to disable AdSense inside the Android app and avoid
    // mixing web ads with the app's AdMob ads.
    String ua = settings.getUserAgentString();
    if (ua != null && !ua.contains("MKT88Android")) {
      settings.setUserAgentString(ua + " MKT88Android");
    }
  }

  /**
   * Start each launcher tap from a clean home page.
   *
   * Android's singleTask activity keeps the WebView and its previous URL alive
   * between launches. That is why the first open could resume an old page or an
   * old cached bundle, while closing the app and opening it again appeared to
   * fix it. The unique query forces a network document; clearing only the HTTP
   * cache keeps favourites, notifications and login data intact.
   */
  private void loadFreshHome() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;
    stalePageRecoveryStarted = false;
    homeClassRepairSent = false;
    try {
      webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
      webView.clearCache(true);
      webView.clearHistory();
      webView.loadUrl(HOME_URL + "?appLaunch=" + System.currentTimeMillis());
      appHandler.postDelayed(() -> {
        if (webView.getSettings() != null) {
          webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
        }
      }, 5000);
    } catch (Exception ignored) {
      // A cache reset failure must not stop the app from opening.
    }
  }

  private void initializeAds() {
    if (bannerAd != null || isFinishing()) return;
    try {
      MobileAds.initialize(this, initializationStatus -> runOnUiThread(this::createBannerAd));
    } catch (Exception ignored) {
      // Ad failure must never stop the results app from working.
    }
  }

  private void createBannerAd() {
    if (bannerAd != null || isFinishing()) return;

    ViewGroup root = findViewById(android.R.id.content);
    if (root == null) return;

    bannerAd = new AdView(this);
    bannerAd.setAdUnitId(getString(R.string.admob_banner_unit_id));
    bannerAd.setAdSize(AdSize.BANNER);
    bannerAd.setAlpha(0f);

    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.BOTTOM
    );
    root.addView(bannerAd, params);

    bannerAd.setAdListener(new AdListener() {
      @Override
      public void onAdLoaded() {
        if (bannerAd == null) return;
        adAttempts = 0;
        setWebViewBottomPadding(60);
        bannerAd.animate().alpha(1f).setDuration(200).start();
      }

      @Override
      public void onAdFailedToLoad(LoadAdError adError) {
        if (bannerAd == null || isFinishing()) return;
        long delay = AD_RETRY_MS[Math.min(adAttempts, AD_RETRY_MS.length - 1)];
        adAttempts++;
        appHandler.postDelayed(MainActivity.this::reloadBanner, delay);
      }
    });

    bannerAd.loadAd(new AdRequest.Builder().build());
  }

  /** Ask AdMob again. The view is reused, so nothing flickers when it does fill. */
  private void reloadBanner() {
    if (bannerAd == null || isFinishing()) return;
    try {
      bannerAd.loadAd(new AdRequest.Builder().build());
    } catch (Exception ignored) {
      // Ad failure must never stop the results app from working.
    }
  }

  private void removeBannerAd() {
    setWebViewBottomPadding(0);
    if (bannerAd == null) return;
    ViewGroup parent = (ViewGroup) bannerAd.getParent();
    if (parent != null) parent.removeView(bannerAd);
    bannerAd.destroy();
    bannerAd = null;
  }

  private void setWebViewBottomPadding(int dp) {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;
    int px = (int) (dp * getResources().getDisplayMetrics().density);
    webView.setPadding(0, 0, 0, px);
    webView.setClipToPadding(false);
  }

  private void startWebViewReadyCheck() {
    appHandler.postDelayed(new WebViewReadyCheck(), 250);
  }

  private void markWebViewReady() {
    if (webViewReady) return;
    webViewReady = true;
    appHandler.removeCallbacksAndMessages(null);
    // Re-schedule only the AdMob initialization that may have been removed.
    if (bannerAd == null) appHandler.postDelayed(this::initializeAds, 250);
  }

  private boolean isPageReady(String value) {
    if (value == null) return false;
    String clean = value.replace("\"", "");
    String[] parts = clean.split("\\|", -1);
    if (parts.length < 4) return false;

    try {
      int homePresent = Integer.parseInt(parts[1].trim());
      int homeTextLength = Integer.parseInt(parts[3].trim());
      // The website header alone is not a usable app screen. Keep the launch
      // logo up until the actual home tiles are present and visible.
      return "complete".equals(parts[0].trim())
          && homePresent == 1
          && !"none".equals(parts[2].trim())
          && homeTextLength >= 20;
    } catch (NumberFormatException ignored) {
      return false;
    }
  }

  /**
   * Old WebView/Service Worker data can keep serving HTML from an older site
   * build. Its static scripts then 404, React cannot hydrate, and only the top
   * header is painted. The old page is still running enough JavaScript for us
   * to unregister its workers and clear Cache Storage, so do that once and load
   * the current page again. Local favourites and settings are not touched.
   */
  private void recoverFromStalePage(WebView webView) {
    if (stalePageRecoveryStarted) return;
    stalePageRecoveryStarted = true;
    String target = HOME_URL + "?appRecovery=" + System.currentTimeMillis();
    String js =
        "(function(){var done=false;function go(){if(done)return;done=true;"
        + "location.replace(" + org.json.JSONObject.quote(target) + ");}"
        + "var jobs=[];"
        + "try{if(navigator.serviceWorker)jobs.push(navigator.serviceWorker.getRegistrations()"
        + ".then(function(rs){return Promise.all(rs.map(function(r){return r.unregister();}));}));}catch(e){}"
        + "try{if(window.caches)jobs.push(caches.keys().then(function(keys){"
        + "return Promise.all(keys.map(function(k){return caches.delete(k);}));}));}catch(e){}"
        + "Promise.all(jobs).then(go,go);setTimeout(go,1200);})()";
    webView.evaluateJavascript(js, null);
  }

  private final class WebViewReadyCheck implements Runnable {
    @Override
    public void run() {
      if (webViewReady) return;

      WebView webView = getBridge() != null ? getBridge().getWebView() : null;
      String url = webView != null ? webView.getUrl() : null;

      if (webView == null || url == null || !url.startsWith("https://www.mkt88.my")
          || webView.getProgress() < 20) {
        appHandler.postDelayed(this, 250);
        return;
      }

      try {
        webView.evaluateJavascript(JS_PAGE_STATE, value -> {
          if (isPageReady(value)) {
            markWebViewReady();
            return;
          }
          String clean = value == null ? "" : value.replace("\"", "");
          String[] parts = clean.split("\\|", -1);
          if (parts.length >= 4 && !"loading".equals(parts[0].trim())) {
            if ("0".equals(parts[1].trim())) {
              recoverFromStalePage(webView);
            } else if (!homeClassRepairSent && "none".equals(parts[2].trim())) {
              homeClassRepairSent = true;
              webView.evaluateJavascript(JS_REPAIR_HOME_CLASS, null);
            }
          }
          appHandler.postDelayed(WebViewReadyCheck.this, 250);
        });
      } catch (Exception ignored) {
        appHandler.postDelayed(this, 250);
      }
    }
  }

  /**
   * Lets the page read result sites that refuse a browser request.
   *
   * Perdana 4D publishes its results on one page that sends no CORS headers and
   * refuses our server's address, so neither the website nor the server can read
   * it. The phone is not refused, so this runs the request natively and hands
   * the page body back to the web code. Only the Perdana host is allowed.
   */
  private void installResultBridge() {
    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
    if (webView == null) return;
    webView.addJavascriptInterface(new Object() {
      @android.webkit.JavascriptInterface
      public void get(final String url, final String id) {
        new Thread(() -> {
          String body = "";
          java.net.HttpURLConnection conn = null;
          try {
            java.net.URL u = new java.net.URL(url);
            String host = u.getHost() == null ? "" : u.getHost().toLowerCase();
            if (!"www.perdana4d.com".equals(host) && !"perdana4d.com".equals(host)) {
              postResult(webView, id, "");
              return;
            }
            conn = (java.net.HttpURLConnection) u.openConnection();
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36");
            conn.setRequestProperty("Accept", "text/html,*/*");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setInstanceFollowRedirects(true);
            if (conn.getResponseCode() >= 200 && conn.getResponseCode() < 300) {
              java.io.InputStream in = conn.getInputStream();
              java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
              byte[] buf = new byte[8192];
              int n;
              while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
              in.close();
              body = out.toString("UTF-8");
            }
          } catch (Exception ignored) {
            // the page simply keeps whatever it already shows
          } finally {
            if (conn != null) conn.disconnect();
          }
          postResult(webView, id, body);
        }).start();
      }
    }, "mktNative");
  }

  private void postResult(final WebView webView, final String id, final String body) {
    final String js = "window.__mktNative && window.__mktNative.result("
        + org.json.JSONObject.quote(id) + "," + org.json.JSONObject.quote(body) + ")";
    webView.post(() -> webView.evaluateJavascript(js, null));
  }
}
