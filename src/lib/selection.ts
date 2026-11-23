import type { ModifierList } from "./types";

/** Toggle a modifier, respecting single choice and the list's maximum. */
export function toggleModifier(list: ModifierList, selected: string[], modifierId: string): string[] {
  const belongs = (id: string) => list.modifiers.some((m) => m.id === id);
  const inList = selected.filter(belongs);
  const others = selected.filter((id) => !belongs(id));
  if (inList.includes(modifierId)) {
    // Can't drop below the minimum for a required single choice: keep it selected.
    if (list.selection === "SINGLE" && list.minSelected >= 1) return selected;
    return [...others, ...inList.filter((id) => id !== modifierId)];
  }
  if (list.selection === "SINGLE" || list.maxSelected === 1) return [...others, modifierId];
  if (list.maxSelected != null && inList.length >= list.maxSelected) return selected;
  return [...others, ...inList, modifierId];
}

/** A message for the first list whose minimum isn't met, or null when all are fine. */
export function selectionProblem(lists: ModifierList[], selected: string[]): string | null {
  for (const list of lists) {
    const count = list.modifiers.filter((m) => selected.includes(m.id)).length;
    if (count < list.minSelected) {
      return list.minSelected === 1 ? `Choose a ${list.name.toLowerCase()}` : `Choose at least ${list.minSelected} for ${list.name}`;
    }
  }
  return null;
}
