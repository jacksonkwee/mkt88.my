"use client";

import { useEffect, useState } from "react";

/**
 * App language: English, Bahasa Melayu or Chinese.
 *
 * Before this, every label was printed twice - "See live results 查看成绩" - so
 * each screen carried both languages whether the reader wanted them or not. The
 * choice is now per phone: it follows the phone's own language until the user
 * picks one in Settings, and that pick is remembered.
 *
 * Only the strings listed below are wired up so far. Anything not in the table
 * still falls back to its old bilingual text.
 */
export type Lang = "en" | "ms" | "zh";

const KEY = "mkt_lang";
const EVT = "mkt-lang";

export const LANG_LABEL: Record<Lang, string> = { en: "English", ms: "Bahasa Melayu", zh: "中文" };

/** The chosen language, else the phone's own. */
export function detectLang(): Lang {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "en" || saved === "ms" || saved === "zh") return saved;
  } catch { /* private mode */ }
  try {
    const n = String(navigator.language || "").toLowerCase();
    if (n.startsWith("zh")) return "zh";
    if (n.startsWith("ms")) return "ms";
  } catch { /* no navigator */ }
  return "en";
}

export function setLang(l: Lang): void {
  try { window.localStorage.setItem(KEY, l); } catch { /* private mode */ }
  try {
    document.documentElement.setAttribute("data-lang", l);
    window.dispatchEvent(new Event(EVT));
  } catch { /* no document */ }
}

/** Current language, re-rendering when it changes anywhere in the app. */
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, set] = useState<Lang>("en");
  useEffect(() => {
    const apply = () => {
      const l = detectLang();
      set(l);
      try { document.documentElement.setAttribute("data-lang", l); } catch { /* ignore */ }
    };
    apply();
    window.addEventListener(EVT, apply);
    return () => window.removeEventListener(EVT, apply);
  }, []);
  return [lang, setLang];
}

type Row = { en: string; ms: string; zh: string };

/** Everything wired up so far. Add a row here and use its key with tr(). */
export const STRINGS: Record<string, Row> = {
  favourite:       { en: "Favourite Numbers", ms: "Nombor Kegemaran", zh: "收藏号码" },
  dabogong:        { en: "DABOGONG", ms: "DABOGONG", zh: "大伯公" },
  dabogongSub:     { en: "Number Chart",      ms: "Carta Nombor",    zh: "千字图" },
  history:         { en: "Number History",    ms: "Sejarah Nombor",  zh: "开彩记录" },
  hot:             { en: "Hot Numbers",       ms: "Nombor Panas",    zh: "热门号码" },
  rate:            { en: "Rate us",           ms: "Nilai Kami",      zh: "评分" },
  settings:        { en: "Settings",          ms: "Tetapan",         zh: "设置" },
  lucky:           { en: "Lucky Number", ms: "Nombor Bertuah", zh: "幸运号码" },
  seeLive:         { en: "See live results",  ms: "Lihat Keputusan Langsung", zh: "查看成绩" },
  language:        { en: "Language",          ms: "Bahasa",          zh: "语言" },
  languageHelp:    {
    en: "Follows your phone until you choose one here.",
    ms: "Mengikut bahasa telefon anda sehingga anda pilih di sini.",
    zh: "未选择前会跟随你手机的语言。",
  },
  keepScreen:      { en: "Keep screen on",    ms: "Skrin Sentiasa Hidup", zh: "屏幕常亮" },
  keepScreenHelp:  {
    en: "While this is on the phone will not sleep during a live draw.",
    ms: "Apabila dihidupkan, telefon tidak akan tidur semasa cabutan langsung.",
    zh: "打开后，开奖进行时手机不会休眠。",
  },
  drawSound:       { en: "Live draw sound",   ms: "Bunyi Cabutan Langsung", zh: "开奖提示音" },
  drawSoundHelp:   {
    en: "A short knock sounds as each number comes out during a live draw.",
    ms: "Bunyi ketukan pendek berbunyi setiap kali nombor keluar semasa cabutan langsung.",
    zh: "开奖时每出一个号码，会响一下短促的提示音。",
  },
  done:            { en: "Done",              ms: "Selesai",         zh: "完成" },
  favTitle:        { en: "Favourite Numbers", ms: "Nombor Kegemaran", zh: "收藏号码" },
  favAdd:          { en: "Add favourite numbers", ms: "Tambah nombor kegemaran", zh: "添加收藏号码" },
  favPau:          { en: "Pau", ms: "Pau", zh: "包" },
  favReverse:      { en: "Reverse", ms: "Sonsang", zh: "来回" },
  favAlertFor:     { en: "Alert for", ms: "Maklum untuk", zh: "提醒奖项" },
  favSpecialNotif: { en: "Special notification", ms: "Pemberitahuan khas", zh: "特别通知" },
  favMine:         { en: "My favourite numbers", ms: "Nombor kegemaran saya", zh: "我的收藏" },

  // 大伯公 page (/dabogong).
  dabogongTitle:   { en: "DABOGONG Number Chart", ms: "DABOGONG Carta Nombor", zh: "大伯公 千字图万字图" },
  dbgPlaceholder:  { en: "Number or word", ms: "Nombor atau perkataan", zh: "号码或词语" },
  dbgHint:         {
    en: "Type 3-4 digits or a word in Chinese, English or BM · e.g. 666 · okra · dog",
    ms: "Taip 3-4 digit atau perkataan dalam Cina, Inggeris atau BM · cth. 666 · okra · bendi · anjing",
    zh: "输入 3-4 位数或词语（中文 / English / BM）· 例 666 · okra · 狗",
  },
  dbgSearch:       { en: "Search", ms: "Cari", zh: "查询" },
  dbgClear:        { en: "Clear", ms: "Kosongkan", zh: "清除" },
  loading:         { en: "Loading…", ms: "Memuatkan…", zh: "载入中…" },
  dbgNothing:      { en: "Nothing found.", ms: "Tiada hasil ditemui.", zh: "找不到结果。" },
  dbgLoadFail:     { en: "Unable to load. Please try again.", ms: "Gagal memuatkan. Sila cuba lagi.", zh: "无法载入，请再试一次。" },
  dbgResultOne:    { en: "result for", ms: "hasil untuk", zh: "个结果" },
  dbgResultMany:   { en: "results for", ms: "hasil untuk", zh: "个结果" },
  dbgTapHistory:   { en: "tap a number for its Number History", ms: "ketik nombor untuk Sejarah Nombor", zh: "点号码看开彩记录" },
  dbgNoMatch:      { en: "No number found for that word.", ms: "Tiada nombor ditemui untuk perkataan itu.", zh: "找不到与这个词相关的号码。" },
  dbgImage:        { en: "image", ms: "imej", zh: "图片" },
  dbgKind10k:      { en: "10,000-number chart", ms: "Carta 10,000 nombor", zh: "万字图" },
  dbgKind1k:       { en: "Tua Pek Kong 1,000-number chart", ms: "Carta 1,000 nombor Tua Pek Kong", zh: "大伯公千字图" },
};

/** Look a key up in one language; an unknown key is returned unchanged. */
export function tr(key: string, lang: Lang): string {
  const row = STRINGS[key];
  return row ? row[lang] : key;
}
