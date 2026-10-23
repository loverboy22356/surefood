import { Storefront } from "./storefront";

export default async function SellerStorePage({ params }: { params: Promise<{ sellerId: string }> }) {
  const { sellerId } = await params;
  return <Storefront sellerId={sellerId} />;
}
