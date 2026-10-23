export const DEFAULT_PRODUCT_CATEGORIES = [
  "Fresh vegetables",
  "Fresh fruits",
  "Meat & seafood",
  "Dairy & eggs",
  "Bakery",
  "Pantry essentials",
  "Drinks",
  "Snacks & treats",
  "Frozen foods",
  "Home & kitchen",
  "Health & beauty",
  "Baby & kids",
  "Pet supplies",
  "Household essentials",
] as const;

export function categoryId(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}
