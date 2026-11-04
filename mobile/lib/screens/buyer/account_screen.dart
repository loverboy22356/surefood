import 'package:flutter/material.dart';

import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';
import 'notifications_screen.dart';
import 'orders_screen.dart';
import 'pay_later_screen.dart';
import 'settings_screen.dart';
import 'special_order_screen.dart';
import 'wishlist_screen.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  Future<void> _signIn(BuildContext context) async {
    await ensureSignedIn(context, reason: 'Sign in to your Sure Foodz account');
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final profile = state.profile;
    return Scaffold(
      backgroundColor: Sf.white,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(Sf.gutter, 10, Sf.gutter, 28),
          children: [
            Row(
              children: [
                Expanded(
                  child: Text('Account', style: SfType.h1.copyWith(fontSize: 22)),
                ),
                SfIconButton(
                  icon: Icons.notifications_none_rounded,
                  filled: true,
                  onPressed: () => Navigator.of(context).push(sfRoute(const NotificationsScreen())),
                ),
                SfIconButton(
                  icon: Icons.settings_outlined,
                  filled: true,
                  onPressed: () => Navigator.of(context).push(sfRoute(const SettingsScreen())),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (!state.signedIn)
              _GuestCard(onSignIn: () => _signIn(context))
            else
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  gradient: Sf.gradientBlue,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 54,
                          height: 54,
                          decoration: BoxDecoration(
                            color: Sf.white.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                            border: Border.all(color: Sf.white.withValues(alpha: 0.45), width: 2),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: profile?.avatarUrl.isNotEmpty == true
                              ? SfImage(profile!.avatarUrl)
                              : Center(
                                  child: Text(
                                    _initials(profile?.displayName ?? state.displayName),
                                    style: SfType.h2.copyWith(color: Sf.white, fontSize: 18),
                                  ),
                                ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                profile?.displayName.isNotEmpty == true
                                    ? profile!.displayName
                                    : state.displayName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: SfType.h2.copyWith(color: Sf.white, fontSize: 17),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                profile?.email.isNotEmpty == true ? profile!.email : state.email,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: SfType.caption.copyWith(
                                  color: Sf.white.withValues(alpha: 0.85),
                                  fontSize: 11,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(Icons.verified_rounded, size: 13, color: Sf.yellow),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Buyer account',
                                    style: SfType.caption.copyWith(
                                      color: Sf.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 10.5,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: Sf.white.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          _Stat(label: 'Cart', value: '${state.cartCount}'),
                          _Divider(),
                          _Stat(label: 'Saved', value: '${state.wishlistCount}'),
                          _Divider(),
                          _Stat(label: 'Addresses', value: '${state.addresses.length}'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 18),
            _ShortcutGrid(state: state),
            const SizedBox(height: 18),
            Text('Your activity', style: SfType.h3),
            const SizedBox(height: 4),
            _MenuCard(
              children: [
                SfTile(
                  icon: Icons.receipt_long_rounded,
                  title: 'My orders',
                  subtitle: 'Track deliveries and reorder',
                  onTap: () => Navigator.of(context).push(sfRoute(const OrdersScreen())),
                ),
                SfTile(
                  icon: Icons.favorite_border_rounded,
                  title: 'Wishlist',
                  subtitle: '${state.wishlistCount} saved item(s)',
                  tint: Sf.orange,
                  onTap: () => Navigator.of(context).push(sfRoute(const WishlistScreen())),
                ),
                SfTile(
                  icon: Icons.location_on_outlined,
                  title: 'Saved addresses',
                  subtitle: '${state.addresses.length} address(es) on file',
                  tint: Sf.green,
                  onTap: () => _openAddresses(context, state),
                ),
                SfTile(
                  icon: Icons.assignment_return_rounded,
                  title: 'Returns & refunds',
                  subtitle: '24-hour money-back guarantee',
                  tint: Sf.orange,
                  onTap: () => _showInfo(
                    context,
                    'Returns & refunds',
                    'If something is wrong with an order, contact the seller through support '
                        'within 24 hours of delivery. Approved refunds are returned to your '
                        'original payment method.',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text('Account', style: SfType.h3),
            const SizedBox(height: 4),
            _MenuCard(
              children: [
                SfTile(
                  icon: Icons.settings_outlined,
                  title: 'Settings',
                  subtitle: 'Profile, security and app details',
                  tint: Sf.ink,
                  onTap: () => Navigator.of(context).push(sfRoute(const SettingsScreen())),
                ),
                SfTile(
                  icon: Icons.support_agent_rounded,
                  title: 'Help & support',
                  subtitle: 'support@surefoodz.com',
                  tint: Sf.blue,
                  onTap: () => _showInfo(
                    context,
                    'We are here 24/7',
                    'Email support@surefoodz.com with your order number and our team will '
                        'respond. For delivery issues, include the rider name shown on your order.',
                  ),
                ),
                if (state.signedIn)
                  SfTile(
                    icon: Icons.logout_rounded,
                    title: 'Sign out',
                    tint: Sf.orange,
                    trailing: const SizedBox.shrink(),
                    onTap: () async {
                      final confirmed = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: const Text('Sign out?'),
                          content: const Text('Your cart stays on this device.'),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.of(context).pop(false),
                              child: const Text('Cancel'),
                            ),
                            TextButton(
                              onPressed: () => Navigator.of(context).pop(true),
                              child: const Text('Sign out'),
                            ),
                          ],
                        ),
                      );
                      if (confirmed != true || !context.mounted) return;
                      AppScope.read(context).signOut();
                      SfToast.show(context, 'Signed out', icon: Icons.logout_rounded, color: Sf.muted);
                    },
                  ),
              ],
            ),
            const SizedBox(height: 22),
            Center(
              child: Column(
                children: [
                  Image.asset('assets/images/logo.png', height: 26, fit: BoxFit.contain),
                  const SizedBox(height: 6),
                  Text(
                    'Sure Foodz · Fresh Food. Better Living.',
                    style: SfType.caption.copyWith(fontSize: 10.5),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((part) => part.isNotEmpty).toList();
    if (parts.isEmpty) return 'SF';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
  }

  static Future<void> _showInfo(BuildContext context, String title, String body) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Sf.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(Sf.radiusLg)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
        child: SafeArea(
          top: false,
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
              Text(title, style: SfType.h2),
              const SizedBox(height: 8),
              Text(body, style: SfType.bodyMuted.copyWith(height: 1.55)),
              const SizedBox(height: 18),
              SfButton(label: 'Got it', onPressed: () => Navigator.of(context).pop()),
            ],
          ),
        ),
      ),
    );
  }

  static Future<void> _openAddresses(BuildContext context, AppState state) async {
    final label = TextEditingController();
    final line = TextEditingController();
    final phone = TextEditingController();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Container(
            decoration: const BoxDecoration(
              color: Sf.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(Sf.radiusLg)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
            child: SafeArea(
              top: false,
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
                  Text('Saved addresses', style: SfType.h2),
                  const SizedBox(height: 10),
                  if (state.addresses.isEmpty)
                    Text(
                      'No address saved yet. Add the address your riders should deliver to.',
                      style: SfType.bodyMuted.copyWith(height: 1.5),
                    ),
                  for (final address in state.addresses)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        children: [
                          const Icon(Icons.location_on_rounded, size: 18, color: Sf.blue),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  address.label,
                                  style: SfType.h3.copyWith(fontSize: 13.5),
                                ),
                                Text(
                                  address.line,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: SfType.caption.copyWith(fontSize: 10.5),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Sf.muted),
                            onPressed: () {
                              state.removeAddress(address.id);
                              setSheetState(() {});
                            },
                          ),
                        ],
                      ),
                    ),
                  const Divider(height: 22),
                  Text('Add an address', style: SfType.h3.copyWith(fontSize: 14)),
                  const SizedBox(height: 10),
                  TextField(
                    controller: label,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(hintText: 'Label, e.g. Home or Shop'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: line,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(hintText: 'Street address and landmark'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: phone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(hintText: 'Phone number'),
                  ),
                  const SizedBox(height: 14),
                  SfButton(
                    label: 'Save address',
                    onPressed: () {
                      if (line.text.trim().length < 5) {
                        SfToast.show(
                          context,
                          'Enter a full street address',
                          icon: Icons.error_outline_rounded,
                          color: Sf.orange,
                        );
                        return;
                      }
                      state.saveAddress(
                        DeliveryAddress(
                          id: DateTime.now().microsecondsSinceEpoch.toString(),
                          label: label.text.trim().isEmpty ? 'Address' : label.text.trim(),
                          line: line.text.trim(),
                          phone: phone.text.trim(),
                          isDefault: state.addresses.isEmpty,
                        ),
                      );
                      label.clear();
                      line.clear();
                      phone.clear();
                      setSheetState(() {});
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GuestCard extends StatelessWidget {
  const _GuestCard({required this.onSignIn});

  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: Sf.gradientBlue,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'SHOPPING AS A GUEST',
            style: SfType.micro.copyWith(color: Sf.yellow, letterSpacing: 1.2, fontSize: 9.5),
          ),
          const SizedBox(height: 6),
          Text(
            'Sign in for faster\ncheckout and tracking',
            style: SfType.h2.copyWith(color: Sf.white, fontSize: 19, height: 1.2),
          ),
          const SizedBox(height: 8),
          Text(
            'Save your basket, follow every order and unlock Pay Later.',
            style: SfType.caption.copyWith(color: Sf.white.withValues(alpha: 0.85), height: 1.45),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: SfButton(
                  label: 'Sign in',
                  variant: SfButtonVariant.gold,
                  height: 44,
                  onPressed: onSignIn,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: SfButton(
                  label: 'Create account',
                  variant: SfButtonVariant.dark,
                  height: 44,
                  onPressed: () async {
                    await ensureSignedIn(
                      context,
                      reason: 'Create your Sure Foodz account',
                      startInSignUp: true,
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ShortcutGrid extends StatelessWidget {
  const _ShortcutGrid({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.receipt_long_rounded, 'Orders', () => Navigator.of(context).push(sfRoute(const OrdersScreen()))),
      (Icons.favorite_rounded, 'Wishlist', () => Navigator.of(context).push(sfRoute(const WishlistScreen()))),
      (Icons.event_available_rounded, 'Special order', () => Navigator.of(context).push(sfRoute(const SpecialOrderScreen()))),
      (Icons.account_balance_wallet_rounded, 'Pay later', () => Navigator.of(context).push(sfRoute(const PayLaterScreen()))),
    ];
    return Row(
      children: [
        for (final item in items)
          Expanded(
            child: GestureDetector(
              onTap: item.$3,
              child: Container(
                margin: EdgeInsets.only(right: item == items.last ? 0 : 8),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Sf.soft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  children: [
                    Icon(item.$1, size: 20, color: Sf.blue),
                    const SizedBox(height: 6),
                    Text(
                      item.$2,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: SfType.caption.copyWith(
                        color: Sf.ink,
                        fontWeight: FontWeight.w700,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _MenuCard extends StatelessWidget {
  const _MenuCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: Sf.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Sf.line),
      ),
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            children[i],
            if (i != children.length - 1) const Divider(height: 1),
          ],
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: SfType.h3.copyWith(color: Sf.white, fontSize: 16)),
          const SizedBox(height: 1),
          Text(
            label,
            style: SfType.caption.copyWith(
              color: Sf.white.withValues(alpha: 0.8),
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 26,
      color: Sf.white.withValues(alpha: 0.25),
    );
  }
}
