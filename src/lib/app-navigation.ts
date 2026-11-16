type NativeNavigationBridge = {
  navigate?: (url: string) => void;
  refresh?: (url: string) => void;
};

/**
 * Open an app page through the Android shell.
 *
 * WebView document navigation can leave the page parsed but never interactive.
 * The native side can cancel that request before opening the target. The
 * refresh fallback keeps an older installed shell usable during navigation.
 */
export function navigateInApp(href: string): void {
  const native = (window as Window & { mktNative?: NativeNavigationBridge }).mktNative;
  if (typeof native?.navigate === "function") {
    native.navigate(href);
    return;
  }
  if (typeof native?.refresh === "function") {
    native.refresh(href);
    return;
  }
  window.location.assign(href);
}
