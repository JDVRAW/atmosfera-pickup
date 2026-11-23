import "server-only";
import { SquareClient, SquareEnvironment, SquareError } from "square";
import { unstable_cache } from "next/cache";
import { normalizeCatalog, type RawCatalogObject } from "./catalog";
import { DEMO_MENU, DEMO_SHOP } from "./demo-menu";
import { fromSquarePeriods } from "./hours";
import { buildOrderRequest, type CheckoutInput } from "./checkout";
import type { Menu, ShopInfo } from "./types";

/** Settings read from the environment. Demo mode when Square isn't configured. */
export function squareConfig() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN ?? "";
  const locationId = process.env.SQUARE_LOCATION_ID ?? "";
  const env = process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox";
  return {
    demo: !accessToken || !locationId,
    accessToken,
    locationId,
    env,
    appId: process.env.NEXT_PUBLIC_SQUARE_APP_ID ?? "",
  } as const;
}

function client() {
  const c = squareConfig();
  return new SquareClient({
    token: c.accessToken,
    environment: c.env === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
}

async function fetchMenu(): Promise<Menu> {
  const c = squareConfig();
  if (c.demo) return DEMO_MENU;
  const objects: RawCatalogObject[] = [];
  const pages = await client().catalog.list({ types: "ITEM,CATEGORY,MODIFIER_LIST,IMAGE" });
  for await (const obj of pages) objects.push(obj as unknown as RawCatalogObject);
  return normalizeCatalog(objects, c.locationId);
}

async function fetchShop(): Promise<ShopInfo> {
  const c = squareConfig();
  if (c.demo) return DEMO_SHOP;
  const { location } = await client().locations.get({ locationId: c.locationId });
  const a = location?.address;
  return {
    name: location?.businessName || location?.name || "Atmosfera Cafe",
    timezone: location?.timezone || "America/New_York",
    hours: fromSquarePeriods(location?.businessHours?.periods),
    address: a ? [a.addressLine1, a.locality, a.administrativeDistrictLevel1].filter(Boolean).join(", ") || null : null,
  };
}

// Square stays the source of truth; we re-read it at most once a minute.
export const getMenu = unstable_cache(fetchMenu, ["square-menu"], { revalidate: 60, tags: ["menu"] });
export const getShop = unstable_cache(fetchShop, ["square-shop"], { revalidate: 300, tags: ["shop"] });

export type Quote = { subtotalCents: number; taxCents: number; totalCents: number };

/** Ask Square to price the cart (taxes included) without creating anything. */
export async function quoteOrder(input: Pick<CheckoutInput, "lines">): Promise<Quote> {
  const c = squareConfig();
  if (c.demo) {
    const menu = await getMenu();
    const subtotal = demoSubtotal(menu, input.lines);
    return { subtotalCents: subtotal, taxCents: 0, totalCents: subtotal };
  }
  const req = buildOrderRequest(
    {
      idempotencyKey: "quote-only-0000",
      sourceId: "x",
      lines: input.lines,
      customer: { name: "Quote", phone: "0", email: "" },
      pickup: { type: "ASAP" },
      tipCents: 0,
      orderNote: "",
    },
    c.locationId,
  );
  const { order } = await client().orders.calculate({ order: { ...req.order, fulfillments: undefined } });
  const total = Number(order?.totalMoney?.amount ?? 0);
  const tax = Number(order?.totalTaxMoney?.amount ?? 0);
  return { subtotalCents: total - tax, taxCents: tax, totalCents: total };
}

export type PlacedOrder = { orderId: string; totalCents: number; tipCents: number; receiptUrl: string | null };

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

/**
 * Create the pickup order in Square, then charge it. The order only shows on
 * the register once it is paid, so a failed payment leaves nothing for staff.
 */
export async function placeOrder(input: CheckoutInput, expectedTotalCents: number): Promise<PlacedOrder> {
  const c = squareConfig();
  if (c.demo) {
    const menu = await getMenu();
    const subtotal = demoSubtotal(menu, input.lines);
    return { orderId: `DEMO-${input.idempotencyKey.slice(0, 6).toUpperCase()}`, totalCents: subtotal + input.tipCents, tipCents: input.tipCents, receiptUrl: null };
  }
  const sq = client();
  try {
    const { order } = await sq.orders.create(buildOrderRequest(input, c.locationId));
    if (!order?.id) throw new CheckoutError("Square didn't return an order", 502, "NO_ORDER");
    const total = Number(order.totalMoney?.amount ?? 0);
    if (total !== expectedTotalCents) {
      throw new CheckoutError("Prices changed while you were ordering. Please review your total.", 409, "PRICE_CHANGED");
    }
    const { payment } = await sq.payments.create({
      idempotencyKey: `pay-${input.idempotencyKey}`,
      sourceId: input.sourceId,
      verificationToken: input.verificationToken,
      orderId: order.id,
      locationId: c.locationId,
      amountMoney: { amount: BigInt(total), currency: order.totalMoney?.currency ?? "USD" },
      tipMoney: input.tipCents > 0 ? { amount: BigInt(input.tipCents), currency: order.totalMoney?.currency ?? "USD" } : undefined,
      buyerEmailAddress: input.customer.email || undefined,
      note: `Pickup for ${input.customer.name}`,
    });
    return { orderId: order.id, totalCents: total + input.tipCents, tipCents: input.tipCents, receiptUrl: payment?.receiptUrl ?? null };
  } catch (err) {
    if (err instanceof CheckoutError) throw err;
    if (err instanceof SquareError) {
      const first = err.errors[0];
      const code = String(first?.code ?? "SQUARE_ERROR");
      throw new CheckoutError(friendlyPaymentMessage(code), err.statusCode === 400 || err.statusCode === 402 ? 402 : 502, code);
    }
    throw err;
  }
}

export type OrderSummary = {
  id: string;
  state: string;
  pickupName: string | null;
  pickupAt: string | null;
  lines: { name: string; quantity: string; totalCents: number }[];
  totalCents: number;
};

export async function getOrder(orderId: string): Promise<OrderSummary | null> {
  const c = squareConfig();
  if (c.demo) return null;
  try {
    const { order } = await client().orders.get({ orderId });
    if (!order || order.locationId !== c.locationId) return null;
    const pickup = order.fulfillments?.[0]?.pickupDetails;
    return {
      id: order.id!,
      state: order.fulfillments?.[0]?.state ?? order.state ?? "OPEN",
      pickupName: pickup?.recipient?.displayName ?? null,
      pickupAt: pickup?.pickupAt ?? null,
      lines: (order.lineItems ?? []).map((l) => ({
        name: [l.name, l.variationName && l.variationName !== "Regular" ? `(${l.variationName})` : ""].filter(Boolean).join(" "),
        quantity: l.quantity,
        totalCents: Number(l.totalMoney?.amount ?? 0),
      })),
      totalCents: Number(order.totalMoney?.amount ?? 0) + Number(order.totalTipMoney?.amount ?? 0),
    };
  } catch {
    return null;
  }
}

function demoSubtotal(menu: Menu, lines: CheckoutInput["lines"]): number {
  let sum = 0;
  for (const l of lines) {
    const item = menu.items.find((i) => i.variations.some((v) => v.id === l.variationId));
    const v = item?.variations.find((x) => x.id === l.variationId);
    if (!item || !v) throw new CheckoutError("An item in your cart is no longer on the menu.", 409, "ITEM_GONE");
    if (v.soldOut) throw new CheckoutError(`${item.name} just sold out.`, 409, "SOLD_OUT");
    const mods = item.modifierLists.flatMap((ml) => ml.modifiers).filter((m) => l.modifierIds.includes(m.id));
    sum += (v.priceCents + mods.reduce((s, m) => s + m.priceCents, 0)) * l.quantity;
  }
  return sum;
}

function friendlyPaymentMessage(code: string): string {
  switch (code) {
    case "CARD_DECLINED":
    case "GENERIC_DECLINE":
      return "Your card was declined. Please try another card.";
    case "CVV_FAILURE":
    case "VERIFY_CVV_FAILURE":
      return "The security code didn't match. Please check it and try again.";
    case "ADDRESS_VERIFICATION_FAILURE":
    case "VERIFY_AVS_FAILURE":
      return "The ZIP code didn't match your card. Please check it and try again.";
    case "INVALID_EXPIRATION":
    case "CARD_EXPIRED":
      return "This card has expired. Please use another card.";
    case "INSUFFICIENT_FUNDS":
      return "The card was declined for insufficient funds.";
    case "ITEM_AT_LOCATION_NOT_FOUND":
    case "NOT_FOUND":
      return "An item in your cart is no longer available. Please refresh the menu.";
    default:
      return "We couldn't complete the payment. You have not been charged. Please try again.";
  }
}
