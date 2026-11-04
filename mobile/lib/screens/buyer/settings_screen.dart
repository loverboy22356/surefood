import 'package:flutter/material.dart';

import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  void _info(BuildContext context, String title, String body) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(body, style: SfType.bodyMuted.copyWith(height: 1.5)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final profile = state.profile;
    return Scaffold(
      backgroundColor: Sf.soft,
      appBar: AppBar(title: const Text('Settings'), backgroundColor: Sf.white),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Sf.gutter, 14, Sf.gutter, 28),
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
            decoration: BoxDecoration(
              color: Sf.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Sf.line),
            ),
            child: Column(
              children: [
                SfTile(
                  icon: Icons.person_outline_rounded,
                  title: 'Name',
                  subtitle: profile?.displayName.isNotEmpty == true
                      ? profile!.displayName
                      : (state.signedIn ? 'Not set' : 'Guest'),
                  tint: Sf.blue,
                  trailing: const SizedBox.shrink(),
                ),
                const Divider(height: 1),
                SfTile(
                  icon: Icons.alternate_email_rounded,
                  title: 'Email',
                  subtitle: state.email.isEmpty ? 'Sign in to add your email' : state.email,
                  tint: Sf.green,
                  trailing: const SizedBox.shrink(),
                ),
                const Divider(height: 1),
                SfTile(
                  icon: Icons.call_outlined,
                  title: 'Phone',
                  subtitle: (profile?.phone ?? '').isEmpty ? 'Added at checkout' : profile!.phone,
                  tint: Sf.orange,
                  trailing: const SizedBox.shrink(),
                ),
                const Divider(height: 1),
                SfTile(
                  icon: Icons.location_on_outlined,
                  title: 'Delivery area',
                  subtitle: state.area,
                  tint: Sf.ink,
                  trailing: const SizedBox.shrink(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
            decoration: BoxDecoration(
              color: Sf.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Sf.line),
            ),
            child: Column(
              children: [
                SfTile(
                  icon: Icons.lock_outline_rounded,
                  title: 'How sign-in works',
                  subtitle: 'One-time email codes, no passwords',
                  tint: Sf.blue,
                  onTap: () => _info(
                    context,
                    'Secure, passwordless sign-in',
                    'Sure Foodz emails a six-digit code whenever you sign in. The code expires '
                        'after ten minutes and can only be used once, so there is no password to '
                        'leak or forget.',
                  ),
                ),
                const Divider(height: 1),
                SfTile(
                  icon: Icons.shield_outlined,
                  title: 'Privacy',
                  subtitle: 'How your data is used',
                  tint: Sf.green,
                  onTap: () => _info(
                    context,
                    'Your privacy',
                    'Your account details are used to fulfil orders, confirm deliveries and meet '
                        'regulatory requirements. Sellers only see the details needed to deliver '
                        'your order. Full details are on surefoodz.com/privacy.',
                  ),
                ),
                const Divider(height: 1),
                SfTile(
                  icon: Icons.description_outlined,
                  title: 'Terms of service',
                  subtitle: 'Marketplace rules for buyers and sellers',
                  tint: Sf.ink,
                  onTap: () => _info(
                    context,
                    'Terms of service',
                    'Sure Foodz connects buyers with independent, verified sellers. Prices, stock '
                        'and delivery windows are set by each seller. The full marketplace terms '
                        'are published on surefoodz.com.',
                  ),
                ),
                const Divider(height: 1),
                SfTile(
                  icon: Icons.info_outline_rounded,
                  title: 'App version',
                  subtitle: 'Sure Foodz mobile 0.1.0',
                  tint: Sf.muted,
                  trailing: const SizedBox.shrink(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (state.signedIn)
            SfButton(
              label: 'Sign out',
              variant: SfButtonVariant.outline,
              icon: Icons.logout_rounded,
              onPressed: () {
                AppScope.read(context).signOut();
                Navigator.of(context).maybePop();
                SfToast.show(context, 'Signed out', icon: Icons.logout_rounded, color: Sf.muted);
              },
            )
          else
            SfButton(
              label: 'Sign in to your account',
              icon: Icons.login_rounded,
              onPressed: () => ensureSignedIn(context, reason: 'Sign in from settings'),
            ),
          const SizedBox(height: 18),
          Center(
            child: Text(
              'Prices in Naira · Sellers verified by Sure Foodz',
              style: SfType.caption.copyWith(fontSize: 10.5),
            ),
          ),
        ],
      ),
    );
  }
}
