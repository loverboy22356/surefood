import 'package:flutter/material.dart';

/// Sure Foodz design tokens.
///
/// Every colour here is taken from the website stylesheet (`app/shop.css`) so the
/// app and the site share one brand identity: royal blue, amber/orange, yellow,
/// white and dark ink. No other hues are introduced.
class Sf {
  static const ink = Color(0xFF14151A);
  static const muted = Color(0xFF6F7280);
  static const soft = Color(0xFFF5F5F7);
  static const line = Color(0xFFE6E6EA);
  static const orange = Color(0xFFFF5A1F);
  static const yellow = Color(0xFFFFC21A);
  static const blue = Color(0xFF1B6CFF);
  static const green = Color(0xFF0F9D6B);
  static const white = Colors.white;

  /// Brand washes built from the palette above (same hue, different opacity).
  static const blueWash = Color(0x1A1B6CFF);
  static const orangeWash = Color(0x1AFF5A1F);
  static const yellowWash = Color(0x29FFC21A);
  static const greenWash = Color(0x1A0F9D6B);

  static const double gutter = 16;
  static const double radius = 18;
  static const double radiusSm = 12;
  static const double radiusLg = 26;

  static const gradientBlue = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [blue, Color(0xFF1B4FE0)],
  );

  static const gradientGold = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [yellow, Color(0xFFFFA81A)],
  );

  static const gradientFade = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x00000000), Color(0xB3000000)],
  );

  static List<BoxShadow> get cardShadow => [
    BoxShadow(
      color: ink.withValues(alpha: 0.07),
      blurRadius: 18,
      offset: const Offset(0, 8),
      spreadRadius: -8,
    ),
  ];

  static List<BoxShadow> get liftShadow => [
    BoxShadow(
      color: ink.withValues(alpha: 0.10),
      blurRadius: 28,
      offset: const Offset(0, 14),
      spreadRadius: -12,
    ),
  ];
}

class SfType {
  static const display = TextStyle(
    fontSize: 32,
    height: 1.06,
    fontWeight: FontWeight.w900,
    letterSpacing: -1.2,
    color: Sf.ink,
  );
  static const h1 = TextStyle(
    fontSize: 24,
    height: 1.12,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.8,
    color: Sf.ink,
  );
  static const h2 = TextStyle(
    fontSize: 19,
    height: 1.2,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.4,
    color: Sf.ink,
  );
  static const h3 = TextStyle(
    fontSize: 16,
    height: 1.25,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.2,
    color: Sf.ink,
  );
  static const body = TextStyle(
    fontSize: 14,
    height: 1.45,
    fontWeight: FontWeight.w500,
    color: Sf.ink,
  );
  static const bodyMuted = TextStyle(
    fontSize: 13.5,
    height: 1.45,
    fontWeight: FontWeight.w500,
    color: Sf.muted,
  );
  static const caption = TextStyle(
    fontSize: 12,
    height: 1.3,
    fontWeight: FontWeight.w600,
    color: Sf.muted,
  );
  static const micro = TextStyle(
    fontSize: 10.5,
    height: 1.2,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.6,
    color: Sf.muted,
  );
  static const price = TextStyle(
    fontSize: 18,
    height: 1.1,
    fontWeight: FontWeight.w900,
    letterSpacing: -0.6,
    color: Sf.ink,
  );
  static const button = TextStyle(
    fontSize: 15,
    height: 1.1,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.1,
  );
}

ThemeData buildSfTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: Sf.blue,
    primary: Sf.blue,
    secondary: Sf.yellow,
    surface: Sf.white,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: Sf.white,
    splashFactory: InkSparkle.splashFactory,
    fontFamily: 'Segoe UI',
    appBarTheme: const AppBarTheme(
      backgroundColor: Sf.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: SfType.h2,
      iconTheme: IconThemeData(color: Sf.ink),
    ),
    textTheme: const TextTheme(
      bodyLarge: SfType.body,
      bodyMedium: SfType.body,
      bodySmall: SfType.bodyMuted,
      titleLarge: SfType.h2,
      titleMedium: SfType.h3,
      labelLarge: SfType.button,
    ),
    dividerTheme: const DividerThemeData(color: Sf.line, thickness: 1, space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Sf.soft,
      hintStyle: SfType.bodyMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Sf.radiusSm),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Sf.radiusSm),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Sf.radiusSm),
        borderSide: const BorderSide(color: Sf.blue, width: 1.6),
      ),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Sf.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(Sf.radiusLg)),
      ),
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: ZoomPageTransitionsBuilder(),
        TargetPlatform.iOS: ZoomPageTransitionsBuilder(),
        TargetPlatform.windows: ZoomPageTransitionsBuilder(),
        TargetPlatform.macOS: ZoomPageTransitionsBuilder(),
        TargetPlatform.linux: ZoomPageTransitionsBuilder(),
      },
    ),
  );
}

/// Page route with the smooth, app-like slide the buyer flow uses everywhere.
Route<T> sfRoute<T>(Widget page, {RouteSettings? settings}) {
  return PageRouteBuilder<T>(
    settings: settings,
    transitionDuration: const Duration(milliseconds: 340),
    reverseTransitionDuration: const Duration(milliseconds: 260),
    pageBuilder: (_, _, _) => page,
    transitionsBuilder: (context, animation, secondary, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      );
      final offset = Tween(
        begin: const Offset(0.14, 0),
        end: Offset.zero,
      ).animate(curved);
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(position: offset, child: child),
      );
    },
  );
}

/// Sheet-style route used for the auth flow and quick views.
Route<T> sfSheetRoute<T>(Widget page) {
  return PageRouteBuilder<T>(
    opaque: false,
    barrierColor: Sf.ink.withValues(alpha: 0.45),
    transitionDuration: const Duration(milliseconds: 320),
    pageBuilder: (_, _, _) => page,
    transitionsBuilder: (context, animation, secondary, child) {
      final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
      return SlideTransition(
        position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(curved),
        child: child,
      );
    },
  );
}
