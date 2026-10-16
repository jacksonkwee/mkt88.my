import { ASSET_BASE } from "./site-paths";

const IMG = ASSET_BASE + "/theme-assets/images/";

export default function AppStoreBanner() {
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: 0,
          marginBottom: 0,
          marginTop: "1rem",
        }}
      >
        <a href="https://play.google.com/store/apps/details?id=com.mkt88.app" target="_blank" rel="noreferrer">
          <img loading="lazy"
            src={IMG + "logo_appstore.png?v=1"}
            width="100%"
            style={{ maxWidth: 200, position: "relative" }}
            alt="Download on the App Store"
          />
        </a>
        <div className="px-1"></div>
        <a href="https://play.google.com/store/apps/details?id=com.mkt88.app" target="_blank" rel="noreferrer">
          <img loading="lazy"
            src={IMG + "logo_playstore.png?v=1"}
            width="100%"
            style={{ maxWidth: 200 }}
            alt="Get it on Google Play"
          />
        </a>
      </div>
      <br />
    </>
  );
}
