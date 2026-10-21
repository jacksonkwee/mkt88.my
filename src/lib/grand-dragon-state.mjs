export const GD_CARD_FIELDS = [
  "first_prize", "second_prize", "third_prize",
  ...Array.from({ length: 13 }, (_, i) => "special-" + (i + 1)),
  ...Array.from({ length: 10 }, (_, i) => "consolation-" + (i + 1)),
  "jp4_pool", "jp4_letter", "jp4_units",
  "__prizeLetter1", "__prizeLetter2", "__prizeLetter3",
];

export const GD_SOURCE_PRIORITY = {
  mirror: 40,
  socket: 60,
  official: 80,
  manual: 100,
};

const blank = (value) => value == null || value === "" || /^----+$/.test(String(value).trim());
const day = (value) => {
  const s = String(value || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const label = /^(\d{2})-(\d{2})-(\d{4})/.exec(s);
  return label ? Date.UTC(Number(label[3]), Number(label[2]) - 1, Number(label[1])) : 0;
};
const hasNumber = (values, six, jp7) =>
  Object.entries(values || {}).some(([key, value]) => key !== "date" && key !== "draw_no" && !blank(value))
  || /^\d{6}$/.test(String(six?.main || ""))
  || Object.values(jp7 || {}).some((value) => !blank(value));

/** @param {any} previous @param {any} candidate */
export function mergeGrandDragonState(previous, candidate) {
  if (!candidate?.date || !hasNumber(candidate.values, candidate.six, candidate.jp7)) return previous || null;
  const candidateDay = day(candidate.date);
  const previousDay = day(previous?.date);
  const meta = {
    source: candidate.source,
    at: Number(candidate.at || 0),
    priority: Number(candidate.priority || 0),
  };
  const newerDraw = !previous || (candidateDay > 0 && (!previousDay || candidateDay > previousDay));
  const olderDraw = previous && candidateDay > 0 && previousDay > candidateDay;
  if (olderDraw) return previous;

  const state = newerDraw
    ? {
        date: candidate.date,
        values: { date: candidate.date, draw_no: candidate.values?.draw_no || "----" },
        six: null,
        jp7: null,
        fieldMeta: {},
        sixMeta: null,
        jp7Meta: null,
      }
    : {
        ...previous,
        values: { ...(previous.values || {}) },
        fieldMeta: { ...(previous.fieldMeta || {}) },
      };

  const take = (currentMeta) => {
    if (!currentMeta) return true;
    if (meta.priority >= GD_SOURCE_PRIORITY.manual) return true;
    if (currentMeta.priority >= GD_SOURCE_PRIORITY.manual) return false;
    if (meta.priority === GD_SOURCE_PRIORITY.mirror && currentMeta.priority > GD_SOURCE_PRIORITY.mirror) return false;
    return meta.at > Number(currentMeta.at || 0)
      || meta.at === Number(currentMeta.at || 0) && meta.priority >= Number(currentMeta.priority || 0);
  };

  for (const key of ["date", "draw_no", ...GD_CARD_FIELDS]) {
    if (!(key in (candidate.values || {}))) continue;
    const value = String(candidate.values[key] ?? "").trim();
    const current = state.values[key];
    const booth = /^(special|consolation)-/.test(key);
    if (!newerDraw && blank(value) && !blank(current) && !booth) continue;
    if (!newerDraw && !take(state.fieldMeta[key])) continue;
    state.values[key] = value || "----";
    state.fieldMeta[key] = meta;
  }

  if (candidate.six && /^\d{6}$/.test(String(candidate.six.main || "")) && (newerDraw || take(state.sixMeta))) {
    state.six = candidate.six;
    state.sixMeta = meta;
  }
  if (candidate.jp7 && Object.values(candidate.jp7).some((value) => !blank(value)) && (newerDraw || take(state.jp7Meta))) {
    state.jp7 = { ...candidate.jp7 };
    state.jp7Meta = meta;
  }
  return state;
}
