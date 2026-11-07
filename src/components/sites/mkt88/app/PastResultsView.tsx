import { rewriteHtml, stripAdHtml } from "./site-paths";
import { getPastEntry, getViewHtml, splitParts } from "./past-data";
import PastToolbar from "./PastToolbar";
import CambodiaKhResults from "./CambodiaKhResults";
import MalaysiaPastFallback from "./MalaysiaPastFallback";
import { PAST_DATES } from "./past-data";
import { buildLocalPastHtml, localHistoryDateTables } from "../../../../lib/local-past";
import { getArchivedPast } from "../../../../lib/past-archive";

export default async function PastResultsView({ date, view }: { date: string; view?: "my" | "kh" }) {
  const entry = getPastEntry(date);
  const resolved = view || entry?.defaultView || "my";
  const html = getViewHtml(date, resolved);
  const parts = html ? splitParts(html) : null;
  const archived = !parts?.grid && resolved === "my" ? await getArchivedPast(date) : null;
  const localHtml = !archived && !parts?.grid && resolved === "my" ? buildLocalPastHtml(date) : "";
  const dates = [...new Set([...PAST_DATES, ...Object.keys(localHistoryDateTables())])].sort();
  return (
    <main className="container flex-shrink-0">
      <div className="row">
        <div className="col-sm-12">
          <PastToolbar current={date} view={resolved} dates={dates} />
          {resolved === "kh" ? (
            <CambodiaKhResults date={date} />
          ) : parts && parts.grid ? (
            <div dangerouslySetInnerHTML={{ __html: stripAdHtml(rewriteHtml(parts.grid)) }} />
          ) : archived || localHtml ? (
            <div dangerouslySetInnerHTML={{ __html: stripAdHtml(rewriteHtml(archived?.html || localHtml)) }} />
          ) : (
            <MalaysiaPastFallback date={date} />
          )}
        </div>
      </div>
    </main>
  );
}
