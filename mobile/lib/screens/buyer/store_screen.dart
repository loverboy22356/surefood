import 'package:flutter/material.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';
import 'cart_screen.dart';
import 'product_screen.dart';

class StoreScreen extends StatefulWidget {
  const StoreScreen({super.key, required this.seller});

  final Seller seller;

  @override
  State<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends State<StoreScreen> {
  Future<List<Product>>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= AppScope.read(context).products();
  }

  Future<void> _refresh() async {
    setState(() {
  _future = AppScope.read(context).products(refresh: true);
});
    await _future;
  }

  Future<void> _add(Product product) async {
    final ok = await ensureSignedIn(context, reason: 'Sign in to add ${product.name} to your cart');
    if (!ok || !mounted) return;
    AppScope.read(context).addToCart(product);
    SfToast.show(
      context,
      '${product.name} added to cart',
      icon: Icons.shopping_bag_rounded,
      actionLabel: 'View',
      onAction: () => Navigator.of(context).push(sfRoute(const CartScreen())),
    );
  }

  @override
  Widget build(BuildContext context) {
    final seller = widget.seller;
    final state = AppScope.of(context);
    return Scaffold(
      backgroundColor: Sf.white,
      body: SafeArea(
        bottom: false,
        child: FutureBuilder<List<Product>>(
          future: _future,
          builder: (context, snapshot) {
            final all = snapshot.data ?? const <Product>[];
            final items = all
                .where((product) => product.sellerId == seller.id || product.sellerName == seller.name)
                .toList();
            return RefreshIndicator(
              onRefresh: _refresh,
              color: Sf.blue,
              child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _StoreHeader(
                    seller: seller,
                    listingCount: items.length,
                    onBack: () => Navigator.of(context).maybePop(),
                    onCart: () => Navigator.of(context).push(sfRoute(const CartScreen())),
                    cartCount: state.cartCount,
                  ),
                ),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(Sf.gutter),
                      child: SfGridSkeleton(count: 4),
                    ),
                  )
                else if (items.isEmpty)
                  SliverToBoxAdapter(
                    child: SfEmpty(
                      icon: Icons.storefront_rounded,
                      title: 'No listings from this seller yet',
                      message: '${seller.name} has not published products in your area.',
                      action: SfButton(
                        label: 'Browse the market',
                        expanded: false,
                        variant: SfButtonVariant.outline,
                        onPressed: () => Navigator.of(context).maybePop(),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(Sf.gutter, 8, Sf.gutter, 26),
                    sliver: SliverGrid(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 0.60,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final product = items[index];
                          return SfProductCard(
                            product: product,
                            onTap: () => Navigator.of(context).push(
                              sfRoute(ProductScreen(product: product)),
                            ),
                            onAdd: () => _add(product),
                            wishlisted: state.isWishlisted(product.id),
                            onWishlist: () {
                              AppScope.read(context).toggleWishlist(product);
                            },
                          );
                        },
                        childCount: items.length,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _StoreHeader extends StatelessWidget {
  const _StoreHeader({
    required this.seller,
    required this.listingCount,
    required this.onBack,
    required this.onCart,
    required this.cartCount,
  });

  final Seller seller;
  final int listingCount;
  final VoidCallback onBack;
  final VoidCallback onCart;
  final int cartCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: Sf.gradientBlue,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(6, 6, 6, 20),
      child: Column(
        children: [
          Row(
            children: [
              SfIconButton(
                icon: Icons.arrow_back_rounded,
                onPressed: onBack,
              ),
              const Spacer(),
              SfIconButton(icon: Icons.shopping_cart_outlined, badge: cartCount, onPressed: onCart),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Container(
                width: 64,
                height: 64,
                margin: const EdgeInsets.only(left: 10),
                decoration: BoxDecoration(
                  color: Sf.white,
                  borderRadius: BorderRadius.circular(18),
                ),
                clipBehavior: Clip.antiAlias,
                child: seller.logoUrl.isEmpty
                    ? Center(
                        child: Text(
                          seller.emoji.isEmpty ? '🏪' : seller.emoji,
                          style: const TextStyle(fontSize: 26),
                        ),
                      )
                    : SfImage(seller.logoUrl, fit: BoxFit.cover),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      seller.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: SfType.h2.copyWith(color: Sf.white, fontSize: 18),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.verified_rounded, size: 12, color: Sf.yellow),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            seller.badge.isEmpty ? 'Verified seller' : seller.badge,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: SfType.caption.copyWith(
                              color: Sf.white.withValues(alpha: 0.9),
                              fontSize: 10.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (seller.detail.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Row(
                          children: [
                            Icon(
                              Icons.location_on_rounded,
                              size: 11,
                              color: Sf.white.withValues(alpha: 0.8),
                            ),
                            const SizedBox(width: 3),
                            Flexible(
                              child: Text(
                                seller.detail,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: SfType.caption.copyWith(
                                  color: Sf.white.withValues(alpha: 0.85),
                                  fontSize: 10,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 10),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: Sf.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                _HeaderStat(label: 'Listings', value: '$listingCount'),
                _HeaderDivider(),
                _HeaderStat(label: 'Delivery', value: '24h'),
                _HeaderDivider(),
                _HeaderStat(label: 'Returns', value: '24h'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderStat extends StatelessWidget {
  const _HeaderStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: SfType.h3.copyWith(color: Sf.white, fontSize: 15)),
          Text(
            label,
            style: SfType.caption.copyWith(
              color: Sf.white.withValues(alpha: 0.8),
              fontSize: 9.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderDivider extends StatelessWidget {
  const _HeaderDivider();

  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 22, color: Sf.white.withValues(alpha: 0.25));
  }
}
