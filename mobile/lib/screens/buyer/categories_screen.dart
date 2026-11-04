import 'package:flutter/material.dart';

import '../../api.dart';
import '../../categories.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import 'category_screen.dart';
import 'search_screen.dart';

class CategoriesRoute extends StatelessWidget {
  const CategoriesRoute({super.key});

  @override
  Widget build(BuildContext context) => const CategoriesScreen(asRoute: true);
}

class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key, this.asRoute = false});

  final bool asRoute;

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen> {
  Future<(List<Category>, List<Product>)>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= _load();
  }

  Future<(List<Category>, List<Product>)> _load({bool refresh = false}) async {
    final state = AppScope.read(context);
    final results = await Future.wait([
      state.categories(refresh: refresh),
      state.products(refresh: refresh),
    ]);
    return (results[0] as List<Category>, results[1] as List<Product>);
  }

  int _count(List<Product> products, Category category) => products
      .where((product) => product.category.toLowerCase() == category.name.toLowerCase())
      .length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Sf.white,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 6, 12, 4),
              child: Row(
                children: [
                  if (widget.asRoute)
                    SfIconButton(
                      icon: Icons.arrow_back_rounded,
                      onPressed: () => Navigator.of(context).maybePop(),
                    )
                  else
                    const SizedBox(width: 6),
                  const SizedBox(width: 2),
                  Expanded(
                    child: Text('Categories', style: SfType.h1.copyWith(fontSize: 22)),
                  ),
                  SfIconButton(
                    icon: Icons.search_rounded,
                    filled: true,
                    onPressed: () => Navigator.of(context).push(sfRoute(const SearchScreen())),
                  ),
                ],
              ),
            ),
            Expanded(
              child: FutureBuilder<(List<Category>, List<Product>)>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Padding(
                      padding: EdgeInsets.all(Sf.gutter),
                      child: SfListSkeleton(count: 6, height: 72),
                    );
                  }
                  if (snapshot.hasError) {
                    return SfEmpty(
                      icon: Icons.cloud_off_rounded,
                      title: 'Categories unavailable',
                      message: 'Pull the market back online and try again.',
                      action: SfButton(
                        label: 'Reload',
                        expanded: false,
                        onPressed: () => setState(() {
  _future = _load(refresh: true);
}),
                      ),
                    );
                  }
                  final (categories, products) = snapshot.data!;
                  if (categories.isEmpty) {
                    return const SfEmpty(
                      icon: Icons.category_outlined,
                      title: 'No categories yet',
                      message: 'Approved sellers have not published categories yet.',
                    );
                  }
                  final active = categories.where((c) => _count(products, c) > 0).toList();
                  return ListView(
                    padding: const EdgeInsets.fromLTRB(Sf.gutter, 8, Sf.gutter, 24),
                    children: [
                      _PromoBanner(count: categories.length, products: products.length),
                      const SizedBox(height: 18),
                      if (active.isNotEmpty) ...[
                        SfSectionHeader(
                          title: 'Shop now',
                          subtitle: 'Categories with live listings',
                          padding: const EdgeInsets.only(bottom: 10),
                        ),
                        _CategoryGrid(
                          categories: active,
                          products: products,
                          highlight: true,
                        ),
                        const SizedBox(height: 20),
                      ],
                      SfSectionHeader(
                        title: 'All categories',
                        subtitle: '${categories.length} aisles in the market',
                        padding: const EdgeInsets.only(bottom: 10),
                      ),
                      _CategoryGrid(categories: categories, products: products),
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

class _PromoBanner extends StatelessWidget {
  const _PromoBanner({required this.count, required this.products});

  final int count;
  final int products;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: Sf.gradientBlue,
        borderRadius: BorderRadius.circular(22),
      ),
      padding: const EdgeInsets.fromLTRB(16, 16, 8, 16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'THE WHOLE MARKET',
                  style: SfType.micro.copyWith(color: Sf.yellow, letterSpacing: 1.2, fontSize: 9.5),
                ),
                const SizedBox(height: 6),
                Text(
                  '$count categories.\n$products live listings.',
                  style: SfType.h2.copyWith(color: Sf.white, height: 1.18, fontSize: 18),
                ),
                const SizedBox(height: 6),
                Text(
                  'Straight from verified sellers.',
                  style: SfType.caption.copyWith(color: Sf.white.withValues(alpha: 0.85), fontSize: 11),
                ),
              ],
            ),
          ),
          Image.asset('assets/images/promo-seasonal.png', width: 96, fit: BoxFit.contain),
        ],
      ),
    );
  }
}

class _CategoryGrid extends StatelessWidget {
  const _CategoryGrid({
    required this.categories,
    required this.products,
    this.highlight = false,
  });

  final List<Category> categories;
  final List<Product> products;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 11,
        crossAxisSpacing: 11,
        childAspectRatio: 1.32,
      ),
      itemCount: categories.length,
      itemBuilder: (context, index) {
        final category = categories[index];
        final tint = categoryTint(category.name);
        final count = products
            .where((product) => product.category.toLowerCase() == category.name.toLowerCase())
            .length;
        return GestureDetector(
          onTap: () => Navigator.of(context).push(
            sfRoute(CategoryScreen(category: category, products: products)),
          ),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: highlight ? tint.withValues(alpha: 0.09) : Sf.soft,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: highlight ? tint.withValues(alpha: 0.22) : Sf.line,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: Sf.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: Sf.cardShadow,
                  ),
                  child: Icon(categoryIcon(category.name), size: 20, color: tint),
                ),
                const Spacer(),
                Text(
                  category.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SfType.h3.copyWith(fontSize: 13.5),
                ),
                const SizedBox(height: 2),
                Text(
                  count == 0 ? 'No listings yet' : '$count listing${count == 1 ? '' : 's'}',
                  style: SfType.caption.copyWith(fontSize: 10.5),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
