"use client";

import Link from "next/link";
import { useCart } from "./cart";

export function Header({ showCart = true }: { showCart?: boolean }) {
  const { count, ready } = useCart();
  const label = ready && count > 0 ? `Bag, ${count} ${count === 1 ? "item" : "items"}` : "Bag";
  return (
    <header className="sticky top-0 z-30 bg-plum/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
        <Link href="/" aria-label="Atmosfera Cafe, back to menu" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/atmosfera-logo-on-dark.svg" alt="Atmosfera Cafe" className="h-[34px] w-auto" />
        </Link>
        {showCart && (
          <Link
            href="/checkout"
            aria-label={label}
            className="relative grid h-11 w-11 place-items-center rounded-full bg-shell/10 text-shell transition hover:bg-shell/20"
          >
            <BagIcon className="h-5 w-5" />
            {ready && count > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose px-1 text-[11px] font-extrabold text-white"
              >
                {count}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  );
}

export function BagIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M6 7h12l-1 13H7L6 7z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </svg>
  );
}
