import 'package:flutter/material.dart';

import '../state.dart';
import '../theme.dart';
import '../ui.dart';
import 'shell/app_shell.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _controller = PageController();
  int _index = 0;

  static const _slides = [
    _Slide(
      eyebrow: 'WELCOME TO SURE FOODZ',
      title: 'Farm-fresh food,\ndelivered in minutes',
      body:
          'Fruit, vegetables, staples, drinks and household essentials from verified '
          'sellers around you — at prices you can trust.',
      art: _UserArt(),
      chips: ['Verified sellers', 'Same-day delivery'],
    ),
    _Slide(
      eyebrow: 'SHOP SMARTER',
      title: 'A whole market\nin your pocket',
      body:
          'Compare sellers, catch flash deals, buy in bulk and track every order from '
          'confirmation to your doorstep.',
      art: _StaplesArt(),
      chips: ['Flash deals', 'Bulk staples'],
    ),
    _Slide(
      eyebrow: 'PAY YOUR WAY',
      title: 'Pay now, later\nor on delivery',
      body:
          'Choose the payment that suits you, order for events with Special Order, and '
          'keep everything in one basket.',
      art: _PaymentArt(),
      chips: ['Pay Later', 'Special Order'],
    ),
  ];

  void _finish() {
    AppScope.read(context).completeOnboarding();
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 420),
        pageBuilder: (_, _, _) => const AppShell(),
        transitionsBuilder: (_, animation, _, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  void _next() {
    if (_index == _slides.length - 1) {
      _finish();
      return;
    }
    _controller.nextPage(
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final last = _index == _slides.length - 1;
    return Scaffold(
      backgroundColor: Sf.white,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 12, 0),
              child: Row(
                children: [
                  Image.asset('assets/images/logo.png', height: 34, fit: BoxFit.contain),
                  const Spacer(),
                  TextButton(
                    onPressed: _finish,
                    style: TextButton.styleFrom(
                      foregroundColor: Sf.ink,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    child: Text(
                      'Skip',
                      style: SfType.caption.copyWith(
                        fontWeight: FontWeight.w800,
                        color: Sf.ink,
                        fontSize: 13.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (value) => setState(() => _index = value),
                itemBuilder: (context, index) => _SlideView(slide: _slides[index]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 2, 20, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < _slides.length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 260),
                      curve: Curves.easeOut,
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      height: 6,
                      width: i == _index ? 26 : 6,
                      decoration: BoxDecoration(
                        color: i == _index ? Sf.blue : Sf.line,
                        borderRadius: BorderRadius.circular(6),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
              child: Column(
                children: [
                  SfButton(
                    label: last ? 'Get started' : 'Continue',
                    icon: last ? Icons.storefront_rounded : Icons.arrow_forward_rounded,
                    onPressed: _next,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Browse as a guest. Sign in only when you add to cart.',
                    textAlign: TextAlign.center,
                    style: SfType.caption.copyWith(fontSize: 11.5),
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

class _Slide {
  const _Slide({
    required this.eyebrow,
    required this.title,
    required this.body,
    required this.art,
    required this.chips,
  });

  final String eyebrow;
  final String title;
  final String body;
  final Widget art;
  final List<String> chips;
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});

  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final artHeight = (constraints.maxHeight * 0.47).clamp(160.0, 360.0);
        return SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(height: artHeight, width: double.infinity, child: slide.art),
                  const SizedBox(height: 22),
                  Text(
                    slide.eyebrow,
                    style: SfType.micro.copyWith(color: Sf.blue, letterSpacing: 1.4),
                  ),
                  const SizedBox(height: 8),
                  Text(slide.title, style: SfType.display.copyWith(fontSize: 30)),
                  const SizedBox(height: 10),
                  Text(slide.body, style: SfType.bodyMuted.copyWith(height: 1.5)),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final chip in slide.chips) _MiniPill(label: chip),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _MiniPill extends StatelessWidget {
  const _MiniPill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: Sf.soft,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Sf.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check_circle_rounded, size: 13, color: Sf.green),
          const SizedBox(width: 5),
          Text(
            label,
            style: SfType.caption.copyWith(color: Sf.ink, fontWeight: FontWeight.w700, fontSize: 11.5),
          ),
        ],
      ),
    );
  }
}

/// The buyer's own onboarding artwork lives at assets/images/onboarding_hero.png.
/// When that file is present it is used as-is; otherwise the campaign banner stands in
/// so the page is never empty.
class _UserArt extends StatelessWidget {
  const _UserArt();

  @override
  Widget build(BuildContext context) {
    return _ArtFrame(
      overlay: const [
        _FloatBadge(label: 'Fresh picks daily', icon: Icons.eco_rounded, color: Sf.green),
      ],
      child: Image.asset(
        'assets/images/onboarding_hero.png',
        fit: BoxFit.contain,
        errorBuilder: (_, _, _) => const _BrandArt(),
      ),
    );
  }
}

class _StaplesArt extends StatelessWidget {
  const _StaplesArt();

  @override
  Widget build(BuildContext context) {
    return _ArtFrame(
      overlay: const [
        _FloatBadge(label: 'Supplier prices', icon: Icons.inventory_2_rounded, color: Sf.blue),
        _FloatBadge(label: 'Same-day', icon: Icons.bolt_rounded, color: Sf.orange),
      ],
      child: Image.asset('assets/images/store-banner.jpg', fit: BoxFit.cover),
    );
  }
}

class _PaymentArt extends StatelessWidget {
  const _PaymentArt();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: Sf.gradientBlue,
        borderRadius: BorderRadius.circular(30),
      ),
      padding: const EdgeInsets.all(20),
      child: Center(
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              color: Sf.white.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.local_shipping_rounded, color: Sf.white, size: 46),
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: Sf.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.verified_rounded, color: Sf.green, size: 18),
                const SizedBox(width: 8),
                Text(
                  'Order delivered',
                  style: SfType.h3.copyWith(fontSize: 13.5),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.check_circle_rounded, color: Sf.green, size: 18),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: Sf.ink.withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.payments_rounded, color: Sf.yellow, size: 17),
                const SizedBox(width: 7),
                Text(
                  'Cash · Transfer · Pay Later',
                  style: SfType.caption.copyWith(color: Sf.white, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
          ),
        ),
      ),
    );
  }
}

