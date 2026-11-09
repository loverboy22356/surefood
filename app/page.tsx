import { loadApprovedSellers, loadBuyerCatalog, loadProductCategories } from "@/lib/catalog";
import HomeView from "./home-view";

// The shelves are identical for every visitor, so they are rendered on the server
// and refreshed every minute. The first paint already shows the catalogue instead
// of an empty page waiting on JavaScript and three API round trips.
export const revalidate = 60;

export default async function Home() {
  const [catalog, vendors, categories] = await Promise.allSettled([
    loadBuyerCatalog(),
    loadApprovedSellers("vendor"),
    loadProductCategories(),
  ]);

  if (catalog.status === "rejected") {
    // The page still renders (the client offers a retry), but an empty shelf at
    // build time is worth knowing about.
    console.error("Could not read the Sure Foodz catalogue for the home page.", catalog.reason);
  }

  return (
    <HomeView
      initialProducts={catalog.status === "fulfilled" ? catalog.value : []}
      initialSellers={vendors.status === "fulfilled" ? vendors.value : []}
      initialCategories={categories.status === "fulfilled" ? categories.value : []}
      initialCatalogOk={catalog.status === "fulfilled"}
    />
  );
}
