import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import 'order_success_screen.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _area = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_phone.text.isEmpty) {
      final state = AppScope.read(context);
      final saved = state.defaultAddress;
      _phone.text = saved?.phone ?? state.phone;
      _address.text = saved?.line ?? state.profile?.location ?? '';
      _area.text = saved?.label ?? state.area;
    }
  }

  @override
  void dispose() {
    _phone.dispose();
    _address.dispose();
    _area.dispose();
    super.dispose();
  }

  String _checkoutId() {
    final random = Random.secure();
    final buffer = StringBuffer();
    for (var i = 0; i < 32; i++) {
      buffer.write(random.nextInt(16).toRadixString(16));
    }
    return buffer.toString();
  }

  Future<void> _placeOrder() async {
    final state = AppScope.read(context);
    if (state.cartEmpty) {
      setState(() => _error = 'Your cart is empty.');
      return;
    }
    final phone = _phone.text.trim();
    final address = _address.text.trim();
    if (!RegExp(r'^[+()\d\s.-]{7,24}$').hasMatch(phone)) {
      setState(() => _error = 'Enter a phone number the rider can call, e.g. 0803 000 0000.');
      return;
    }
    if (address.length < 5) {
      setState(() => _error = 'Enter your full delivery address.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = <String, int>{
        for (final line in state.cart) line.product.id: line.quantity,
      };
      final orders = await state.api.placeOrder(
        checkoutId: _checkoutId(),
        items: items,
        phone: phone,
        deliveryAddress: _area.text.trim().isEmpty
            ? address
            : '$address, ${_area.text.trim()}',
      );
      if (!mounted) return;
      state.saveAddress(
        DeliveryAddress(
          id: 'default',
          label: _area.text.trim().isEmpty ? state.area : _area.text.trim(),
          line: address,
          phone: phone,
          isDefault: true,
        ),
      );
      state.clearCart();
      Navigator.of(context).pushReplacement(
        sfRoute(OrderSuccessScreen(orders: orders)),
      );
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'We could not place the order. Try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return Scaffold(
      backgroundColor: Sf.soft,
      appBar: AppBar(
        title: const Text('Checkout'),
        backgroundColor: Sf.white,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Sf.gutter, 12, Sf.gutter, 100),
        children: [
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Sf.orangeWash,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Sf.orange.withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, size: 17, color: Sf.orange),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: SfType.caption.copyWith(color: Sf.ink, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          _Section(
            title: 'Delivery details',
            icon: Icons.location_on_rounded,
            child: Column(
              children: [
                _field(_phone, 'Phone number', '0803 000 0000', TextInputType.phone),
                const SizedBox(height: 12),
                _field(_address, 'Street address', 'House number, street, landmark'),
                const SizedBox(height: 12),
                _field(_area, 'Area / city', 'e.g. Ikeja, Lagos'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Delivery',
            icon: Icons.local_shipping_rounded,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Sf.blueWash,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(Icons.bolt_rounded, size: 18, color: Sf.blue),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Standard delivery · within 24 hours',
                          style: SfType.caption.copyWith(
                            color: Sf.ink,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Your order is split by seller and priced at checkout confirmation.',
                          style: SfType.caption.copyWith(fontSize: 10.5, height: 1.4),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Payment',
            icon: Icons.payments_rounded,
            child: Column(
              children: [
                _PaymentOption(
                  icon: Icons.delivery_dining_rounded,
                  title: 'Pay on delivery',
                  subtitle: 'Cash or transfer to the rider when your order arrives',
                  selected: true,
                ),
                const SizedBox(height: 8),
                _PaymentOption(
                  icon: Icons.credit_card_rounded,
                  title: 'Pay online with card',
                  subtitle: 'Card payment is confirmed by the seller after review',
                  selected: false,
                  disabled: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _Section(
            title: 'Order summary',
            icon: Icons.receipt_long_rounded,
            child: Column(
              children: [
                for (final line in state.cart)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(9),
                          child: SizedBox(
                            width: 44,
                            height: 44,
                            child: SfImage(line.product.imageUrl),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                line.product.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: SfType.body.copyWith(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                '${line.quantity} × ${naira(line.product.priceMinor)}',
                                style: SfType.caption.copyWith(fontSize: 10.5),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          naira(line.lineTotalMinor),
                          style: SfType.price.copyWith(fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                const Divider(height: 20),
                Row(
                  children: [
                    Text('Total to pay', style: SfType.h3.copyWith(fontSize: 14)),
                    const Spacer(),
                    Text(
                      naira(state.cartTotalMinor),
                      style: SfType.price.copyWith(fontSize: 19, color: Sf.blue),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SfBottomBar(
        child: SfButton(
          label: 'Place order · ${naira(state.cartTotalMinor)}',
          icon: Icons.lock_outline_rounded,
          loading: _loading,
          onPressed: state.cartEmpty ? null : _placeOrder,
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    String hint, [
    TextInputType? keyboard,
    TextCapitalization capitalization = TextCapitalization.words,
  ]) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(), style: SfType.micro.copyWith(color: Sf.muted)),
        const SizedBox(height: 5),
        TextField(
          controller: controller,
          keyboardType: keyboard,
          textCapitalization: capitalization,
          inputFormatters: keyboard == TextInputType.phone
              ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9+()\s.-]'))]
              : null,
          style: SfType.body.copyWith(fontWeight: FontWeight.w600),
          decoration: InputDecoration(hintText: hint, filled: true, fillColor: Sf.soft),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.icon, required this.child});

  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Sf.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Sf.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: Sf.blue),
              const SizedBox(width: 7),
              Text(title, style: SfType.h3.copyWith(fontSize: 14)),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _PaymentOption extends StatelessWidget {
  const _PaymentOption({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    this.disabled = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? Sf.blueWash : Sf.soft,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? Sf.blue : Sf.line, width: selected ? 1.4 : 1),
        ),
        child: Row(
          children: [
            Icon(icon, size: 19, color: selected ? Sf.blue : Sf.muted),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: SfType.h3.copyWith(fontSize: 13)),
                  const SizedBox(height: 1),
                  Text(subtitle, style: SfType.caption.copyWith(fontSize: 10.5, height: 1.35)),
                ],
              ),
            ),
            Icon(
              selected ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded,
              size: 19,
              color: selected ? Sf.blue : Sf.line,
            ),
          ],
        ),
      ),
    );
  }
}
