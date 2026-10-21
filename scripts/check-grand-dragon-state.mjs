import { GD_SOURCE_PRIORITY, mergeGrandDragonState } from "../src/lib/grand-dragon-state.mjs";

const values = (date, first = "1111") => ({
  date,
  draw_no: "1/2026",
  first_prize: first,
  second_prize: "2222",
  third_prize: "3333",
  ...Object.fromEntries(Array.from({ length: 13 }, (_, i) => ["special-" + (i + 1), String(4000 + i)])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => ["consolation-" + (i + 1), String(5000 + i)])),
  jp4_pool: "USD 1.00",
  jp4_letter: "A",
  jp4_units: "0",
});
const candidate = (source, priority, at, date, patch = {}, extra = {}) => ({
  source, priority, at, date, values: { ...values(date), ...patch }, ...extra,
});

let state = mergeGrandDragonState(null, candidate(
  "socket", GD_SOURCE_PRIORITY.socket, 100, "20-10-2026 (Tue)",
));
if (state.values.first_prize !== "1111") throw new Error("initial socket value missing");

state = mergeGrandDragonState(state, candidate(
  "socket", GD_SOURCE_PRIORITY.socket, 120, state.date, { first_prize: "----" },
));
if (state.values.first_prize !== "1111") throw new Error("blank prize erased a known result");

state = mergeGrandDragonState(state, candidate(
  "socket", GD_SOURCE_PRIORITY.socket, 115, state.date, { first_prize: "2222" },
));
state = mergeGrandDragonState(state, candidate(
  "official", GD_SOURCE_PRIORITY.official, 105, state.date, { first_prize: "9999" },
));
if (state.values.first_prize !== "2222") throw new Error("older official value replaced newer socket value");

state = mergeGrandDragonState(state, candidate(
  "official", GD_SOURCE_PRIORITY.official, 130, state.date, { first_prize: "9999", "special-1": "----" },
));
if (state.values.first_prize !== "9999" || state.values["special-1"] !== "----") {
  throw new Error("newer official correction was not applied");
}

state = mergeGrandDragonState(state, candidate(
  "mirror", GD_SOURCE_PRIORITY.mirror, 140, state.date, { first_prize: "7777" },
));
if (state.values.first_prize !== "9999") throw new Error("mirror overrode a higher-priority source");

state = mergeGrandDragonState(state, candidate(
  "official", GD_SOURCE_PRIORITY.official, 150, "21-10-2026 (Wed)",
));
if (state.values.first_prize !== "1111" || state.values["special-1"] !== "4000") {
  throw new Error("new draw did not reset the previous board");
}

const older = mergeGrandDragonState(state, candidate(
  "socket", GD_SOURCE_PRIORITY.socket, 999, "20-10-2026 (Tue)", { first_prize: "0000" },
));
if (older.values.first_prize !== "1111") throw new Error("older draw replaced the current draw");

console.log("Grand Dragon merge state OK");
