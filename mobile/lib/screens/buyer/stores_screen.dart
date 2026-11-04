import 'package:flutter/material.dart';

import '../../api.dart';
import '../../catalog.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import 'cart_screen.dart';
import 'store_screen.dart';

/// Full-screen route wrapper so the Stores tab can also be pushed from Home.
class StoresRoute extends StatelessWidget {
  const StoresRoute({super.key});

  @override
  Widget build(BuildContext context) => const StoresScreen(asRoute: true);
}

/// Marketplace stores: every approved supplier and vendor that sells on
/// Sure Foodz, with the same filter/sort controls the reference screen shows.
class StoresScreen extends StatefulWidget {
  const StoresScreen({super.key, this.asRoute = false});

  final bool asRoute;

  @override
  State<StoresScreen> createState() => _StoresScreenState();
}

enum _StoreFilter { all, suppliers, vendors }

class _StoresScreenState extends State<StoresScreen> {
  Future<List<Seller>>? _future;
  final TextEditingController _controller = TextEditingController();
  _StoreFilter _filter = _StoreFilter.all;
  String _query = '';
  bool _sortByListings = false;
  List<Product> _products = const [];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _load();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<List<Seller>> _load({bool refresh = false}) async {
    final state = AppScope.read(context);
    final results = await Future.wait([
      state.vendors(refresh: refresh),
      state.products(refresh: refresh),
    ]);
    _products = results[1] as List<Product>;
    return [...(results[0] as List<Seller>), ...state.suppliers];
  }

  Future<void> _reload() async {
    setState(() {
      _future = _load(refresh: true);
    });
    await _future;
  }

  int _listingsFor(Seller seller) =>
      _products.where((product) => product.sellerId == seller.id).length;

  List<Seller> _visible(List<Seller> sellers) {
    final term = _query.trim().toLowerCase();
    final filtered = sellers.where((seller) {
      final matchesRole = switch (_filter) {
        _StoreFilter.all => true,
        _StoreFilter.suppliers => seller.role == 'supplier',
        _StoreFilter.vendors => seller.role == 'vendor',
      };
      final matchesTerm =
          term.isEmpty ||
          seller.name.toLowerCase().contains(term) ||
          seller.detail.toLowerCase().contains(term) ||
          seller.city.toLowerCase().contains(term) ||
          seller.region.toLowerCase().contains(term);
      return matchesRole && matchesTerm;
    }).toList();
    if (_sortByListings) {
      filtered.sort((a, b) => _listingsFor(b).compareTo(_listingsFor(a)));
    } else {
      filtered.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    }
    return filtered;
  }

  Future<void> _openSort() async {
    final choice = await sfSheet<String>(
      context,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(color: Sf.line, borderRadius: BorderRadius.circular(4)),
              ),
            ),
            const SizedBox(height: 16),
            const Text('Sort stores', style: SfType.h2),
            const SizedBox(height: 12),
            SfTile(
              icon: Icons.sort_by_alpha_rounded,
              title: 'Store name (A–Z)',
              tint: !_sortByListings ? Sf.blueWash : Sf.soft,
              trailing: !_sortByListings
                  ? const Icon(Icons.check_circle_rounded, color: Sf.blue, size: 20)
                  : null,
              onTap: () => Navigator.of(context).pop('name'),
            ),
            SfTile(
              icon: Icons.inventory_2_rounded,
              title: 'Most listings',
              tint: _sortByListings ? Sf.blueWash : Sf.soft,
              trailing: _sortByListings
                  ? const Icon(Icons.check_circle_rounded, color: Sf.blue, size: 20)
                  : null,
              onTap: () => Navigator.of(context).pop('listings'),
            ),
          ],
        ),
      ),
    );
    if (choice == null) return;
    setState(() => _sortByListings = choice == 'listings');
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
                          'Stores',
                          style: SfType.display.copyWith(fontSize: 29, letterSpacing: -1.1),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          'Shop from your favourite stores',
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
                hint: 'Search stores…',
                height: 52,
                controller: _controller,
                onChanged: (value) => setState(() => _query = value),
                onClear: _query.isEmpty
                    ? null
                    : () {
                        _controller.clear();
                        setState(() => _query = '');
                      },
                onFilter: _openSort,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 38,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  for (final filter in _StoreFilter.values) ...[
                    _StoreChip(
                      label: switch (filter) {
                        _StoreFilter.all => 'All Stores',
                        _StoreFilter.suppliers => 'Suppliers',
                        _StoreFilter.vendors => 'Vendors',
                      },
                      selected: _filter == filter,
                      onTap: () => setState(() => _filter = filter),
                    ),
                    const SizedBox(width: 8),
                  ],
                ],
              ),
            ),
            Expanded(
              child: FutureBuilder<List<Seller>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return ListView(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                      children: const [
                        SfShimmer(height: 132, radius: 20),
                        SizedBox(height: 12),
                        SfShimmer(height: 132, radius: 20),
                        SizedBox(height: 12),
                        SfShimmer(height: 132, radius: 20),
                      ],
                    );
                  }
                  if (snapshot.hasError) {
                    return ListView(
                      padding: const EdgeInsets.fromLTRB(16, 30, 16, 24),
                      children: [
                        SfEmpty(
                          icon: Icons.wifi_off_rounded,
                          title: 'Stores are unavailable',
                          message: 'Check your connection and try again.',
                          action: SfButton(
                            label: 'Retry',
                            variant: SfButtonVariant.outline,
                            onPressed: _reload,
                          ),
                        ),
                      ],
                    );
                  }
                  final sellers = _visible(snapshot.data ?? const []);
                  return RefreshIndicator(
                    onRefresh: _reload,
                    color: Sf.blue,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                      physics: const AlwaysScrollableScrollPhysics(),
                      itemCount: sellers.isEmpty ? 1 : sellers.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        if (sellers.isEmpty) {
                          return Padding(
                            padding: const EdgeInsets.only(top: 40),
                            child: SfEmpty(
                              icon: Icons.storefront_rounded,
                              title: _query.isEmpty ? 'No stores yet' : 'No store matches “$_query”',
                              message: _query.isEmpty
                                  ? 'Approved sellers appear here as soon as they join.'
                                  : 'Try another name, city or filter.',
                            ),
                          );
                        }
                        final seller = sellers[index];
                        return _StoreCard(
                          seller: seller,
                          listings: _listingsFor(seller),
                          onTap: () => Navigator.of(
                            context,
                          ).push(sfRoute(StoreScreen(seller: seller))),
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

class _StoreChip extends StatelessWidget {
  const _StoreChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? Sf.blue : Sf.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? Sf.blue : Sf.line),
        ),
        child: Text(
          label,
          style: SfType.body.copyWith(
            fontSize: 12.5,
            fontWeight: FontWeight.w800,
            color: selected ? Sf.white : Sf.ink,
          ),
        ),
      ),
    );
  }
}

