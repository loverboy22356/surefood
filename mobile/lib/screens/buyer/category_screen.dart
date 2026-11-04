import 'package:flutter/material.dart';

import '../../api.dart';
import '../../categories.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';
import 'cart_screen.dart';
import 'product_screen.dart';
import 'search_screen.dart';

enum _Sort { recommended, priceLow, priceHigh, discount }

class CategoryScreen extends StatefulWidget {
  const CategoryScreen({super.key, required this.category, this.products = const []});

  final Category category;
  final List<Product> products;

  @override
  State<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends State<CategoryScreen> {
  Future<List<Product>>? _future;
  _Sort _sort = _Sort.recommended;
  bool _inStockOnly = false;

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

  List<Product> _filtered(List<Product> source) {
    final items = source
        .where((product) => product.category.toLowerCase() == widget.category.name.toLowerCase())
        .where((product) => !_inStockOnly || !product.soldOut)
        .toList();
    switch (_sort) {
      case _Sort.priceLow:
        items.sort((a, b) => a.priceMinor.compareTo(b.priceMinor));
      case _Sort.priceHigh:
        items.sort((a, b) => b.priceMinor.compareTo(a.priceMinor));
      case _Sort.discount:
        items.sort((a, b) => b.discountPercent.compareTo(a.discountPercent));
      case _Sort.recommended:
        items.sort((a, b) => (b.sellerVerified ? 1 : 0).compareTo(a.sellerVerified ? 1 : 0));
    }
    return items;
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

  Future<void> _wishlist(Product product) async {
    if (!AppScope.read(context).signedIn) {
      final ok = await ensureSignedIn(context, reason: 'Sign in to save favourites');
      if (!ok || !mounted) return;
    }
    final added = AppScope.read(context).toggleWishlist(product);
    SfToast.show(
      context,
      added ? 'Saved to favourites' : 'Removed from favourites',
      icon: added ? Icons.favorite_rounded : Icons.favorite_border_rounded,
      color: added ? Sf.orange : Sf.muted,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tint = categoryTint(widget.category.name);
    final state = AppScope.of(context);
    return Scaffold(
      backgroundColor: Sf.white,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 6, 12, 0),
              child: Row(
                children: [
                  SfIconButton(
                    icon: Icons.arrow_back_rounded,
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  Expanded(
                    child: Text(
                      widget.category.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: SfType.h1.copyWith(fontSize: 20),
                    ),
                  ),
                  SfIconButton(
                    icon: Icons.search_rounded,
                    onPressed: () => Navigator.of(context).push(sfRoute(const SearchScreen())),
                  ),
                  SfIconButton(
                    icon: Icons.shopping_cart_outlined,
                    badge: state.cartCount,
                    onPressed: () => Navigator.of(context).push(sfRoute(const CartScreen())),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 52,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(Sf.gutter, 8, Sf.gutter, 8),
                children: [
                  SfChip(
                    label: 'Recommended',
                    selected: _sort == _Sort.recommended,
                    onTap: () => setState(() => _sort = _Sort.recommended),
                  ),
                  const SizedBox(width: 8),
                  SfChip(
                    label: 'Price: low to high',
                    selected: _sort == _Sort.priceLow,
                    onTap: () => setState(() => _sort = _Sort.priceLow),
                  ),
                  const SizedBox(width: 8),
                  SfChip(
                    label: 'Price: high to low',
                    selected: _sort == _Sort.priceHigh,
                    onTap: () => setState(() => _sort = _Sort.priceHigh),
                  ),
                  const SizedBox(width: 8),
                  SfChip(
                    label: 'Biggest discount',
                    icon: Icons.bolt_rounded,
                    selected: _sort == _Sort.discount,
                    onTap: () => setState(() => _sort = _Sort.discount),
                  ),
                  const SizedBox(width: 8),
                  SfChip(
                    label: 'In stock',
                    icon: Icons.check_circle_outline_rounded,
                    selected: _inStockOnly,
                    onTap: () => setState(() => _inStockOnly = !_inStockOnly),
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
                      padding: EdgeInsets.symmetric(horizontal: Sf.gutter),
                      child: SfGridSkeleton(count: 6),
                    );
                  }
                  final source = snapshot.data ?? widget.products;
                  final items = _filtered(source);
                  if (items.isEmpty) {
                    return RefreshIndicator(
                      onRefresh: _refresh,
                      color: Sf.blue,
                      child: ListView(
                        children: [
                          Container(
                            margin: const EdgeInsets.all(Sf.gutter),
                            padding: const EdgeInsets.all(18),
                            decoration: BoxDecoration(
                              color: tint.withValues(alpha: 0.07),
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Row(
                              children: [
                                Icon(categoryIcon(widget.category.name), color: tint, size: 26),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'Sellers are stocking this aisle. Check back soon.',
                                    style: SfType.caption.copyWith(color: Sf.ink, height: 1.4),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          SfEmpty(
                            icon: Icons.inventory_2_outlined,
                            title: 'No listings here yet',
                            message: _inStockOnly
                                ? 'Everything in this category is out of stock. Turn off the stock filter to see it all.'
                                : 'No approved seller has published this category yet.',
                            action: SfButton(
                              label: 'Browse other categories',
                              expanded: false,
                              onPressed: () => Navigator.of(context).maybePop(),
                            ),
                          ),
                        ],
                      ),
                    );
                  }
                  return RefreshIndicator(
                    onRefresh: _refresh,
                    color: Sf.blue,
                    child: GridView.builder(
                      padding: const EdgeInsets.fromLTRB(Sf.gutter, 4, Sf.gutter, 24),
                      physics: const AlwaysScrollableScrollPhysics(),
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
                          onWishlist: () => _wishlist(product),
                        );
                      },
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
