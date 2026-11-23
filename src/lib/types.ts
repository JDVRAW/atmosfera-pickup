// Shared shapes used by the server and the browser. Money is always in cents.

export type Modifier = {
  id: string;
  name: string;
  priceCents: number;
};

export type ModifierList = {
  id: string;
  name: string;
  /** "SINGLE" means pick at most one (e.g. milk); "MULTIPLE" allows several. */
  selection: "SINGLE" | "MULTIPLE";
  minSelected: number;
  maxSelected: number | null;
  modifiers: Modifier[];
};

export type Variation = {
  id: string;
  name: string;
  priceCents: number;
  soldOut: boolean;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  categoryId: string | null;
  variations: Variation[];
  modifierLists: ModifierList[];
};

export type Category = {
  id: string;
  name: string;
};

export type Menu = {
  categories: Category[];
  items: MenuItem[];
};

export type CartLine = {
  /** Stable key for this line: variation plus sorted modifiers plus note. */
  key: string;
  itemId: string;
  itemName: string;
  variationId: string;
  variationName: string;
  unitPriceCents: number;
  modifiers: Modifier[];
  quantity: number;
  note: string;
};

/** A weekly opening period in the shop's local time, e.g. MON 07:00 to 15:00. */
export type OpeningPeriod = {
  day: "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
  start: string; // "HH:MM"
  end: string; // "HH:MM"
};

export type ShopInfo = {
  name: string;
  timezone: string;
  hours: OpeningPeriod[];
  address: string | null;
};
