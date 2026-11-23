import { Header } from "@/components/header";
import { MenuView } from "@/components/menu-view";
import { hoursByDay, isOpenNow } from "@/lib/hours";
import { PREP_MINUTES } from "@/lib/constants";
import { getMenu, getShop, squareConfig } from "@/lib/square";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [menu, shop] = await Promise.all([getMenu(), getShop()]);
  const open = isOpenNow(new Date(), shop.hours, shop.timezone);
  const demo = squareConfig().demo;

  return (
    <>
      <Header />
      {demo && (
        <p className="bg-plum px-4 py-2 text-center text-xs font-semibold text-shell">
          Preview menu. Your real Square menu appears here once Square is connected.
        </p>
      )}
      <main className="mx-auto max-w-5xl px-4 pb-32">
        <section className="bg-sunrise relative mt-6 overflow-hidden rounded-3xl px-6 py-8 text-plum sm:px-10 sm:py-12">
          <p className="text-sm font-bold uppercase tracking-widest">Order ahead</p>
          <h1 className="font-display mt-2 max-w-lg text-3xl font-medium leading-tight sm:text-4xl">Skip the line. Your coffee will be waiting.</h1>
          <p className="mt-3 max-w-md text-plum/80">
            {open
              ? `Order now and pick up in about ${PREP_MINUTES} minutes${shop.address ? ` at ${shop.address}` : ""}.`
              : "We're closed right now. Browse the menu and order when we open."}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/atmosfera-mark-on-light.svg" alt="" aria-hidden className="pointer-events-none absolute -bottom-6 -right-6 hidden h-48 w-48 opacity-30 mix-blend-multiply sm:block" />
        </section>

        <MenuView menu={menu} open={open} />

        {shop.hours.length > 0 && (
          <section className="mt-14 rounded-2xl bg-white p-6">
            <h2 className="font-display text-lg font-medium">Hours</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              {hoursByDay(shop.hours).map((d) => (
                <div key={d.day} className="contents">
                  <dt className="font-semibold">{d.day}</dt>
                  <dd className="text-plum-soft">{d.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </main>
    </>
  );
}
