import 'package:flutter/material.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';
import 'order_track_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  Future<List<Order>>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (AppScope.read(context).signedIn) {
      _future ??= AppScope.read(context).api.orders();
    }
  }

  Future<void> _refresh() async {
    if (!AppScope.read(context).signedIn) return;
    setState(() {
  _future = AppScope.read(context).api.orders();
});
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return Scaffold(
      backgroundColor: Sf.white,
      appBar: AppBar(
        title: const Text('My orders'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _refresh,
          ),
        ],
      ),
      body: !state.signedIn
          ? SfEmpty(
              icon: Icons.receipt_long_rounded,
              title: 'Sign in to see your orders',
              message: 'Your order history, delivery status and receipts live in your account.',
              action: SfButton(
                label: 'Sign in',
                expanded: false,
                onPressed: () async {
                  final ok = await ensureSignedIn(context, reason: 'Sign in to view your orders');
                  if (ok && context.mounted) {
                    setState(() {
  _future = AppScope.read(context).api.orders();
});
                  }
                },
              ),
            )
          : FutureBuilder<List<Order>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.all(Sf.gutter),
                    child: SfListSkeleton(count: 4, height: 64),
                  );
                }
                if (snapshot.hasError) {
                  return SfEmpty(
                    icon: Icons.cloud_off_rounded,
                    title: 'Orders are unavailable',
                    message: 'Check your connection and try again.',
                    action: SfButton(label: 'Retry', expanded: false, onPressed: _refresh),
                  );
                }
                final orders = snapshot.data ?? const <Order>[];
                if (orders.isEmpty) {
                  return const SfEmpty(
                    icon: Icons.shopping_bag_outlined,
                    title: 'No orders yet',
                    message: 'When you place your first order it will appear here with live tracking.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: _refresh,
                  color: Sf.blue,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(Sf.gutter, 14, Sf.gutter, 26),
                    itemCount: orders.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) => _OrderCard(order: orders[index]),
                  ),
                );
              },
            ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final delivered = order.delivered;
    final cancelled = order.status.toLowerCase().contains('cancel');
    final tint = delivered ? Sf.green : (cancelled ? Sf.orange : Sf.blue);
    return GestureDetector(
      onTap: () => Navigator.of(context).push(sfRoute(OrderTrackScreen(order: order))),
      child: Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: Sf.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Sf.line),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: tint.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    order.status.toUpperCase(),
                    style: SfType.caption.copyWith(
                      color: tint,
                      fontWeight: FontWeight.w800,
                      fontSize: 9.5,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  order.createdAt == null ? '' : _relative(order.createdAt!),
                  style: SfType.caption.copyWith(fontSize: 10.5),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.lines.isEmpty
                            ? 'Order #${order.id.substring(0, 8).toUpperCase()}'
                            : order.lines.map((line) => line.name).take(2).join(', '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: SfType.h3.copyWith(fontSize: 13.5),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${order.lines.fold<int>(0, (sum, line) => sum + line.quantity)} item(s)'
                        '${order.sellerName.isEmpty ? '' : ' · ${order.sellerName}'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: SfType.caption.copyWith(fontSize: 10.5),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      naira(order.totalMinor),
                      style: SfType.price.copyWith(fontSize: 15),
                    ),
                    const SizedBox(height: 2),
                    const Icon(Icons.chevron_right_rounded, size: 18, color: Sf.muted),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: order.progress,
                minHeight: 4,
                backgroundColor: Sf.soft,
                valueColor: AlwaysStoppedAnimation(tint),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _relative(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${date.day}/${date.month}/${date.year}';
  }
}
