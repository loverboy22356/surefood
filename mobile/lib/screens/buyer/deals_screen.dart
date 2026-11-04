import 'package:flutter/material.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';
import 'cart_screen.dart';
import 'product_screen.dart';
import 'wishlist_screen.dart';

enum _DealFilter { all, discount, under10k, almostGone }

class DealsScreen extends StatefulWidget {
  const DealsScreen({super.key});

  @override
  State<DealsScreen> createState() => _DealsScreenState();
}

class _DealsScreenState extends State<DealsScreen> {
  Future<List<Product>>? _future;
  _DealFilter _filter = _DealFilter.all;

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

  List<Product> _apply(List<Product> products) {
    final items = products.where((product) => product.discounted).toList();
    final source = items.isNotEmpty ? items : [...products];
    switch (_filter) {
      case _DealFilter.all:
        break;
      case _DealFilter.discount:
        source.sort((a, b) => b.discountPercent.compareTo(a.discountPercent));
      case _DealFilter.under10k:
        source.removeWhere((product) => product.priceMinor > 1000000);
        source.sort((a, b) => a.priceMinor.compareTo(b.priceMinor));
      case _DealFilter.almostGone:
        source.removeWhere((product) => !product.lowStock);
    }
    return source;
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
    final state = AppScope.of(context);
    final endsAt = DateTime.now().add(const Duration(hours: 5, minutes: 18));
    return Scaffold(
      backgroundColor: Sf.white,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(Sf.gutter, 10, 12, 6),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Deals', style: SfType.h1.copyWith(fontSize: 22)),
                        Text(
                          'Flash prices from verified sellers',
                          style: SfType.caption.copyWith(fontSize: 11.5),
                        ),
                      ],
                    ),
                  ),
                  SfIconButton(
                    icon: Icons.favorite_border_rounded,
                    filled: true,
                    badge: state.wishlistCount,
                    onPressed: () => Navigator.of(context).push(sfRoute(const WishlistScreen())),
                  ),
                ],
              ),
            ),
            Expanded(
              child: FutureBuilder<List<Product>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Padding(
                      padding: EdgeInsets.all(Sf.gutter),
                      child: SfGridSkeleton(count: 6),
                    );
                  }
                  if (snapshot.hasError) {
                    return SfEmpty(
                      icon: Icons.cloud_off_rounded,
                      title: 'Deals are offline',
                      message: 'Reconnect to load today\'s prices.',
                      action: SfButton(label: 'Reload', expanded: false, onPressed: _refresh),
                    );
                  }
                  final products = snapshot.data ?? const <Product>[];
                  final items = _apply([...products]);
                  return RefreshIndicator(
                    onRefresh: _refresh,
                    color: Sf.blue,
                    child: ListView(
                      padding: const EdgeInsets.only(bottom: 24),
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        _FlashHeader(endsAt: endsAt),
                        SizedBox(
                          height: 46,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.fromLTRB(Sf.gutter, 6, Sf.gutter, 6),
                            children: [
                              SfChip(
                                label: 'All deals',
                                selected: _filter == _DealFilter.all,
                                onTap: () => setState(() => _filter = _DealFilter.all),
                              ),
                              const SizedBox(width: 8),
                              SfChip(
                                label: 'Biggest discount',
                                icon: Icons.bolt_rounded,
                                selected: _filter == _DealFilter.discount,
                                onTap: () => setState(() => _filter = _DealFilter.discount),
                              ),
                              const SizedBox(width: 8),
                              SfChip(
                                label: 'Under ₦10,000',
                                selected: _filter == _DealFilter.under10k,
                                onTap: () => setState(() => _filter = _DealFilter.under10k),
                              ),
                              const SizedBox(width: 8),
                              SfChip(
                                label: 'Almost gone',
                                icon: Icons.local_fire_department_rounded,
                                selected: _filter == _DealFilter.almostGone,
                                onTap: () => setState(() => _filter = _DealFilter.almostGone),
                              ),
                            ],
                          ),
                        ),
                        if (items.isEmpty)
                          const SfEmpty(
                            icon: Icons.bolt_outlined,
                            title: 'No deals in this filter',
                            message: 'Try another filter — sellers restock deals through the day.',
                          )
                        else
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: Sf.gutter),
                            child: GridView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              padding: const EdgeInsets.only(top: 6),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                mainAxisSpacing: 12,
                                crossAxisSpacing: 12,
                                childAspectRatio: 0.60,
                              ),
                              itemCount: items.length,
                              itemBuilder: (context, index) {
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
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FlashHeader extends StatelessWidget {
  const _FlashHeader({required this.endsAt});

  final DateTime endsAt;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(Sf.gutter, 6, Sf.gutter, 4),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
      decoration: BoxDecoration(
        gradient: Sf.gradientBlue,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: Sf.yellow,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.bolt_rounded, size: 13, color: Sf.ink),
                    const SizedBox(width: 3),
                    Text(
                      'FLASH SALE',
                      style: SfType.micro.copyWith(color: Sf.ink, fontSize: 9.5),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              Text(
                'Resets soon',
                style: SfType.caption.copyWith(color: Sf.white.withValues(alpha: 0.8), fontSize: 10.5),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Text(
                  'Prices drop daily.\nGrab them before the timer.',
                  style: SfType.h2.copyWith(color: Sf.white, fontSize: 18, height: 1.2),
                ),
              ),
              SfCountdown(endsAt: endsAt, compact: true),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: const LinearProgressIndicator(
              value: 0.68,
              minHeight: 6,
              backgroundColor: Color(0x33FFFFFF),
              valueColor: AlwaysStoppedAnimation(Sf.yellow),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Deals refresh at midnight · while stock lasts',
            style: SfType.caption.copyWith(color: Sf.white.withValues(alpha: 0.8), fontSize: 10),
          ),
        ],
      ),
    );
  }
}
