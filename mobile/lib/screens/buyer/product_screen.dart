import 'package:flutter/material.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';
import 'cart_screen.dart';
import 'checkout_screen.dart';
import 'store_screen.dart';

class ProductScreen extends StatefulWidget {
  const ProductScreen({super.key, required this.product});

  final Product product;

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  final PageController _gallery = PageController();
  int _page = 0;
  bool _descriptionOpen = false;
  Future<List<Product>>? _related;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) AppScope.read(context).remember(widget.product);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _related ??= AppScope.read(context).products();
  }

  @override
  void dispose() {
    _gallery.dispose();
    super.dispose();
  }

  Future<void> _add({bool goToCart = false}) async {
    final product = widget.product;
    final ok = await ensureSignedIn(context, reason: 'Sign in to add ${product.name} to your cart');
    if (!ok || !mounted) return;
    final state = AppScope.read(context);
    state.addToCart(product);
    if (goToCart) {
      Navigator.of(context).push(sfRoute(const CheckoutScreen()));
      return;
    }
    SfToast.show(
      context,
      '${product.name} added to cart',
      icon: Icons.shopping_bag_rounded,
      actionLabel: 'Cart',
      onAction: () => Navigator.of(context).push(sfRoute(const CartScreen())),
    );
  }

  Future<void> _wishlist() async {
    final state = AppScope.read(context);
    if (!state.signedIn) {
      final ok = await ensureSignedIn(context, reason: 'Sign in to save favourites');
      if (!ok || !mounted) return;
    }
    final added = AppScope.read(context).toggleWishlist(widget.product);
    SfToast.show(
      context,
      added ? 'Saved to favourites' : 'Removed from favourites',
      icon: added ? Icons.favorite_rounded : Icons.favorite_border_rounded,
      color: added ? Sf.orange : Sf.muted,
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final product = widget.product;
    final seller = Seller(
      id: product.sellerId,
      name: product.sellerName.isEmpty ? 'Sure Foodz seller' : product.sellerName,
      logoUrl: product.sellerLogoUrl,
      detail: product.sellerLocation,
      city: product.sellerLocation,
      region: '',
      role: product.sellerRole,
      badge: product.sellerVerified ? 'Verified seller' : '',
      emoji: '🏪',
    );

    return Scaffold(
      backgroundColor: Sf.white,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Expanded(
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(child: _galleryHeader(product, state)),
                  SliverToBoxAdapter(child: _titleBlock(product)),
                  SliverToBoxAdapter(child: _priceBlock(product)),
                  SliverToBoxAdapter(child: _assuranceRow(product)),
                  SliverToBoxAdapter(
                    child: _sellerBlock(seller),
                  ),
                  SliverToBoxAdapter(child: _descriptionBlock(product)),
                  SliverToBoxAdapter(child: _detailsBlock(product)),
                  SliverToBoxAdapter(
                    child: FutureBuilder<List<Product>>(
                      future: _related,
                      builder: (context, snapshot) {
                        final items = (snapshot.data ?? const <Product>[])
                            .where(
                              (item) =>
                                  item.id != product.id &&
                                  item.category.toLowerCase() == product.category.toLowerCase(),
                            )
                            .take(8)
                            .toList();
                        if (items.isEmpty) return const SizedBox(height: 16);
                        return Column(
                          children: [
                            SfSectionHeader(
                              title: 'More in ${product.category}',
                              subtitle: 'From sellers near you',
                              icon: Icons.grid_view_rounded,
                            ),
                            SizedBox(
                              height: 196,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                padding: const EdgeInsets.symmetric(horizontal: Sf.gutter),
                                itemCount: items.length,
                                separatorBuilder: (_, _) => const SizedBox(width: 10),
                                itemBuilder: (context, index) {
                                  final item = items[index];
                                  return SizedBox(
                                    width: 132,
                                    child: SfProductCard(
                                      product: item,
                                      onTap: () => Navigator.of(context).pushReplacement(
                                        sfRoute(ProductScreen(product: item)),
                                      ),
                                      onAdd: () => _add(),
                                      wishlisted: state.isWishlisted(item.id),
                                      onWishlist: () {
                                        AppScope.read(context).toggleWishlist(item);
                                      },
                                    ),
                                  );
                                },
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],
                        );
                      },
                    ),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 18)),
                ],
              ),
            ),
            _BottomBar(
              product: product,
              wishlisted: state.isWishlisted(product.id),
              onWishlist: _wishlist,
              onAdd: () => _add(),
              onBuy: () => _add(goToCart: true),
            ),
          ],
        ),
      ),
    );
  }

  Widget _galleryHeader(Product product, AppState state) {
    return Stack(
      children: [
        AspectRatio(
          aspectRatio: 1,
          child: PageView(
            controller: _gallery,
            onPageChanged: (value) => setState(() => _page = value),
            children: [
              SfImage(product.imageUrl, fit: BoxFit.cover),
              if (product.sellerLogoUrl.isNotEmpty) SfImage(product.sellerLogoUrl, fit: BoxFit.contain),
            ],
          ),
        ),
        Positioned(
          top: 8,
          left: 8,
          child: CircleAvatar(
            backgroundColor: Sf.white.withValues(alpha: 0.94),
            radius: 20,
            child: IconButton(
              icon: const Icon(Icons.arrow_back_rounded, size: 19, color: Sf.ink),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
          ),
        ),
        Positioned(
          top: 8,
          right: 8,
          child: Row(
            children: [
              GestureDetector(
                onTap: _wishlist,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Sf.white.withValues(alpha: 0.94),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    state.isWishlisted(product.id)
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    size: 19,
                    color: state.isWishlisted(product.id) ? Sf.orange : Sf.ink,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () => showDialog(
                  context: context,
                  builder: (context) => Dialog(
                    backgroundColor: Sf.white,
                    insetPadding: const EdgeInsets.all(12),
                    child: Stack(
                      children: [
                        InteractiveViewer(
                          maxScale: 4,
                          child: SfImage(product.imageUrl, fit: BoxFit.contain),
                        ),
                        Positioned(
                          top: 4,
                          right: 4,
                          child: IconButton(
                            icon: const Icon(Icons.close_rounded),
                            onPressed: () => Navigator.of(context).pop(),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Sf.white.withValues(alpha: 0.94),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.zoom_out_map_rounded, size: 18, color: Sf.ink),
                ),
              ),
            ],
          ),
        ),
        if (product.discounted)
          Positioned(
            left: 14,
            bottom: 14,
            child: SfTag(label: 'SAVE ${product.discountPercent}%', color: Sf.orange),
          ),
        if (_page == 0 && product.sellerLogoUrl.isNotEmpty)
          Positioned(
            bottom: 16,
            right: 0,
            left: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < 2; i++)
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 2.5),
                    height: 5,
                    width: i == _page ? 18 : 5,
                    decoration: BoxDecoration(
                      color: i == _page ? Sf.white : Sf.white.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _titleBlock(Product product) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(Sf.gutter, 16, Sf.gutter, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(product.name, style: SfType.h1.copyWith(fontSize: 21)),
          const SizedBox(height: 8),
          Row(
            children: [
              if (product.sellerVerified) ...[
                const Icon(Icons.verified_rounded, size: 15, color: Sf.blue),
                const SizedBox(width: 4),
              ],
              Flexible(
                child: Text(
                  product.sellerName.isEmpty ? 'Sure Foodz seller' : product.sellerName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SfType.caption.copyWith(color: Sf.ink, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 8),
              Text('·', style: SfType.caption),
              const SizedBox(width: 8),
              if (product.sellerLocation.isNotEmpty)
                Flexible(
                  child: Text(
                    product.sellerLocation,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: SfType.caption,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _priceBlock(Product product) {
    return Container(
      margin: const EdgeInsets.fromLTRB(Sf.gutter, 14, Sf.gutter, 0),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Sf.orangeWash, Sf.yellowWash],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Sf.orange.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                naira(product.priceMinor),
                style: SfType.display.copyWith(fontSize: 30, color: Sf.ink),
              ),
              if (product.discounted) ...[
                const SizedBox(width: 8),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text(
                    naira(product.compareAtMinor!),
                    style: SfType.caption.copyWith(
                      decoration: TextDecoration.lineThrough,
                      fontSize: 13,
                    ),
                  ),
                ),
                const Spacer(),
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: SfTag(label: '-${product.discountPercent}%', color: Sf.orange),
                ),
              ],
            ],
          ),
          if (product.discounted) ...[
            const SizedBox(height: 6),
            Text(
              'You save ${naira(product.savingMinor)} today',
              style: SfType.caption.copyWith(color: Sf.green, fontWeight: FontWeight.w800),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(
                product.soldOut
                    ? Icons.cancel_rounded
                    : product.lowStock
                    ? Icons.local_fire_department_rounded
                    : Icons.check_circle_rounded,
                size: 15,
                color: product.soldOut ? Sf.orange : (product.lowStock ? Sf.orange : Sf.green),
              ),
              const SizedBox(width: 6),
              Text(
                product.soldOut
                    ? 'Sold out'
                    : product.lowStock
                    ? 'Only ${product.stock} left in stock'
                    : 'In stock · ${product.stock} available',
                style: SfType.caption.copyWith(
                  color: Sf.ink,
                  fontWeight: FontWeight.w700,
                  fontSize: 11.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _assuranceRow(Product product) {
    final items = [
      (Icons.local_shipping_rounded, 'Delivered in 24h', 'Within your area'),
      (Icons.assignment_return_rounded, '24h returns', 'Money-back guarantee'),
      (Icons.shield_rounded, 'Verified seller', 'Checked by Sure Foodz'),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(Sf.gutter, 14, Sf.gutter, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: Sf.soft,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            for (final item in items)
              Expanded(
                child: Column(
                  children: [
                    Icon(item.$1, size: 18, color: Sf.blue),
                    const SizedBox(height: 5),
                    Text(
                      item.$2,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: SfType.caption.copyWith(
                        color: Sf.ink,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      item.$3,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: SfType.caption.copyWith(fontSize: 9, color: Sf.muted),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _sellerBlock(Seller seller) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(Sf.gutter, 14, Sf.gutter, 0),
      child: GestureDetector(
        onTap: () => Navigator.of(context).push(sfRoute(StoreScreen(seller: seller))),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Sf.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Sf.line),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Sf.soft,
                  borderRadius: BorderRadius.circular(12),
                ),
                clipBehavior: Clip.antiAlias,
                child: seller.logoUrl.isEmpty
                    ? const Icon(Icons.storefront_rounded, color: Sf.muted, size: 20)
                    : SfImage(seller.logoUrl),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      seller.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: SfType.h3.copyWith(fontSize: 14),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(Icons.verified_rounded, size: 12, color: Sf.green),
                        const SizedBox(width: 3),
                        Text(
                          seller.city.isEmpty ? 'Verified seller' : '${seller.badge} · ${seller.city}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: SfType.caption.copyWith(fontSize: 10.5),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Sf.blueWash,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  'Visit',
                  style: SfType.caption.copyWith(
                    color: Sf.blue,
                    fontWeight: FontWeight.w800,
                    fontSize: 11.5,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _descriptionBlock(Product product) {
    final text = product.description.isEmpty
        ? 'The seller has not added a description for this listing yet.'
        : product.description;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Sf.gutter, 18, Sf.gutter, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Product details', style: SfType.h2),
              const Spacer(),
              if (text.length > 110)
                GestureDetector(
                  onTap: () => setState(() => _descriptionOpen = !_descriptionOpen),
                  child: Text(
                    _descriptionOpen ? 'Show less' : 'Read more',
                    style: SfType.caption.copyWith(color: Sf.blue, fontWeight: FontWeight.w800),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 240),
            firstChild: Text(
              text,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: SfType.body.copyWith(color: Sf.muted, height: 1.55),
            ),
            secondChild: Text(
              text,
              style: SfType.body.copyWith(color: Sf.muted, height: 1.55),
            ),
            crossFadeState: _descriptionOpen
                ? CrossFadeState.showSecond
                : CrossFadeState.showFirst,
          ),
        ],
      ),
    );
  }

  Widget _detailsBlock(Product product) {
    final rows = <(String, String)>[
      ('Category', product.category.isEmpty ? 'Uncategorised' : product.category),
      if (product.productKind.isNotEmpty) ('Type', product.productKind),
      if (product.unit.isNotEmpty) ('Unit', product.unit),
      if (product.expiryDate.isNotEmpty) ('Best before', product.expiryDate),
      if (product.nafdacNumber.isNotEmpty) ('NAFDAC', product.nafdacNumber),
      ('Sold by', product.sellerName.isEmpty ? 'Sure Foodz seller' : product.sellerName),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(Sf.gutter, 18, Sf.gutter, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: Sf.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Sf.line),
        ),
        child: Column(
          children: [
            for (final row in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 9),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 96,
                      child: Text(row.$1, style: SfType.caption),
                    ),
                    Expanded(
                      child: Text(
                        row.$2,
                        style: SfType.body.copyWith(fontSize: 12.5, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.product,
    required this.wishlisted,
    required this.onWishlist,
    required this.onAdd,
    required this.onBuy,
  });

  final Product product;
  final bool wishlisted;
  final VoidCallback onWishlist;
  final VoidCallback onAdd;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    return SfBottomBar(
      child: Row(
        children: [
          GestureDetector(
            onTap: onWishlist,
            child: Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: Sf.soft,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Sf.line),
              ),
              child: Icon(
                wishlisted ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                size: 20,
                color: wishlisted ? Sf.orange : Sf.ink,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: SfButton(
              label: product.soldOut ? 'Sold out' : 'Add to cart',
              variant: SfButtonVariant.outline,
              height: 46,
              icon: Icons.add_shopping_cart_rounded,
              onPressed: product.soldOut ? null : onAdd,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: SfButton(
              label: 'Buy now',
              height: 46,
              icon: Icons.bolt_rounded,
              onPressed: product.soldOut ? null : onBuy,
            ),
          ),
        ],
      ),
    );
  }
}
