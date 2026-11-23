"use client";

import Link from "next/link";
import { useState } from "react";
import type { Menu, MenuItem } from "@/lib/types";
import { itemSoldOut } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { useCart } from "./cart";
import { ItemSheet } from "./item-sheet";

export function MenuView({ menu, open }: { menu: Menu; open: boolean }) {
  const [active, setActive] = useState<MenuItem | null>(null);
  const { count, subtotal, ready } = useCart();

  return (
    <>
      <nav aria-label="Menu sections" className="sticky top-16 z-20 -mx-4 overflow-x-auto border-b border-plum/10 bg-shell/95 px-4 backdrop-blur">
        <ul className="flex gap-2 py-3">
          {menu.categories.map((c) => (
            <li key={c.id}>
              <a href={`#cat-${c.id}`} className="block whitespace-nowrap rounded-full border border-plum/15 px-4 py-1.5 text-sm font-semibold hover:border-rose hover:text-rose-dark">
                {c.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {menu.categories.map((c) => {
        const items = menu.items.filter((i) => i.categoryId === c.id);
        if (items.length === 0) return null;
        return (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32 pt-8">
            <h2 className="font-display text-xl font-medium">{c.name}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} onSelect={() => setActive(item)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {menu.items.length === 0 && (
        <p className="mt-10 rounded-2xl bg-white p-6 text-center text-plum-soft">The menu is being updated. Please check back in a few minutes.</p>
      )}

      {ready && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Link
            href="/checkout"
            className="mx-auto flex max-w-md items-center justify-between rounded-full bg-plum px-6 py-4 font-semibold text-shell shadow-lg shadow-plum/25 transition hover:bg-plum-soft"
          >
            <span>
              View bag · {count} {count === 1 ? "item" : "items"}
            </span>
            <span>{formatCents(subtotal)}</span>
          </Link>
        </div>
      )}

      {active && <ItemSheet item={active} orderingOpen={open} onClose={() => setActive(null)} />}
    </>
  );
}

function ItemCard({ item, onSelect }: { item: MenuItem; onSelect: () => void }) {
  const soldOut = itemSoldOut(item);
  const from = Math.min(...item.variations.map((v) => v.priceCents));
  const varies = item.variations.some((v) => v.priceCents !== from);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={soldOut}
      className="flex w-full items-stretch gap-4 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-plum/5 transition hover:ring-rose/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{item.name}</span>
        {item.description && <span className="mt-1 line-clamp-2 text-sm text-plum-soft">{item.description}</span>}
        <span className="mt-auto pt-3 text-sm font-semibold">
          {soldOut ? <span className="text-rose-dark">Sold out today</span> : `${varies ? "From " : ""}${formatCents(from)}`}
        </span>
      </div>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" loading="lazy" />
      ) : (
        <div className="bg-sunrise grid h-24 w-24 shrink-0 place-items-center rounded-xl" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/atmosfera-mark-on-light.svg" alt="" className="h-16 w-16 opacity-90 mix-blend-multiply" />
        </div>
      )}
    </button>
  );
}
