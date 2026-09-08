import { rewriteHtml, stripAdHtml } from "./site-paths";
import LiveResults from "./LiveResults";
import DirectTopAd from "./DirectTopAd";

/**
 * Renders a captured page-content snapshot (innerHTML of the original
 * `main .container .col-sm-12`) verbatim with asset URLs localised.
 */
export default function SnapshotPage({ html }: { html: string }) {
  const safe = rewriteHtml(html);
  const rowStart = safe.indexOf('<div id="row">');
  let content = rowStart >= 0 ? safe.slice(rowStart) : safe;
  const descIdx = content.indexOf('<div class="description">');
  if (descIdx >= 0) content = content.slice(0, descIdx);
  content = stripAdHtml(content);
  return (
    <main className="container flex-shrink-0">
      <div className="row">
        <div className="col-sm-12">
          <DirectTopAd />
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      </div>
      <LiveResults />
    </main>
  );
}
