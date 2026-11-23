import { z } from "zod";

import { PREP_MINUTES } from "./constants";
export { PREP_MINUTES };

export const checkoutSchema = z.object({
  idempotencyKey: z.string().min(8).max(45),
  sourceId: z.string().min(1),
  verificationToken: z.string().optional(),
  lines: z
    .array(
      z.object({
        variationId: z.string().min(1),
        quantity: z.number().int().min(1).max(25),
        modifierIds: z.array(z.string().min(1)).max(20).default([]),
        note: z.string().max(200).default(""),
      }),
    )
    .min(1)
    .max(40),
  customer: z
    .object({
      name: z.string().trim().min(1).max(60),
      phone: z.string().trim().max(30).default(""),
      email: z.string().trim().max(254).default(""),
    })
    .refine((c) => c.phone.length > 0 || c.email.length > 0, { message: "Add a phone number or email" })
    .refine((c) => c.email === "" || z.email().safeParse(c.email).success, { message: "That email doesn't look right" }),
  pickup: z.union([z.object({ type: z.literal("ASAP") }), z.object({ type: z.literal("SCHEDULED"), at: z.iso.datetime() })]),
  tipCents: z.number().int().min(0).max(100_00),
  orderNote: z.string().max(200).default(""),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Body for Square's CreateOrder: a pickup order at our location. */
export function buildOrderRequest(input: CheckoutInput, locationId: string) {
  const recipient: { displayName: string; phoneNumber?: string; emailAddress?: string } = {
    displayName: input.customer.name,
  };
  if (input.customer.phone) recipient.phoneNumber = input.customer.phone;
  if (input.customer.email) recipient.emailAddress = input.customer.email;

  return {
    idempotencyKey: `order-${input.idempotencyKey}`,
    order: {
      locationId,
      referenceId: `web-${input.idempotencyKey.slice(0, 20)}`,
      source: { name: "Atmosfera online ordering" },
      lineItems: input.lines.map((l) => ({
        catalogObjectId: l.variationId,
        quantity: String(l.quantity),
        modifiers: l.modifierIds.map((id) => ({ catalogObjectId: id })),
        ...(l.note ? { note: l.note } : {}),
      })),
      fulfillments: [
        {
          type: "PICKUP" as const,
          state: "PROPOSED" as const,
          pickupDetails: {
            recipient,
            prepTimeDuration: `PT${PREP_MINUTES}M`,
            ...(input.pickup.type === "ASAP"
              ? { scheduleType: "ASAP" as const }
              : { scheduleType: "SCHEDULED" as const, pickupAt: input.pickup.at }),
            ...(input.orderNote ? { note: input.orderNote } : {}),
          },
        },
      ],
    },
  };
}
