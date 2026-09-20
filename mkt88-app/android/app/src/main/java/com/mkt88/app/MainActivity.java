package com.mkt88.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
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

  @Override
  public void onCreate(Bundle savedInstanceState) {
    SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
    splashScreen.setKeepOnScreenCondition(() -> !webViewReady);

    super.onCreate(savedInstanceState);
    showSplashBackground();
    configureWebView();
    checkForAppUpdate();
    startWebViewReadyCheck();

    // Do not hold the launch screen for the full page load.
    // The root view is already filled with the brand red behind the transparent
    // WebView, so dropping to it keeps the MKT branding while the page finishes
    // loading.
    appHandler.postDelayed(this::markWebViewReady, 1500);
    // Load ads after the app is usable so startup stays fast.
    appHandler.postDelayed(this::initializeAds, 2500);
  }

  @Override
  public void onStart() {
    super.onStart();
    // Do not clear the WebView cache here. The website sends no-cache for live
    // data, while static assets should stay cached for a fast app.
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
        setWebViewBottomPadding(60);
        bannerAd.animate().alpha(1f).setDuration(200).start();
      }

      @Override
      public void onAdFailedToLoad(LoadAdError adError) {
        removeBannerAd();
      }
    });

    bannerAd.loadAd(new AdRequest.Builder().build());
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
    String[] parts = clean.split("\\|");
    if (parts.length < 3) return false;

    try {
      int textLength = Integer.parseInt(parts[1].trim());
      int scrollHeight = Integer.parseInt(parts[2].trim());
      // Release as soon as anything real has painted. Waiting for "complete"
      // plus a tall page kept the splash up for 5-7s on a slow connection.
      return textLength >= 20 && scrollHeight >= 100;
    } catch (NumberFormatException ignored) {
      return false;
    }
  }

  private final class WebViewReadyCheck implements Runnable {
    @Override
    public void run() {
      if (webViewReady) return;

      WebView webView = getBridge() != null ? getBridge().getWebView() : null;
      String url = webView != null ? webView.getUrl() : null;

      if (webView == null || url == null || !url.startsWith("https://www.mkt88.my")
          || webView.getProgress() < 50) {
        appHandler.postDelayed(this, 250);
        return;
      }

      try {
        webView.evaluateJavascript(
            "(function(){var b=document.body;return [document.readyState,b?b.innerText.trim().length:0,b?b.scrollHeight:0].join('|');})()",
            value -> {
              if (isPageReady(value)) {
                markWebViewReady();
              } else {
                appHandler.postDelayed(WebViewReadyCheck.this, 250);
              }
            });
      } catch (Exception ignored) {
        appHandler.postDelayed(this, 250);
      }
    }
  }
}
