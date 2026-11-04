import 'package:flutter/material.dart';

import '../../theme.dart';
import '../buyer/account_screen.dart';
import '../buyer/home_screen.dart';
import '../buyer/notifications_screen.dart';
import '../buyer/search_screen.dart';
import '../buyer/stores_screen.dart';

/// Buyer shell with the reference navigation: Home, Stores, Search, Activity
/// and Profile. The basket lives in each screen's header, as on the reference.
class AppShell extends StatefulWidget {
  const AppShell({super.key, this.initialIndex = 0});

  final int initialIndex;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late int _index = widget.initialIndex;

  static const _items = [
    _NavItem(icon: Icons.home_outlined, active: Icons.home_rounded, label: 'Home'),
    _NavItem(icon: Icons.storefront_outlined, active: Icons.storefront_rounded, label: 'Stores'),
    _NavItem(icon: Icons.search_rounded, active: Icons.search_rounded, label: 'Search'),
    _NavItem(icon: Icons.receipt_long_outlined, active: Icons.receipt_long_rounded, label: 'Activity'),
    _NavItem(icon: Icons.person_outline_rounded, active: Icons.person_rounded, label: 'Profile'),
  ];

  void goTo(int index) => setState(() => _index = index);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Sf.white,
      body: IndexedStack(
        index: _index,
        children: [
          HomeScreen(onOpenSearch: () => goTo(2)),
          const StoresScreen(),
          const SearchScreen(),
          const NotificationsScreen(title: 'Activity'),
          const AccountScreen(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Sf.white,
          border: const Border(top: BorderSide(color: Sf.line)),
          boxShadow: [
            BoxShadow(
              color: Sf.ink.withValues(alpha: 0.05),
              blurRadius: 20,
              offset: const Offset(0, -6),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 64,
            child: Row(
              children: [
                for (var i = 0; i < _items.length; i++)
                  Expanded(
                    child: _NavButton(
                      item: _items[i],
                      selected: _index == i,
                      onTap: () => goTo(i),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem({required this.icon, required this.active, required this.label});

  final IconData icon;
  final IconData active;
  final String label;
}

class _NavButton extends StatelessWidget {
  const _NavButton({required this.item, required this.selected, required this.onTap});

  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            width: 26,
            height: 3,
            decoration: BoxDecoration(
              color: selected ? Sf.blue : Colors.transparent,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(height: 8),
          AnimatedScale(
            duration: const Duration(milliseconds: 200),
            scale: selected ? 1.06 : 1,
            child: Icon(
              selected ? item.active : item.icon,
              size: 23,
              color: selected ? Sf.blue : Sf.muted,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            item.label,
            style: TextStyle(
              fontSize: 11.5,
              height: 1.1,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              color: selected ? Sf.blue : Sf.ink,
            ),
          ),
        ],
      ),
    );
  }
}
