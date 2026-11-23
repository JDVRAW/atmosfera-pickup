import type { Category, Menu, MenuItem, ModifierList, Variation } from "./types";

// A loose view of Square catalog objects: only the fields we read.
// Square's SDK returns money amounts as bigint, so amounts accept bigint | number.
type Money = { amount?: bigint | number | null; currency?: string | null } | null | undefined;

export type RawCatalogObject = {
  type: string;
  id: string;
  isDeleted?: boolean | null;
  presentAtAllLocations?: boolean | null;
  presentAtLocationIds?: string[] | null;
  absentAtLocationIds?: string[] | null;
  categoryData?: { name?: string | null } | null;
  imageData?: { url?: string | null } | null;
  modifierListData?: {
    name?: string | null;
    selectionType?: string | null;
    minSelectedModifiers?: bigint | number | null;
    maxSelectedModifiers?: bigint | number | null;
    modifiers?: RawCatalogObject[] | null;
  } | null;
  modifierData?: { name?: string | null; priceMoney?: Money; ordinal?: number | null } | null;
  itemData?: {
    name?: string | null;
    description?: string | null;
    descriptionPlaintext?: string | null;
    isArchived?: boolean | null;
    categoryId?: string | null;
    categories?: { id?: string | null }[] | null;
    reportingCategory?: { id?: string | null } | null;
    imageIds?: string[] | null;
    variations?: RawCatalogObject[] | null;
    modifierListInfo?:
      | {
          modifierListId: string;
          enabled?: boolean | null;
          minSelectedModifiers?: number | null;
          maxSelectedModifiers?: number | null;
        }[]
      | null;
  } | null;
  itemVariationData?: {
    name?: string | null;
    pricingType?: string | null;
    priceMoney?: Money;
    ordinal?: number | null;
    locationOverrides?: { locationId?: string | null; soldOut?: boolean | null; priceMoney?: Money }[] | null;
  } | null;
};

const cents = (m: Money): number => (m?.amount == null ? 0 : Number(m.amount));
const num = (v: bigint | number | null | undefined): number | null => (v == null ? null : Number(v));

function presentAt(obj: RawCatalogObject, locationId: string | null): boolean {
  if (obj.isDeleted) return false;
  if (!locationId) return true;
  if (obj.presentAtAllLocations === false) {
    return (obj.presentAtLocationIds ?? []).includes(locationId);
  }
  return !(obj.absentAtLocationIds ?? []).includes(locationId);
}

/**
 * Turn a flat list of Square catalog objects into the menu the app shows.
 * Hides deleted, archived and other-location items, and variable-priced
 * variations (they need a price typed at the register). Marks variations
 * that are sold out at this location.
 */
export function normalizeCatalog(objects: RawCatalogObject[], locationId: string | null): Menu {
  const byId = new Map(objects.map((o) => [o.id, o]));

  const categories: Category[] = objects
    .filter((o) => o.type === "CATEGORY" && !o.isDeleted && o.categoryData?.name)
    .map((o) => ({ id: o.id, name: o.categoryData!.name! }));

  const modifierLists = new Map<string, ModifierList>();
  for (const o of objects) {
    if (o.type !== "MODIFIER_LIST" || o.isDeleted || !o.modifierListData) continue;
    const d = o.modifierListData;
    modifierLists.set(o.id, {
      id: o.id,
      name: d.name ?? "Options",
      selection: d.selectionType === "SINGLE" ? "SINGLE" : "MULTIPLE",
      minSelected: Math.max(0, num(d.minSelectedModifiers) ?? 0),
      maxSelected: (() => {
        const max = num(d.maxSelectedModifiers);
        if (d.selectionType === "SINGLE") return 1;
        return max == null || max < 0 ? null : max;
      })(),
      modifiers: (d.modifiers ?? [])
        .filter((m) => !m.isDeleted && presentAt(m, locationId) && m.modifierData?.name)
        .sort((a, b) => (a.modifierData?.ordinal ?? 0) - (b.modifierData?.ordinal ?? 0))
        .map((m) => ({ id: m.id, name: m.modifierData!.name!, priceCents: cents(m.modifierData!.priceMoney) })),
    });
  }

  const items: MenuItem[] = [];
  for (const o of objects) {
    if (o.type !== "ITEM" || !o.itemData || o.itemData.isArchived || !presentAt(o, locationId)) continue;
    const d = o.itemData;

    const variations: Variation[] = (d.variations ?? [])
      .filter((v) => presentAt(v, locationId) && v.itemVariationData)
      .filter((v) => v.itemVariationData!.pricingType !== "VARIABLE_PRICING")
      .sort((a, b) => (a.itemVariationData?.ordinal ?? 0) - (b.itemVariationData?.ordinal ?? 0))
      .map((v) => {
        const vd = v.itemVariationData!;
        const override = (vd.locationOverrides ?? []).find((lo) => lo.locationId === locationId);
        return {
          id: v.id,
          name: vd.name ?? "Regular",
          priceCents: override?.priceMoney ? cents(override.priceMoney) : cents(vd.priceMoney),
          soldOut: Boolean(override?.soldOut),
        };
      });
    if (variations.length === 0) continue;

    const imageId = d.imageIds?.[0];
    const image = imageId ? byId.get(imageId) : undefined;

    items.push({
      id: o.id,
      name: d.name ?? "Item",
      description: d.descriptionPlaintext ?? d.description ?? "",
      imageUrl: image?.imageData?.url ?? null,
      categoryId: d.categories?.[0]?.id ?? d.reportingCategory?.id ?? d.categoryId ?? null,
      variations,
      modifierLists: (d.modifierListInfo ?? [])
        .filter((info) => info.enabled !== false && modifierLists.has(info.modifierListId))
        .map((info) => {
          const base = modifierLists.get(info.modifierListId)!;
          const min = info.minSelectedModifiers;
          const max = info.maxSelectedModifiers;
          return {
            ...base,
            minSelected: min != null && min >= 0 ? min : base.minSelected,
            maxSelected: max != null && max >= 0 ? max : base.maxSelected,
          };
        })
        .filter((ml) => ml.modifiers.length > 0),
    });
  }

  // Only show categories that have something in them, and put uncategorized items last.
  const used = new Set(items.map((i) => i.categoryId));
  const shown = categories.filter((c) => used.has(c.id));
  if (items.some((i) => !i.categoryId || !shown.find((c) => c.id === i.categoryId))) {
    shown.push({ id: "other", name: "More" });
    for (const i of items) if (!i.categoryId || !shown.find((c) => c.id === i.categoryId)) i.categoryId = "other";
  }

  return { categories: shown, items };
}

/** True when every variation of the item is sold out. */
export function itemSoldOut(item: MenuItem): boolean {
  return item.variations.every((v) => v.soldOut);
}
