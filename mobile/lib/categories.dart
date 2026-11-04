import 'package:flutter/material.dart';

import 'theme.dart';

/// Category artwork is drawn with Material symbols in brand tints so every
/// category — including ones a seller adds later — renders without needing an
/// uploaded image.
IconData categoryIcon(String label) {
  final name = label.toLowerCase();
  if (name.contains('fruit')) return Icons.emoji_food_beverage_rounded;
  if (name.contains('vegetable') || name.contains('veg')) return Icons.eco_rounded;
  if (name.contains('meat') || name.contains('seafood') || name.contains('fish')) {
    return Icons.set_meal_rounded;
  }
  if (name.contains('dairy') || name.contains('egg')) return Icons.egg_alt_rounded;
  if (name.contains('grain') || name.contains('rice') || name.contains('staple')) {
    return Icons.rice_bowl_rounded;
  }
  if (name.contains('bak')) return Icons.bakery_dining_rounded;
  if (name.contains('drink') || name.contains('beverage') || name.contains('juice')) {
    return Icons.local_drink_rounded;
  }
  if (name.contains('snack') || name.contains('biscuit')) return Icons.cookie_rounded;
  if (name.contains('frozen')) return Icons.ac_unit_rounded;
  if (name.contains('health') || name.contains('beauty')) return Icons.spa_rounded;
  if (name.contains('baby') || name.contains('kid')) return Icons.child_friendly_rounded;
  if (name.contains('house') || name.contains('clean')) return Icons.cleaning_services_rounded;
  if (name.contains('provision') || name.contains('pantry')) return Icons.local_grocery_store_rounded;
  if (name.contains('spice') || name.contains('season')) return Icons.grain_rounded;
  if (name.contains('oil')) return Icons.water_drop_rounded;
  if (name.contains('farm') || name.contains('agri')) return Icons.agriculture_rounded;
  return Icons.shopping_basket_rounded;
}

const _tints = [Sf.blue, Sf.orange, Sf.green, Sf.yellow];

Color categoryTint(String label) {
  final sum = label.codeUnits.fold<int>(0, (value, unit) => value + unit);
  return _tints[sum % _tints.length];
}
