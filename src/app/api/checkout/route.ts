import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSchema } from "@/lib/checkout";
import { isOpenNow } from "@/lib/hours";
import { CheckoutError, getShop, placeOrder } from "@/lib/square";

const bodySchema = checkoutSchema.and(z.object({ expectedTotalCents: z.number().int().min(0) }));

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Please check your order details." }, { status: 400 });
  }
  const input = parsed.data;

  const shop = await getShop();
  const now = new Date();
  if (!isOpenNow(now, shop.hours, shop.timezone)) {
    return NextResponse.json({ error: "We're closed right now, so online ordering is paused." }, { status: 409 });
  }
  if (input.pickup.type === "SCHEDULED" && Date.parse(input.pickup.at) < now.getTime()) {
    return NextResponse.json({ error: "That pickup time has passed. Please pick another." }, { status: 409 });
  }

  try {
    const placed = await placeOrder(input, input.expectedTotalCents);
    return NextResponse.json(placed);
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("checkout failed", err);
    return NextResponse.json({ error: "Something went wrong. You have not been charged." }, { status: 500 });
  }
}
