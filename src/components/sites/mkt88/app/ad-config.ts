/**
 * Advertising configuration - Google AdSense.
 * Publisher ID is set (ca-pub-3670692731712446).
 * Optional per-slot IDs come from your AdSense account; if you enable
 * "Auto ads" in AdSense, no manual slot IDs are required.
 */
export const ADS_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-3670692731712446";
export const ADS_ENABLED = ADS_CLIENT.length > 0;
export const ADS_SLOTS: Record<string, string> = {
  top: process.env.NEXT_PUBLIC_AD_SLOT_TOP || "",
  incontent: process.env.NEXT_PUBLIC_AD_SLOT_INCONTENT || "",
  footer: process.env.NEXT_PUBLIC_AD_SLOT_FOOTER || "",
};
