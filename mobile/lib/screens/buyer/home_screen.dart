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
import 'categories_screen.dart';
import 'category_screen.dart';
import 'deals_screen.dart';
import 'notifications_screen.dart';
import 'product_screen.dart';
import 'search_screen.dart';
import 'store_screen.dart';
import 'stores_screen.dart';

class _HomeData {
  const _HomeData({required this.products, required this.categories, required this.sellers});

  final List<Product> products;
  final List<Category> categories;
  final List<Seller> sellers;
}

/// One promo slide in the hero carousel.
class _Slide {
  const _Slide({
    required this.eyebrow,
    required this.headline,
    required this.caption,
    required this.image,
    required this.action,
    required this.onTap,
    this.tint = Sf.blueWash,
  });

  final String eyebrow;
  final String headline;
  final String caption;
  final String image;
  final String action;
  final VoidCallback onTap;
  final Color tint;
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.onOpenSearch});

  /// Lets the shell switch to its own search tab instead of pushing a route.
  final VoidCallback? onOpenSearch;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Future<_HomeData>? _future;
  final PageController _pages = PageController();
  final ScrollController _scroll = ScrollController(
    initialScrollOffset: const int.fromEnvironment('SF_SCROLL').toDouble(),
  );
  Timer? _autoplay;
  int _page = 0;
  int _slideCount = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _load();
  }

  @override
  void dispose() {
    _autoplay?.cancel();
    _pages.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<_HomeData> _load({bool refresh = false}) async {
    final state = AppScope.read(context);
    final results = await Future.wait([
      state.products(refresh: refresh),
      state.categories(refresh: refresh),
      state.vendors(refresh: refresh),
    ]);
    return _HomeData(
      products: results[0] as List<Product>,
      categories: results[1] as List<Category>,
      sellers: [...(results[2] as List<Seller>), ...state.suppliers],
    );
  }

  Future<void> _reload() async {
    setState(() {
      _future = _load(refresh: true);
    });
    await _future;
  }

  Future<void> _addToCart(Product product) async {
    final ok = await ensureSignedIn(
      context,
      reason: 'Sign in to add ${product.name} to your cart',
    );
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

  void _openProduct(Product product) {
    Navigator.of(context).push(sfRoute(ProductScreen(product: product)));
  }

  void _openSearch() {
    if (widget.onOpenSearch != null) {
      widget.onOpenSearch!();
      return;
    }
    Navigator.of(context).push(sfRoute(const SearchScreen()));
  }

  void _openCart() => Navigator.of(context).push(sfRoute(const CartScreen()));

  Future<void> _openAccount(Profile? profile, bool signedIn) async {
    if (signedIn) return;
    await ensureSignedIn(context, reason: 'Sign in to your Sure Foodz account');
  }

  List<_Slide> _slides(List<Product> products) {
    final deals = products.where((p) => p.discounted).toList()
      ..sort((a, b) => b.discountPercent.compareTo(a.discountPercent));
    final slides = <_Slide>[
      for (final product in deals.take(3))
        _Slide(
          eyebrow: product.category.isEmpty ? 'Market offer' : '${product.category} offer',
          headline: '${product.discountPercent}% OFF',
          caption: product.name,
          image: product.imageUrl,
          action: 'Get Now',
          onTap: () => _openProduct(product),
          tint: Sf.yellowWash,
        ),
    ];
    if (slides.length < 3) {
      slides.add(
        _Slide(
          eyebrow: 'Farm fresh',
          headline: 'Same-day',
          caption: 'Order before noon, delivered today',
          image: '',
          action: 'Shop now',
          onTap: () => Navigator.of(context).push(sfRoute(const CategoriesRoute())),
          tint: Sf.blueWash,
        ),
      );
    }
    if (slides.length < 3) {
      slides.add(
        _Slide(
          eyebrow: 'Verified sellers',
          headline: 'Fair prices',
          caption: 'Every price is set by the seller',
          image: '',
          action: 'Browse deals',
          onTap: () => Navigator.of(context).push(sfRoute(const DealsScreen())),
          tint: Sf.orangeWash,
        ),
      );
    }
    return slides;
  }

  void _startAutoplay(int count) {
    if (_slideCount == count && _autoplay != null) return;
    _slideCount = count;
    _autoplay?.cancel();
    if (count < 2) return;
    _autoplay = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_pages.hasClients) return;
      final next = (_page + 1) % _slideCount;
      _pages.animateToPage(
        next,
        duration: const Duration(milliseconds: 520),
        curve: Curves.easeInOutCubic,
      );
    });
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
            _HomeHeader(
              name: state.signedIn ? state.displayName : 'Guest shopper',
              area: state.area,
              signedIn: state.signedIn,
              cartCount: state.cartCount,
              onProfile: () => _openAccount(state.profile, state.signedIn),
              onCart: _openCart,
              onBell: () => Navigator.of(context).push(sfRoute(const NotificationsScreen())),
              onArea: () => _pickArea(state),
            ),
            Expanded(
              child: FutureBuilder<_HomeData>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return _HomeSkeleton(onSearch: _openSearch);
                  }
                  if (snapshot.hasError) {
                    return RefreshIndicator(
                      onRefresh: _reload,
                      color: Sf.blue,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(Sf.gutter, 10, Sf.gutter, 24),
                        children: [
                          SfEmpty(
                            icon: Icons.wifi_off_rounded,
                            title: 'We could not load the market',
                            message: 'Check your connection and pull down to try again.',
                            action: SfButton(
                              label: 'Try again',
                              variant: SfButtonVariant.outline,
                              onPressed: _reload,
                            ),
                          ),
                        ],
                      ),
                    );
                  }
                  final data = snapshot.data!;
                  final slides = _slides(data.products);
                  _startAutoplay(slides.length);
                  return RefreshIndicator(
                    onRefresh: _reload,
                    color: Sf.blue,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final width = constraints.maxWidth - Sf.gutter * 2;
                        final cardWidth = (width - 12) / 2;
                        return ListView(
                          controller: _scroll,
                          padding: const EdgeInsets.only(bottom: 26),
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(
                                Sf.gutter,
                                6,
                                Sf.gutter,
                                14,
                              ),
                              child: SfPillField(
                                hint: 'What would you like to eat today?',
                                readOnly: true,
                                onTap: _openSearch,
                                onFilter: _openSearch,
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: Sf.gutter),
                              child: _HeroCarousel(
                                slides: slides,
                                controller: _pages,
                                index: _page,
                                onChanged: (value) => setState(() => _page = value),
                              ),
                            ),
                            const SizedBox(height: 18),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: Sf.gutter),
                              child: _CategoryPanel(
                                categories: data.categories,
                                onOpen: (category) => Navigator.of(
                                  context,
                                ).push(sfRoute(CategoryScreen(category: category))),
                                onAll: () => Navigator.of(
                                  context,
                                ).push(sfRoute(const CategoriesRoute())),
                              ),
                            ),
                            if (data.sellers.isNotEmpty) ...[
                              const SizedBox(height: 22),
                              SfSectionTitle(
                                title: 'Top Grocery Stores',
                                onAction: () => Navigator.of(
                                  context,
                                ).push(sfRoute(const StoresRoute())),
                              ),
                              const SizedBox(height: 12),
                              SizedBox(
                                height: 98,
                                child: ListView.separated(
                                  scrollDirection: Axis.horizontal,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: Sf.gutter,
                                  ),
                                  itemCount: data.sellers.length,
                                  separatorBuilder: (_, _) => const SizedBox(width: 14),
                                  itemBuilder: (context, index) {
                                    final seller = data.sellers[index];
                                    return _SellerBubble(
                                      seller: seller,
                                      onTap: () => Navigator.of(
                                        context,
                                      ).push(sfRoute(StoreScreen(seller: seller))),
                                    );
                                  },
                                ),
                              ),
                            ],
                            const SizedBox(height: 20),
                            SfSectionTitle(
                              title: 'Fresh picks for you',
                              onAction: () => Navigator.of(
                                context,
                              ).push(sfRoute(const DealsScreen())),
                            ),
                            const SizedBox(height: 12),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: Sf.gutter),
                              child: Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  for (final product in data.products)
                                    SizedBox(
                                      width: cardWidth,
                                      child: SfCatalogCard(
                                        product: product,
                                        onTap: () => _openProduct(product),
                                        onAdd: () => _addToCart(product),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
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

  Future<void> _pickArea(AppState state) async {
    final choice = await sfSheet<String>(
      context,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: Sf.line,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text('Where should we deliver?', style: SfType.h2),
            const SizedBox(height: 4),
            Text('Sellers near this area are shown first.', style: SfType.bodyMuted),
            const SizedBox(height: 14),
            for (final area in const ['Nigeria', 'Lagos', 'Abuja', 'Port Harcourt', 'Ibadan'])
              SfTile(
                icon: Icons.place_rounded,
                title: area,
                tint: area == state.area ? Sf.blueWash : Sf.soft,
                trailing: area == state.area
                    ? const Icon(Icons.check_circle_rounded, color: Sf.blue, size: 20)
                    : null,
                onTap: () => Navigator.of(context).pop(area),
              ),
          ],
        ),
      ),
    );
    if (choice != null) state.setArea(choice);
  }
}

