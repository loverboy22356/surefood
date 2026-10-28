"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useBusinessAccount, type BusinessProfile } from "@/lib/auth/use-business-account";
import { activityIcon, formatActivityTime, type ActivityItem } from "@/lib/activity-types";
import { uploadProductImage } from "@/lib/cloudinary-client";
import { sellerCanManageListings, sellerNeedsApprovalFee } from "@/lib/auth/seller-verification";
import { ProductCategoryPicker } from "@/app/components/product-category-picker";
import { PayoutAccountForm } from "@/app/components/payout-account-form";

type SupplierTab =
  | "Dashboard"
  | "Products"
  | "Bulk Orders"
  | "Inventory"
  | "Orders"
  | "Customers & Vendors"
  | "Pricing & Discounts"
  | "Shipments & Delivery"
  | "Payouts"
  | "Analytics"
  | "Supplier Profile"
  | "Settings";

type VendorProduct = {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  compareAt?: number;
  stock: number;
  emoji: string;
  imageUrl?: string;
  expiryDate?: string;
  nafdacNumber?: string;
  productKind?: string;
};

type OrderStatus =
  | "Pending seller confirmation"
  | "Awaiting buyer payment"
  | "Paid"
  | "Processing"
  | "Ready"
  | "Delivered"
  | "Cancelled/Refund";

type SupplierOrder = {
  id: string;
  buyer: string;
  item: string;
  quantity: string;
  total: number;
  status: OrderStatus;
  deliveryFeeMinor?: number | null;
  paymentStatus?: string;
  deliveryAddress?: string;
  customerPhone?: string;
};

type SupplierNotificationPreferences = {
  newOrders: boolean;
  shipmentUpdates: boolean;
  lowStockAlerts: boolean;
  marketingEmails: boolean;
};

const orderStatuses: OrderStatus[] = [
  "Pending seller confirmation",
  "Awaiting buyer payment",
  "Paid",
  "Processing",
  "Ready",
  "Delivered",
  "Cancelled/Refund",
];

const nextOrderStep: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> = {
  Paid: { label: "Start preparing", status: "Processing" },
  Processing: { label: "Mark ready", status: "Ready" },
  Ready: { label: "Mark delivered", status: "Delivered" },
};

const navigation: { label: SupplierTab; icon: string; badge?: string }[] = [
  { label: "Dashboard", icon: "⌂" },
  { label: "Products", icon: "▦" },
  { label: "Bulk Orders", icon: "▣" },
  { label: "Inventory", icon: "▤" },
  { label: "Orders", icon: "▱" },
  { label: "Customers & Vendors", icon: "♧" },
  { label: "Pricing & Discounts", icon: "◇" },
  { label: "Shipments & Delivery", icon: "▰" },
  { label: "Payouts", icon: "₦" },
  { label: "Analytics", icon: "▥" },
  { label: "Supplier Profile", icon: "♙" },
  { label: "Settings", icon: "⚙" },
];

const platformRoles = [
  { role: "Customer", icon: "♙", description: "Buy food and everyday essentials." },
  { role: "Vendor", icon: "▦", description: "Sell products directly to customers." },
  { role: "Supplier", icon: "▣", description: "Supply products in bulk to businesses and Sure Foodz." },
  { role: "Producer/ manufacturer", icon: "⚙", description: "Produce or manufacture food products." },
  { role: "Rider", icon: "↗", description: "Pick up and deliver customer orders." },
  { role: "Sure Foodz staff", icon: "♧", description: "Manage marketplace operations and support." },
];

const tabDescriptions: Record<SupplierTab, string> = {
  Dashboard: "Manage your inventory, bulk orders, and grow your business with Sure Food.",
  Products: "Manage your product listings, pricing and availability.",
  "Bulk Orders": "Manage wholesale orders and grow your business with trusted buyers.",
  Inventory: "Track stock levels, manage quantities, and keep products available.",
  Orders: "Review incoming orders and keep every delivery moving.",
  "Customers & Vendors": "Build strong relationships with your customers and partners.",
  "Pricing & Discounts": "Set wholesale prices, discounts and special offers.",
  "Shipments & Delivery": "Track shipments and coordinate reliable deliveries.",
  Payouts: "Review earnings, payouts and payment activity.",
  Analytics: "Understand your sales and make confident business decisions.",
  "Supplier Profile": "Keep your business details up to date for buyers.",
  Settings: "Manage your account preferences and business settings.",
};

const currency = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

function statusClass(status: string) {
  return status.toLowerCase().replaceAll(" ", "-").replace("/", "-");
}

