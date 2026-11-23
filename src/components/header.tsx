"use client";

import Link from "next/link";
import { useCart } from "./cart";

export function Header({ showCart = true }: { showCart?: boolean }) {
  const { count, ready } = useCart();
  return (
    <header className="sticky top-0 z-30 border-b border-plum/10 bg-shell/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href="/" aria-label="Atmosfera Cafe, back to menu" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/atmosfera-logo-on-light.svg" alt="Atmosfera Cafe" className="h-10 w-auto" />
        </Link>
        {showCart && (
          <Link
            href="/checkout"
            className="relative flex items-center gap-2 rounded-full bg-plum px-4 py-2 text-sm font-semibold text-shell transition hover:bg-plum-soft"
          >
            <BagIcon />
            <span>Bag</span>
            {ready && count > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-xs text-white" aria-label={`${count} items`}>
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
