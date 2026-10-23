"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useBusinessAccount } from "@/lib/auth/use-business-account";
import { activityIcon, formatActivityTime, type ActivityItem } from "@/lib/activity-types";
import { uploadProductImage } from "@/lib/cloudinary-client";
import { sellerCanManageListings, sellerNeedsApprovalFee } from "@/lib/auth/seller-verification";
import { ProductCategoryPicker } from "@/app/components/product-category-picker";
import { PayoutAccountForm } from "@/app/components/payout-account-form";

type VendorView = "Overview" | "Products" | "Customer orders" | "Inventory" | "Customers" | "Promotions" | "Payout account" | "Buy from suppliers" | "Supplier orders";
type CustomerOrderStatus = "Pending seller confirmation" | "Awaiting buyer payment" | "Paid" | "Processing" | "Ready" | "Delivered" | "Cancelled/Refund";

type RetailProduct = {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  compareAt?: number;
  stock: number;
  emoji: string;
  sales: number;
  imageUrl?: string;
  productKind?: string;
  expiryDate?: string;
  nafdacNumber?: string;
};

type RetailOrder = {
  id: string;
  customer: string;
  item: string;
  total: number;
  status: CustomerOrderStatus;
  deliveryFeeMinor?: number | null;
  paymentStatus?: string;
  deliveryAddress?: string;
  customerPhone?: string;
};

type SupplierListing = {
  id: string;
  name: string;
  priceMinor: number;
  stock: number;
  sellerName?: string;
  sellerRole?: string;
  category?: string;
  imageUrl?: string;
};

type PurchaseOrder = {
  id: string;
  sellerName?: string;
  items: { name: string; quantity: number }[];
  totalMinor: number;
  status: CustomerOrderStatus;
  paymentStatus?: string;
  paymentAuthorizationUrl?: string;
};

const views: VendorView[] = ["Overview", "Products", "Customer orders", "Inventory", "Customers", "Promotions", "Payout account", "Buy from suppliers", "Supplier orders"];

const nextStatus: Partial<Record<CustomerOrderStatus, { label: string; status: CustomerOrderStatus }>> = {
  Paid: { label: "Start preparing", status: "Processing" },
  Processing: { label: "Mark ready", status: "Ready" },
  Ready: { label: "Mark delivered", status: "Delivered" },
};

const statusOptions: CustomerOrderStatus[] = [
  "Pending seller confirmation", "Awaiting buyer payment", "Paid", "Processing", "Ready", "Delivered", "Cancelled/Refund",
];

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

function statusClass(status: string) {
  return status.toLowerCase().replaceAll(" ", "-").replace("/", "-");
}

