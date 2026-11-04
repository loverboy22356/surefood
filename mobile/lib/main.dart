import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import 'screens/shell/app_shell.dart';
import 'screens/splash_screen.dart';
import 'state.dart';
import 'theme.dart';

void main() {
  runApp(const SureFoodzApp());
}

class SureFoodzApp extends StatefulWidget {
  const SureFoodzApp({super.key});

  @override
  State<SureFoodzApp> createState() => _SureFoodzAppState();
}

class _SureFoodzAppState extends State<SureFoodzApp> {
  final AppState _state = AppState();

  @override
  void dispose() {
    _state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: _state,
      child: MaterialApp(
        title: 'Sure Foodz',
        debugShowCheckedModeBanner: false,
        theme: buildSfTheme(),
        scrollBehavior: const _SfScrollBehavior(),
        // `--dart-define=SF_START=home|stores|search` opens the buyer shell on
        // that tab; used for visual checks so splash/onboarding stay out of the way.
        home: switch (const String.fromEnvironment('SF_START')) {
          'home' => const AppShell(),
          'stores' => const AppShell(initialIndex: 1),
          'search' => const AppShell(initialIndex: 2),
          _ => const SplashScreen(),
        },
        builder: (context, child) {
          final media = MediaQuery.of(context);
          return MediaQuery(
            data: media.copyWith(
              textScaler: media.textScaler.clamp(minScaleFactor: 0.9, maxScaleFactor: 1.12),
            ),
            child: child ?? const SizedBox.shrink(),
          );
        },
      ),
    );
  }
}

/// Desktop gets drag-to-scroll on lists, which is what a phone-like window expects.
class _SfScrollBehavior extends MaterialScrollBehavior {
  const _SfScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => const {
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
    PointerDeviceKind.trackpad,
    PointerDeviceKind.stylus,
  };
}
