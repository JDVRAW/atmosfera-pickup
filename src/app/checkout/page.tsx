import { Header } from "@/components/header";
import { CheckoutForm } from "@/components/checkout-form";
import { isOpenNow } from "@/lib/hours";
import { getShop, squareConfig } from "@/lib/square";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your bag | Atmosfera Cafe" };

export default async function CheckoutPage() {
  const shop = await getShop();
  const cfg = squareConfig();
  return (
    <>
      <Header showCart={false} />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <h1 className="font-display text-2xl font-medium">Your bag</h1>
        <CheckoutForm
          shop={shop}
          openNow={isOpenNow(new Date(), shop.hours, shop.timezone)}
          demo={cfg.demo}
          square={{ appId: cfg.appId, locationId: cfg.locationId, env: cfg.env }}
        />
      </main>
    </>
  );
}
