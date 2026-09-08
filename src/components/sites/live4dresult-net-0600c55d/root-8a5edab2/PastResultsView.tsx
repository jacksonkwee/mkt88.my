import { rewriteHtml, stripAdHtml } from "./site-paths";
import { getPastEntry, getViewHtml, splitParts } from "./past-data";
import PastToolbar from "./PastToolbar";
import CambodiaKhResults from "./CambodiaKhResults";

export default function PastResultsView({ date, view }: { date: string; view?: "my" | "kh" }) {
  const entry = getPastEntry(date);
  const resolved = view || entry?.defaultView || "my";
  const html = getViewHtml(date, resolved);
  const parts = html ? splitParts(html) : null;
  return (
    <main className="container flex-shrink-0">
      <div className="row">
        <div className="col-sm-12">
          <PastToolbar current={date} view={resolved} />
          {resolved === "kh" ? (
            <CambodiaKhResults date={date} />
          ) : parts && parts.grid ? (
            <div dangerouslySetInnerHTML={{ __html: stripAdHtml(rewriteHtml(parts.grid)) }} />
          ) : (
            <div className="alert alert-warning mt-3 text-center font-weight-bold">
              No results are included for {date} in this demo.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
