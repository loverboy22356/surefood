import 'package:flutter/material.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, this.title = 'Notifications'});

  /// Tab label is "Activity"; the pushed route keeps "Notifications".
  final String title;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  Future<List<Activity>>? _future;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (AppScope.read(context).signedIn) {
      _future ??= AppScope.read(context).api.activities();
    }
  }

  Future<void> _refresh() async {
    if (!AppScope.read(context).signedIn) return;
    setState(() {
  _future = AppScope.read(context).api.activities();
});
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return Scaffold(
      backgroundColor: Sf.white,
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _refresh),
        ],
      ),
      body: !state.signedIn
          ? SfEmpty(
              icon: Icons.notifications_none_rounded,
              title: 'Sign in for updates',
              message: 'Order updates, seller confirmations and account alerts appear here.',
              action: SfButton(
                label: 'Sign in',
                expanded: false,
                onPressed: () async {
                  final ok = await ensureSignedIn(
                    context,
                    reason: 'Sign in to see your notifications',
                  );
                  if (ok && context.mounted) {
                    setState(() {
  _future = AppScope.read(context).api.activities();
});
                  }
                },
              ),
            )
          : FutureBuilder<List<Activity>>(
              future: _future,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.all(Sf.gutter),
                    child: SfListSkeleton(count: 5, height: 44),
                  );
                }
                if (snapshot.hasError) {
                  return SfEmpty(
                    icon: Icons.cloud_off_rounded,
                    title: 'Updates are unavailable',
                    message: 'Check your connection and refresh.',
                    action: SfButton(label: 'Retry', expanded: false, onPressed: _refresh),
                  );
                }
                final items = snapshot.data ?? const <Activity>[];
                if (items.isEmpty) {
                  return const SfEmpty(
                    icon: Icons.mark_email_read_outlined,
                    title: 'You are all caught up',
                    message: 'Order updates and account alerts will land here.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: _refresh,
                  color: Sf.blue,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(Sf.gutter, 14, Sf.gutter, 26),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, index) => _ActivityTile(activity: items[index]),
                  ),
                );
              },
            ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.activity});

  final Activity activity;

  @override
  Widget build(BuildContext context) {
    final action = activity.action.toLowerCase();
    final (icon, tint) = action.contains('order')
        ? (Icons.receipt_long_rounded, Sf.blue)
        : action.contains('pay')
        ? (Icons.payments_rounded, Sf.green)
        : action.contains('verif')
        ? (Icons.verified_rounded, Sf.green)
        : (Icons.notifications_rounded, Sf.orange);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: tint.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 18, color: tint),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activity.summary,
                  style: SfType.body.copyWith(fontSize: 13, height: 1.4, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 3),
                Text(
                  activity.createdAt == null ? '' : _relative(activity.createdAt!),
                  style: SfType.caption.copyWith(fontSize: 10.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _relative(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} h ago';
    if (diff.inDays < 7) return '${diff.inDays} d ago';
    return '${date.day}/${date.month}/${date.year}';
  }
}
