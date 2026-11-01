import type { Metadata } from "next";
import { FavouritesBoard } from "./favourites-board";
import "../wishlist.css";

export const metadata: Metadata = {
  title: "Your wishlist | Sure Foodz",
  description: "The Sure Foodz products you have saved for later.",
};

export default function FavoritesPage() {
  return <FavouritesBoard />;
}
