import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/checkout";
import { CheckoutError, quoteOrder } from "@/lib/square";

const bodySchema = checkoutSchema.pick({ lines: true });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  try {
    return NextResponse.json(await quoteOrder(parsed.data));
  } catch (err) {
    if (err instanceof CheckoutError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("quote failed", err);
    return NextResponse.json({ error: "Couldn't price your order. Please refresh the menu." }, { status: 502 });
  }
}