class _StoreCard extends StatelessWidget {
  const _StoreCard({required this.seller, required this.listings, required this.onTap});

  final Seller seller;
  final int listings;
  final VoidCallback onTap;

  String get _roleLabel => seller.role == 'vendor' ? 'Vendor' : 'Supplier';

  @override
  Widget build(BuildContext context) {
    final location = seller.detail.trim().isNotEmpty
        ? seller.detail
        : [seller.city, seller.region].where((part) => part.trim().isNotEmpty).join(', ');
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: Sf.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Sf.line),
          boxShadow: Sf.cardShadow,
        ),
        child: Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 78,
                  height: 78,
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: Sf.soft,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Sf.line),
                  ),
                  child: SfSellerLogo(seller: seller, size: 64, radius: 10),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    seller.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: SfType.h3.copyWith(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.verified_rounded, size: 15, color: Sf.blue),
                              ],
                            ),
                          ),
                          InkWell(
                            onTap: onTap,
                            borderRadius: BorderRadius.circular(18),
                            child: Container(
                              height: 32,
                              padding: const EdgeInsets.symmetric(horizontal: 11),
                              decoration: BoxDecoration(
                                color: Sf.blueWash,
                                borderRadius: BorderRadius.circular(18),
                              ),
                              child: Row(
                                children: [
                                  Text(
                                    'Visit Store',
                                    style: SfType.body.copyWith(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w800,
                                      color: Sf.blue,
                                    ),
                                  ),
                                  const SizedBox(width: 3),
                                  const Icon(
                                    Icons.arrow_forward_rounded,
                                    size: 14,
                                    color: Sf.blue,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        location.isEmpty ? '$_roleLabel on Sure Foodz' : location,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: SfType.bodyMuted.copyWith(fontSize: 12),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          const Icon(Icons.inventory_2_outlined, size: 13, color: Sf.muted),
                          const SizedBox(width: 4),
                          Text(
                            listings == 1 ? '1 listing' : '$listings listings',
                            style: SfType.caption.copyWith(fontSize: 11.5),
                          ),
                          Container(
                            margin: const EdgeInsets.symmetric(horizontal: 7),
                            width: 3,
                            height: 3,
                            decoration: const BoxDecoration(
                              color: Sf.muted,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const Icon(Icons.storefront_rounded, size: 13, color: Sf.muted),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              _roleLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: SfType.caption.copyWith(fontSize: 11.5),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (seller.badge.trim().isNotEmpty) ...[
              const SizedBox(height: 11),
              Container(
                height: 34,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  color: Sf.yellowWash,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.workspace_premium_rounded, size: 15, color: Sf.orange),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        seller.badge,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: SfType.body.copyWith(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: Sf.ink,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
