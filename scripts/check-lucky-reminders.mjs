import { luckyAlarmPlan, luckyTriplet } from "../src/lib/lucky-reminders.mjs";

const device = "test-device-1234";
const days = [
  luckyTriplet(device, "2026-10-21"),
  luckyTriplet(device, "2026-10-22"),
  luckyTriplet(device, "2026-10-23"),
];

if (days.flat().length !== new Set(days.flat()).size) {
  throw new Error("lucky numbers repeat across adjacent days");
}

const plan = luckyAlarmPlan({
  deviceId: device,
  now: Date.UTC(2026, 9, 20, 0, 0),
  days: 90,
});
const numbers = plan.map((alarm) => alarm.number);
if (numbers.length !== 270 || numbers.length !== new Set(numbers).size) {
  throw new Error(`expected 270 unique reminders, got ${numbers.length}`);
}
const slots = [...new Set(plan.map((alarm) => `${alarm.hour}:${String(alarm.minute).padStart(2, "0")}`))].sort();
if (slots.join(",") !== "14:00,18:00,18:30") {
  throw new Error(`expected 14:00, 18:00 and 18:30 reminders, got ${slots.join(", ")}`);
}

console.log("Lucky reminders: 270 unique one-off notifications");
console.log("Daily slots: " + slots.join(" / "));
console.log("21/22/23 Oct: " + days.map((set) => set.join("/")).join(" | "));
