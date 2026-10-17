/** Game name order used by the icon pages to pick the starting slide. */
export const GAME_PAGER_ORDER = [
  "magnum", "damacai", "sportstoto", "sg", "sabah88", "cashsweep",
  "sandakan", "grand-dragon", "nine-lotto", "perdana", "lucky-harihari",
];

export function gamePagerIndex(name: string): number {
  const i = GAME_PAGER_ORDER.indexOf(name);
  return i >= 0 ? i : 0;
}