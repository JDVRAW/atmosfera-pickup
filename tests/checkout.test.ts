import { describe, expect, it } from "vitest";
import { buildOrderRequest, checkoutSchema } from "@/lib/checkout";
import { lineTotalCents, tipFromPercent } from "@/lib/money";
import { selectionProblem, toggleModifier } from "@/lib/selection";
import type { ModifierList } from "@/lib/types";

const base = {
  idempotencyKey: "abcdef123456",
  sourceId: "cnon:card-nonce-ok",
  lines: [{ variationId: "LATTE_12", quantity: 2, modifierIds: ["M_OAT"], note: "extra hot" }],
  customer: { name: "Ana", phone: "555-0100", email: "" },
  pickup: { type: "ASAP" as const },
  tipCents: 150,
  orderNote: "",
};

describe("checkoutSchema", () => {
  it("accepts a valid order", () => {
    expect(checkoutSchema.safeParse(base).success).toBe(true);
  });

  it("requires a phone or an email", () => {
    const r = checkoutSchema.safeParse({ ...base, customer: { name: "Ana", phone: "", email: "" } });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe("Add a phone number or email");
  });

  it("rejects an empty cart, zero quantity and a blank name", () => {
    expect(checkoutSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, lines: [{ ...base.lines[0], quantity: 0 }] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, customer: { ...base.customer, name: "   " } }).success).toBe(false);
  });

  it("rejects a bad email and a negative tip", () => {
    expect(checkoutSchema.safeParse({ ...base, customer: { ...base.customer, email: "nope" } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, tipCents: -1 }).success).toBe(false);
  });
});

describe("buildOrderRequest", () => {
  it("builds a Square pickup order with line items and modifiers", () => {
    const req = buildOrderRequest(checkoutSchema.parse(base), "LOC1");
    expect(req.idempotencyKey).toBe("order-abcdef123456");
    expect(req.order.locationId).toBe("LOC1");
    expect(req.order.lineItems).toEqual([
      { catalogObjectId: "LATTE_12", quantity: "2", modifiers: [{ catalogObjectId: "M_OAT" }], note: "extra hot" },
    ]);
    expect(req.order.fulfillments[0]).toEqual({
      type: "PICKUP",
      state: "PROPOSED",
      pickupDetails: { recipient: { displayName: "Ana", phoneNumber: "555-0100" }, prepTimeDuration: "PT10M", scheduleType: "ASAP" },
    });
  });

  it("schedules a later pickup", () => {
    const req = buildOrderRequest(checkoutSchema.parse({ ...base, pickup: { type: "SCHEDULED", at: "2026-11-23T19:45:00.000Z" } }), "LOC1");
    expect(req.order.fulfillments[0].pickupDetails).toMatchObject({ scheduleType: "SCHEDULED", pickupAt: "2026-11-23T19:45:00.000Z" });
  });
});

describe("money", () => {
  it("adds modifiers per unit", () => {
    expect(lineTotalCents({ unitPriceCents: 450, modifiers: [{ id: "a", name: "Oat", priceCents: 75 }], quantity: 2 })).toBe(1050);
  });
  it("rounds tips to the cent", () => {
    expect(tipFromPercent(1050, 18)).toBe(189);
    expect(tipFromPercent(1050, 0)).toBe(0);
  });
});

describe("modifier selection", () => {
  const milk: ModifierList = {
    id: "milk", name: "Milk", selection: "SINGLE", minSelected: 1, maxSelected: 1,
    modifiers: [{ id: "whole", name: "Whole", priceCents: 0 }, { id: "oat", name: "Oat", priceCents: 75 }],
  };
  const extras: ModifierList = {
    id: "x", name: "Extras", selection: "MULTIPLE", minSelected: 0, maxSelected: 2,
    modifiers: [{ id: "shot", name: "Shot", priceCents: 100 }, { id: "van", name: "Vanilla", priceCents: 60 }, { id: "car", name: "Caramel", priceCents: 60 }],
  };

  it("swaps within a single-choice list and keeps a required choice", () => {
    expect(toggleModifier(milk, ["whole", "shot"], "oat").sort()).toEqual(["oat", "shot"]);
    expect(toggleModifier(milk, ["oat"], "oat")).toEqual(["oat"]);
  });

  it("caps a multiple-choice list at its maximum", () => {
    expect(toggleModifier(extras, ["shot", "van"], "car")).toEqual(["shot", "van"]);
    expect(toggleModifier(extras, ["shot", "van"], "van")).toEqual(["shot"]);
  });

  it("reports a missing required choice", () => {
    expect(selectionProblem([milk, extras], [])).toBe("Choose a milk");
    expect(selectionProblem([milk, extras], ["oat"])).toBeNull();
  });
});
