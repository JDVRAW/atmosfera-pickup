import { describe, expect, it } from "vitest";
import { normalizeCatalog, type RawCatalogObject } from "@/lib/catalog";

const LOC = "LOC1";

const objects: RawCatalogObject[] = [
  { type: "CATEGORY", id: "CAT_COFFEE", categoryData: { name: "Coffee" } },
  { type: "CATEGORY", id: "CAT_EMPTY", categoryData: { name: "Merch" } },
  { type: "IMAGE", id: "IMG1", imageData: { url: "https://img/latte.jpg" } },
  {
    type: "MODIFIER_LIST",
    id: "ML_MILK",
    modifierListData: {
      name: "Milk",
      selectionType: "SINGLE",
      modifiers: [
        { type: "MODIFIER", id: "M_OAT", modifierData: { name: "Oat", priceMoney: { amount: BigInt(75), currency: "USD" }, ordinal: 2 } },
        { type: "MODIFIER", id: "M_WHOLE", modifierData: { name: "Whole", ordinal: 1 } },
      ],
    },
  },
  {
    type: "ITEM",
    id: "LATTE",
    itemData: {
      name: "Latte",
      descriptionPlaintext: "Espresso and milk",
      categories: [{ id: "CAT_COFFEE" }],
      imageIds: ["IMG1"],
      modifierListInfo: [{ modifierListId: "ML_MILK", minSelectedModifiers: 1 }],
      variations: [
        { type: "ITEM_VARIATION", id: "LATTE_16", itemVariationData: { name: "16 oz", ordinal: 2, priceMoney: { amount: BigInt(525) } } },
        {
          type: "ITEM_VARIATION",
          id: "LATTE_12",
          itemVariationData: {
            name: "12 oz",
            ordinal: 1,
            priceMoney: { amount: BigInt(450) },
            locationOverrides: [{ locationId: LOC, soldOut: true, priceMoney: { amount: BigInt(475) } }],
          },
        },
        { type: "ITEM_VARIATION", id: "LATTE_OPEN", itemVariationData: { name: "Custom", pricingType: "VARIABLE_PRICING" } },
      ],
    },
  },
  { type: "ITEM", id: "ARCHIVED", itemData: { name: "Old", isArchived: true, variations: [{ type: "ITEM_VARIATION", id: "A1", itemVariationData: { priceMoney: { amount: 1 } } }] } },
  { type: "ITEM", id: "DELETED", isDeleted: true, itemData: { name: "Gone", variations: [{ type: "ITEM_VARIATION", id: "D1", itemVariationData: { priceMoney: { amount: 1 } } }] } },
  {
    type: "ITEM",
    id: "OTHER_SHOP",
    presentAtAllLocations: false,
    presentAtLocationIds: ["LOC2"],
    itemData: { name: "Elsewhere", variations: [{ type: "ITEM_VARIATION", id: "O1", itemVariationData: { priceMoney: { amount: 1 } } }] },
  },
  { type: "ITEM", id: "NOCAT", itemData: { name: "Mystery cookie", variations: [{ type: "ITEM_VARIATION", id: "N1", itemVariationData: { name: "Regular", priceMoney: { amount: 300 } } }] } },
];

describe("normalizeCatalog", () => {
  const menu = normalizeCatalog(objects, LOC);
  const latte = menu.items.find((i) => i.id === "LATTE")!;

  it("keeps only live items for this location", () => {
    expect(menu.items.map((i) => i.id).sort()).toEqual(["LATTE", "NOCAT"]);
  });

  it("orders variations, applies location price overrides and sold-out flags, and drops variable prices", () => {
    expect(latte.variations).toEqual([
      { id: "LATTE_12", name: "12 oz", priceCents: 475, soldOut: true },
      { id: "LATTE_16", name: "16 oz", priceCents: 525, soldOut: false },
    ]);
  });

  it("attaches modifier lists with item-level minimums and sorted modifiers", () => {
    expect(latte.modifierLists).toHaveLength(1);
    expect(latte.modifierLists[0]).toMatchObject({ name: "Milk", selection: "SINGLE", minSelected: 1, maxSelected: 1 });
    expect(latte.modifierLists[0].modifiers.map((m) => [m.name, m.priceCents])).toEqual([
      ["Whole", 0],
      ["Oat", 75],
    ]);
  });

  it("resolves the image and category", () => {
    expect(latte.imageUrl).toBe("https://img/latte.jpg");
    expect(latte.categoryId).toBe("CAT_COFFEE");
  });

  it("hides empty categories and puts uncategorized items under More", () => {
    expect(menu.categories.map((c) => c.name)).toEqual(["Coffee", "More"]);
    expect(menu.items.find((i) => i.id === "NOCAT")!.categoryId).toBe("other");
  });

  it("returns an empty menu for an empty catalog", () => {
    expect(normalizeCatalog([], LOC)).toEqual({ categories: [], items: [] });
  });
});
