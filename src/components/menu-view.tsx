"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Menu, MenuItem } from "@/lib/types";
import { itemSoldOut } from "@/lib/catalog";
import { formatCents } from "@/lib/money";
import { useCart } from "./cart";
import { ItemSheet } from "./item-sheet";

/** Items with one size and no required choices can go straight into the bag from the "+" button. */
function canQuickAdd(item: MenuItem) {
  return item.variations.length === 1 && item.modifierLists.every((l) => l.minSelected === 0);
}

export function MenuView({ menu, open }: { menu: Menu; open: boolean }) {
  const [active, setActive] = useState<MenuItem | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const { count, subtotal, ready, add } = useCart();
  const sections = menu.categories.filter((c) => menu.items.some((i) => i.categoryId === c.id));
  const [current, setCurrent] = useState(sections[0]?.id ?? "");

  // Underline the tab for the section that is on screen.
  useEffect(() => {
    const els = sections.map((c) => document.getElementById(`cat-${c.id}`)).filter((e): e is HTMLElement => !!e);
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.id.slice(4));
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 1600);
    return () => clearTimeout(t);
  }, [added]);

  function plus(item: MenuItem) {
    if (!open || !canQuickAdd(item)) return setActive(item);
    const v = item.variations[0];
    add({ itemId: item.id, itemName: item.name, variationId: v.id, variationName: v.name, unitPriceCents: v.priceCents, modifiers: [], quantity: 1, note: "" });
    setAdded(item.name);
  }

  return (
    <>
      <nav aria-label="Menu sections" className="no-scrollbar sticky top-16 z-20 -mx-5 overflow-x-auto border-b border-shell/10 bg-plum/95 px-5 backdrop-blur">
        <ul className="flex gap-6">
          {sections.map((c) => {
            const on = c.id === current;
            return (
              <li key={c.id}>
                <a
                  href={`#cat-${c.id}`}
                  aria-current={on ? "true" : undefined}
                  onClick={() => setCurrent(c.id)}
                  className={`-mb-px block whitespace-nowrap border-b-[3px] py-3 text-[15px] transition ${
                    on ? "border-rose font-extrabold text-shell" : "border-transparent font-bold text-shell/70 hover:text-shell"
                  }`}
                >
                  {c.name}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {sections.map((c) => {
        const items = menu.items.filter((i) => i.categoryId === c.id);
        return (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32 pt-6">
            <h2 className="font-display text-lg font-medium text-shell/90">{c.name}</h2>
            <ul className="mt-1">
              {items.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} onSelect={() => setActive(item)} onPlus={() => plus(item)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {menu.items.length === 0 && (
        <p className="mt-10 rounded-2xl bg-shell/5 p-6 text-center text-shell/75">The menu is being updated. Please check back in a few minutes.</p>
      )}

      <p aria-live="polite" className="sr-only">
        {added ? `${added} added to your bag` : ""}
      </p>

      {ready && count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <Link
            href="/checkout"
            className="bg-sunrise-x mx-auto flex h-14 max-w-md items-center justify-between rounded-[18px] px-[22px] text-base font-extrabold text-plum shadow-lg shadow-black/30 transition hover:brightness-105"
          >
            <span>{added ? `Added ${added}` : `View bag · ${count} ${count === 1 ? "item" : "items"}`}</span>
            <span>{formatCents(subtotal)}</span>
          </Link>
        </div>
      )}

      {active && <ItemSheet item={active} orderingOpen={open} onClose={() => setActive(null)} />}
    </>
  );
}

function ItemRow({ item, onSelect, onPlus }: { item: MenuItem; onSelect: () => void; onPlus: () => void }) {
  const soldOut = itemSoldOut(item);
  const from = Math.min(...item.variations.map((v) => v.priceCents));
  const varies = item.variations.some((v) => v.priceCents !== from);
  return (
    <div className={`flex items-center gap-3.5 border-b border-shell/10 py-3.5 ${soldOut ? "opacity-60" : ""}`}>
      <button type="button" onClick={onSelect} disabled={soldOut} className="flex min-w-0 flex-1 items-center gap-3.5 rounded-xl text-left disabled:cursor-not-allowed">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" loading="lazy" />
        ) : (
          <span className="bg-sunrise h-14 w-14 shrink-0 rounded-2xl" aria-hidden />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-bold">{item.name}</span>
          {item.description && <span className="line-clamp-2 text-[13px] text-shell/75">{item.description}</span>}
        </span>
        <span className="shrink-0 text-[15px] font-bold">
          {soldOut ? <span className="text-sm text-peach">Sold out</span> : `${varies ? "From " : ""}${formatCents(from)}`}
        </span>
      </button>
      <button
        type="button"
        onClick={onPlus}
        disabled={soldOut}
        aria-label={`Add ${item.name}`}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose text-white transition hover:bg-rose-dark disabled:cursor-not-allowed disabled:bg-shell/10"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
