import 'package:flutter/material.dart';

import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';
import '../auth/auth_flow_screen.dart';

class PayLaterScreen extends StatefulWidget {
  const PayLaterScreen({super.key});

  @override
  State<PayLaterScreen> createState() => _PayLaterScreenState();
}

class _PayLaterScreenState extends State<PayLaterScreen> {
  Future<Map<String, dynamic>?>? _application;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (AppScope.read(context).signedIn) {
      _application ??= AppScope.read(context).api.payLaterApplication();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return Scaffold(
      backgroundColor: Sf.soft,
      appBar: AppBar(title: const Text('Pay later'), backgroundColor: Sf.white),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Sf.gutter, 14, Sf.gutter, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: Sf.gradientBlue,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                      decoration: BoxDecoration(
                        color: Sf.yellow,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '30-DAY TERMS',
                        style: SfType.micro.copyWith(color: Sf.ink, fontSize: 9.5),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  'Shop now,\npay in 30 days',
                  style: SfType.display.copyWith(color: Sf.white, fontSize: 26),
                ),
                const SizedBox(height: 8),
                Text(
                  'Approved buyers can stock up on essentials and settle later — ideal for '
                  'offices, food businesses and busy households.',
                  style: SfType.caption.copyWith(
                    color: Sf.white.withValues(alpha: 0.88),
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _Step(
            number: '01',
            title: 'Apply with your details',
            body: 'Share your name, contact, address and the evidence that supports your '
                'application — business registration or employer details, plus references.',
          ),
          _Step(
            number: '02',
            title: 'We verify',
            body: 'Our team checks your information before setting a limit. You are contacted '
                'if anything else is needed.',
          ),
          _Step(
            number: '03',
            title: 'Shop on terms',
            body: 'Once approved, eligible orders can be paid within 30 days of delivery.',
            last: true,
          ),
          const SizedBox(height: 16),
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
                Row(
                  children: [
                    const Icon(Icons.fact_check_rounded, size: 17, color: Sf.blue),
                    const SizedBox(width: 7),
                    Text('Your application', style: SfType.h3.copyWith(fontSize: 14)),
                  ],
                ),
                const SizedBox(height: 10),
                if (!state.signedIn)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Sign in to see whether you already have a Pay Later application.',
                        style: SfType.bodyMuted.copyWith(height: 1.45, fontSize: 12.5),
                      ),
                      const SizedBox(height: 12),
                      SfButton(
                        label: 'Sign in',
                        height: 44,
                        variant: SfButtonVariant.ghost,
                        onPressed: () async {
                          final ok = await ensureSignedIn(
                            context,
                            reason: 'Sign in to check your Pay Later application',
                          );
                          if (ok && context.mounted) {
                            setState(() {
                              _application = AppScope.read(context).api.payLaterApplication();
                            });
                          }
                        },
                      ),
                    ],
                  )
                else
                  FutureBuilder<Map<String, dynamic>?>(
                    future: _application,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const SfShimmer(height: 42, radius: 10);
                      }
                      final application = snapshot.data;
                      if (application == null) {
                        return Text(
                          'No application on file yet. Applications are completed on '
                          'surefoodz.com/pay-later with your supporting documents, then '
                          'reviewed by our team.',
                          style: SfType.bodyMuted.copyWith(height: 1.45, fontSize: 12.5),
                        );
                      }
                      final status = (application['status'] ?? 'submitted').toString();
                      final tint = status == 'approved'
                          ? Sf.green
                          : status == 'declined'
                          ? Sf.orange
                          : Sf.blue;
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: tint.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              status == 'approved'
                                  ? Icons.verified_rounded
                                  : status == 'declined'
                                  ? Icons.cancel_rounded
                                  : Icons.hourglass_top_rounded,
                              size: 18,
                              color: tint,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Application ${status[0].toUpperCase()}${status.substring(1)}',
                                style: SfType.caption.copyWith(
                                  color: Sf.ink,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Sf.yellowWash,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline_rounded, size: 17, color: Sf.ink),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Pay Later is subject to verification and approval. Sure Foodz never asks '
                    'for payment before your application is approved.',
                    style: SfType.caption.copyWith(
                      color: Sf.ink,
                      height: 1.45,
                      fontSize: 11.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SfButton(
            label: 'Talk to the Pay Later team',
            icon: Icons.support_agent_rounded,
            onPressed: () => showDialog<void>(
              context: context,
              builder: (context) => AlertDialog(
                title: const Text('Pay Later support'),
                content: const Text(
                  'Email support@surefoodz.com with the subject "Pay Later" and our team will '
                  'walk you through the documents needed for your application.',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Close'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({
    required this.number,
    required this.title,
    required this.body,
    this.last = false,
  });

  final String number;
  final String title;
  final String body;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(bottom: last ? 0 : 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Sf.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Sf.line),
      ),
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
            alignment: Alignment.center,
            child: Text(
              number,
              style: SfType.caption.copyWith(
                color: Sf.blue,
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: SfType.h3.copyWith(fontSize: 13.5)),
                const SizedBox(height: 3),
                Text(body, style: SfType.caption.copyWith(height: 1.45, fontSize: 11.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
