import type { MarketplaceProduct } from "./marketplace-product";

export type CartLine = {
  product: MarketplaceProduct;
  quantity: number;
};

const CART_KEY = "surefood-cart";

export function readCartLines(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function writeCartLines(lines: CartLine[]) {
  try {
    if (lines.length) window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
    else window.localStorage.removeItem(CART_KEY);
  } catch (error) {
    console.error("Could not save your basket.", error);
  }
}

export function cartItemCount() {
  return readCartLines().reduce((total, line) => total + line.quantity, 0);
}

export function addItemToBasket(product: MarketplaceProduct, amount = 1): { ok: boolean; message: string } {
  if ((product.stock ?? 0) <= 0) return { ok: false, message: "This item is out of stock." };
  const cart = readCartLines();
  const currency = cart[0]?.product.currency;
  if (cart.length && currency && product.currency && currency !== product.currency) {
    return { ok: false, message: "Your basket can hold products in one currency at a time. Finish that order first." };
  }
  if (cart.length && cart.some((line) => line.product.sellerId && line.product.sellerId !== product.sellerId)) {
    return { ok: false, message: "Your basket has items from another store. Place that order first, then shop here." };
  }
  const line = cart.find((item) => item.product.id === product.id);
  const nextQuantity = Math.min((line?.quantity ?? 0) + amount, product.stock ?? amount);
  if (line && nextQuantity === line.quantity) {
    return { ok: false, message: "There is no more stock available for this product." };
  }
  const nextCart: CartLine[] = line
    ? cart.map((item) => item.product.id === product.id ? { ...item, quantity: nextQuantity } : item)
    : [...cart, { product, quantity: nextQuantity }];
  writeCartLines(nextCart);
  return { ok: true, message: `${product.name} added to your basket.` };
}