export default function VendorPage() {
  const account = useBusinessAccount("vendor");
  const canListProducts = sellerCanManageListings(account.profile);
  const [activeView, setActiveView] = useState<VendorView>("Overview");
  const [products, setProducts] = useState<RetailProduct[]>([]);
  const [orders, setOrders] = useState<RetailOrder[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [orderFilter, setOrderFilter] = useState<CustomerOrderStatus | "All">("All");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<RetailProduct | null>(null);
  const [busyProductId, setBusyProductId] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const savingProductRef = useRef(false);
  const [orderNotice, setOrderNotice] = useState("");
  const [initialOrdersLoaded, setInitialOrdersLoaded] = useState(false);
  const observedOrderStatuses = useRef(new Map<string, CustomerOrderStatus>());
  const hasObservedOrderList = useRef(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [supplierListings, setSupplierListings] = useState<SupplierListing[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [supplyError, setSupplyError] = useState("");
  const [supplyNotice, setSupplyNotice] = useState("");
  const [supplyBusy, setSupplyBusy] = useState("");
  const [promoProductId, setPromoProductId] = useState("");
  const [promoSalePrice, setPromoSalePrice] = useState("");
  const [promoBusy, setPromoBusy] = useState("");
  const [promoError, setPromoError] = useState("");

  async function loadSupplyWorkspace() {
    if (!account.user) return;
    try {
      const token = await account.user.getIdToken();
      const [catalogResponse, purchaseResponse] = await Promise.all([
        fetch("/api/products", { signal: AbortSignal.timeout(15_000) }),
        fetch("/api/orders?mine=purchases", { headers: { authorization: `Bearer ${token}` } }),
      ]);
      const [catalogData, purchaseData] = await Promise.all([catalogResponse.json(), purchaseResponse.json()]);
      if (!catalogResponse.ok) throw new Error(catalogData.error || "Could not load supplier listings.");
      if (!purchaseResponse.ok) throw new Error(purchaseData.error || "Could not load your supplier orders.");
      setSupplierListings((catalogData.products as (SupplierListing & { sellerRole?: string })[])
        .filter((product) => product.sellerRole === "supplier"));
      setPurchases(purchaseData.orders as PurchaseOrder[]);
      setSupplyError("");
    } catch (reason) {
      setSupplyError(reason instanceof Error ? reason.message : "Could not load wholesale supply.");
    }
  }

  useEffect(() => {
    if (account.user) void loadSupplyWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.user]);

  async function orderFromSupplier(product: SupplierListing, quantity: number) {
    if (!account.user) return;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > product.stock) {
      setSupplyError("Choose a quantity within the available stock.");
      return;
    }
    setSupplyBusy(product.id);
    setSupplyError("");
    setSupplyNotice("");
    try {
      const token = await account.user.getIdToken();
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ checkoutId: crypto.randomUUID(), items: [{ productId: product.id, quantity }] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not place the supply order.");
      setSupplyNotice(`Order sent to ${product.sellerName || "your supplier"}. They will confirm the delivery fee, then you can pay.`);
      await loadSupplyWorkspace();
    } catch (reason) {
      setSupplyError(reason instanceof Error ? reason.message : "Could not place the supply order.");
    } finally {
      setSupplyBusy("");
    }
  }

  async function payForPurchase(order: PurchaseOrder) {
    if (!account.user) return;
    setSupplyBusy(order.id);
    setSupplyError("");
    try {
      if (order.paymentStatus === "pending" && order.paymentAuthorizationUrl) {
        window.location.assign(order.paymentAuthorizationUrl);
        return;
      }
      const token = await account.user.getIdToken();
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start secure checkout.");
      if (typeof result.authorizationUrl !== "string") throw new Error("Paystack did not return a checkout link.");
      window.location.assign(result.authorizationUrl);
    } catch (reason) {
      setSupplyError(reason instanceof Error ? reason.message : "Could not start secure checkout.");
      setSupplyBusy("");
    }
  }

  async function refreshActivities() {
    if (!account.user) return;
    try {
      const token = await account.user.getIdToken();
      const response = await fetch("/api/activity", { headers: { authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load recent activity.");
      setActivities(data.activities);
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : "Could not load recent activity.");
    }
  }

  useEffect(() => {
    if (!account.user || !account.profile) return;
    let active = true;
    async function loadWorkspace() {
      try {
        const token = await account.user!.getIdToken();
        const headers = { authorization: `Bearer ${token}` };
        const [productResponse, orderResponse, activityResponse] = await Promise.all([
          fetch("/api/products?mine=true", { headers }),
          fetch("/api/orders", { headers }),
          fetch("/api/activity", { headers }),
        ]);
        const [productData, orderData, activityData] = await Promise.all([
          productResponse.json(),
          orderResponse.json(),
          activityResponse.json(),
        ]);
        if (!productResponse.ok) throw new Error(productData.error || "Could not load products.");
        if (!orderResponse.ok) throw new Error(orderData.error || "Could not load orders.");
        if (!activityResponse.ok) throw new Error(activityData.error || "Could not load recent activity.");
        if (!active) return;
        setProducts(productData.products.map((product: { id: string; name: string; description?: string; category: string; priceMinor: number; compareAtMinor?: number; stock: number; imageUrl?: string; productKind?: string; expiryDate?: string; nafdacNumber?: string }) => ({
          id: product.id, name: product.name, description: product.description, category: product.category, price: product.priceMinor / 100,
          compareAt: product.compareAtMinor ? product.compareAtMinor / 100 : undefined,
          stock: product.stock, imageUrl: product.imageUrl, productKind: product.productKind,
          expiryDate: product.expiryDate, nafdacNumber: product.nafdacNumber, emoji: "🧺", sales: 0,
        })));
        setOrders(orderData.orders.map((order: { id: string; customerName?: string; customerPhone?: string; deliveryAddress?: string; items: { name: string }[]; totalMinor: number; deliveryFeeMinor?: number | null; paymentStatus?: string; status: CustomerOrderStatus }) => ({
          id: order.id, customer: order.customerName || "SureFood customer",
          item: order.items.map((item) => item.name).join(", "), total: order.totalMinor / 100, status: order.status,
          deliveryFeeMinor: order.deliveryFeeMinor, paymentStatus: order.paymentStatus,
          deliveryAddress: order.deliveryAddress, customerPhone: order.customerPhone,
        })));
        setInitialOrdersLoaded(true);
        setActivities(activityData.activities);
        setWorkspaceError("");
      } catch (reason) {
        if (active) setWorkspaceError(reason instanceof Error ? reason.message : "Could not load your workspace data.");
      }
    }
    void loadWorkspace();
    return () => { active = false; };
  }, [account.user, account.profile]);

  useEffect(() => {
    if (!account.user) return;
    let active = true;
    async function refreshOrders() {
      try {
        const token = await account.user!.getIdToken();
        const response = await fetch("/api/orders", { headers: { authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not refresh orders.");
        if (active) setOrders(result.orders.map((order: { id: string; customerName?: string; customerPhone?: string; deliveryAddress?: string; items: { name: string }[]; totalMinor: number; deliveryFeeMinor?: number | null; paymentStatus?: string; status: CustomerOrderStatus }) => ({
          id: order.id, customer: order.customerName || "SureFood customer",
          item: order.items.map((item) => item.name).join(", "),
          total: order.totalMinor / 100, status: order.status,
          deliveryFeeMinor: order.deliveryFeeMinor, paymentStatus: order.paymentStatus,
          deliveryAddress: order.deliveryAddress, customerPhone: order.customerPhone,
        })));
      } catch (reason) {
        if (active) setWorkspaceError(reason instanceof Error ? reason.message : "Could not refresh orders.");
      }
    }
    const interval = window.setInterval(() => void refreshOrders(), 20_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [account.user]);

  useEffect(() => {
    if (!initialOrdersLoaded) return;
    if (!hasObservedOrderList.current) {
      observedOrderStatuses.current = new Map(orders.map((order) => [order.id, order.status]));
      hasObservedOrderList.current = true;
      return;
    }
    const previous = observedOrderStatuses.current;
    const newOrder = orders.find((order) => !previous.has(order.id));
    const newlyPaid = orders.find((order) => previous.has(order.id) &&
      previous.get(order.id) !== "Paid" && order.status === "Paid");
    if (newOrder) setOrderNotice(`New customer order from ${newOrder.customer}. Confirm its delivery fee to notify the buyer.`);
    else if (newlyPaid) setOrderNotice(`Payment received for ${newlyPaid.item}. You can start preparing the order.`);
    observedOrderStatuses.current = new Map(orders.map((order) => [order.id, order.status]));
  }, [initialOrdersLoaded, orders]);

  async function updateOrder(orderId: string, status: CustomerOrderStatus) {
    if (!account.user) return;
    try {
      const token = await account.user.getIdToken();
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the order.");
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status } : order));
      setWorkspaceError("");
      void refreshActivities();
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : "Could not update the order.");
    }
  }

  async function quoteDelivery(orderId: string, deliveryFeeMinor: number) {
    if (!account.user) return;
    try {
      const token = await account.user.getIdToken();
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ deliveryFeeMinor }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not confirm delivery.");
      setOrders((current) => current.map((order) => order.id === orderId
        ? { ...order, status: result.order.status, deliveryFeeMinor: result.order.deliveryFeeMinor, total: result.order.totalMinor / 100 }
        : order));
      setWorkspaceError("");
      void refreshActivities();
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : "Could not confirm delivery.");
    }
  }

  async function addProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.user) return;
    if (!canListProducts) {
      setWorkspaceError("Complete business verification before listing products.");
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name")).trim();
    const description = String(data.get("description") ?? "").trim();
    const price = Number(data.get("price"));
    const compareAt = Number(data.get("compareAt"));
    const stock = Number(data.get("stock"));
    const category = productCategory;
    const productKind = String(data.get("productKind"));
    const expiryDate = String(data.get("expiryDate"));
    const nafdacNumber = String(data.get("nafdacNumber") ?? "");
    const image = data.get("image");
    const hasNewImage = image instanceof File && image.size > 0;
    const editing = editingProduct;
    if (!category || !expiryDate || (!hasNewImage && !editing) || !Number.isFinite(price) || price <= 0 || !Number.isFinite(stock) || stock < 0) {
      setWorkspaceError(editing ? "Choose a category and expiry date and enter a valid price and stock count." : "Choose a category and expiry date and enter a product image, valid price, and stock count.");
      return;
    }
    if (productKind === "manufacturer" && !nafdacNumber.trim()) {
      setWorkspaceError("Enter a NAFDAC number for manufacturer products.");
      return;
    }
    // A double-click must not upload and create the same listing twice.
    if (savingProductRef.current) return;
    savingProductRef.current = true;
    setSavingProduct(true);
    try {
      const imageUrl = hasNewImage ? await uploadProductImage(image, account.user) : undefined;
      const token = await account.user.getIdToken();
      const response = await fetch(editing ? `/api/products/${encodeURIComponent(editing.id)}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          category,
          productKind,
          expiryDate,
          nafdacNumber,
          priceMinor: Math.round(price * 100),
          ...(Number.isFinite(compareAt) && compareAt > price
            ? { compareAtMinor: Math.round(compareAt * 100) }
            : editing ? { compareAtMinor: null } : {}),
          stock,
          ...(imageUrl ? { imageUrl } : {}),
          currency: "NGN",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || (editing ? "Could not update this product." : "Could not publish this product."));
      const product = result.product;
      const savedProduct = {
        id: product.id, name: product.name, description: product.description, category: product.category,
        price: product.priceMinor / 100, compareAt: product.compareAtMinor ? product.compareAtMinor / 100 : undefined,
        stock: product.stock, imageUrl: product.imageUrl, productKind: product.productKind,
        expiryDate: product.expiryDate, nafdacNumber: product.nafdacNumber, emoji: "🧺", sales: 0,
      };
      setProducts((current) => editing
        ? current.map((item) => item.id === editing.id ? { ...item, ...savedProduct } : item)
        : [savedProduct, ...current]);
      setSavedNotice(editing ? `${name} has been updated.` : `${name} is now listed in your store.`);
      setWorkspaceError("");
      void refreshActivities();
      form.reset();
      setShowAddProduct(false);
      setEditingProduct(null);
      setProductCategory("");
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : "Could not save this product.");
    } finally {
      savingProductRef.current = false;
      setSavingProduct(false);
    }
  }

  function startNewProduct() {
    setActiveView("Products");
    setEditingProduct(null);
    setProductCategory("");
    setShowAddProduct(true);
    setSavedNotice("");
  }

  function editProduct(product: RetailProduct) {
    setActiveView("Products");
    setEditingProduct(product);
    setProductCategory(product.category);
    setShowAddProduct(true);
    setSavedNotice("");
  }

  function closeProductForm() {
    setShowAddProduct(false);
    setEditingProduct(null);
    setProductCategory("");
  }

  async function deleteProduct(product: RetailProduct) {
    if (!account.user) return;
    if (!window.confirm(`Delete ${product.name}? Customers will no longer see this listing.`)) return;
    setBusyProductId(product.id);
    try {
      const token = await account.user.getIdToken();
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "DELETE", headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete this product.");
      setProducts((current) => current.filter((item) => item.id !== product.id));
      if (editingProduct?.id === product.id) closeProductForm();
      setSavedNotice(`${product.name} was deleted.`);
      setWorkspaceError("");
      void refreshActivities();
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : "Could not delete this product.");
    } finally {
      setBusyProductId("");
    }
  }

  async function restockProduct(product: RetailProduct) {
    if (!account.user) return;
    try {
      const token = await account.user.getIdToken();
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ stock: product.stock + 10 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update stock.");
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stock: result.product.stock } : item));
      setWorkspaceError("");
      void refreshActivities();
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : "Could not update stock.");
    }
  }

  async function applyPromotion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.user) return;
    const product = products.find((item) => item.id === promoProductId);
    const salePrice = Number(promoSalePrice);
    if (!product) {
      setPromoError("Choose a product to promote.");
      return;
    }
    if (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= product.price) {
      setPromoError("Enter a sale price that is lower than the current price.");
      return;
    }
    setPromoBusy(product.id);
    setPromoError("");
    try {
      const token = await account.user.getIdToken();
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ compareAtMinor: Math.round(product.price * 100), priceMinor: Math.round(salePrice * 100) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not start this promotion.");
      setProducts((current) => current.map((item) => item.id === product.id
        ? { ...item, price: result.product.priceMinor / 100, compareAt: result.product.compareAtMinor ? result.product.compareAtMinor / 100 : undefined }
        : item));
      setSavedNotice(`${product.name} is now on promotion at ${money.format(salePrice)}.`);
      setPromoProductId("");
      setPromoSalePrice("");
      void refreshActivities();
    } catch (reason) {
      setPromoError(reason instanceof Error ? reason.message : "Could not start this promotion.");
    } finally {
      setPromoBusy("");
    }
  }

  async function endPromotion(product: RetailProduct) {
    if (!account.user || !product.compareAt) return;
    setPromoBusy(product.id);
    setPromoError("");
    try {
      const token = await account.user.getIdToken();
      const response = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ priceMinor: Math.round(product.compareAt * 100), compareAtMinor: null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not end this promotion.");
      setProducts((current) => current.map((item) => item.id === product.id
        ? { ...item, price: result.product.priceMinor / 100, compareAt: undefined }
        : item));
      setSavedNotice(`${product.name} is back at ${money.format(product.compareAt)}.`);
      void refreshActivities();
    } catch (reason) {
      setPromoError(reason instanceof Error ? reason.message : "Could not end this promotion.");
    } finally {
      setPromoBusy("");
    }
  }

  const itemCount = orders.filter((order) => !["Delivered", "Cancelled/Refund"].includes(order.status)).length;
  const deliveredSales = orders.filter((order) => order.status === "Delivered").reduce((sum, order) => sum + order.total, 0);
  const customerCounts = new Map<string, number>();
  orders.forEach((order) => customerCounts.set(order.customer, (customerCounts.get(order.customer) ?? 0) + 1));

  if (account.loading) return <main className="business-loading">Loading your vendor workspace…</main>;
  if (account.error) return <main className="business-loading" role="alert">{account.error}</main>;

  return (
    <main className="retail-vendor-app">
      <aside className="retail-vendor-sidebar">
        <div className="retail-vendor-brand"><span>sf</span><strong>Sure Food<small>Customer vendor store</small></strong></div>
        <div className="retail-store-switch"><span>🥬</span><span><strong>{account.profile?.displayName}</strong><small>Customer-facing store</small></span><b>⌄</b></div>
        <span className="retail-nav-caption">YOUR STORE</span>
        <nav className="retail-vendor-nav" aria-label="Vendor store workspace">
          {views.map((view, index) => <button type="button" key={view} className={activeView === view ? "active" : ""} aria-current={activeView === view ? "page" : undefined} onClick={() => { setActiveView(view); setSavedNotice(""); }}>            <span>{["⌂", "▦", "▤", "▥", "♙", "◇", "₦", "▣", "▱"][index]}</span>{view}{view === "Supplier orders" && purchases.length > 0 && <i>{purchases.length}</i>}{view === "Customer orders" && <i>{itemCount}</i>}</button>)}
        </nav>
        <div className="retail-vendor-side-note"><strong>Selling to your community</strong><p>Your vendor store serves individual customers with everyday fresh picks.</p><Link href="/">View customer storefront →</Link></div>
        <Link className="retail-supplier-link" href="/supplier">Need wholesale supply? <strong>Open supplier workspace →</strong></Link>
      </aside>

      <section className="retail-vendor-main">
        <header className="retail-vendor-topbar"><div className="retail-breadcrumb">Vendor workspace <span>›</span> {activeView}</div><div className="retail-top-actions"><span className="retail-store-open"><i />{canListProducts ? "Store open" : "Listings locked"}</span><button type="button" aria-label="Open order notifications" onClick={() => { setActiveView("Customer orders"); setOrderNotice(""); }}>♧{itemCount > 0 && <i>{itemCount > 9 ? "9+" : itemCount}</i>}</button><span className="retail-vendor-avatar">{(account.profile?.displayName ?? "Seller").slice(0, 2).toUpperCase()}</span><strong>{account.profile?.displayName}</strong></div></header>
        <div className="retail-vendor-content">
          <div className="retail-page-title"><div><span className="retail-title-kicker">DIRECT-TO-CUSTOMER STORE</span><h1>{activeView === "Overview" ? `Good morning, ${account.profile?.displayName}` : activeView}</h1><p>{activeView === "Overview" ? "Manage your shop, customer orders, and fresh daily listings." : viewDescription(activeView)}</p></div>{canListProducts
            ? (activeView === "Products" || activeView === "Overview") && <button className="retail-primary-button" type="button" onClick={startNewProduct}>＋ Add product</button>
            : <Link className="retail-primary-button retail-verify-button" href="/onboarding">{sellerNeedsApprovalFee(account.profile) ? "Pay approval fee" : "Complete verification"} <span aria-hidden="true">→</span></Link>}</div>

          {workspaceError && <p className="workspace-api-error" role="alert">{workspaceError}</p>}
          {orderNotice && <p className="retail-order-notice" role="status">{orderNotice}<button type="button" onClick={() => { setActiveView("Customer orders"); setOrderNotice(""); }}>View orders</button><button type="button" aria-label="Dismiss order notification" onClick={() => setOrderNotice("")}>×</button></p>}
          {savedNotice && <p className="retail-saved-notice" role="status">{savedNotice}</p>}
          {!canListProducts && <p className="workspace-api-error" role="status">{sellerNeedsApprovalFee(account.profile) ? <>Your business is approved. Pay the {money.format((account.profile?.approvalFeeMinor ?? 200_000) / 100)} approval fee to unlock listings. <Link href="/onboarding">Pay approval fee →</Link></> : <>Your seller dashboard is ready. Complete business verification to list products. <Link href="/onboarding">Continue verification →</Link></>}</p>}
          {activeView === "Overview" && (
            <>
              <section className="retail-welcome-banner"><div><span>YOUR NEIGHBOURHOOD, YOUR STORE</span><h2>Fresh finds for<br />your community.</h2><p>Keep your best local picks in stock and ready for the next customer.</p>{canListProducts ? <button type="button" onClick={startNewProduct}>List a product <b>→</b></button> : <Link href="/onboarding">Complete verification →</Link>}</div><div className="retail-banner-art" aria-hidden="true">🥬🍊🥑</div></section>
              <section className="retail-metrics" aria-label="Store performance"><Metric label="Delivered sales" value={money.format(deliveredSales)} note="From delivered orders" icon="₦" /><Metric label="Customer orders" value={String(orders.length)} note={`${itemCount} open orders` } icon="▤" /><Metric label="Active products" value={String(products.length)} note={`${products.filter((product) => product.stock < 10).length} need restocking`} icon="▦" /><Metric label="Store rating" value="—" note="Ratings not available yet" icon="★" /></section>
              <div className="retail-dashboard-columns">
                <section className="retail-panel"><div className="retail-panel-heading"><div><h2>Recent customer orders</h2><p>Quote delivery first, then prepare paid orders.</p></div><button type="button" onClick={() => setActiveView("Customer orders")}>View all →</button></div><OrderTable orders={orders.slice(0, 4)} onUpdate={updateOrder} onQuoteDelivery={quoteDelivery} compact /></section>
                <section className="retail-panel"><div className="retail-panel-heading"><div><h2>Products customers love</h2><p>Your popular direct-sale listings.</p></div><button type="button" onClick={() => setActiveView("Products")}>All products →</button></div>{products.slice(0, 3).map((product) => <ProductRow key={product.id} product={product} onRestock={() => setActiveView("Inventory")} />)}</section>
              </div>
              <section className="retail-panel retail-activity-panel">
                <div className="retail-panel-heading"><div><h2>Recent Activity</h2><p>Latest changes to your store and orders.</p></div></div>
                {activities.length === 0
                  ? <p className="retail-activity-empty">Your product and order updates will appear here.</p>
                  : activities.slice(0, 8).map((activity) => (
                    <div className="retail-activity-item" key={activity.id}>
                      <span>{activityIcon(activity.action)}</span>
                      <div><strong>{activity.summary}</strong><small>{formatActivityTime(activity.createdAt)}</small></div>
                    </div>
                  ))}
              </section>
            </>
          )}

          {activeView === "Products" && <section className="retail-panel"><div className="retail-panel-heading"><div><h2>Your customer-facing products</h2><p>{products.length} products and prices in your store.</p></div></div>{canListProducts && showAddProduct && <form key={editingProduct?.id ?? "new"} className="retail-product-form" onSubmit={addProduct}>{editingProduct && <h3 className="vendor-form-title">Editing {editingProduct.name}</h3>}<label>Product name<input name="name" required placeholder="Fresh oranges (1kg)" defaultValue={editingProduct?.name ?? ""} /></label><label>Product description <span>(shown to buyers)</span><textarea name="description" rows={3} maxLength={500} placeholder="Tell customers what they are buying, how it is packed, and when it is best used." defaultValue={editingProduct?.description ?? ""} /></label><ProductCategoryPicker user={account.user} value={productCategory} onChange={setProductCategory} /><label>Product source<select name="productKind" defaultValue={editingProduct?.productKind ?? "supplier"} required><option value="supplier">Supplier (reselling)</option><option value="farmer">Farmer</option><option value="producer">Producer</option><option value="manufacturer">Manufacturer</option></select></label><label>Expiry date<input name="expiryDate" type="date" min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} defaultValue={editingProduct?.expiryDate ?? ""} required /></label><label>NAFDAC number <span>(required for manufacturer products)</span><input name="nafdacNumber" maxLength={40} placeholder="e.g. A1-1234" defaultValue={editingProduct?.nafdacNumber ?? ""} /></label><label>Sale price per item (₦)<input name="price" type="number" min="1" required placeholder="1800" defaultValue={editingProduct?.price ?? ""} /></label><label>Original price (₦, optional)<input name="compareAt" type="number" min="1" placeholder="For discounted listings" defaultValue={editingProduct?.compareAt ?? ""} /></label><label>Stock available<input name="stock" type="number" min="0" required placeholder="25" defaultValue={editingProduct?.stock ?? ""} /></label><label>Product photo <span>({editingProduct ? "leave empty to keep the current photo" : "required"})</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp" required={!editingProduct} /></label><div className="vendor-form-actions"><button className="retail-primary-button" type="submit" disabled={savingProduct}>{savingProduct ? "Saving…" : editingProduct ? "Save changes" : "Publish product"}</button><button type="button" className="vendor-outline-button" onClick={closeProductForm} disabled={savingProduct}>Cancel</button></div></form>}{products.map((product) => <ProductRow key={product.id} product={product} onRestock={() => setActiveView("Inventory")} onEdit={() => editProduct(product)} onDelete={() => void deleteProduct(product)} busy={busyProductId === product.id} />)}{canListProducts && products.length === 0 && <p className="retail-empty">No products yet. Add your first listing to start selling.</p>}</section>}

          {activeView === "Customer orders" && <section className="retail-panel"><div className="retail-panel-heading"><div><h2>Customer order management</h2><p>Set your delivery fee; buyers are notified when the order is ready for payment.</p></div></div><div className="retail-order-filters"><button type="button" className={orderFilter === "All" ? "selected" : ""} onClick={() => setOrderFilter("All")}>All orders <i>{orders.length}</i></button>{statusOptions.map((status) => <button type="button" key={status} className={orderFilter === status ? "selected" : ""} onClick={() => setOrderFilter(status)}>{status}<i>{orders.filter((order) => order.status === status).length}</i></button>)}</div><OrderTable orders={orders.filter((order) => orderFilter === "All" || order.status === orderFilter)} onUpdate={updateOrder} onQuoteDelivery={quoteDelivery} /></section>}
          {activeView === "Payout account" && (account.profile?.verificationStatus === "approved"
            ? <PayoutAccountForm user={account.user} businessName={account.profile.business?.businessName} />
            : <p className="workspace-api-error" role="status">Verify your vendor account before adding a payout bank account.</p>)}

          {activeView === "Inventory" && <section className="retail-panel"><div className="retail-panel-heading"><div><h2>Store inventory</h2><p>Retail products currently available to your customers.</p></div>{canListProducts && <button type="button" onClick={startNewProduct}>＋ Add product</button>}</div>{products.map((product) => <ProductRow key={product.id} product={product} onRestock={() => restockProduct(product)} inventory />)}</section>}

          {activeView === "Customers" && <section className="retail-panel"><div className="retail-panel-heading"><div><h2>Your store customers</h2><p>Buyers who have orders in your store.</p></div></div><div className="retail-customers-grid">{[...customerCounts].map(([name, count]) => <article key={name}><span>{name.slice(0, 2).toUpperCase()}</span><div><strong>{name}</strong><small>{count} order{count === 1 ? "" : "s"}</small></div><i>Buyer</i></article>)}</div>{customerCounts.size === 0 && <p className="retail-empty">No customer orders yet.</p>}</section>}

          {activeView === "Buy from suppliers" && <section className="retail-panel">
            <div className="retail-panel-heading"><div><h2>Wholesale supply</h2><p>Order stock directly from approved SureFood suppliers. Your supplier confirms the delivery fee, then you pay securely with Paystack.</p></div><button type="button" onClick={() => void loadSupplyWorkspace()}>Refresh</button></div>
            {supplyError && <p className="workspace-api-error" role="alert">{supplyError}</p>}
            {supplyNotice && <p className="retail-saved-notice" role="status">{supplyNotice}</p>}
            {supplierListings.length === 0 ? <p className="retail-empty">No approved supplier listings are available right now.</p>
              : supplierListings.map((product) => <SupplierPurchaseRow key={product.id} product={product} busy={supplyBusy === product.id} onOrder={orderFromSupplier} />)}
          </section>}

          {activeView === "Supplier orders" && <section className="retail-panel">
            <div className="retail-panel-heading"><div><h2>Your supplier orders</h2><p>Track the stock you ordered from suppliers and pay once they confirm delivery.</p></div><button type="button" onClick={() => void loadSupplyWorkspace()}>Refresh</button></div>
            {supplyError && <p className="workspace-api-error" role="alert">{supplyError}</p>}
            <div className="retail-order-table-wrap"><table className="retail-order-table"><thead><tr><th>Order</th><th>Supplier</th><th>Items</th><th>Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>
              {purchases.map((order) => <tr key={order.id}><td><strong>{order.id.slice(0, 8)}</strong></td><td>{order.sellerName || "SureFood supplier"}</td><td>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(", ")}</td><td>{money.format(order.totalMinor / 100)}</td><td><span className={`retail-order-status ${statusClass(order.status)}`}>{order.status}</span></td><td>{order.paymentStatus === "paid" ? <span className="retail-no-step">Paid</span> : order.status === "Awaiting buyer payment" ? <button type="button" className="retail-next-step" disabled={supplyBusy === order.id} onClick={() => void payForPurchase(order)}>{supplyBusy === order.id ? "Opening…" : `Pay ${money.format(order.totalMinor / 100)} →`}</button> : <span className="retail-no-step">Waiting for supplier</span>}</td></tr>)}
            </tbody></table>{purchases.length === 0 && <p className="retail-empty">You have not ordered stock from a supplier yet.</p>}</div>
          </section>}

          {activeView === "Promotions" && <section className="retail-panel">
            <div className="retail-panel-heading"><div><h2>Store promotions</h2><p>Put a product on sale for your customers. Buyers see the crossed-out original price and the discount badge.</p></div></div>
            {promoError && <p className="workspace-api-error" role="alert">{promoError}</p>}
            {canListProducts && products.length > 0 && <form className="retail-product-form retail-promo-form" onSubmit={applyPromotion}>
              <label>Product to promote<select value={promoProductId} onChange={(event) => { setPromoProductId(event.target.value); const product = products.find((item) => item.id === event.target.value); setPromoSalePrice(product ? (product.price * 0.9).toFixed(0) : ""); }} required><option value="">Choose a product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {money.format(product.price)}</option>)}</select></label>
              <label>Sale price (₦)<input type="number" min="1" step="1" value={promoSalePrice} onChange={(event) => setPromoSalePrice(event.target.value)} required /></label>
              <div className="vendor-form-actions"><button className="retail-primary-button" type="submit" disabled={Boolean(promoBusy) || !promoProductId}>{promoBusy ? "Starting…" : "Start promotion"}</button></div>
            </form>}
            <div className="retail-promo-list">
              {products.filter((product) => product.compareAt && product.compareAt > product.price).map((product) => (
                <div className="retail-product-row" key={product.id}>
                  <span className="retail-row-emoji">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} width={46} height={46} quality={90} /> : product.emoji}</span>
                  <div><strong>{product.name}</strong><small>{Math.round((1 - product.price / (product.compareAt ?? product.price)) * 100)}% off · was {money.format(product.compareAt ?? product.price)}</small></div>
                  <span className="retail-row-price">{money.format(product.price)}</span>
                  <span className="retail-stock">{product.stock} in stock</span>
                  <div className="retail-row-actions"><button type="button" className="danger" disabled={promoBusy === product.id} onClick={() => void endPromotion(product)}>{promoBusy === product.id ? "Ending…" : "End promotion"}</button></div>
                </div>
              ))}
              {products.filter((product) => product.compareAt && product.compareAt > product.price).length === 0 && <p className="retail-empty">No products are on promotion right now. Start one above to attract more buyers.</p>}
            </div>
            {products.length === 0 && <p className="retail-empty">Add a product before creating a promotion.</p>}
          </section>}
        </div>
      </section>
    </main>
  );
}

function viewDescription(view: VendorView) {
  const descriptions: Record<VendorView, string> = {
    Overview: "Manage your shop, customer orders, and fresh daily listings.",
    Products: "List the individual products your customers can shop in your store.",
    "Customer orders": "Confirm each order, quote seller-handled delivery, and fulfil it after the buyer pays.",
    Inventory: "Keep your customer-facing stock accurate and ready to sell.",
    Customers: "Get to know the people who choose your local store.",
    Promotions: "Create customer offers for products in your retail store.",
    "Payout account": "Verify the business bank account SureFood will use for manual seller payouts.",
    "Buy from suppliers": "Order wholesale stock from approved suppliers and keep your shelves full.",
    "Supplier orders": "Track and pay for the stock you ordered from suppliers.",
  };
  return descriptions[view];
}

function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: string }) {
  return <article className="retail-metric"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><i>{note}</i></div></article>;
}

function ProductRow({ product, onRestock, onEdit, onDelete, busy = false, inventory = false }: { product: RetailProduct; onRestock: () => void; onEdit?: () => void; onDelete?: () => void; busy?: boolean; inventory?: boolean }) {
  return <div className="retail-product-row"><span className="retail-row-emoji">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} width={46} height={46} quality={90} /> : product.emoji}</span><div><strong>{product.name}</strong><small>{[product.category, product.productKind, product.expiryDate && `Expires ${product.expiryDate}`, product.nafdacNumber && `NAFDAC ${product.nafdacNumber}`].filter(Boolean).join(" · ")}</small>{product.description && <small className="retail-row-description">{product.description}</small>}</div><span className="retail-row-price">{money.format(product.price)}{product.compareAt && product.compareAt > product.price && <small className="order-customer-delivery">was {money.format(product.compareAt)}</small>}</span><span className={product.stock < 10 ? "retail-stock low" : "retail-stock"}>{product.stock} in stock</span><div className="retail-row-actions">{onEdit && <button type="button" onClick={onEdit} disabled={busy}>Edit</button>}{onDelete && <button type="button" className="danger" onClick={onDelete} disabled={busy}>{busy ? "Deleting…" : "Delete"}</button>}<button type="button" onClick={onRestock}>{inventory ? "＋ Restock 10" : product.stock < 10 ? "Restock →" : "View →"}</button></div></div>;
}

function OrderTable({ orders, onUpdate, onQuoteDelivery, compact = false }: { orders: RetailOrder[]; onUpdate: (id: string, status: CustomerOrderStatus) => void; onQuoteDelivery: (id: string, deliveryFeeMinor: number) => void; compact?: boolean }) {
  return <div className="retail-order-table-wrap"><table className="retail-order-table"><thead><tr><th>Order</th><th>Customer / delivery</th><th>Items</th><th>Product total</th><th>Status</th><th>Next step</th></tr></thead><tbody>{orders.slice(0, compact ? 4 : undefined).map((order) => {
    const next = nextStatus[order.status];
    return <tr key={order.id}><td><strong>{order.id.slice(0, 8)}</strong></td><td>{order.customer}<small className="order-customer-delivery">{order.customerPhone} · {order.deliveryAddress}</small></td><td>{order.item}</td><td>{money.format(order.total)}{order.deliveryFeeMinor !== null && order.deliveryFeeMinor !== undefined && <small className="order-customer-delivery">Delivery: {money.format(order.deliveryFeeMinor / 100)}</small>}</td><td><span className={`retail-order-status ${statusClass(order.status)}`}>{order.status}</span>{order.paymentStatus === "paid" && <small className="order-customer-delivery">Paid</small>}</td><td>{order.status === "Pending seller confirmation" ? <DeliveryQuoteForm orderId={order.id} onSubmit={onQuoteDelivery} /> : next ? <button type="button" className="retail-next-step" onClick={() => onUpdate(order.id, next.status)}>{next.label} →</button> : <span className="retail-no-step">{order.status === "Delivered" ? "Complete" : order.status === "Awaiting buyer payment" ? "Waiting for buyer payment" : "Closed"}</span>}</td></tr>;
  })}</tbody></table>{orders.length === 0 && <p className="retail-empty">No customer orders in this status.</p>}</div>;
}

function SupplierPurchaseRow({ product, busy, onOrder }: {
  product: SupplierListing;
  busy: boolean;
  onOrder: (product: SupplierListing, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState("1");
  return <div className="retail-product-row">
    <span className="retail-row-emoji">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} width={46} height={46} quality={90} /> : "📦"}</span>
    <div><strong>{product.name}</strong><small>{[product.sellerName || "SureFood supplier", product.category, `${product.stock} available`].filter(Boolean).join(" · ")}</small></div>
    <span className="retail-row-price">{money.format(product.priceMinor / 100)}</span>
    <input className="retail-quantity-input" type="number" min="1" max={product.stock} value={quantity} aria-label={`Quantity of ${product.name}`} onChange={(event) => setQuantity(event.target.value)} />
    <button type="button" disabled={busy} onClick={() => onOrder(product, Number(quantity))}>{busy ? "Ordering…" : "Order stock"}</button>
  </div>;
}

function DeliveryQuoteForm({ orderId, onSubmit }: { orderId: string; onSubmit: (orderId: string, deliveryFeeMinor: number) => void }) {
  const [fee, setFee] = useState("");
  return <form className="delivery-quote-form" onSubmit={(event) => { event.preventDefault(); const amount = Number(fee); if (Number.isSafeInteger(amount) && amount >= 0) onSubmit(orderId, amount * 100); }}>
    <label>Delivery fee (₦)<input type="number" min="0" step="1" value={fee} onChange={(event) => setFee(event.target.value)} required /></label>
    <button type="submit" className="retail-next-step">Confirm fee</button>
  </form>;
}
