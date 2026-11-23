import type { CartLine } from "./types";

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function lineTotalCents(line: Pick<CartLine, "unitPriceCents" | "modifiers" | "quantity">): number {
  const modifiers = line.modifiers.reduce((sum, m) => sum + m.priceCents, 0);
  return (line.unitPriceCents + modifiers) * line.quantity;
}

export function subtotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotalCents(l), 0);
}

/** Tip as a whole number of cents, rounded half up. */
export function tipFromPercent(subtotal: number, percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round((subtotal * percent) / 100);
}

export const TIP_PERCENTS = [15, 18, 20] as const;
