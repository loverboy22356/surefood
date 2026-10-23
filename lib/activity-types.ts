export type ActivityItem = {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
};

export function activityIcon(action: string) {
  if (action.startsWith("product_")) return "▦";
  if (action === "order_status_changed") return "▣";
  if (action.startsWith("verification_")) return "✓";
  return "•";
}

export function formatActivityTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}
