import { Suspense } from "react";
import { ShopBrowser } from "./shop-browser";

export const metadata = {
  title: "Shop | Sure Foodz",
  description: "Everything on Sure Foodz — fresh groceries, staples and household essentials from verified sellers.",
};

export default function ShopPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
      <ShopBrowser />
    </Suspense>
  );
}
