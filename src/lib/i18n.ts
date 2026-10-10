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
};

/** Look a key up in one language; an unknown key is returned unchanged. */
export function tr(key: string, lang: Lang): string {
  const row = STRINGS[key];
  return row ? row[lang] : key;
}