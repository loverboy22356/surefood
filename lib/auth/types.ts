export type AppRole = "buyer" | "vendor" | "supplier" | "producer" | "manufacturer" | "rider" | "staff" | "admin";

export const orderStatuses = [
  "Pending payment",
  "Confirm",
  "Processing",
  "Ready",
  "Assigned for delivery",
  "Delivered",
  "Cancelled/Refund",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];