class _BrandArt extends StatelessWidget {
  const _BrandArt();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(gradient: Sf.gradientBlue),
      child: Stack(
        children: [
          Positioned(
            right: -40,
            top: -40,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                color: Sf.yellow.withValues(alpha: 0.18),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            left: -30,
            bottom: -50,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                color: Sf.white.withValues(alpha: 0.10),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                    decoration: BoxDecoration(
                      color: Sf.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: Sf.liftShadow,
                    ),
                    child: Image.asset('assets/images/logo.png', height: 46, fit: BoxFit.contain),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Fresh Food. Better Living.',
                    textAlign: TextAlign.center,
                    style: SfType.h1.copyWith(color: Sf.white, fontSize: 21, height: 1.15),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'The whole market, from sellers you can trust.',
                    textAlign: TextAlign.center,
                    style: SfType.caption.copyWith(
                      color: Sf.white.withValues(alpha: 0.85),
                      fontSize: 11.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      _MiniPill(label: 'Verified sellers'),
                      SizedBox(width: 8),
                      _MiniPill(label: 'Same-day'),
                    ],
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

class _ArtFrame extends StatelessWidget {
  const _ArtFrame({required this.child, this.overlay});

  final Widget child;
  final List<Widget>? overlay;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: Container(
            decoration: BoxDecoration(
              color: Sf.soft,
              borderRadius: BorderRadius.circular(30),
              border: Border.all(color: Sf.line),
            ),
            clipBehavior: Clip.antiAlias,
            child: child,
          ),
        ),
        if (overlay != null)
          Positioned(
            left: 14,
            bottom: 14,
            right: 14,
            child: Row(children: [for (final pill in overlay!) Padding(padding: const EdgeInsets.only(right: 8), child: pill)]),
          ),
      ],
    );
  }
}

class _FloatBadge extends StatelessWidget {
  const _FloatBadge({required this.label, required this.icon, required this.color});

  final String label;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
      decoration: BoxDecoration(
        color: Sf.white.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(30),
        boxShadow: Sf.cardShadow,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 5),
          Text(
            label,
            style: SfType.caption.copyWith(color: Sf.ink, fontWeight: FontWeight.w800, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
