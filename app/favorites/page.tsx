import type { Metadata } from "next";
import { FavouritesBoard } from "./favourites-board";

export const metadata: Metadata = {
  title: "Your favourites | SureFood",
  description: "The SureFood products you have saved for later.",
};

export default function FavoritesPage() {
  return <FavouritesBoard />;
}
