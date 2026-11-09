import type { Metadata } from "next";
import { BasketStore } from "./basket-store";

export const metadata: Metadata = {
  title: "Sure Foodz Basket — food delivered on a schedule",
  description:
    "Weekly, fortnightly or monthly food baskets: student, personal, family and business packages, or build your own basket from fresh market staples.",
};

export default function BasketsPage() {
  return <BasketStore />;
}
