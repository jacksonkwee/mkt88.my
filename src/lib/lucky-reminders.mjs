export const LUCKY_ID_BASE = 4000;
export const LUCKY_DAYS = 90;
export const LUCKY_ID_RANGE = LUCKY_DAYS * 3 + 3;

export const LUCKY_SLOTS = [
  { hour: 14, minute: 0, label: "14:00 4D Live 开奖提醒" },
  { hour: 18, minute: 0, label: "18:00 4D Live 开奖开始" },
  { hour: 18, minute: 30, label: "18:30 4D Live 开奖进行中" },
];

export function luckyNumber(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String((h >>> 0) % 10000).padStart(4, "0");
}

export function malaysiaDate(now = Date.now(), offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now + offsetDays * 86400000));
}

function alarmTime(date, hour, minute) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day, hour - 8, minute);
}

function dayNumbers(deviceId, date, used) {
  return LUCKY_SLOTS.map((slot) => {
    const seed = deviceId + "|" + date + "|" + slot.label;
    let number = luckyNumber(seed);
    let salt = 0;
    while (used.has(number) && salt++ < 20000) number = luckyNumber(seed + "|" + salt);
    used.add(number);
    return { number, ...slot };
  });
}

/**
 * One-off reminders for the next 90 days.
 *
 * Yesterday is generated too but not scheduled, so the first future day cannot
 * reuse yesterday's numbers. Today's times that have already passed are
 * skipped. Android therefore never has to repeat yesterday's notification text.
 */
export function luckyAlarmPlan({ deviceId, now = Date.now(), days = LUCKY_DAYS }) {
  const used = new Set();
  const out = [];

  for (let offset = -1; offset < days; offset++) {
    const date = malaysiaDate(now, offset);
    const numbers = dayNumbers(deviceId, date, used);
    if (offset < 0) continue;

    numbers.forEach((slot, index) => {
      const at = alarmTime(date, slot.hour, slot.minute);
      if (at <= now) return;
      const [year, month, day] = date.split("-").map(Number);
      out.push({
        ...slot,
        id: LUCKY_ID_BASE + (offset + 1) * 3 + index,
        date,
        year,
        month,
        day,
        at,
        body: slot.label + "\n幸运号码：" + slot.number,
        largeBody: slot.label + "\n恭喜发财 幸运号码：" + slot.number,
      });
    });
  }

  return out;
}

export function luckyTriplet(deviceId, date) {
  return dayNumbers(deviceId, date, new Set()).map((slot) => slot.number);
}
