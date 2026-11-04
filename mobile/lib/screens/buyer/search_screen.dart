import 'dart:async';

import 'package:flutter/material.dart';

import '../../api.dart';
import '../../catalog.dart';
import '../../categories.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';
import 'cart_screen.dart';
import 'category_screen.dart';
import 'product_screen.dart';

/// Search tab: recent searches, popular aisles and suggested products, then
/// live results once the buyer types.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.initialQuery = '', this.asRoute = false});

  final String initialQuery;
  final bool asRoute;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.initialQuery,
  );
  final FocusNode _focus = FocusNode();
  Future<(List<Product>, List<Category>)>? _future;
  Timer? _debounce;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _query = widget.initialQuery.trim();
    if (widget.asRoute && _query.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<(List<Product>, List<Category>)> _load() async {
    final state = AppScope.read(context);
    final results = await Future.wait([state.products(), state.categories()]);
    return (results[0] as List<Product>, results[1] as List<Category>);
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 200), () {
      if (mounted) setState(() => _query = value.trim());
    });
  }

  void _submit(String value) {
    final term = value.trim();
    if (term.isEmpty) return;
    AppScope.read(context).rememberSearch(term);
    setState(() => _query = term);
    _focus.unfocus();
  }

  void _searchFor(String term) {
    _controller.text = term;
    AppScope.read(context).rememberSearch(term);
    setState(() => _query = term);
    _focus.unfocus();
  }

  List<Product> _matches(List<Product> products) {
    final term = _query.toLowerCase();
    if (term.isEmpty) return const [];
    return products
        .where(
          (product) =>
              product.name.toLowerCase().contains(term) ||
              product.category.toLowerCase().contains(term) ||
              product.sellerName.toLowerCase().contains(term) ||
              product.description.toLowerCase().contains(term),
        )
        .toList();
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
    final state = AppScope.read(context);
    if (!state.signedIn) {
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

  void _openProduct(Product product) {
    Navigator.of(context).push(sfRoute(ProductScreen(product: product)));
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return Scaffold(
      backgroundColor: Sf.white,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(widget.asRoute ? 8 : 16, 10, 16, 6),
              child: Row(
                children: [
                  if (widget.asRoute) ...[
                    SfCircleAction(
                      icon: Icons.arrow_back_rounded,
                      tooltip: 'Back',
                      onPressed: () => Navigator.of(context).maybePop(),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Search',
                          style: SfType.display.copyWith(fontSize: 29, letterSpacing: -1.1),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          'Find your favourite products',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: SfType.bodyMuted.copyWith(fontSize: 12.5),
                        ),
                      ],
                    ),
                  ),
                  SfCircleAction(
                    icon: Icons.shopping_cart_outlined,
                    tooltip: 'Cart',
                    badge: state.cartCount,
                    onPressed: () => Navigator.of(context).push(sfRoute(const CartScreen())),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: SfPillField(
                hint: 'Search for products, stores…',
                height: 52,
                controller: _controller,
                focusNode: _focus,
                onChanged: _onChanged,
                onSubmitted: _submit,
                onClear: _controller.text.isEmpty
                    ? null
                    : () {
                        _controller.clear();
                        setState(() => _query = '');
                      },
                onFilter: () => _focus.requestFocus(),
              ),
            ),
            Expanded(
              child: FutureBuilder<(List<Product>, List<Category>)>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return ListView(
                      padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
                      children: const [
                        SfShimmer(height: 34, width: 180, radius: 8),
                        SizedBox(height: 14),
                        SfShimmer(height: 44, radius: 22),
                        SizedBox(height: 22),
                        SfShimmer(height: 20, width: 160, radius: 8),
                        SizedBox(height: 12),
                        SfGridSkeleton(count: 4),
                      ],
                    );
                  }
                  final products = snapshot.data?.$1 ?? const <Product>[];
                  final categories = snapshot.data?.$2 ?? const <Category>[];
                  final results = _matches(products);
                  return ListView(
                    padding: const EdgeInsets.only(bottom: 28),
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    children: [
                      if (_query.isEmpty) ...[
                        if (state.recentSearches.isNotEmpty)
                          _RecentSearches(
                            terms: state.recentSearches,
                            onPick: _searchFor,
                            onRemove: (term) => AppScope.read(context).forgetSearch(term),
                            onClear: () => AppScope.read(context).clearSearches(),
                          ),
                        _PopularSearches(categories: categories, onPick: _searchFor),
                        _Suggested(
                          products: products.take(6).toList(),
                          onTap: _openProduct,
                          onAdd: _add,
                          onWishlist: _wishlist,
                          wishlisted: (product) => state.isWishlisted(product.id),
                        ),
                      ] else ...[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${results.length} result${results.length == 1 ? '' : 's'} for “$_query”',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: SfType.h3.copyWith(fontSize: 14.5),
                                ),
                              ),
                              TextButton(
                                onPressed: () {
                                  _controller.clear();
                                  setState(() => _query = '');
                                },
                                child: Text(
                                  'Clear',
                                  style: SfType.body.copyWith(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w800,
                                    color: Sf.blue,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (results.isEmpty)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 30, 16, 0),
                            child: SfEmpty(
                              icon: Icons.search_off_rounded,
                              title: 'Nothing matched “$_query”',
                              message: 'Try a shorter word, a category or a store name.',
                              action: SfButton(
                                label: 'Browse categories',
                                variant: SfButtonVariant.outline,
                                onPressed: () => Navigator.of(context).push(
                                  sfRoute(CategoryScreen(category: categories.first)),
                                ),
                              ),
                            ),
                          )
                        else
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: LayoutBuilder(
                              builder: (context, constraints) {
                                final cardWidth = (constraints.maxWidth - 12) / 2;
                                return Wrap(
                                  spacing: 12,
                                  runSpacing: 12,
                                  children: [
                                    for (final product in results)
                                      SizedBox(
                                        width: cardWidth,
                                        child: SfCatalogCard(
                                          product: product,
                                          freeDelivery: false,
                                          onTap: () => _openProduct(product),
                                          onAdd: () => _add(product),
                                        ),
                                      ),
                                  ],
                                );
                              },
                            ),
                          ),
                      ],
                    ],
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

class _RecentSearches extends StatelessWidget {
  const _RecentSearches({
    required this.terms,
    required this.onPick,
    required this.onRemove,
    required this.onClear,
  });

  final List<String> terms;
  final ValueChanged<String> onPick;
  final ValueChanged<String> onRemove;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SfSectionTitle(
          title: 'Recent Searches',
          actionLabel: 'Clear All',
          onAction: onClear,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final term in terms)
                Container(
                  padding: const EdgeInsets.fromLTRB(12, 0, 6, 0),
                  height: 38,
                  decoration: BoxDecoration(
                    color: Sf.soft,
                    borderRadius: BorderRadius.circular(19),
                    border: Border.all(color: Sf.line),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.history_rounded, size: 15, color: Sf.muted),
                      const SizedBox(width: 6),
                      InkWell(
                        onTap: () => onPick(term),
                        child: Text(
                          term,
                          style: SfType.body.copyWith(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      InkResponse(
                        onTap: () => onRemove(term),
                        radius: 16,
                        child: const Padding(
                          padding: EdgeInsets.all(3),
                          child: Icon(Icons.close_rounded, size: 14, color: Sf.muted),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PopularSearches extends StatelessWidget {
  const _PopularSearches({required this.categories, required this.onPick});

  final List<Category> categories;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) return const SizedBox.shrink();
    final tiles = categories.take(8).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SfSectionTitle(
          title: 'Popular Searches',
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final width = (constraints.maxWidth - 24) / 4;
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final category in tiles)
                    SizedBox(
                      width: width,
                      height: width,
                      child: SfSearchTile(
                        label: category.name,
                        icon: categoryIcon(category.name),
                        tint: categoryTint(category.name).withValues(alpha: 0.10),
                        iconColor: categoryTint(category.name),
                        onTap: () => onPick(category.name),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _Suggested extends StatelessWidget {
  const _Suggested({
    required this.products,
    required this.onTap,
    required this.onAdd,
    required this.onWishlist,
    required this.wishlisted,
  });

  final List<Product> products;
  final ValueChanged<Product> onTap;
  final ValueChanged<Product> onAdd;
  final ValueChanged<Product> onWishlist;
  final bool Function(Product) wishlisted;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SfSectionTitle(
          title: 'Suggested Products',
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final width = (constraints.maxWidth - 20) / 3;
              return Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final product in products)
                    SizedBox(
                      width: width,
                      child: _SuggestedCard(
                        product: product,
                        wishlisted: wishlisted(product),
                        onTap: () => onTap(product),
                        onAdd: () => onAdd(product),
                        onWishlist: () => onWishlist(product),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _SuggestedCard extends StatelessWidget {
  const _SuggestedCard({
    required this.product,
    required this.wishlisted,
    required this.onTap,
    required this.onAdd,
    required this.onWishlist,
  });

  final Product product;
  final bool wishlisted;
  final VoidCallback onTap;
  final VoidCallback onAdd;
  final VoidCallback onWishlist;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Sf.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Sf.line),
          boxShadow: Sf.cardShadow,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                AspectRatio(
                  aspectRatio: 1,
                  child: SfImage(
                    product.imageUrl,
                    fit: BoxFit.cover,
                    radius: 0,
                    background: Sf.soft,
                  ),
                ),
                Positioned(
                  right: 6,
                  top: 6,
                  child: InkResponse(
                    onTap: onWishlist,
                    radius: 18,
                    child: Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: Sf.white.withValues(alpha: 0.94),
                        shape: BoxShape.circle,
                        boxShadow: Sf.cardShadow,
                      ),
                      child: Icon(
                        wishlisted ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        size: 14,
                        color: wishlisted ? Sf.orange : Sf.ink,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(9, 8, 8, 9),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: SfType.h3.copyWith(fontSize: 12.5, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              naira(product.priceMinor),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: SfType.price.copyWith(fontSize: 13, color: Sf.blue),
                            ),
                            if (product.discounted)
                              Text(
                                naira(product.compareAtMinor!),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: SfType.caption.copyWith(
                                  fontSize: 9.5,
                                  decoration: TextDecoration.lineThrough,
                                  decorationColor: Sf.muted,
                                ),
                              ),
                          ],
                        ),
                      ),
                      InkResponse(
                        onTap: product.soldOut ? null : onAdd,
                        radius: 18,
                        child: Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            color: product.soldOut ? Sf.soft : Sf.blue,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.add_rounded,
                            size: 17,
                            color: product.soldOut ? Sf.muted : Sf.white,
                          ),
                        ),
                      ),
                    ],
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
