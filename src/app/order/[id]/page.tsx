import Link from "next/link";
import { Header } from "@/components/header";
import { formatCents } from "@/lib/money";
import { getOrder, getShop } from "@/lib/square";
import { PREP_MINUTES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order placed | Atmosfera Cafe" };

const STATUS: Record<string, string> = {
  PROPOSED: "Received. We're on it.",
  RESERVED: "Being made now.",
  PREPARED: "Ready for pickup!",
  COMPLETED: "Picked up. Enjoy!",
  CANCELED: "This order was canceled. Please talk to us at the counter.",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const [order, shop] = await Promise.all([getOrder(id), getShop()]);

  const name = order?.pickupName ?? q.name ?? "";
  const totalCents = order?.totalCents ?? (q.total ? Number(q.total) : null);
  const when =
    q.pickup && q.pickup !== "asap"
      ? `Pick it up at ${q.pickup}.`
      : order?.pickupAt
        ? `Pick it up at ${new Date(order.pickupAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: shop.timezone })}.`
        : `It'll be ready in about ${PREP_MINUTES} minutes.`;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <section className="bg-sunrise rounded-3xl px-6 py-10 text-center text-plum">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/atmosfera-mark-on-light.svg" alt="" aria-hidden className="mx-auto h-20 w-20 mix-blend-multiply" />
          <h1 className="font-display mt-4 text-2xl font-medium">Thanks{name ? `, ${name}` : ""}!</h1>
          <p className="mt-2 text-plum/80">Your order is in. {when}</p>
          {order && <p className="mt-4 inline-block rounded-full bg-plum px-4 py-1.5 text-sm font-bold text-shell">{STATUS[order.state] ?? "Received."}</p>}
        </section>

        <section className="mt-6 rounded-2xl bg-shell/5 p-5">
          <h2 className="font-display text-lg font-medium">Order details</h2>
          {order ? (
            <ul className="mt-3 divide-y divide-shell/10 text-sm">
              {order.lines.map((l, i) => (
                <li key={i} className="flex justify-between py-2">
                  <span>
                    {l.quantity} × {l.name}
                  </span>
                  <span>{formatCents(l.totalCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-shell/75">Order number {id}</p>
          )}
          {totalCents != null && (
            <p className="mt-3 flex justify-between border-t border-shell/10 pt-3 font-bold">
              <span>Total paid</span>
              <span>{formatCents(totalCents)}</span>
            </p>
          )}
          {q.receipt && /^https:\/\/(squareup|squareupsandbox)\.com\//.test(q.receipt) && (
            <a href={q.receipt} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-peach hover:text-shell">
              View your receipt
            </a>
          )}
        </section>

        <p className="mt-6 text-center text-sm text-shell/75">
          Head to the pickup counter and give the name on your order{shop.address ? ` at ${shop.address}` : ""}.
        </p>
        <div className="mt-4 text-center">
          <Link href="/" className="inline-block rounded-full bg-shell/10 px-6 py-3 font-bold text-shell hover:bg-shell/20">
            Back to the menu
          </Link>
        </div>
      </main>
    </>
  );
}
