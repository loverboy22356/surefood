import 'package:flutter/material.dart';

import '../../api.dart';
import '../../theme.dart';
import '../../ui.dart';
import 'order_track_screen.dart';

class OrderSuccessScreen extends StatefulWidget {
  const OrderSuccessScreen({super.key, required this.orders});

  final List<Order> orders;

  @override
  State<OrderSuccessScreen> createState() => _OrderSuccessScreenState();
}

class _OrderSuccessScreenState extends State<OrderSuccessScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 720),
  )..forward();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.orders.fold<int>(0, (sum, order) => sum + order.totalMinor);
    final scale = CurvedAnimation(parent: _controller, curve: Curves.elasticOut);
    return Scaffold(
      backgroundColor: Sf.white,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(Sf.gutter, 30, Sf.gutter, 20),
                children: [
                  Center(
                    child: ScaleTransition(
                      scale: scale,
                      child: Container(
                        width: 96,
                        height: 96,
                        decoration: const BoxDecoration(
                          color: Sf.greenWash,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.check_circle_rounded,
                          size: 54,
                          color: Sf.green,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Order placed!',
                    textAlign: TextAlign.center,
                    style: SfType.display.copyWith(fontSize: 28),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Your sellers have been notified. You can follow every step from '
                    'your orders until it reaches your door.',
                    textAlign: TextAlign.center,
                    style: SfType.bodyMuted.copyWith(height: 1.5),
                  ),
                  const SizedBox(height: 22),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Sf.soft,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      children: [
                        for (final order in widget.orders) ...[
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Sf.white,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '#${order.id.length > 8 ? order.id.substring(0, 8).toUpperCase() : order.id.toUpperCase()}',
                                  style: SfType.caption.copyWith(
                                    color: Sf.ink,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  order.status,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: SfType.caption.copyWith(fontSize: 11),
                                ),
                              ),
                              Text(
                                naira(order.totalMinor),
                                style: SfType.price.copyWith(fontSize: 14),
                              ),
                            ],
                          ),
                          if (order != widget.orders.last) const Divider(height: 18),
                        ],
                        const Divider(height: 18),
                        Row(
                          children: [
                            Text('Paid on delivery', style: SfType.caption),
                            const Spacer(),
                            Text(
                              naira(total),
                              style: SfType.price.copyWith(fontSize: 16, color: Sf.blue),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  _NextStep(
                    icon: Icons.storefront_rounded,
                    title: 'Seller confirms',
                    body: 'Each seller confirms stock and packs your items.',
                  ),
                  _NextStep(
                    icon: Icons.delivery_dining_rounded,
                    title: 'Rider heads out',
                    body: 'You get a call when your order is on the way.',
                    last: true,
                  ),
                ],
              ),
            ),
            SfBottomBar(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SfButton(
                    label: 'Track my order',
                    icon: Icons.local_shipping_rounded,
                    onPressed: () {
                      if (widget.orders.isEmpty) return;
                      Navigator.of(context).pushReplacement(
                        sfRoute(OrderTrackScreen(order: widget.orders.first)),
                      );
                    },
                  ),
                  const SizedBox(height: 8),
                  SfButton(
                    label: 'Continue shopping',
                    variant: SfButtonVariant.outline,
                    onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
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

class _NextStep extends StatelessWidget {
  const _NextStep({
    required this.icon,
    required this.title,
    required this.body,
    this.last = false,
  });

  final IconData icon;
  final String title;
  final String body;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: Sf.blueWash,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, size: 17, color: Sf.blue),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: SfType.h3.copyWith(fontSize: 13)),
                const SizedBox(height: 1),
                Text(body, style: SfType.caption.copyWith(height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
