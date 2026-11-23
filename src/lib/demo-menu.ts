import type { Menu, ShopInfo } from "./types";

// Shown only when Square isn't connected yet (no SQUARE_ACCESS_TOKEN), so the
// app can be previewed. Replaced by the real Square menu once connected.

const milk = {
  id: "demo-ml-milk",
  name: "Milk",
  selection: "SINGLE" as const,
  minSelected: 0,
  maxSelected: 1,
  modifiers: [
    { id: "demo-m-whole", name: "Whole milk", priceCents: 0 },
    { id: "demo-m-oat", name: "Oat milk", priceCents: 75 },
    { id: "demo-m-almond", name: "Almond milk", priceCents: 75 },
  ],
};
const extras = {
  id: "demo-ml-extras",
  name: "Extras",
  selection: "MULTIPLE" as const,
  minSelected: 0,
  maxSelected: null,
  modifiers: [
    { id: "demo-m-shot", name: "Extra shot", priceCents: 100 },
    { id: "demo-m-vanilla", name: "Vanilla syrup", priceCents: 60 },
    { id: "demo-m-caramel", name: "Caramel syrup", priceCents: 60 },
  ],
};
const sizes = (id: string, small: number, large: number) => [
  { id: `${id}-12`, name: "12 oz", priceCents: small, soldOut: false },
  { id: `${id}-16`, name: "16 oz", priceCents: large, soldOut: false },
];

export const DEMO_MENU: Menu = {
  categories: [
    { id: "coffee", name: "Coffee" },
    { id: "not-coffee", name: "Not coffee" },
    { id: "bakery", name: "Bakery" },
  ],
  items: [
    { id: "demo-latte", name: "Latte", description: "Double espresso and steamed milk.", imageUrl: null, categoryId: "coffee", variations: sizes("demo-latte", 450, 525), modifierLists: [milk, extras] },
    { id: "demo-cortado", name: "Cortado", description: "Equal parts espresso and warm milk.", imageUrl: null, categoryId: "coffee", variations: [{ id: "demo-cortado-r", name: "Regular", priceCents: 400, soldOut: false }], modifierLists: [milk] },
    { id: "demo-coldbrew", name: "Cold brew", description: "Steeped 18 hours, served over ice.", imageUrl: null, categoryId: "coffee", variations: sizes("demo-coldbrew", 425, 500), modifierLists: [milk, extras] },
    { id: "demo-americano", name: "Americano", description: "Espresso and hot water.", imageUrl: null, categoryId: "coffee", variations: sizes("demo-americano", 350, 400), modifierLists: [extras] },
    { id: "demo-matcha", name: "Matcha latte", description: "Ceremonial matcha whisked with milk.", imageUrl: null, categoryId: "not-coffee", variations: sizes("demo-matcha", 525, 600), modifierLists: [milk, extras] },
    { id: "demo-chai", name: "Chai latte", description: "Spiced black tea with steamed milk.", imageUrl: null, categoryId: "not-coffee", variations: sizes("demo-chai", 475, 550), modifierLists: [milk] },
    { id: "demo-croissant", name: "Butter croissant", description: "Baked every morning.", imageUrl: null, categoryId: "bakery", variations: [{ id: "demo-croissant-r", name: "Regular", priceCents: 375, soldOut: false }], modifierLists: [] },
    { id: "demo-banana", name: "Banana bread", description: "With walnuts and brown butter.", imageUrl: null, categoryId: "bakery", variations: [{ id: "demo-banana-r", name: "Slice", priceCents: 400, soldOut: true }], modifierLists: [] },
  ],
};

export const DEMO_SHOP: ShopInfo = {
  name: "Atmosfera Cafe",
  timezone: "America/New_York",
  address: null,
  hours: [],
};
