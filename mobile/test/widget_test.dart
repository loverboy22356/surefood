import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:surefoodz_mobile/main.dart';

void main() {
  testWidgets('splash hands over to the three-page onboarding', (tester) async {
    await tester.pumpWidget(const SureFoodzApp());
    await tester.pump();

    expect(find.text('Fresh Food. Better Living.'), findsOneWidget);

    // Splash timer + fade into onboarding.
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('WELCOME TO SURE FOODZ'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
    expect(find.text('Skip'), findsOneWidget);

    // Swiping through the three pages keeps the same narrative.
    await tester.drag(find.byType(PageView), const Offset(-500, 0));
    await tester.pumpAndSettle();
    expect(find.text('SHOP SMARTER'), findsOneWidget);

    await tester.drag(find.byType(PageView), const Offset(-500, 0));
    await tester.pumpAndSettle();
    expect(find.text('PAY YOUR WAY'), findsOneWidget);
    expect(find.text('Get started'), findsOneWidget);
  });

  testWidgets('guests can skip onboarding straight into the buyer homepage',
      (tester) async {
    await tester.pumpWidget(const SureFoodzApp());
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 600));

    await tester.tap(find.text('Skip'));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 400));

    // The shell is up: bottom navigation and the guest shopping header are visible
    // even though the live catalog cannot load inside a unit test.
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Stores'), findsOneWidget);
    expect(find.text('Search'), findsOneWidget);
    expect(find.text('Activity'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);
  });
}
