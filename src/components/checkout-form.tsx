"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ShopInfo } from "@/lib/types";
import { PREP_MINUTES } from "@/lib/constants";
import { formatCents, lineTotalCents, TIP_PERCENTS, tipFromPercent } from "@/lib/money";
import { localMinutesToIso, pickupSlotsToday } from "@/lib/hours";
import { useCart } from "./cart";
import { SquarePay, type PayHandle } from "./square-pay";

type Quote = { subtotalCents: number; taxCents: number; totalCents: number };
type Tip = { kind: "percent"; value: number } | { kind: "custom"; cents: number } | { kind: "none" };

const CONTACT_KEY = "atmosfera-contact-v1";

export function CheckoutForm({
  shop,
  openNow,
  demo,
  square,
}: {
  shop: ShopInfo;
  openNow: boolean;
  demo: boolean;
  square: { appId: string; locationId: string; env: "sandbox" | "production" };
}) {
  const router = useRouter();
  const { lines, ready, setQuantity, clear } = useCart();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [pickup, setPickup] = useState<string>("ASAP"); // "ASAP" or minutes since midnight
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [tip, setTip] = useState<Tip>({ kind: "percent", value: 18 });
  const [customTip, setCustomTip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payRef = useRef<PayHandle | null>(null);

  const slots = useMemo(() => pickupSlotsToday(new Date(), shop.hours, shop.timezone, PREP_MINUTES), [shop]);

  // Remember contact details on this device for next time.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CONTACT_KEY) ?? "{}");
      setName(saved.name ?? "");
      setPhone(saved.phone ?? "");
      setEmail(saved.email ?? "");
    } catch {
      /* ignore */
    }
  }, []);

  // Ask the server (Square) for the real price including tax whenever the bag changes.
  const linesKey = JSON.stringify(lines.map((l) => [l.variationId, l.quantity, l.modifiers.map((m) => m.id)]));
  useEffect(() => {
    if (!ready || lines.length === 0) {
      setQuote(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lines: apiLines() }),
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setQuote(data);
        setQuoteError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setQuoteError((e as Error).message || "Couldn't price your order.");
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, ready]);

  function apiLines() {
    return lines.map((l) => ({ variationId: l.variationId, quantity: l.quantity, modifierIds: l.modifiers.map((m) => m.id), note: l.note }));
  }

  const subtotal = quote?.subtotalCents ?? lines.reduce((s, l) => s + lineTotalCents(l), 0);
  const tipCents =
    tip.kind === "percent" ? tipFromPercent(subtotal, tip.value) : tip.kind === "custom" ? tip.cents : 0;
  const total = (quote?.totalCents ?? subtotal) + tipCents;

  function validate(): string | null {
    if (!openNow) return "We're closed right now, so online ordering is paused.";
    if (!name.trim()) return "Add the name we should call out.";
    if (!phone.trim() && !email.trim()) return "Add a phone number or email so we can reach you.";
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return "That email doesn't look right.";
    if (!quote) return quoteError ?? "Still pricing your order, one moment.";
    return null;
  }

  async function pay(walletToken?: string) {
    setError(null);
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      let sourceId = walletToken ?? "demo";
      if (!demo && !walletToken) {
        if (!payRef.current) throw new Error("The card form is still loading.");
        sourceId = await payRef.current.tokenizeCard();
      }
      try {
        localStorage.setItem(CONTACT_KEY, JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() }));
      } catch {
        /* ignore */
      }
      const pickupBody =
        pickup === "ASAP" ? { type: "ASAP" } : { type: "SCHEDULED", at: localMinutesToIso(new Date(), Number(pickup), shop.timezone) };
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          sourceId,
          lines: apiLines(),
          customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
          pickup: pickupBody,
          tipCents,
          orderNote: orderNote.trim(),
          expectedTotalCents: quote!.totalCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "PRICE_CHANGED") setQuote(null);
        throw new Error(data.error ?? "Payment didn't go through.");
      }
      const pickupLabel = pickup === "ASAP" ? "asap" : slots.find((s) => String(s.minutesFromMidnight) === pickup)?.label ?? "";
      const qs = new URLSearchParams({ name: name.trim(), total: String(data.totalCents), pickup: pickupLabel });
      if (data.receiptUrl) qs.set("receipt", data.receiptUrl);
      clear();
      router.push(`/order/${encodeURIComponent(data.orderId)}?${qs}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!ready) return <div className="mt-8 h-40 animate-pulse rounded-2xl bg-white/60" />;

  if (lines.length === 0) {
    return (
      <div className="mt-8 rounded-2xl bg-white p-8 text-center">
        <p className="text-plum-soft">Your bag is empty.</p>
        <Link href="/" className="mt-4 inline-block rounded-full bg-rose px-6 py-3 font-semibold text-white hover:bg-rose-dark">
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <form
      className="mt-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void pay();
      }}
    >
      <section className="rounded-2xl bg-white p-4">
        <ul className="divide-y divide-plum/10">
          {lines.map((l) => (
            <li key={l.key} className="flex gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {l.itemName}
                  {l.variationName && l.variationName !== "Regular" && <span className="font-normal text-plum-soft"> · {l.variationName}</span>}
                </p>
                {l.modifiers.length > 0 && <p className="text-sm text-plum-soft">{l.modifiers.map((m) => m.name).join(", ")}</p>}
                {l.note && <p className="text-sm italic text-plum-soft">“{l.note}”</p>}
                <div className="mt-2 inline-flex items-center rounded-full border border-plum/15">
                  <button type="button" className="h-8 w-8" onClick={() => setQuantity(l.key, l.quantity - 1)} aria-label={`Remove one ${l.itemName}`}>
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{l.quantity}</span>
                  <button type="button" className="h-8 w-8" onClick={() => setQuantity(l.key, l.quantity + 1)} aria-label={`Add one ${l.itemName}`}>
                    +
                  </button>
                </div>
              </div>
              <p className="font-semibold">{formatCents(lineTotalCents(l))}</p>
            </li>
          ))}
        </ul>
        <Link href="/" className="mt-2 inline-block text-sm font-semibold text-rose-dark hover:underline">
          + Add more
        </Link>
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="font-display text-lg font-medium">Pickup time</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Choice on={pickup === "ASAP"} onClick={() => setPickup("ASAP")}>
            As soon as possible
            <span className="block text-xs font-normal text-plum-soft">About {PREP_MINUTES} minutes</span>
          </Choice>
          <label className={`rounded-xl border-2 px-3 py-2 ${pickup !== "ASAP" ? "border-rose" : "border-plum/10"}`}>
            <span className="block text-sm font-semibold">Later today</span>
            <select
              value={pickup === "ASAP" ? "" : pickup}
              onChange={(e) => setPickup(e.target.value || "ASAP")}
              disabled={slots.length === 0}
              className="mt-1 w-full bg-transparent text-sm"
              aria-label="Pickup time later today"
            >
              <option value="">{slots.length ? "Pick a time" : "No more times today"}</option>
              {slots.map((s) => (
                <option key={s.minutesFromMidnight} value={s.minutesFromMidnight}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="font-display text-lg font-medium">Your details</h2>
        <div className="mt-3 grid gap-3">
          <Field label="Name for the order" value={name} onChange={setName} autoComplete="given-name" required />
          <Field label="Phone" value={phone} onChange={setPhone} type="tel" autoComplete="tel" hint="So we can text if something's up" />
          <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" hint="For your receipt" />
          <Field label="Note for the order (optional)" value={orderNote} onChange={setOrderNote} />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="font-display text-lg font-medium">Add a tip</h2>
        <p className="text-sm text-plum-soft">100% goes to the team.</p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          <Choice compact on={tip.kind === "none"} onClick={() => setTip({ kind: "none" })}>
            None
          </Choice>
          {TIP_PERCENTS.map((p) => (
            <Choice compact key={p} on={tip.kind === "percent" && tip.value === p} onClick={() => setTip({ kind: "percent", value: p })}>
              {p}%
            </Choice>
          ))}
          <Choice compact on={tip.kind === "custom"} onClick={() => setTip({ kind: "custom", cents: Math.round(Number(customTip || 0) * 100) })}>
            Other
          </Choice>
        </div>
        {tip.kind === "custom" && (
          <label className="mt-3 flex items-center gap-2">
            <span className="text-sm font-semibold">$</span>
            <input
              inputMode="decimal"
              value={customTip}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, "");
                setCustomTip(v);
                const cents = Math.round(Number(v || 0) * 100);
                setTip({ kind: "custom", cents: Number.isFinite(cents) ? Math.min(cents, 100_00) : 0 });
              }}
              placeholder="0.00"
              className="w-28 rounded-lg border border-plum/15 px-3 py-2"
              aria-label="Custom tip in dollars"
            />
          </label>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4">
        <dl className="space-y-1 text-sm">
          <Row label="Subtotal" value={formatCents(subtotal)} />
          <Row label="Tax" value={quote ? formatCents(quote.taxCents) : "…"} />
          <Row label="Tip" value={formatCents(tipCents)} />
          <div className="flex justify-between border-t border-plum/10 pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatCents(total)}</dd>
          </div>
        </dl>
        {quoteError && <p className="mt-2 text-sm font-semibold text-rose-dark">{quoteError}</p>}
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="font-display mb-3 text-lg font-medium">Payment</h2>
        {demo ? (
          <p className="rounded-xl bg-shell-deep p-3 text-sm">
            Preview mode: no card is charged. Once Square is connected, the card, Apple Pay and Google Pay form appears here.
          </p>
        ) : (
          <SquarePay
            appId={square.appId}
            locationId={square.locationId}
            env={square.env}
            totalCents={total}
            disabled={busy}
            onReady={(h) => (payRef.current = h)}
            onWalletToken={(token) => void pay(token)}
            beforeWallet={() => {
              const problem = validate();
              setError(problem);
              return problem == null;
            }}
          />
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-rose/10 p-3 text-sm font-semibold text-rose-dark">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !openNow}
        className="flex h-14 w-full items-center justify-between rounded-full bg-rose px-6 text-lg font-semibold text-white shadow-lg shadow-rose/30 transition hover:bg-rose-dark disabled:opacity-60"
      >
        <span>{busy ? "Placing order…" : openNow ? "Place order" : "Ordering paused"}</span>
        <span>{formatCents(total)}</span>
      </button>
    </form>
  );
}

function Choice({ on, onClick, children, compact }: { on: boolean; onClick: () => void; children: React.ReactNode; compact?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-xl border-2 text-left font-semibold transition ${compact ? "px-1 py-2 text-center text-sm" : "px-3 py-2 text-sm"} ${
        on ? "border-rose bg-rose/5" : "border-plum/10 hover:border-plum/30"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  hint,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="ml-2 text-xs text-plum-soft">{hint}</span>}
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-plum/15 bg-white px-4 py-3"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-plum-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
