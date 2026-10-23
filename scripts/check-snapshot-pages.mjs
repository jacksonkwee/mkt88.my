import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const appDir = join(root, "src", "app");

function pages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

const failures = [];
for (const path of pages(appDir)) {
  const source = readFileSync(path, "utf8");
  const file = relative(root, path);
  if (!source.includes("getSnapshot")) continue;

  const waitsForLive = /getSnapshot\(\{\s*wait:\s*true\s*\}\)/.test(source);
  const dynamic = /export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/.test(source);
  if (waitsForLive && !dynamic) {
    failures.push(`${file}: getSnapshot({ wait: true }) must use export const dynamic = "force-dynamic"`);
    continue;
  }

  const refreshesOnClient = source.includes("<LiveResults")
    || (source.includes("<GamePager") && source.includes("<GameColumns"));
  if (!dynamic && !refreshesOnClient) {
    failures.push(`${file}: server snapshot has no live refresh path; make the page dynamic or render LiveResults/GamePager+GameColumns`);
  }
}

if (failures.length) {
  console.error("Server snapshot rendering policy failed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("Server snapshot rendering policy passed.");
