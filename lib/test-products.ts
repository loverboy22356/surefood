export type TestProduct = {
  id: string;
  sellerId: string;
  [key: string]: unknown;
};

const productsBySeller = new Map<string, TestProduct[]>();

export function isLocalTestSeller(email: unknown) {
  const allowlistedEmail = process.env.SUREFOOD_TEST_LISTING_EMAIL?.trim().toLowerCase();
  return process.env.NODE_ENV === "development" &&
    Boolean(allowlistedEmail) &&
    typeof email === "string" &&
    email.trim().toLowerCase() === allowlistedEmail;
}

export function getLocalTestProducts(sellerId: string) {
  return productsBySeller.get(sellerId) ?? [];
}

export function saveLocalTestProduct(product: TestProduct) {
  const products = productsBySeller.get(product.sellerId) ?? [];
  productsBySeller.set(product.sellerId, [product, ...products].slice(0, 100));
}