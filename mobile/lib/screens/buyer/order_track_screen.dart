import 'dart:async';

import 'package:flutter/material.dart';

import '../../api.dart';
import '../../theme.dart';

class OrderTrackScreen extends StatefulWidget {
  const OrderTrackScreen({super.key, required this.order});

  final Order order;

  @override
  State<OrderTrackScreen> createState() => _OrderTrackScreenState();
}

class _OrderTrackScreenState extends State<OrderTrackScreen> {
  late Order _order = widget.order;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _poll = Timer.periodic(const Duration(seconds: 30), (_) => _refresh());
  }

  Future<void> _refresh() async {
    if (!mounted) return;
    try {
      final fresh = await ApiClient.instance.order(_order.id);
      if (fresh != null && mounted) setState(() => _order = fresh);
    } on ApiException {
      // Keep the last known status when the network hiccups.
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  static const _steps = [
    ('Order placed', 'We received your order'),
    ('Seller confirmed', 'Stock checked and packed'),
    ('Out for delivery', 'A rider is on the way'),
    ('Delivered', 'Enjoy your groceries'),
  ];

  int get _stage {
    final status = _order.status.toLowerCase();
    if (status.contains('deliver') && status.contains('out')) return 2;
    if (status.contains('delivered')) return 3;
    if (status.contains('confirm') || status.contains('prepar') || status.contains('pack')) return 1;
    if (status.contains('cancel')) return 0;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final cancelled = _order.status.toLowerCase().contains('cancel');
    return Scaffold(
      backgroundColor: Sf.soft,
      appBar: AppBar(
        title: const Text('Track order'),
        backgroundColor: Sf.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _refresh,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        color: Sf.blue,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(Sf.gutter, 14, Sf.gutter, 28),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: cancelled ? null : Sf.gradientBlue,
                color: cancelled ? Sf.orangeWash : null,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Sf.white.withValues(alpha: 0.9),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '#${_order.id.length > 8 ? _order.id.substring(0, 8).toUpperCase() : _order.id.toUpperCase()}',
                          style: SfType.caption.copyWith(
                            color: Sf.ink,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Icon(
                        cancelled ? Icons.cancel_rounded : Icons.local_shipping_rounded,
                        color: cancelled ? Sf.orange : Sf.yellow,
                        size: 20,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    cancelled ? 'Order cancelled' : _order.status,
                    style: SfType.h2.copyWith(
                      color: cancelled ? Sf.ink : Sf.white,
                      fontSize: 18,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    cancelled
                        ? 'This order will not be delivered. Contact support for a refund status.'
                        : 'Estimated delivery within 24 hours of seller confirmation.',
                    style: SfType.caption.copyWith(
                      color: cancelled ? Sf.muted : Sf.white.withValues(alpha: 0.85),
                      height: 1.4,
                    ),
                  ),
                  if (!cancelled) ...[
                    const SizedBox(height: 14),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: LinearProgressIndicator(
                        value: _order.progress,
                        minHeight: 6,
                        backgroundColor: Sf.white.withValues(alpha: 0.25),
                        valueColor: const AlwaysStoppedAnimation(Sf.yellow),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
              decoration: BoxDecoration(
                color: Sf.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Sf.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Progress', style: SfType.h3),
                  const SizedBox(height: 12),
                  for (var i = 0; i < _steps.length; i++)
                    _StepRow(
                      title: _steps[i].$1,
                      body: _steps[i].$2,
                      done: !cancelled && i <= _stage,
                      active: !cancelled && i == _stage,
                      last: i == _steps.length - 1,
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Sf.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Sf.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Delivering to', style: SfType.h3.copyWith(fontSize: 13.5)),
                  const SizedBox(height: 4),
                  Text(
                    _order.deliveryAddress.isEmpty ? 'Address on file' : _order.deliveryAddress,
                    style: SfType.body.copyWith(color: Sf.muted, fontSize: 12.5, height: 1.45),
                  ),
                  const Divider(height: 22),
                  Text('Items', style: SfType.h3.copyWith(fontSize: 13.5)),
                  const SizedBox(height: 8),
                  for (final line in _order.lines)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '${line.quantity} × ${line.name}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: SfType.body.copyWith(fontSize: 12.5),
                            ),
                          ),
                          Text(
                            naira(line.lineTotalMinor),
                            style: SfType.price.copyWith(fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                  if (_order.lines.isEmpty)
                    Text('Items were shared with the seller.', style: SfType.caption),
                  const Divider(height: 22),
                  Row(
                    children: [
                      Text('Order total', style: SfType.h3.copyWith(fontSize: 13.5)),
                      const Spacer(),
                      Text(
                        naira(_order.totalMinor),
                        style: SfType.price.copyWith(fontSize: 16, color: Sf.blue),
                      ),
                    ],
                  ),
                  if (_order.sellerName.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text('Sold by ${_order.sellerName}', style: SfType.caption),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({
    required this.title,
    required this.body,
    required this.done,
    required this.active,
    required this.last,
  });

  final String title;
  final String body;
  final bool done;
  final bool active;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final color = done ? Sf.green : Sf.line;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 260),
              width: active ? 22 : 18,
              height: active ? 22 : 18,
              decoration: BoxDecoration(
                color: done ? Sf.green : Sf.white,
                shape: BoxShape.circle,
                border: Border.all(color: color, width: 2),
              ),
              child: done
                  ? const Icon(Icons.check_rounded, size: 11, color: Sf.white)
                  : null,
            ),
            if (!last)
              Container(
                width: 2,
                height: 34,
                color: done ? Sf.green.withValues(alpha: 0.4) : Sf.line,
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10, top: 1),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: SfType.h3.copyWith(
                    fontSize: 13,
                    color: done ? Sf.ink : Sf.muted,
                  ),
                ),
                const SizedBox(height: 1),
                Text(body, style: SfType.caption.copyWith(fontSize: 10.5)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
