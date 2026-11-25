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
        <p className="bg-shell/5 px-5 py-2 text-center text-xs font-semibold text-shell/75">
          Preview menu. Your real Square menu appears here once Square is connected.
        </p>
      )}
      <main className="mx-auto max-w-3xl px-5 pb-32">
        <section className="pb-5 pt-3">
          <p className="text-sm font-bold text-peach">
            {open ? `Open now · ready in about ${PREP_MINUTES} min` : "Closed right now · browse and order when we open"}
          </p>
          <h1 className="font-display mt-2 text-[30px] font-medium leading-[1.12] sm:text-4xl">
            What are we
            <br />
            brewing today?
          </h1>
          {shop.address && <p className="mt-2 text-sm text-shell/75">Pickup at {shop.address}</p>}
        </section>

        <MenuView menu={menu} open={open} />

        {shop.hours.length > 0 && (
          <section className="mt-12 rounded-2xl bg-shell/5 p-5">
            <h2 className="font-display text-lg font-medium">Hours</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              {hoursByDay(shop.hours).map((d) => (
                <div key={d.day} className="contents">
                  <dt className="font-semibold">{d.day}</dt>
                  <dd className="text-shell/75">{d.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </main>
    </>
  );
}
