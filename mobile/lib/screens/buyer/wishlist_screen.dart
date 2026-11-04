import 'package:flutter/material.dart';

import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';
import 'cart_screen.dart';
import 'product_screen.dart';

class WishlistScreen extends StatelessWidget {
  const WishlistScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final items = state.wishlist;
    return Scaffold(
      backgroundColor: Sf.white,
      appBar: AppBar(
        title: Text(items.isEmpty ? 'Wishlist' : 'Wishlist · ${items.length}'),
      ),
      body: !state.signedIn
          ? SfEmpty(
              icon: Icons.favorite_border_rounded,
              title: 'Sign in to save favourites',
              message: 'Keep the products you love in one place and pick up where you left off.',
              action: SfButton(
                label: 'Sign in',
                expanded: false,
                onPressed: () => ensureSignedIn(context, reason: 'Sign in to save favourites'),
              ),
            )
          : items.isEmpty
          ? const SfEmpty(
              icon: Icons.favorite_border_rounded,
              title: 'Nothing saved yet',
              message: 'Tap the heart on any product to keep it here for later.',
            )
          : GridView.builder(
              padding: const EdgeInsets.fromLTRB(Sf.gutter, 14, Sf.gutter, 24),
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
                  wishlisted: true,
                  onWishlist: () {
                    AppScope.read(context).toggleWishlist(product);
                    SfToast.show(
                      context,
                      'Removed from favourites',
                      icon: Icons.favorite_border_rounded,
                      color: Sf.muted,
                      actionLabel: 'Undo',
                      onAction: () => AppScope.read(context).toggleWishlist(product),
                    );
                  },
                  onAdd: () async {
                    AppScope.read(context).addToCart(product);
                    SfToast.show(
                      context,
                      '${product.name} added to cart',
                      icon: Icons.shopping_bag_rounded,
                      actionLabel: 'View',
                      onAction: () => Navigator.of(context).push(sfRoute(const CartScreen())),
                    );
                  },
                );
              },
            ),
    );
  }
}
