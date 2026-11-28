import { sgHeadlineCard } from "../src/lib/sg-headline.mjs";

const dash = "----";
const partial = sgHeadlineCard({
  date: "28-11-2026 (Sat)",
  first_prize: "1487",
  second_prize: dash,
  third_prize: dash,
  "special-1": dash,
  "special-2": dash,
  "special-6": "0971",
  "special-7": "2810",
  "consolation-1": "0795",
});

if (!partial) throw new Error("Singapore headline card was not created");
if (partial.date !== "28-11-2026 (Sat)" || partial.first_prize !== "1487") {
  throw new Error("Singapore headline date or 1st prize was lost");
}
if (partial.second_prize !== dash || partial.third_prize !== dash) {
  throw new Error("Singapore headline feed took ownership of 2nd or 3rd prize");
}
for (let i = 1; i <= 15; i++) {
  if (partial["special-" + i] !== dash) throw new Error("Singapore headline feed leaked starter-" + i);
}
for (let i = 1; i <= 10; i++) {
  if (partial["consolation-" + i] !== dash) throw new Error("Singapore headline feed leaked consolation-" + i);
}

const noFirst = sgHeadlineCard({
  date: "29-11-2026 (Sun)",
  first_prize: dash,
  second_prize: "8519",
  "special-1": "0971",
});
if (!noFirst || noFirst.first_prize !== dash || noFirst.second_prize !== dash || noFirst["special-1"] !== dash) {
  throw new Error("Singapore headline feed accepted unconfirmed detail values");
}

if (sgHeadlineCard(null) !== null) throw new Error("Empty Singapore headline should stay empty");
console.log("Singapore headline contract OK");