export default function SupplierPage() {
  const account = useBusinessAccount("supplier");
  const isLocalTestMode = process.env.NODE_ENV === "development" &&
    account.profile?.email.toLowerCase() === process.env.NEXT_PUBLIC_SUREFOOD_TEST_LISTING_EMAIL?.trim().toLowerCase();
  const canListProducts = sellerCanManageListings(account.profile) || isLocalTestMode;
  const [notificationPreferences, setNotificationPreferences] = useState({
    newOrders: true,
    shipmentUpdates: true,
    lowStockAlerts: true,
    marketingEmails: false,
  });
  const [activeTab, setActiveTab] = useState<SupplierTab>("Dashboard");
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [search, setSearch] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<VendorProduct | null>(null);
  const [busyProductId, setBusyProductId] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productSaved, setProductSaved] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const savingProductRef = useRef(false);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [orderFilter, setOrderFilter] = useState<OrderStatus | "All">("All");
  const [workspaceError, setWorkspaceError] = useState("");
  const [orderNotice, setOrderNotice] = useState("");
  const [initialOrdersLoaded, setInitialOrdersLoaded] = useState(false);
  const observedOrderStatuses = useRef(new Map<string, OrderStatus>());
  const hasObservedOrderList = useRef(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (account.profile?.notificationPreferences) {
      setNotificationPreferences((current) => ({ ...current, ...account.profile?.notificationPreferences }));
    }
  }, [account.profile]);

  async function updateNotificationPreference(key: keyof typeof notificationPreferences, enabled: boolean) {
    if (!account.user) return;
    const previous = notificationPreferences;
    const updated = { ...previous, [key]: enabled };
    setNotificationPreferences(updated);
    setSettingsSaved(false);
    try {
      const token = await account.user.getIdToken();
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ notificationPreferences: updated }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your settings.");
      setSettingsSaved(true);
      setWorkspaceError("");
    } catch (reason) {
      setNotificationPreferences(previous);
      setWorkspaceError(reason instanceof Error ? reason.message : "Could not save your settings.");
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
        setProducts(productData.products.map((product: { id: string; name: string; description?: string; category: string; priceMinor: number; compareAtMinor?: number; stock: number; imageUrl?: string; expiryDate?: string; nafdacNumber?: string; productKind?: string }) => ({
          id: product.id, name: product.name, description: product.description, category: product.category, price: product.priceMinor / 100,
          compareAt: product.compareAtMinor ? product.compareAtMinor / 100 : undefined,
          stock: product.stock, imageUrl: product.imageUrl, expiryDate: product.expiryDate,
          nafdacNumber: product.nafdacNumber, productKind: product.productKind, emoji: "📦",
        })));
        setOrders(orderData.orders.map((order: { id: string; customerName?: string; customerPhone?: string; deliveryAddress?: string; items: { name: string; quantity: number }[]; totalMinor: number; deliveryFeeMinor?: number | null; paymentStatus?: string; status: OrderStatus }) => ({
          id: order.id, buyer: order.customerName || "SureFood buyer",
          item: order.items.map((item) => item.name).join(", "),
          quantity: order.items.map((item) => String(item.quantity)).join(", "),
          total: order.totalMinor / 100, status: order.status,
          deliveryFeeMinor: order.deliveryFeeMinor, paymentStatus: order.paymentStatus,
          deliveryAddress: order.deliveryAddress, customerPhone: order.customerPhone,
        })));
        setInitialOrdersLoaded(true);
        setActivities(activityData.activities);
        setWorkspaceError("");
      } catch (reason) {
        if (active) setWorkspaceError(reason instanceof Error ? reason.message : "Could not load your supplier workspace.");
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
        if (active) setOrders(result.orders.map((order: { id: string; customerName?: string; customerPhone?: string; deliveryAddress?: string; items: { name: string; quantity: number }[]; totalMinor: number; deliveryFeeMinor?: number | null; paymentStatus?: string; status: OrderStatus }) => ({
          id: order.id, buyer: order.customerName || "SureFood buyer",
          item: order.items.map((item) => item.name).join(", "),
          quantity: order.items.map((item) => String(item.quantity)).join(", "),
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
    if (newOrder) setOrderNotice(`New buyer order from ${newOrder.buyer}. Confirm its delivery fee to notify the buyer.`);
    else if (newlyPaid) setOrderNotice(`Payment received for ${newlyPaid.item}. You can start preparing the order.`);
    observedOrderStatuses.current = new Map(orders.map((order) => [order.id, order.status]));
  }, [initialOrdersLoaded, orders]);

  const visibleProducts = useMemo(
    () => products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase())),
    [products, search],
  );

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account.user) return;
    if (!canListProducts) {
      setWorkspaceError("Complete business verification before listing products.");
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("productName")).trim();
    const description = String(formData.get("productDescription") ?? "").trim();
    const price = Number(formData.get("productPrice"));
    const compareAt = Number(formData.get("compareAtPrice"));
    const stock = Number(formData.get("productStock"));
    const category = productCategory;
    const productKind = String(formData.get("productKind"));
    const expiryDate = String(formData.get("expiryDate"));
    const nafdacNumber = String(formData.get("nafdacNumber") ?? "");
    const image = formData.get("productImage");
    const hasNewImage = image instanceof File && image.size > 0;
    const editing = editingProduct;

    if (!name || !category || !expiryDate || (!hasNewImage && !editing) || !Number.isFinite(price) || price <= 0 || !Number.isFinite(stock) || stock < 0) {
      setWorkspaceError(editing ? "Add a product category, expiry date, valid price, and stock quantity." : "Add a product category, expiry date, image, valid price, and stock quantity.");
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
        method: editing ? "PATCH" : "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
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
        stock: product.stock, imageUrl: product.imageUrl,
        productKind: product.productKind, expiryDate: product.expiryDate,
        nafdacNumber: product.nafdacNumber, emoji: "📦",
      };
      setProducts((current) => editing
        ? current.map((item) => item.id === editing.id ? { ...item, ...savedProduct } : item)
        : [savedProduct, ...current]);
      setShowProductForm(false);
      setEditingProduct(null);
      setProductCategory("");
      setProductSaved(true);
      setWorkspaceError("");
      void refreshActivities();
      form.reset();
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : "Could not save this product.");
    } finally {
      savingProductRef.current = false;
      setSavingProduct(false);
    }
  }

  function openProducts() {
    if (!canListProducts) return;
    setActiveTab("Products");
    setEditingProduct(null);
    setProductCategory("");
    setShowProductForm(true);
    setProductSaved(false);
  }

  function editProduct(product: VendorProduct) {
    setActiveTab("Products");
    setEditingProduct(product);
    setProductCategory(product.category);
    setShowProductForm(true);
    setProductSaved(false);
  }

  function closeProductForm() {
    setShowProductForm(false);
    setEditingProduct(null);
    setProductCategory("");
  }

  async function deleteProduct(product: VendorProduct) {
    if (!account.user) return;
    if (!window.confirm(`Delete ${product.name}? Buyers will no longer see this listing.`)) return;
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
      setWorkspaceError("");
      void refreshActivities();
    } catch (reason) {
      setWorkspaceError(reason instanceof Error ? reason.message : "Could not delete this product.");
    } finally {
      setBusyProductId("");
    }
  }

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
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

  async function restockProduct(product: VendorProduct) {
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

  if (account.loading) return <main className="business-loading">Loading your supplier workspace…</main>;
  if (account.error) return <main className="business-loading" role="alert">{account.error}</main>;

  return (
    <main className="vendor-app">
      <aside className="vendor-sidebar">
        <div className="vendor-brand">
          <span className="vendor-brand-mark">✿</span>
          <span>Sure Food<small>Fresh Food · Better Life</small></span>
        </div>
        <div className="vendor-account">
          <span className="vendor-account-icon">▣</span>
          <span><strong>{account.profile?.displayName}</strong><small>{isLocalTestMode ? "Local test mode" : canListProducts ? "✓ Verified Supplier" : "Verification pending"}</small></span>
          <span className="vendor-account-arrow">⌄</span>
        </div>
        <nav className="vendor-navigation" aria-label="Supplier dashboard">
          <span className="vendor-nav-heading">WORKSPACE</span>
          {navigation.slice(0, 5).map((item) => (
            <button key={item.label} type="button" className={`vendor-nav-item${activeTab === item.label ? " active" : ""}`} aria-current={activeTab === item.label ? "page" : undefined} onClick={() => { setActiveTab(item.label); setSearch(""); setShowProductForm(false); }}>
              <span className="vendor-nav-icon">{item.icon}</span><span className="vendor-nav-label">{item.label}</span>{item.badge && <span className="vendor-nav-badge">{item.badge}</span>}
            </button>
          ))}
          <span className="vendor-nav-heading vendor-nav-heading-spaced">GROW YOUR BUSINESS</span>
          {navigation.slice(5).map((item) => (
            <button key={item.label} type="button" className={`vendor-nav-item${activeTab === item.label ? " active" : ""}`} aria-current={activeTab === item.label ? "page" : undefined} onClick={() => { setActiveTab(item.label); setSearch(""); setShowProductForm(false); }}>
              <span className="vendor-nav-icon">{item.icon}</span><span className="vendor-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <button type="button" className="vendor-growth-card" onClick={() => setActiveTab("Bulk Orders")}>
          <strong>Powering<br />food businesses</strong>
          <span>Grow your reach with bulk buyers.</span>
          <span className="vendor-growth-cta">Manage your supply →</span>
          <span className="vendor-growth-art" aria-hidden="true">👨🏿‍🌾</span>
        </button>
        <div className="vendor-sidebar-footer"><span className="vendor-brand-mark">✿</span><span>Sure Food<small>Supplier workspace</small></span></div>
      </aside>

      <div className="vendor-workspace">
        <header className="vendor-topbar">
          <label className="vendor-search"><span>⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${activeTab === "Dashboard" ? "products, orders, or customers" : activeTab.toLowerCase()}...`} aria-label="Search supplier workspace" /></label>
          <button type="button" className="vendor-notifications" aria-label="Open order notifications" onClick={() => { setActiveTab("Orders"); setOrderNotice(""); }}>♧{orders.some((order) => !["Delivered", "Cancelled/Refund"].includes(order.status)) && <i>{orders.filter((order) => !["Delivered", "Cancelled/Refund"].includes(order.status)).length > 9 ? "9+" : orders.filter((order) => !["Delivered", "Cancelled/Refund"].includes(order.status)).length}</i>}</button>
          <button type="button" className="vendor-user"><span className="vendor-avatar">{(account.profile?.displayName ?? "Seller").slice(0, 2).toUpperCase()}</span><span><strong>{account.profile?.displayName}</strong><small>Supplier <span>⌄</span></small></span></button>
          {!canListProducts && <Link href="/onboarding" className="vendor-store-link">Verify business</Link>}
          <Link href="/supplier/store" className="vendor-store-link">View store ↗</Link>
        </header>

        <div className="vendor-page">
          {isLocalTestMode && <p className="workspace-api-error" role="status">Local test mode: listings stay in this dev server, are hidden from buyers, and reset when it restarts.</p>}
          {workspaceError && <p className="workspace-api-error" role="alert">{workspaceError}</p>}
          {orderNotice && <p className="vendor-order-notice" role="status">{orderNotice}<button type="button" onClick={() => { setActiveTab("Orders"); setOrderNotice(""); }}>View orders</button><button type="button" aria-label="Dismiss order notification" onClick={() => setOrderNotice("")}>×</button></p>}
          <div className="vendor-page-heading">
            <div><span className="vendor-breadcrumb">Supplier Workspace <span>›</span> {activeTab}</span><h1>{activeTab === "Dashboard" ? `Welcome back, ${account.profile?.displayName} 👋` : activeTab}</h1><p>{tabDescriptions[activeTab]}</p></div>
            {canListProducts && activeTab !== "Dashboard" && <button type="button" className="vendor-primary-button" onClick={openProducts}>＋ Add New Product</button>}
          </div>

          {!canListProducts && <p className="workspace-api-error" role="status">{sellerNeedsApprovalFee(account.profile) ? <>Your business is approved. Pay the {currency.format((account.profile?.approvalFeeMinor ?? 500_000) / 100)} approval fee to unlock listings. <Link href="/onboarding">Pay approval fee →</Link></> : <>Your supplier dashboard is ready. Complete business verification to list products. <Link href="/onboarding">Continue verification →</Link></>}</p>}
          {activeTab === "Payouts" && (account.profile?.verificationStatus === "approved"
            ? <PayoutAccountForm user={account.user} businessName={account.profile.business?.businessName} />
            : <p className="workspace-api-error" role="status">Verify your supplier account before adding a payout bank account.</p>)}
          {activeTab === "Dashboard" && (
            <>
              <button type="button" className="vendor-banner" onClick={() => setActiveTab("Bulk Orders")} aria-label="Open bulk orders">
                <Image src="/images/supplier-bulk-banner.jpg" alt="Sell in bulk. Grow bigger. Add a bulk product." fill priority sizes="(max-width: 1100px) 100vw, 75vw" />
              </button>
              <div className="vendor-stat-grid">
                <Metric icon="▦" label="Total Products" value={String(products.length)} trend="Live" note="your catalogue" />
                <Metric icon="▣" label="Bulk Orders" value={String(orders.length)} trend="Live" note="all order statuses" />
                <Metric icon="♧" label="Active Vendors" value="—" trend=" " note="partner network" />
                <Metric icon="₦" label="Delivered Revenue" value={currency.format(orders.filter((order) => order.status === "Delivered").reduce((sum, order) => sum + order.total, 0))} trend="Live" note="delivered orders" />
              </div>
              <div className="vendor-dashboard-grid">
                <div className="vendor-main-column">
                  <section className="vendor-panel sales-panel">
                    <div className="vendor-panel-heading"><div><h2>Sales &amp; Bulk Orders Overview</h2><p>Order totals and payment status are live; historical sales charts are not collected yet.</p></div></div>
                    <div className="sales-chart"><p className="vendor-empty-search">Order totals are available above; historical sales charts need payment and reporting data.</p></div>
                  </section>
                  <section className="vendor-panel">
                    <div className="vendor-panel-heading"><div><h2>Recent Bulk Orders</h2><p>Your latest wholesale activity</p></div><button type="button" className="vendor-text-button" onClick={() => setActiveTab("Orders")}>View all →</button></div>
                    <OrdersTable orders={orders} onStatusChange={updateOrderStatus} onQuoteDelivery={quoteDelivery} onView={() => setActiveTab("Bulk Orders")} compact />
                  </section>
                </div>
                <aside className="vendor-right-column">
                  <section className="vendor-panel">
                    <div className="vendor-panel-heading"><div><h2>Quick Actions</h2><p>Common tasks, right here</p></div></div>
                    {canListProducts && <QuickAction icon="＋" label="Add New Product" description="List a product for bulk sale" onClick={openProducts} />}
                    <QuickAction icon="▦" label="Manage Inventory" description="Update stock levels" onClick={() => setActiveTab("Inventory")} />
                    <QuickAction icon="▣" label="View Bulk Orders" description="Check and manage orders" onClick={() => setActiveTab("Orders")} />
                  </section>
                  <section className="vendor-panel activity-panel">
                    <div className="vendor-panel-heading"><div><h2>Recent Activity</h2><p>Latest updates from your store</p></div></div>
                    {activities.length === 0
                      ? <p className="vendor-empty-search">Your product and order updates will appear here.</p>
                      : activities.slice(0, 8).map((activity) => (
                        <div className="activity-item" key={activity.id}>
                          <span>{activityIcon(activity.action)}</span>
                          <div><strong>{activity.summary}</strong><small>{formatActivityTime(activity.createdAt)}</small></div>
                        </div>
                      ))}
                  </section>
                </aside>
              </div>
            </>
          )}

          {activeTab === "Products" && (
            <section className="vendor-panel vendor-products-panel">
              <div className="vendor-panel-heading"><div><h2>Your Products</h2><p>{visibleProducts.length} products in your supplier catalogue</p></div></div>
              {productSaved && <p className="vendor-success" role="status">{isLocalTestMode ? "Test listing saved locally. It is not visible to buyers." : "Your catalogue is up to date."}</p>}
              {canListProducts && showProductForm && <form key={editingProduct?.id ?? "new"} className="vendor-product-form" onSubmit={saveProduct}>{editingProduct && <h3 className="vendor-form-title">Editing {editingProduct.name}</h3>}<label>Product name<input name="productName" placeholder="e.g. Fresh mangoes (1kg)" defaultValue={editingProduct?.name ?? ""} required /></label><label>Product description <span>(shown to buyers)</span><textarea name="productDescription" rows={3} maxLength={500} defaultValue={editingProduct?.description ?? ""} placeholder="What is this product, how is it packed, and what makes it a good buy?" /></label><ProductCategoryPicker user={account.user} value={productCategory} onChange={setProductCategory} /><label>Product source<select name="productKind" defaultValue={editingProduct?.productKind ?? "supplier"} required><option value="supplier">Supplier (reselling)</option><option value="farmer">Farmer</option><option value="producer">Producer</option><option value="manufacturer">Manufacturer</option></select></label><label>Expiry date<input name="expiryDate" type="date" min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} defaultValue={editingProduct?.expiryDate ?? ""} required /></label><label>NAFDAC number <span>(required for manufacturer products)</span><input name="nafdacNumber" maxLength={40} placeholder="e.g. A1-1234" defaultValue={editingProduct?.nafdacNumber ?? ""} /></label><label>Wholesale price (₦)<input name="productPrice" type="number" min="1" placeholder="1200" defaultValue={editingProduct?.price ?? ""} required /></label><label>Original price (₦, optional)<input name="compareAtPrice" type="number" min="1" placeholder="For discounted listings" defaultValue={editingProduct?.compareAt ?? ""} /></label><label>Stock quantity<input name="productStock" type="number" min="0" placeholder="100" defaultValue={editingProduct?.stock ?? ""} required /></label><label>Product photo <span>({editingProduct ? "leave empty to keep the current photo" : "required"})</span><input name="productImage" type="file" accept="image/jpeg,image/png,image/webp" required={!editingProduct} /></label><div className="vendor-form-actions"><button type="submit" className="vendor-primary-button" disabled={savingProduct}>{savingProduct ? "Saving…" : editingProduct ? "Save changes" : "Save product"}</button><button type="button" className="vendor-outline-button" onClick={closeProductForm} disabled={savingProduct}>Cancel</button></div></form>}
              <div className="vendor-product-grid">{visibleProducts.map((product) => <article className="vendor-product-card" key={product.id}><div className="vendor-product-art">{product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill sizes="220px" unoptimized /> : <span>{product.emoji}</span>}<span className={product.stock < 15 ? "stock-pill low" : "stock-pill"}>{product.stock < 15 ? "Low stock" : "In stock"}</span></div><div className="vendor-product-details"><small>{[product.category, product.productKind].filter(Boolean).join(" · ")}</small><h3>{product.name}</h3><strong>{currency.format(product.price)}<small> / unit</small></strong><p className="vendor-product-description">{product.description || "No description added yet."}</p><p>Available stock: {product.stock} units{product.expiryDate ? ` · Expires ${product.expiryDate}` : ""}{product.nafdacNumber ? ` · NAFDAC ${product.nafdacNumber}` : ""}</p><div className="vendor-product-actions"><button type="button" onClick={() => editProduct(product)} disabled={busyProductId === product.id}>Edit</button><button type="button" className="danger" onClick={() => void deleteProduct(product)} disabled={busyProductId === product.id}>{busyProductId === product.id ? "Deleting…" : "Delete"}</button><button type="button" onClick={() => setActiveTab("Inventory")}>Manage stock →</button></div></div></article>)}</div>
              {visibleProducts.length === 0 && <p className="vendor-empty-search">{search ? "No products match that search. Try a different name or category." : canListProducts ? "No products listed yet. Add your first bulk product to begin." : "Product listing will be available after your business is approved."}</p>}
            </section>
          )}

          {activeTab === "Inventory" && <InventoryPanel products={visibleProducts} onRestock={restockProduct} />}
          {activeTab === "Orders" && <section className="vendor-panel"><div className="vendor-panel-heading"><div><h2>Order management</h2><p>Confirm delivery fees; buyers are notified and can pay once delivery is set.</p></div><button type="button" className="vendor-outline-button" onClick={() => setActiveTab("Bulk Orders")}>Bulk order tools</button></div><div className="order-status-filters" aria-label="Filter orders by status"><button type="button" className={orderFilter === "All" ? "selected" : ""} onClick={() => setOrderFilter("All")}>All <span>{orders.length}</span></button>          {orderStatuses.map((status) => <button type="button" key={status} className={orderFilter === status ? "selected" : ""} aria-pressed={orderFilter === status} onClick={() => setOrderFilter(status)}>{status} <span>{orders.filter((order) => order.status === status).length}</span></button>)}</div><OrdersTable orders={orders.filter((order) => orderFilter === "All" || order.status === orderFilter)} onStatusChange={updateOrderStatus} onQuoteDelivery={quoteDelivery} onView={() => setActiveTab("Bulk Orders")} /></section>}
          {activeTab === "Bulk Orders" && <BulkOrdersPanel orders={orders} onStatusChange={updateOrderStatus} onQuoteDelivery={quoteDelivery} onAddProduct={openProducts} onViewOrders={() => setActiveTab("Orders")} />}
          {activeTab !== "Dashboard" && activeTab !== "Products" && activeTab !== "Inventory" && activeTab !== "Orders" && activeTab !== "Bulk Orders" && activeTab !== "Payouts" && <OverviewPanel activeTab={activeTab} onNavigate={setActiveTab} profile={account.profile} products={products} orders={orders} notificationPreferences={notificationPreferences} onPreferenceChange={updateNotificationPreference} settingsSaved={settingsSaved} />}
        </div>
        <footer className="vendor-footer"><span>© 2025 Sure Food Supplier</span><span>Support</span><span>Terms &amp; Conditions</span><span>Privacy Policy</span><Link href="/">Back to shop</Link></footer>
      </div>
    </main>
  );
}

function Metric({ icon, label, value, trend, note }: { icon: string; label: string; value: string; trend: string; note: string }) {
  return <article className="vendor-metric"><span className="metric-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><span className="metric-trend">{trend}</span><small>{note}</small></div></article>;
}

function QuickAction({ icon, label, description, onClick }: { icon: string; label: string; description: string; onClick: () => void }) {
  return <button type="button" className="quick-action" onClick={onClick}><span>{icon}</span><span><strong>{label}</strong><small>{description}</small></span><b>›</b></button>;
}

function OrdersTable({
  orders,
  onStatusChange,
  onQuoteDelivery,
  onView,
  compact = false,
}: {
  orders: SupplierOrder[];
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onQuoteDelivery: (orderId: string, deliveryFeeMinor: number) => void;
  onView: () => void;
  compact?: boolean;
}) {
  return (
    <div className="vendor-table-wrap"><table className="vendor-table"><thead><tr><th>Order ID</th><th>Product</th><th>Quantity</th><th>Buyer</th><th>Total</th><th>Status</th><th>Next step</th><th>Action</th></tr></thead><tbody>{orders.slice(0, compact ? 3 : undefined).map((order) => {
      const nextStep = nextOrderStep[order.status];
      const canCancel = order.status !== "Delivered" && order.status !== "Cancelled/Refund" &&
        order.paymentStatus !== "paid" && order.paymentStatus !== "pending" && order.paymentStatus !== "initializing";
      return <tr key={order.id}><td><strong>{order.id.slice(0, 8)}</strong></td><td>{order.item}</td><td>{order.quantity}</td><td>{order.buyer}<small className="order-customer-delivery">{order.customerPhone} · {order.deliveryAddress}</small></td><td>{currency.format(order.total)}{order.deliveryFeeMinor !== null && order.deliveryFeeMinor !== undefined && <small className="order-customer-delivery">Delivery {currency.format(order.deliveryFeeMinor / 100)}</small>}</td><td><span className={`order-status ${statusClass(order.status)}`}>{order.status}</span>{order.paymentStatus === "paid" && <small className="order-customer-delivery">Paid</small>}</td><td>{order.status === "Pending seller confirmation" ? <DeliveryQuoteForm orderId={order.id} onSubmit={onQuoteDelivery} /> : nextStep ? <button type="button" className="order-step-button" onClick={() => onStatusChange(order.id, nextStep.status)}>{nextStep.label} →</button> : <span className="order-terminal">{order.status === "Awaiting buyer payment" ? "Waiting for buyer payment" : "No next step"}</span>}</td><td><div className="order-actions"><button type="button" className="table-view-button" onClick={onView}>Details</button>{canCancel && <button type="button" className="cancel-order-button" onClick={() => onStatusChange(order.id, "Cancelled/Refund")}>Cancel order</button>}</div></td></tr>;
    })}</tbody></table>{orders.length === 0 && <p className="vendor-empty-search">No orders currently have this status.</p>}</div>
  );
}

function DeliveryQuoteForm({ orderId, onSubmit }: { orderId: string; onSubmit: (orderId: string, deliveryFeeMinor: number) => void }) {
  const [fee, setFee] = useState("");
  return (
    <form className="delivery-quote-form" onSubmit={(event) => {
      event.preventDefault();
      const amount = Number(fee);
      if (Number.isSafeInteger(amount) && amount >= 0) onSubmit(orderId, amount * 100);
    }}>
      <label>Delivery fee ₦<input type="number" min="0" step="1" value={fee} onChange={(event) => setFee(event.target.value)} required /></label>
      <button type="submit" className="order-step-button">Confirm fee</button>
    </form>
  );
}

function InventoryPanel({ products, onRestock }: { products: VendorProduct[]; onRestock: (product: VendorProduct) => void }) {
  function downloadReport() {
    const headers = ["Product", "SKU", "Category", "Stock", "Status", "Wholesale price (NGN)"];
    const rows = products.map((product) => [
      product.name,
      `SF-${product.id.slice(0, 5).toUpperCase()}`,
      product.category,
      String(product.stock),
      product.stock < 15 ? "Low stock" : "In stock",
      product.price.toFixed(2),
    ]);
    const escapeCell = (value: string) => {
      const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `surefood-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="vendor-panel">
      <div className="vendor-panel-heading"><div><h2>Inventory List</h2><p>Track available stock and low inventory</p></div><button type="button" className="vendor-outline-button" onClick={downloadReport}>Download report ↓</button></div>
      <div className="vendor-table-wrap"><table className="vendor-table inventory-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Stock level</th><th>Status</th><th>Wholesale price</th><th>Action</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><span className="inventory-product"><span>{product.emoji}</span><strong>{product.name}</strong></span></td><td>SF-{product.id.slice(0, 5).toUpperCase()}</td><td>{product.category}</td><td><strong>{product.stock} units</strong></td><td><span className={`order-status ${product.stock < 15 ? "processing" : "confirmed"}`}>{product.stock < 15 ? "Low stock" : "In stock"}</span></td><td>{currency.format(product.price)}</td><td><button type="button" className="table-view-button" onClick={() => onRestock(product)}>Add 10 units</button></td></tr>)}</tbody></table>{products.length === 0 && <p className="vendor-empty-search">No product inventory yet.</p>}</div>
    </section>
  );
}

function BulkOrdersPanel({ orders, onStatusChange, onQuoteDelivery, onAddProduct, onViewOrders }: { orders: SupplierOrder[]; onStatusChange: (orderId: string, status: OrderStatus) => void; onQuoteDelivery: (orderId: string, deliveryFeeMinor: number) => void; onAddProduct: () => void; onViewOrders: () => void }) {
  return (
    <>
      <button type="button" className="vendor-banner bulk-order-banner" onClick={onAddProduct} aria-label="Add a product to bulk orders"><Image src="/images/supplier-bulk-banner.jpg" alt="Sell in bulk. Grow bigger. Add a bulk product." fill sizes="(max-width: 1100px) 100vw, 75vw" /></button>
      <div className="vendor-stat-grid"><Metric icon="▣" label="Bulk Orders" value={String(orders.length)} trend="Live" note="all order statuses" /><Metric icon="◷" label="Awaiting fulfillment" value={String(orders.filter((order) => !["Delivered", "Cancelled/Refund"].includes(order.status)).length)} trend="Live" note="open orders" /><Metric icon="✓" label="Delivered Orders" value={String(orders.filter((order) => order.status === "Delivered").length)} trend="Live" note="completed orders" /><Metric icon="₦" label="Delivered Revenue" value={currency.format(orders.filter((order) => order.status === "Delivered").reduce((sum, order) => sum + order.total, 0))} trend="Live" note="delivered orders only" /></div>
      <section className="vendor-panel"><div className="vendor-panel-heading"><div><h2>Bulk order management</h2><p>Set your delivery fee, then prepare orders after the buyer pays.</p></div><button type="button" className="vendor-outline-button" onClick={onViewOrders}>All order statuses →</button></div><div className="bulk-benefits"><span>✓ Quote seller-handled delivery</span><span>✓ Buyer pays securely through Paystack</span><span>✓ Prepare and mark paid orders ready</span></div><OrdersTable orders={orders} onStatusChange={onStatusChange} onQuoteDelivery={onQuoteDelivery} onView={onViewOrders} /></section>
    </>
  );
}

function OverviewPanel({ activeTab, onNavigate, profile, products, orders, notificationPreferences, onPreferenceChange, settingsSaved }: {
  activeTab: SupplierTab;
  onNavigate: (tab: SupplierTab) => void;
  profile: BusinessProfile | null;
  products: VendorProduct[];
  orders: SupplierOrder[];
  notificationPreferences: { newOrders: boolean; shipmentUpdates: boolean; lowStockAlerts: boolean; marketingEmails: boolean };
  onPreferenceChange: (key: keyof SupplierNotificationPreferences, enabled: boolean) => void;
  settingsSaved: boolean;
}) {
  const settings: { key: keyof typeof notificationPreferences; label: string; description: string }[] = [
    { key: "newOrders", label: "New order notifications", description: "Get a message when a buyer places an order." },
    { key: "shipmentUpdates", label: "Shipment updates", description: "Receive updates when deliveries are on the move." },
    { key: "lowStockAlerts", label: "Low stock alerts", description: "Know when products need restocking." },
    { key: "marketingEmails", label: "Marketing emails", description: "Hear about supplier tools and promotions." },
  ];
  const actionTabs: SupplierTab[] = activeTab === "Customers & Vendors"
    ? ["Products", "Orders", "Supplier Profile"]
    : activeTab === "Pricing & Discounts"
      ? ["Products", "Bulk Orders", "Analytics"]
      : activeTab === "Shipments & Delivery"
        ? ["Orders", "Inventory", "Analytics"]
        : ["Products", "Orders", "Settings"];
  const deliveredOrders = orders.filter((order) => order.status === "Delivered");
  const deliveredTotal = deliveredOrders.reduce((sum, order) => sum + order.total, 0);
  const averageDeliveredOrder = deliveredOrders.length ? deliveredTotal / deliveredOrders.length : 0;
  const buyerOrders = new Map<string, number>();
  orders.forEach((order) => buyerOrders.set(order.buyer, (buyerOrders.get(order.buyer) ?? 0) + 1));
  const stats: Partial<Record<SupplierTab, [string, string][]>> = {
    "Customers & Vendors": [["Buyers with orders", String(buyerOrders.size)], ["Orders received", String(orders.length)], ["Vendor directory", "Not connected"]],
    "Pricing & Discounts": [["Products listed", String(products.length)], ["Active discounts", "Not configured"], ["Average listed price", currency.format(products.length ? products.reduce((sum, product) => sum + product.price, 0) / products.length : 0)]],
    "Shipments & Delivery": [["Ready for delivery", String(orders.filter((order) => order.status === "Ready").length)], ["Delivered", String(deliveredOrders.length)], ["Delivery", "Seller handled"]],
    Payouts: [["Available balance", "Manual payout"], ["Pending payouts", "Manual payout"], ["Payment provider", "Paystack"]],
    Analytics: [["Delivered order value", currency.format(deliveredTotal)], ["Total orders", String(orders.length)], ["Average delivered order", currency.format(averageDeliveredOrder)]],
    "Supplier Profile": [["Total products", String(products.length)], ["Orders received", String(orders.length)], ["Verification", profile?.verificationStatus.replaceAll("_", " ") ?? "Unknown"]],
    Settings: [["Account status", profile?.verificationStatus.replaceAll("_", " ") ?? "Unknown"], ["Notification preferences", "Account saved"]],
  };
  const currentStats = stats[activeTab] ?? [];

  return (
    <div className="overview-layout">
      <section className="vendor-panel overview-summary">
      <div className="overview-icon">{navigation.find((item) => item.label === activeTab)?.icon}</div>
      <span className="vendor-breadcrumb">SUPPLIER WORKSPACE</span>
      <h2>{activeTab}</h2>
      <p>{tabDescriptions[activeTab]}</p>
      <div className="overview-stats">{currentStats.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>

      {activeTab === "Customers & Vendors" && <><PlatformRolesPanel /><WorkspaceTable title="Buyers who ordered from you" headers={["Buyer", "Orders", "Directory details"]} rows={[...buyerOrders].map(([buyer, count]) => [buyer, String(count), "Not available"])}/></>}

      {activeTab === "Pricing & Discounts" && <WorkspaceTable title="Listed product prices and inventory" headers={["Product", "Category", "Price", "Stock", "Discount"]} rows={products.map((product) => [product.name, product.category, currency.format(product.price), `${product.stock} units`, "Not configured"])} />}

      {activeTab === "Shipments & Delivery" && <WorkspaceTable title="Orders requiring delivery" headers={["Order", "Buyer", "Products", "Status"]} rows={orders.filter((order) => order.status === "Ready" || order.status === "Delivered").map((order) => [order.id, order.buyer, order.item, order.status])} />}

      {activeTab === "Payouts" && <div className="payout-summary"><div><span>Seller funds are sent manually by SureFood</span><strong>Manual payouts</strong><small>Use the verified business bank account in Payouts after approval.</small></div></div>}

      {activeTab === "Analytics" && <WorkspaceTable title="Orders by status" headers={["Status", "Orders"]} rows={orderStatuses.map((status) => [status, String(orders.filter((order) => order.status === status).length)])} />}

      {activeTab === "Supplier Profile" && <div className="supplier-profile-details"><div className="supplier-profile-avatar">{(profile?.displayName ?? "Seller").slice(0, 2).toUpperCase()}</div><div><span className={profile?.verificationStatus === "approved" ? "profile-verified" : "order-status processing"}>{profile?.verificationStatus === "approved" ? "✓ Verified supplier" : `Verification ${profile?.verificationStatus.replaceAll("_", " ") ?? "incomplete"}`}</span><h3>{profile?.business?.businessName || profile?.displayName}</h3><dl><dt>Business location</dt><dd>{profile?.location || "Not provided"}</dd><dt>Email address</dt><dd>{profile?.email || "Not provided"}</dd><dt>Phone number</dt><dd>{profile?.phone || "Not provided"}</dd><dt>Country</dt><dd>{profile?.business?.country || "Not provided"}</dd></dl></div></div>}

      {activeTab === "Settings" && <div className="supplier-settings"><h3>Notification preferences</h3><p className="vendor-empty-search">These preferences are saved to your account. SureFood email alerts are not yet available.</p>{settingsSaved && <p className="vendor-success" role="status">Settings saved.</p>}{settings.map((setting) => <label className="supplier-setting" key={setting.key}><span><strong>{setting.label}</strong><small>{setting.description}</small></span><input type="checkbox" checked={notificationPreferences[setting.key]} onChange={(event) => onPreferenceChange(setting.key, event.target.checked)} /></label>)}</div>}
      </section>
      <section className="vendor-panel overview-actions"><div className="vendor-panel-heading"><div><h2>Quick links</h2><p>Continue managing your business</p></div></div>{actionTabs.map((tab) => <QuickAction key={tab} icon={navigation.find((item) => item.label === tab)?.icon ?? "→"} label={tab} description={tabDescriptions[tab]} onClick={() => onNavigate(tab)} />)}</section>
    </div>
  );
}

function PlatformRolesPanel() {
  return (
    <section className="platform-roles">
      <div className="platform-roles-heading"><div><h3>Sure Foodz platform roles</h3><p>Each participant has a distinct place in the food supply chain.</p></div><span>6 roles</span></div>
      <div className="platform-role-grid">{platformRoles.map(({ role, icon, description }) => <article className="platform-role-card" key={role}><span>{icon}</span><div><strong>{role}</strong><small>{description}</small></div></article>)}</div>
    </section>
  );
}

function WorkspaceTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return <div className="workspace-table-section"><h3>{title}</h3><div className="vendor-table-wrap"><table className="vendor-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === row.length - 1 && cell === "Active" ? <span className="order-status confirmed">{cell}</span> : cell}</td>)}</tr>)}</tbody></table>{rows.length === 0 && <p className="vendor-empty-search">No saved records yet.</p>}</div></div>;
}
