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

/** Short labels for the Settings buttons - the full names do not fit three-up. */
export const LANG_LABEL: Record<Lang, string> = { en: "ENG", ms: "BM", zh: "中文" };

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
  dabogongTitle:   { en: "DABOGONG", ms: "DABOGONG", zh: "大伯公 千字图万字图" },
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

  // Number History page (/number-history).
  nhSearchTitle:   { en: "Search a 4D number", ms: "Cari nombor 4D", zh: "搜索 4D 号码" },
  nhPlaceholderPrefix: { en: "e.g.", ms: "cth.", zh: "例" },
  nhSearchBtn:     { en: "Search", ms: "Cari", zh: "搜索" },
  nhView:          { en: "View ›", ms: "Lihat ›", zh: "查看 ›" },
  nhSingle:        { en: "Single", ms: "Tunggal", zh: "单一" },
  nhPau:           { en: "Pau", ms: "Pau", zh: "包" },
  nhReverse:       { en: "Reverse", ms: "Songsang", zh: "来回" },
  nhRegion:        { en: "Region", ms: "Wilayah", zh: "地区" },
  nhPrize:         { en: "Prize", ms: "Hadiah", zh: "奖项" },
  nhCompany:       { en: "Company", ms: "Syarikat", zh: "公司" },
  nhAll:           { en: "All", ms: "Semua", zh: "全部" },
  nhOther:         { en: "Other", ms: "Lain-lain", zh: "其他" },
  nhCompanyHelp:   {
    en: "Tick the companies you want to see, untick to hide. Nothing ticked = show all.",
    ms: "Tanda syarikat yang ingin dilihat, nyah tanda untuk sembunyikan. Tiada tanda = tunjuk semua.",
    zh: "勾选想看的公司，取消勾选即可隐藏。全部不勾 = 显示全部。",
  },
  nhR1:            { en: "M'sia", ms: "M'sia", zh: "马来西亚" },
  nhR2:            { en: "Sab, Sar", ms: "Sab, Sar", zh: "沙巴、砂拉越" },
  nhR3:            { en: "Spore", ms: "Singapura", zh: "新加坡" },
  nhR4:            { en: "Others", ms: "Lain-lain", zh: "其他" },
  nhP1:            { en: "1st", ms: "Pertama", zh: "头奖" },
  nhP2:            { en: "2nd", ms: "Kedua", zh: "二奖" },
  nhP3:            { en: "3rd", ms: "Ketiga", zh: "三奖" },
  nhPS:            { en: "Special", ms: "Istimewa", zh: "特别奖" },
  nhPC:            { en: "Consolation", ms: "Saguhati", zh: "安慰奖" },
  nhP1short:       { en: "1st", ms: "1", zh: "头" },
  nhP2short:       { en: "2nd", ms: "2", zh: "二" },
  nhP3short:       { en: "3rd", ms: "3", zh: "三" },
  nhPSshort:       { en: "Spe", ms: "Ist", zh: "特" },
  nhPCshort:       { en: "Con", ms: "Sag", zh: "安" },
  nhSearching:     { en: "Searching past results…", ms: "Mencari keputusan lalu…", zh: "正在搜索过去的开彩成绩…" },
  nhLoadFail:      { en: "Unable to load history. Please try again.", ms: "Gagal memuatkan sejarah. Sila cuba lagi.", zh: "无法载入开彩记录，请再试一次。" },
  nhNoDraw:        { en: "No past draw found for the selected filters.", ms: "Tiada cabutan lalu ditemui untuk tapisan yang dipilih.", zh: "所选筛选条件下找不到过去的开彩记录。" },
  nhNoDrawHint:    { en: "Try another number or clear the filters.", ms: "Cuba nombor lain atau kosongkan tapisan.", zh: "试试其他号码，或清除筛选条件。" },
  nhShowing:       { en: "Showing", ms: "Menunjukkan", zh: "显示" },
  nhOf:            { en: "of", ms: "daripada", zh: "/" },
  nhResultOne:     { en: "result", ms: "hasil", zh: "个结果" },
  nhResultMany:    { en: "results", ms: "hasil", zh: "个结果" },
  nhCompanies:     { en: "companies", ms: "syarikat", zh: "间公司" },
  nhFav:           { en: "Favourite", ms: "Kegemaran", zh: "收藏" },
  nhEmpty:         { en: "Type a 4-digit number above to see every draw where it appeared.", ms: "Taip nombor 4 digit di atas untuk melihat setiap cabutan ia muncul.", zh: "在上方输入 4 位号码，即可看到它出现过的每一次开彩。" },
  nhNotePerm:      {
    en: "Pau shows every permutation · Reverse shows the number and its reverse.",
    ms: "Pau menunjukkan setiap susunan · Reverse menunjukkan nombor dan sonsangannya.",
    zh: "包 显示全部排列 · 来回 显示号码本身与其倒转。",
  },
  nhNoteRecords:   {
    en: "Records: Magnum 4D from 25/08/1985 · Da Ma Cai 1+3D and Sports Toto 4D from 1992 · Sandakan from 1995 · Cash Sweep from 1996 · Sabah 88 from 2001 · Singapore 4D from 2007 · Perdana and Lucky HariHari from 2021 · Grand Dragon from 2022 · Nine Lotto from 2023.",
    ms: "Rekod: Magnum 4D dari 25/08/1985 · Da Ma Cai 1+3D dan Sports Toto 4D dari 1992 · Sandakan dari 1995 · Cash Sweep dari 1996 · Sabah 88 dari 2001 · Singapore 4D dari 2007 · Perdana dan Lucky HariHari dari 2021 · Grand Dragon dari 2022 · Nine Lotto dari 2023.",
    zh: "收录范围：万能 4D 从 25/08/1985 · 大马彩 1+3D 与多多 4D 从 1992 · 山打根从 1995 · 砂劳越大万从 1996 · 沙巴88 从 2001 · 新加坡 4D 从 2007 · Perdana 与 Lucky HariHari 从 2021 · 豪龙从 2022 · Nine Lotto 从 2023。",
  },

  // Favourites page - the labels the first pass left in English.
  favPlaceholder:  { en: "4-digit number", ms: "Nombor 4 digit", zh: "4 位号码" },
  favAddBtn:       { en: "Add to favourites", ms: "Tambah ke kegemaran", zh: "添加到收藏" },
  favClearAll:     { en: "Clear all", ms: "Kosongkan semua", zh: "全部清除" },
  favRemove:       { en: "Remove", ms: "Buang", zh: "移除" },
  favInApp:        { en: "This device will show in-app alerts.", ms: "Peranti ini akan menunjukkan makluman dalam aplikasi.", zh: "这台手机会在应用内显示提醒。" },
  favAllowNotif:   { en: "Allow notifications to get an alert when your number appears.", ms: "Benarkan pemberitahuan untuk mendapat makluman apabila nombor anda muncul.", zh: "允许通知，号码出现时就会收到提醒。" },
  favEnable:       { en: "Enable", ms: "Benarkan", zh: "开启" },
  favAdded:        { en: "Added", ms: "Ditambah", zh: "已添加" },
  favNumOne:       { en: "number", ms: "nombor", zh: "个号码" },
  favNumMany:      { en: "numbers", ms: "nombor", zh: "个号码" },
  favAddedNotif:   { en: ": you will be notified when they appear.", ms: ": anda akan dimaklumkan apabila ia muncul.", zh: "：号码出现时会通知你。" },
  favAddedGlow:    { en: ": they will glow yellow when drawn.", ms: ": ia akan menyala kuning apabila keluar.", zh: "：号码开出时会以黄色标示。" },
  favNeedNum:      { en: "Enter a 4-digit number first.", ms: "Taip nombor 4 digit dahulu.", zh: "请先输入 4 位号码。" },
  favEmpty1:       { en: "No favourites yet. Type a number above and tap ", ms: "Belum ada kegemaran. Taip nombor di atas dan ketik ", zh: "还没有收藏。在上方输入号码，然后点「" },
  favEmpty2:       { en: ".", ms: ".", zh: "」。" },
  favNote1:        { en: "Favourites are saved on this device and highlight in ", ms: "Nombor kegemaran disimpan pada peranti ini dan ditandakan ", zh: "收藏号码保存在这台手机上，并会在所有成绩页面以" },
  favNoteYellow:   { en: "yellow", ms: "kuning", zh: "黄色" },
  favNote2:        { en: " on all result pages.", ms: " pada semua halaman keputusan.", zh: "标示。" },
  favNotifyOn:     { en: "Notifications enabled. Tap the bell on a favourite to switch it on.", ms: "Pemberitahuan dihidupkan. Ketik loceng pada kegemaran untuk menghidupkannya.", zh: "通知已开启。点收藏号码旁的铃铛即可开启提醒。" },
  home:            { en: "Home", ms: "Utama", zh: "首页" },

  // Lucky Number popup on the home screen.
  luckyTitle:      { en: "Your Lucky Number", ms: "Nombor Bertuah Anda", zh: "您的幸运号码" },
  luckyTry:        { en: "Try Again", ms: "Cuba Lagi", zh: "再试一次" },
  close:           { en: "Close", ms: "Tutup", zh: "关闭" },
  luckyTip:        { en: "See this number's draw history", ms: "Lihat sejarah cabutan nombor ini", zh: "查看这个号码的开彩记录" },
};

/** Look a key up in one language; an unknown key is returned unchanged. */
export function tr(key: string, lang: Lang): string {
  const row = STRINGS[key];
  return row ? row[lang] : key;
}
