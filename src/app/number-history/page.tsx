import { Suspense } from "react";
import NumberHistoryApp from "../../components/NumberHistoryApp";

export default function NumberHistoryPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>Loading…</div>}>
      <NumberHistoryApp />
    </Suspense>
  );
}
