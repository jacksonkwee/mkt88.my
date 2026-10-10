"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { useLang, tr } from "../lib/i18n";

const RED = "#cc0000";
const LOGO = "/sites/live4dresult-net-0600c55d/root-8a5edab2/logo-mkt88.webp?v=4";

/**
 * The red title bar and the brand logo above the app's own screens.
 *
 * The bar and the logo are one sticky block, so the logo stays where it is
 * while the page scrolls instead of sliding away underneath the bar. The logo
 * is a link home too - tapping it goes back to the first screen, same as the
 * Home link beside it.
 */
export default function AppTopBar({ titleKey }: { titleKey: string }) {
  const router = useRouter();
  const [lang] = useLang();
  const goHome = () => window.dispatchEvent(new Event("mkt-home"));
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50 }}>
      <div className="mkt-app-topbar" style={{ background: RED, color: "#fff", display: "flex", alignItems: "center", gap: 6, padding: "10px 8px", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
        <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          style={{ background: "transparent", border: 0, color: "#fff", fontSize: 24, lineHeight: 1, cursor: "pointer", padding: "2px 8px" }} aria-label="Back"><ArrowLeft size={24} weight="bold" /></button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr(titleKey, lang)}</div>
        <Link href="/" onClick={goHome} style={{ color: "#fff", fontSize: 13, textDecoration: "none", padding: "6px 8px" }}>{tr("home", lang)}</Link>
      </div>

      {/* Brand logo, fixed with the bar. */}
      <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px", background: "#f4f4f4" }}>
        {/* display:contents keeps the link clickable without giving it a box of
            its own, so the logo is laid out exactly as it is on the screens
            that render it as a plain <img> - one centred item, same size. */}
        <Link href="/" onClick={goHome} aria-label="MKT 88 4D home" style={{ display: "contents" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="MKT 发发" style={{ height: 44, width: "auto", maxWidth: "70%", display: "block" }} />
        </Link>
      </div>
    </div>
  );
}
