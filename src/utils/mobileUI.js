// src/utils/mobileUI.js
// Safe, optional hooks for native polish. No-ops on web or if plugins not installed.

export async function configureStatusBar() {
  try {
    const mod = await import(/* @vite-ignore */ "@capacitor/status-bar").catch(() => null);
    const { StatusBar } = (mod || {});
    if (!StatusBar || typeof StatusBar.setStyle !== "function") return;

    // Light content on dark headers is common in PWAs; tweak as you prefer.
    await StatusBar.setStyle({ style: "LIGHT" }); // "DARK" also valid
    // Optional background color (Android):
    if (typeof StatusBar.setBackgroundColor === "function") {
      await StatusBar.setBackgroundColor({ color: "#121212" });
    }
    // Optional overlay (iOS): leave default unless you have a custom header
    // await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    /* ignore */
  }
}

export async function lockPortraitIfAvailable() {
  try {
    // Community plugin (optional): @capacitor/screen-orientation
    const mod = await import(/* @vite-ignore */ "@capacitor/screen-orientation").catch(() => null);
    const { ScreenOrientation } = (mod || {});
    if (ScreenOrientation && typeof ScreenOrientation.lock === "function") {
      await ScreenOrientation.lock({ orientation: "portrait" });
      return;
    }
  } catch {
    /* ignore */
  }
  // If plugin isn’t present, nothing breaks; orientation remains as platform default.
}
