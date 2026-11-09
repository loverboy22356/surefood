import type { Metadata } from "next";
import { BusinessHub } from "./business-hub";

export const metadata: Metadata = {
  title: "Bulk & business food supply | Sure Foodz",
  description:
    "Wholesale food supply for restaurants, canteens, offices and resellers: bulk quantities, written quotations, scheduled deliveries, repeat orders and business accounts.",
};

export default function BusinessPage() {
  return <BusinessHub />;
}
