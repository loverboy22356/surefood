import type { Metadata } from "next";
import { HelpCentre } from "./help-centre";
import "../help.css";

export const metadata: Metadata = {
  title: "Help centre | Sure Foodz",
  description: "Answers about orders, delivery, Pay Later, event orders, vendor verification and affiliate payouts on Sure Foodz.",
};

export default function HelpPage() {
  return <HelpCentre />;
}
