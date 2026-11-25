"use client";

import { useEffect, useRef, useState } from "react";
import type { MenuItem } from "@/lib/types";
import { formatCents, lineTotalCents } from "@/lib/money";
import { selectionProblem, toggleModifier } from "@/lib/selection";
import { useCart } from "./cart";

export function ItemSheet({ item, orderingOpen, onClose }: { item: MenuItem; orderingOpen: boolean; onClose: () => void }) {
  const { add } = useCart();
  const firstAvailable = item.variations.find((v) => !v.soldOut) ?? item.variations[0];
  const [variationId, setVariationId] = useState(firstAvailable.id);
  const [selected, setSelected] = useState<string[]>(() =>
    // Preselect the first option of required single-choice lists (e.g. milk).
    item.modifierLists.filter((l) => l.selection === "SINGLE" && l.minSelected >= 1).map((l) => l.modifiers[0].id),
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const variation = item.variations.find((v) => v.id === variationId)!;
  const modifiers = item.modifierLists.flatMap((l) => l.modifiers).filter((m) => selected.includes(m.id));
  const total = lineTotalCents({ unitPriceCents: variation.priceCents, modifiers, quantity });
  const problem = selectionProblem(item.modifierLists, selected);

  function submit() {
    setTried(true);
    if (problem || variation.soldOut || !orderingOpen) return;
    add({
      itemId: item.id,
      itemName: item.name,
      variationId: variation.id,
      variationName: variation.name,
      unitPriceCents: variation.priceCents,
      modifiers,
      quantity,
      note: note.trim(),
    });
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="item-title"
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl bg-plum-raised p-0 text-shell backdrop:bg-black/60 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="overflow-y-auto px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="item-title" className="font-display text-2xl font-medium">
                {item.name}
              </h2>
              {item.description && <p className="mt-1 text-shell/75">{item.description}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-shell/10" aria-label="Close">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {item.variations.length > 1 && (
            <fieldset className="mt-6">
              <legend className="text-sm font-bold uppercase tracking-wide text-shell/75">Size</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {item.variations.map((v) => (
                  <label
                    key={v.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border-2 px-4 py-3 ${
                      v.id === variationId ? "border-rose bg-rose/15" : "border-shell/15 bg-shell/5"
                    } ${v.soldOut ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <input type="radio" name="variation" className="sr-only" checked={v.id === variationId} disabled={v.soldOut} onChange={() => setVariationId(v.id)} />
                    <span className="font-semibold">{v.name}</span>
                    <span className="text-sm">{v.soldOut ? "Sold out" : formatCents(v.priceCents)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {item.modifierLists.map((list) => {
            const single = list.selection === "SINGLE" || list.maxSelected === 1;
            return (
              <fieldset key={list.id} className="mt-6">
                <legend className="flex w-full items-center gap-2 text-sm font-bold uppercase tracking-wide text-shell/75">
                  {list.name}
                  <span className="text-xs font-semibold normal-case tracking-normal">
                    {list.minSelected >= 1 ? "Required" : single ? "Optional" : list.maxSelected ? `Up to ${list.maxSelected}` : "Optional"}
                  </span>
                </legend>
                <div className="mt-2 divide-y divide-shell/10 rounded-xl bg-shell/5">
                  {list.modifiers.map((m) => {
                    const on = selected.includes(m.id);
                    return (
                      <label key={m.id} className="flex cursor-pointer items-center gap-3 px-4 py-3">
                        <input
                          type={single ? "radio" : "checkbox"}
                          name={`ml-${list.id}`}
                          checked={on}
                          onChange={() => setSelected((s) => toggleModifier(list, s, m.id))}
                          onClick={() => single && on && setSelected((s) => toggleModifier(list, s, m.id))}
                          className="h-5 w-5 accent-rose"
                        />
                        <span className="flex-1">{m.name}</span>
                        {m.priceCents > 0 && <span className="text-sm text-shell/75">+{formatCents(m.priceCents)}</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <label className="mt-6 block">
            <span className="text-sm font-bold uppercase tracking-wide text-shell/75">Note for the barista</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 120))}
              placeholder="Extra hot, light ice..."
              className="mt-2 w-full rounded-xl border border-shell/15 bg-shell/5 px-4 py-3 placeholder:text-shell/50"
            />
          </label>
        </div>

        <div className="border-t border-shell/10 bg-plum-raised px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {tried && problem && <p className="mb-3 text-sm font-semibold text-rose-light">{problem}</p>}
          {!orderingOpen && <p className="mb-3 text-sm font-semibold text-rose-light">We&apos;re closed right now, so ordering is paused.</p>}
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border border-shell/15 bg-shell/5">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="h-12 w-12 text-xl" aria-label="One fewer">
                −
              </button>
              <span className="w-6 text-center font-semibold" aria-live="polite">
                {quantity}
              </span>
              <button type="button" onClick={() => setQuantity((q) => Math.min(25, q + 1))} className="h-12 w-12 text-xl" aria-label="One more">
                +
              </button>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!orderingOpen || variation.soldOut}
              className="flex h-12 flex-1 items-center justify-between rounded-full bg-sunrise-x px-5 font-extrabold text-plum transition hover:brightness-105 disabled:opacity-50"
            >
              <span>Add to bag</span>
              <span>{formatCents(total)}</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