/* ------------------------------------------------------------------ header */

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({
    required this.name,
    required this.area,
    required this.signedIn,
    required this.cartCount,
    required this.onProfile,
    required this.onCart,
    required this.onBell,
    required this.onArea,
  });

  final String name;
  final String area;
  final bool signedIn;
  final int cartCount;
  final VoidCallback onProfile;
  final VoidCallback onCart;
  final VoidCallback onBell;
  final VoidCallback onArea;

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().isEmpty
        ? 'SF'
        : name
              .trim()
              .split(RegExp(r'\s+'))
              .take(2)
              .map((part) => part.characters.first.toUpperCase())
              .join();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(
        children: [
          InkResponse(
            onTap: onProfile,
            radius: 30,
            child: SizedBox(
              width: 48,
              height: 48,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: const BoxDecoration(
                      gradient: Sf.gradientBlue,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      initials,
                      style: const TextStyle(
                        color: Sf.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                  Positioned(
                    right: 0,
                    bottom: 1,
                    child: Container(
                      width: 13,
                      height: 13,
                      decoration: BoxDecoration(
                        color: signedIn ? Sf.blue : Sf.white,
                        shape: BoxShape.circle,
                        border: Border.all(color: Sf.white, width: 2.4),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: SfType.h3.copyWith(fontSize: 15.5, fontWeight: FontWeight.w800),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(
                      signedIn ? Icons.verified_rounded : Icons.person_outline_rounded,
                      size: 15,
                      color: Sf.blue,
                    ),
                  ],
                ),
                const SizedBox(height: 1),
                InkWell(
                  onTap: onArea,
                  borderRadius: BorderRadius.circular(6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.place_rounded, size: 13, color: Sf.muted),
                      const SizedBox(width: 3),
                      Flexible(
                        child: Text(
                          'Deliver to $area',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: SfType.caption.copyWith(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: Sf.muted),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SfCircleAction(
            icon: Icons.shopping_bag_outlined,
            tooltip: 'Cart',
            badge: cartCount,
            onPressed: onCart,
          ),
          const SizedBox(width: 9),
          SfCircleAction(
            icon: Icons.notifications_none_rounded,
            tooltip: 'Notifications',
            onPressed: onBell,
          ),
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------ carousel */

class _HeroCarousel extends StatelessWidget {
  const _HeroCarousel({
    required this.slides,
    required this.controller,
    required this.index,
    required this.onChanged,
  });

  final List<_Slide> slides;
  final PageController controller;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 166,
      child: Stack(
        children: [
          PageView.builder(
            controller: controller,
            itemCount: slides.length,
            onPageChanged: onChanged,
            itemBuilder: (context, i) => Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _BannerCard(slide: slides[i]),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Center(
              child: Container(
                height: 22,
                padding: const EdgeInsets.symmetric(horizontal: 7),
                decoration: BoxDecoration(
                  color: Sf.white,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: Sf.line),
                  boxShadow: Sf.cardShadow,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < slides.length; i++)
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        margin: const EdgeInsets.symmetric(horizontal: 2.5),
                        width: i == index ? 8 : 6,
                        height: i == index ? 8 : 6,
                        decoration: BoxDecoration(
                          color: i == index ? Sf.blue : Sf.line,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BannerCard extends StatelessWidget {
  const _BannerCard({required this.slide});

  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: slide.onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: Row(
          children: [
            Expanded(
              flex: 47,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [slide.tint, Sf.white],
                  ),
                ),
                padding: const EdgeInsets.fromLTRB(16, 14, 8, 16),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      slide.eyebrow,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: SfType.body.copyWith(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: Sf.orange,
                      ),
                    ),
                    const SizedBox(height: 4),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        slide.headline,
                        style: SfType.display.copyWith(fontSize: 27, letterSpacing: -1.3),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      slide.caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: SfType.caption.copyWith(fontSize: 11.5),
                    ),
                    const SizedBox(height: 10),
                    Container(
                      height: 33,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: Sf.orange,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: Sf.orange.withValues(alpha: 0.3),
                            blurRadius: 12,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        slide.action,
                        style: SfType.button.copyWith(fontSize: 12.5, color: Sf.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              flex: 53,
              child: slide.image.isEmpty
                  ? Container(
                      decoration: const BoxDecoration(gradient: Sf.gradientBlue),
                      alignment: Alignment.center,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Image.asset(
                          'assets/images/logo-full.png',
                          fit: BoxFit.contain,
                          errorBuilder: (_, _, _) => const Icon(
                            Icons.shopping_basket_rounded,
                            color: Sf.white,
                            size: 44,
                          ),
                        ),
                      ),
                    )
                  : SfImage(
                      slide.image,
                      fit: BoxFit.cover,
                      radius: 0,
                      background: Sf.soft,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/* ----------------------------------------------------------------- categories */

class _CategoryPanel extends StatelessWidget {
  const _CategoryPanel({
    required this.categories,
    required this.onOpen,
    required this.onAll,
  });

  final List<Category> categories;
  final ValueChanged<Category> onOpen;
  final VoidCallback onAll;

  @override
  Widget build(BuildContext context) {
    final shown = categories.take(5).toList();
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
      decoration: BoxDecoration(
        color: Sf.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Sf.line),
        boxShadow: Sf.cardShadow,
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final category in shown)
                Expanded(
                  child: _MiniCategory(
                    category: category,
                    onTap: () => onOpen(category),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          InkWell(
            onTap: onAll,
            borderRadius: BorderRadius.circular(22),
            child: Container(
              height: 42,
              decoration: BoxDecoration(
                color: Sf.soft,
                borderRadius: BorderRadius.circular(22),
              ),
              alignment: Alignment.center,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.grid_view_rounded, size: 16, color: Sf.blue),
                  const SizedBox(width: 8),
                  Text(
                    'View More Categories',
                    style: SfType.body.copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: Sf.blue,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MiniCategory extends StatelessWidget {
  const _MiniCategory({required this.category, required this.onTap});

  final Category category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tint = categoryTint(category.name);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: tint.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(categoryIcon(category.name), size: 26, color: tint),
            ),
            const SizedBox(height: 7),
            Text(
              category.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: SfType.caption.copyWith(
                fontSize: 11,
                color: Sf.ink,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/* -------------------------------------------------------------------- stores */

class _SellerBubble extends StatelessWidget {
  const _SellerBubble({required this.seller, required this.onTap});

  final Seller seller;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Column(
          children: [
            Container(
              width: 62,
              height: 62,
              decoration: BoxDecoration(
                color: Sf.white,
                shape: BoxShape.circle,
                border: Border.all(color: Sf.line),
                boxShadow: Sf.cardShadow,
              ),
              alignment: Alignment.center,
              child: SfSellerLogo(seller: seller, size: 44),
            ),
            const SizedBox(height: 6),
            Text(
              seller.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: SfType.caption.copyWith(
                fontSize: 11.5,
                color: Sf.ink,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------ skeleton */

class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton({required this.onSearch});

  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(Sf.gutter, 6, Sf.gutter, 14),
          child: SfPillField(
            hint: 'What would you like to eat today?',
            readOnly: true,
            onTap: onSearch,
            onFilter: onSearch,
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: Sf.gutter),
          child: SfShimmer(height: 162, radius: 22),
        ),
        const SizedBox(height: 18),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: Sf.gutter),
          child: SfShimmer(height: 148, radius: 22),
        ),
        const SizedBox(height: 20),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: Sf.gutter),
          child: SfShimmer(height: 22, radius: 8, width: 170),
        ),
        const SizedBox(height: 12),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: Sf.gutter),
          child: SfGridSkeleton(count: 4),
        ),
      ],
    );
  }
}
