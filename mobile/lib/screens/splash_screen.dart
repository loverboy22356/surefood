import 'dart:async';

import 'package:flutter/material.dart';

import '../state.dart';
import '../theme.dart';
import 'onboarding_screen.dart';
import 'shell/app_shell.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..forward();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 1900), _next);
  }

  void _next() {
    if (!mounted) return;
    final state = AppScope.read(context);
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 480),
        pageBuilder: (_, _, _) =>
            state.onboardingComplete ? const AppShell() : const OnboardingScreen(),
        transitionsBuilder: (_, animation, _, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic);
    return Scaffold(
      backgroundColor: Sf.white,
      body: Stack(
        children: [
          Positioned(
            top: -140,
            right: -110,
            child: _Blob(color: Sf.blue.withValues(alpha: 0.10), size: 320),
          ),
          Positioned(
            bottom: -120,
            left: -90,
            child: _Blob(color: Sf.yellow.withValues(alpha: 0.22), size: 300),
          ),
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FadeTransition(
                  opacity: curved,
                  child: ScaleTransition(
                    scale: Tween(begin: 0.88, end: 1.0).animate(curved),
                    child: Column(
                      children: [
                        Image.asset('assets/images/logo.png', width: 208, fit: BoxFit.contain),
                        const SizedBox(height: 10),
                        Text(
                          'Fresh Food. Better Living.',
                          style: SfType.caption.copyWith(
                            fontSize: 13,
                            color: Sf.muted,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 42),
                SizedBox(
                  width: 132,
                  child: AnimatedBuilder(
                    animation: _controller,
                    builder: (context, _) => ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: _controller.value,
                        minHeight: 4,
                        backgroundColor: Sf.soft,
                        valueColor: const AlwaysStoppedAnimation(Sf.blue),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text('MARKETPLACE', style: SfType.micro.copyWith(color: Sf.muted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Blob extends StatelessWidget {
  const _Blob({required this.color, required this.size});
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}
