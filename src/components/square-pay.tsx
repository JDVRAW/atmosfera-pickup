"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typings for Square's Web Payments SDK (https://developer.squareup.com/docs/web-payments/overview).
type TokenResult = { status: string; token?: string; errors?: { message: string }[] };
type Tokenizer = { tokenize: () => Promise<TokenResult>; attach?: (sel: string) => Promise<void>; destroy?: () => Promise<void> };
type PaymentRequest = { update: (r: { total: { amount: string; label: string } }) => void };
type Payments = {
  card: () => Promise<Tokenizer>;
  paymentRequest: (r: { countryCode: string; currencyCode: string; total: { amount: string; label: string } }) => PaymentRequest;
  applePay: (r: PaymentRequest) => Promise<Tokenizer>;
  googlePay: (r: PaymentRequest) => Promise<Tokenizer & { attach: (sel: string, opts?: object) => Promise<void> }>;
};
declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => Payments };
  }
}

function loadSdk(env: "sandbox" | "production"): Promise<void> {
  if (window.Square) return Promise.resolve();
  const src = env === "production" ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js";
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    const s = existing ?? document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("Couldn't load the payment form")));
    if (!existing) {
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    }
  });
}

export type PayHandle = { tokenizeCard: () => Promise<string> };

/**
 * Square card form plus Apple Pay and Google Pay when the device supports them.
 * `onWalletToken` fires with a token after a wallet sheet succeeds.
 */
export function SquarePay({
  appId,
  locationId,
  env,
  totalCents,
  disabled,
  onReady,
  onWalletToken,
  beforeWallet,
}: {
  appId: string;
  locationId: string;
  env: "sandbox" | "production";
  totalCents: number;
  disabled: boolean;
  onReady: (handle: PayHandle) => void;
  onWalletToken: (token: string) => void;
  /** Return false to stop the wallet sheet opening (e.g. name missing). */
  beforeWallet: () => boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [applePay, setApplePay] = useState<Tokenizer | null>(null);
  const [googlePay, setGooglePay] = useState<Tokenizer | null>(null);
  const requestRef = useRef<PaymentRequest | null>(null);
  const started = useRef(false);
  const amount = (totalCents / 100).toFixed(2);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let card: Tokenizer | null = null;
    (async () => {
      try {
        await loadSdk(env);
        const payments = window.Square!.payments(appId, locationId);
        card = await payments.card();
        await card.attach!("#sq-card");
        onReady({
          tokenizeCard: async () => {
            const r = await card!.tokenize();
            if (r.status === "OK" && r.token) return r.token;
            throw new Error(r.errors?.[0]?.message ?? "Please check your card details.");
          },
        });

        const request = payments.paymentRequest({ countryCode: "US", currencyCode: "USD", total: { amount, label: "Atmosfera Cafe" } });
        requestRef.current = request;
        try {
          setApplePay(await payments.applePay(request));
        } catch {
          /* Apple Pay not available on this device */
        }
        try {
          const gp = await payments.googlePay(request);
          await gp.attach("#sq-google-pay", { buttonColor: "black", buttonSizeMode: "fill", buttonType: "pay" });
          setGooglePay(gp);
        } catch {
          /* Google Pay not available */
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load the payment form.");
      }
    })();
    return () => {
      void card?.destroy?.();
    };
    // Initialise once; amount updates go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    requestRef.current?.update({ total: { amount, label: "Atmosfera Cafe" } });
  }, [amount]);

  async function wallet(t: Tokenizer) {
    if (disabled || !beforeWallet()) return;
    const r = await t.tokenize();
    if (r.status === "OK" && r.token) onWalletToken(r.token);
  }

  return (
    <div>
      {(applePay || googlePay) && (
        <div className="mb-4 grid gap-2">
          {applePay && (
            <button
              type="button"
              onClick={() => wallet(applePay)}
              disabled={disabled}
              className="h-12 rounded-xl bg-black font-semibold text-white disabled:opacity-50"
              style={{ WebkitAppearance: "-apple-pay-button" } as React.CSSProperties}
              aria-label="Pay with Apple Pay"
            >
               Pay
            </button>
          )}
          <div
            id="sq-google-pay"
            onClick={() => googlePay && wallet(googlePay)}
            className={googlePay ? "h-12 overflow-hidden rounded-xl" : "hidden"}
            aria-disabled={disabled}
          />
          <p className="text-center text-xs text-plum-soft">or pay with card</p>
        </div>
      )}
      <div id="sq-card" className="min-h-[90px]" />
      {error && <p className="mt-2 text-sm font-semibold text-rose-dark">{error}</p>}
    </div>
  );
}
