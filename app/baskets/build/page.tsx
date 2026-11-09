import type { Metadata } from "next";
import { BasketBuilder } from "./basket-builder";

export const metadata: Metadata = {
  title: "Build your own basket | Sure Foodz",
  description: "Choose the groceries your household uses and have them delivered weekly, fortnightly or monthly.",
};

export default function BuildBasketPage() {
  return <BasketBuilder />;
}
