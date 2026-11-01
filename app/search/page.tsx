import type { Metadata } from "next";
import { SearchResults } from "./search-results";

export const metadata: Metadata = {
  title: "Search products | Sure Foodz",
  description: "Search live listings from approved Sure Foodz sellers.",
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  return <SearchResults initialQuery={(raw ?? "").slice(0, 80)} />;
}
