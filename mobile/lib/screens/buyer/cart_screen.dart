import 'package:flutter/material.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';
import 'checkout_screen.dart';
import 'product_screen.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final canPop = Navigator.of(context).canPop();
    return Scaffold(
      backgroundColor: Sf.white,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(canPop ? 6 : Sf.gutter, 8, 12, 4),
              child: Row(
                children: [
                  if (canPop)
                    SfIconButton(
                      icon: Icons.arrow_back_rounded,
                      onPressed: () => Navigator.of(context).maybePop(),
                    ),
                  Expanded(
                    child: Text(
                      state.cartEmpty
                          ? 'Your cart'
                          : 'Cart · ${state.cartCount} item${state.cartCount == 1 ? '' : 's'}',
                      style: SfType.h1.copyWith(fontSize: 22),
                    ),
                  ),
                  if (!state.cartEmpty)
                    TextButton(
                      onPressed: () async {
                        final confirmed = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Clear cart?'),
                            content: const Text('This removes everything from your basket.'),
                            actions: [
                              TextButton(
                                onPressed: () => Navigator.of(context).pop(false),
                                child: const Text('Keep cart'),
                              ),
                              TextButton(
                                onPressed: () => Navigator.of(context).pop(true),
                                child: const Text('Clear'),
                              ),
                            ],
                          ),
                        );
                        if (confirmed == true) state.clearCart();
                      },
                      child: Text(
                        'Clear',
                        style: SfType.caption.copyWith(color: Sf.orange, fontWeight: FontWeight.w700),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: state.cartEmpty
                  ? _EmptyCart(canPop: canPop)
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(Sf.gutter, 6, Sf.gutter, 24),
                      children: [
                        _DeliveryCard(state: state),
                        const SizedBox(height: 14),
                        for (final line in state.cart) ...[
                          _CartLineTile(line: line),
                          const SizedBox(height: 10),
                        ],
                        const SizedBox(height: 6),
                        if (state.cartSavingsMinor > 0)
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Sf.greenWash,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.savings_rounded, size: 17, color: Sf.green),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'You are saving ${naira(state.cartSavingsMinor)} on this order',
                                    style: SfType.caption.copyWith(
                                      color: Sf.ink,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        const SizedBox(height: 16),
                        _Summary(state: state),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            const Icon(Icons.verified_user_rounded, size: 15, color: Sf.green),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Every seller is verified by Sure Foodz. Prices are set by the seller.',
                                style: SfType.caption.copyWith(fontSize: 10.5, height: 1.4),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
            ),
            if (!state.cartEmpty)
              SfBottomBar(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('Total', style: SfType.caption.copyWith(fontSize: 10.5)),
                          Text(
                            naira(state.cartTotalMinor),
                            style: SfType.price.copyWith(fontSize: 20),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: 190,
                      child: SfButton(
                        label: 'Checkout',
                        icon: Icons.arrow_forward_rounded,
                        onPressed: () async {
                          final ok = await ensureSignedIn(
                            context,
                            reason: 'Sign in to place your order',
                          );
                          if (!ok || !context.mounted) return;
                          Navigator.of(context).push(sfRoute(const CheckoutScreen()));
                        },
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

class _EmptyCart extends StatelessWidget {
  const _EmptyCart({required this.canPop});

  final bool canPop;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return ListView(
      children: [
        const SizedBox(height: 30),
        SfEmpty(
          icon: Icons.shopping_basket_outlined,
          title: 'Your basket is empty',
          message: state.signedIn
              ? 'Fresh picks are waiting. Add something from the market to get started.'
              : 'Browse the market freely — sign in only when you are ready to add to your cart.',
          action: SfButton(
            label: 'Start shopping',
            expanded: false,
            onPressed: () {
              if (canPop) {
                Navigator.of(context).maybePop();
              } else {
                Navigator.of(context).push(sfRoute(const _CartHint()));
              }
            },
          ),
        ),
      ],
    );
  }
}

class _CartHint extends StatelessWidget {
  const _CartHint();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Shopping')),
      body: const SfEmpty(
        icon: Icons.grid_view_rounded,
        title: 'Open the Home tab',
        message: 'Browse categories, deals and recommendations from the Home tab.',
      ),
    );
  }
}

class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final address = state.defaultAddress;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Sf.soft,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(color: Sf.white, shape: BoxShape.circle),
            child: const Icon(Icons.location_on_rounded, size: 18, color: Sf.blue),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  address?.label ?? 'Deliver to ${state.area}',
                  style: SfType.h3.copyWith(fontSize: 13),
                ),
                const SizedBox(height: 1),
                Text(
                  address?.line ?? 'Add your street address at checkout',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SfType.caption.copyWith(fontSize: 10.5),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, size: 18, color: Sf.muted),
        ],
      ),
    );
  }
}

class _CartLineTile extends StatelessWidget {
  const _CartLineTile({required this.line});

  final CartLine line;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final product = line.product;
    return Dismissible(
      key: ValueKey(product.id),
      direction: DismissDirection.endToStart,
      onDismissed: (_) {
        state.removeFromCart(product.id);
        SfToast.show(
          context,
          '${product.name} removed',
          icon: Icons.delete_outline_rounded,
          color: Sf.orange,
          actionLabel: 'Undo',
          onAction: () => AppScope.read(context).addToCart(product, quantity: line.quantity),
        );
      },
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 18),
        decoration: BoxDecoration(
          color: Sf.orangeWash,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.delete_outline_rounded, color: Sf.orange),
      ),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Sf.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Sf.line),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GestureDetector(
              onTap: () => Navigator.of(context).push(sfRoute(ProductScreen(product: product))),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 76,
                  height: 76,
                  child: SfImage(product.imageUrl),
                ),
              ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: SfType.body.copyWith(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      if (product.sellerVerified)
                        const Padding(
                          padding: EdgeInsets.only(right: 3),
                          child: Icon(Icons.verified_rounded, size: 11, color: Sf.blue),
                        ),
                      Expanded(
                        child: Text(
                          product.sellerName.isEmpty ? 'Sure Foodz seller' : product.sellerName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: SfType.caption.copyWith(fontSize: 10),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text(
                        naira(line.lineTotalMinor),
                        style: SfType.price.copyWith(fontSize: 15),
                      ),
                      if (product.discounted) ...[
                        const SizedBox(width: 5),
                        Text(
                          naira(product.compareAtMinor! * line.quantity),
                          style: SfType.caption.copyWith(
                            decoration: TextDecoration.lineThrough,
                            fontSize: 10,
                          ),
                        ),
                      ],
                      const Spacer(),
                      SfQty(
                        value: line.quantity,
                        compact: true,
                        max: product.stock.clamp(1, 99),
                        onChanged: (value) => state.setQuantity(product.id, value),
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

class _Summary extends StatelessWidget {
  const _Summary({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Sf.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Sf.line),
      ),
      child: Column(
        children: [
          _row('Subtotal (${state.cartCount} items)', naira(state.cartTotalMinor)),
          const SizedBox(height: 8),
          _row('Delivery', 'Confirmed by seller'),
          const Divider(height: 22),
          Row(
            children: [
              Text('Order total', style: SfType.h3.copyWith(fontSize: 14)),
              const Spacer(),
              Text(naira(state.cartTotalMinor), style: SfType.price.copyWith(fontSize: 18)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      children: [
        Text(label, style: SfType.caption),
        const Spacer(),
        Text(
          value,
          style: SfType.caption.copyWith(
            color: Sf.ink,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
