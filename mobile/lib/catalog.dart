import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';
import 'ui.dart';

/// Buyer catalogue components that follow the reference screens' geometry:
/// circular header actions, the pill search field, section headings, the
/// two-column product card, the popular-search tile and the seller mark.

/// Circular white action used in the buyer headers (basket, bell, cart, back).
class SfCircleAction extends StatelessWidget {
  const SfCircleAction({
    super.key,
    required this.icon,
    this.onPressed,
    this.badge = 0,
    this.size = 44,
    this.tooltip,
    this.background = Sf.white,
    this.iconColor = Sf.ink,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final int badge;
  final double size;
  final String? tooltip;
  final Color background;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip,
      child: InkResponse(
        onTap: onPressed,
        radius: size * 0.62,
        child: SizedBox(
          width: size,
          height: size,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: background,
                  shape: BoxShape.circle,
                  border: Border.all(color: Sf.line),
                  boxShadow: Sf.cardShadow,
                ),
                child: Icon(icon, size: size * 0.46, color: iconColor),
              ),
              if (badge > 0)
                Positioned(
                  right: -1,
                  top: -2,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    constraints: const BoxConstraints(minWidth: 19, minHeight: 19),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Sf.orange,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Sf.white, width: 1.8),
                    ),
                    child: Text(
                      badge > 9 ? '9+' : '$badge',
                      style: const TextStyle(
                        color: Sf.white,
                        fontSize: 9.5,
                        height: 1.1,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pill search field with the filter control on the right.
class SfPillField extends StatelessWidget {
  const SfPillField({
    super.key,
    required this.hint,
    this.controller,
    this.focusNode,
    this.onChanged,
    this.onSubmitted,
    this.onTap,
    this.onClear,
    this.onFilter,
    this.autofocus = false,
    this.readOnly = false,
    this.height = 54,
    this.icon = Icons.search_rounded,
  });

  final String hint;
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onTap;
  final VoidCallback? onClear;
  final VoidCallback? onFilter;
  final bool autofocus;
  final bool readOnly;
  final double height;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Sf.white,
        borderRadius: BorderRadius.circular(height / 2),
        border: Border.all(color: Sf.line),
        boxShadow: Sf.cardShadow,
      ),
      padding: const EdgeInsets.only(left: 16, right: 6),
      child: Row(
        children: [
          Icon(icon, size: 22, color: Sf.muted),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              autofocus: autofocus,
              readOnly: readOnly,
              onTap: onTap,
              onChanged: onChanged,
              onSubmitted: onSubmitted,
              textInputAction: TextInputAction.search,
              style: SfType.body.copyWith(fontSize: 14),
              cursorColor: Sf.blue,
              decoration: InputDecoration(
                isDense: true,
                filled: false,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                hintText: hint,
                hintStyle: SfType.bodyMuted.copyWith(fontSize: 14),
              ),
            ),
          ),
          if (onClear != null)
            InkResponse(
              onTap: onClear,
              radius: 18,
              child: const Padding(
                padding: EdgeInsets.all(4),
                child: Icon(Icons.close_rounded, size: 18, color: Sf.muted),
              ),
            ),
          if (onFilter != null)
            Padding(
              padding: const EdgeInsets.only(left: 6, right: 3),
              child: InkResponse(
                onTap: onFilter,
                radius: 22,
                child: Container(
                  width: height - 14,
                  height: height - 14,
                  decoration: const BoxDecoration(color: Sf.soft, shape: BoxShape.circle),
                  child: const Icon(Icons.tune_rounded, size: 19, color: Sf.ink),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Section heading with the blue "View all ›" affordance on the right.
class SfSectionTitle extends StatelessWidget {
  const SfSectionTitle({
    super.key,
    required this.title,
    this.actionLabel = 'View all',
    this.onAction,
    this.padding = const EdgeInsets.symmetric(horizontal: Sf.gutter),
  });

  final String title;
  final String actionLabel;
  final VoidCallback? onAction;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: SfType.h2.copyWith(fontSize: 19.5, letterSpacing: -0.5)),
          ),
          if (onAction != null)
            InkWell(
              onTap: onAction,
              borderRadius: BorderRadius.circular(10),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                child: Row(
                  children: [
                    Text(
                      actionLabel,
                      style: SfType.body.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Sf.blue,
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded, size: 19, color: Sf.blue),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Two-column catalogue card: free-delivery ribbon, product photo, name,
/// subtitle, price with the struck-through old price and the round add button.
class SfCatalogCard extends StatefulWidget {
  const SfCatalogCard({
    super.key,
    required this.product,
    required this.onTap,
    required this.onAdd,
    this.freeDelivery = true,
    this.showAdd = true,
    this.showName = true,
  });

  final Product product;
  final VoidCallback onTap;
  final VoidCallback onAdd;
  final bool freeDelivery;
  final bool showAdd;
  final bool showName;

  @override
  State<SfCatalogCard> createState() => _SfCatalogCardState();
}

class _SfCatalogCardState extends State<SfCatalogCard> {
  bool _down = false;

  String get _subtitle {
    final unit = widget.product.unit.trim();
    if (unit.isNotEmpty) return unit;
    final category = widget.product.category.trim();
    return category.isEmpty ? 'Fresh & quality checked' : category;
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    return AnimatedScale(
      scale: _down ? 0.975 : 1,
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeOut,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: Container(
          decoration: BoxDecoration(
            color: Sf.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Sf.line),
            boxShadow: Sf.cardShadow,
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  AspectRatio(
                    aspectRatio: 1.12,
                    child: SfImage(
                      product.imageUrl,
                      fit: BoxFit.cover,
                      radius: 0,
                      background: Sf.soft,
                    ),
                  ),
                  if (widget.freeDelivery)
                    Positioned(
                      left: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(8, 4, 9, 4),
                        decoration: BoxDecoration(
                          color: Sf.blue,
                          borderRadius: BorderRadius.circular(9),
                          boxShadow: [
                            BoxShadow(
                              color: Sf.blue.withValues(alpha: 0.28),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.electric_moped_rounded, size: 14, color: Sf.white),
                            SizedBox(width: 4),
                            Text(
                              'Free Delivery',
                              style: TextStyle(
                                color: Sf.white,
                                fontSize: 10.5,
                                height: 1.1,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  if (product.soldOut)
                    const Positioned(
                      right: 8,
                      top: 8,
                      child: SfTag(label: 'Sold out', color: Sf.muted, solid: true),
                    ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 10, 11),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (widget.showName) ...[
                      Text(
                        product.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: SfType.h3.copyWith(fontSize: 15, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: SfType.bodyMuted.copyWith(fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 9),
                    ],
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                naira(product.priceMinor),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: SfType.price.copyWith(fontSize: 17, color: Sf.blue),
                              ),
                              if (product.discounted)
                                Text(
                                  naira(product.compareAtMinor!),
                                  style: SfType.caption.copyWith(
                                    fontSize: 11.5,
                                    decoration: TextDecoration.lineThrough,
                                    decorationColor: Sf.muted,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (widget.showAdd)
                          InkResponse(
                            onTap: product.soldOut ? null : widget.onAdd,
                            radius: 22,
                            child: Container(
                              width: 33,
                              height: 33,
                              decoration: BoxDecoration(
                                color: product.soldOut ? Sf.soft : Sf.blue,
                                shape: BoxShape.circle,
                                boxShadow: product.soldOut
                                    ? null
                                    : [
                                        BoxShadow(
                                          color: Sf.blue.withValues(alpha: 0.32),
                                          blurRadius: 12,
                                          offset: const Offset(0, 5),
                                        ),
                                      ],
                              ),
                              child: Icon(
                                Icons.add_rounded,
                                size: 21,
                                color: product.soldOut ? Sf.muted : Sf.white,
                              ),
                            ),
                          ),
                      ],
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

/// Square, tinted tile used by the popular-searches grid.
class SfSearchTile extends StatelessWidget {
  const SfSearchTile({
    super.key,
    required this.label,
    required this.icon,
    required this.tint,
    required this.onTap,
    this.iconColor,
  });

  final String label;
  final IconData icon;
  final Color tint;
  final VoidCallback onTap;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(16)),
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 7),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Center(
                child: Icon(icon, size: 30, color: iconColor ?? Sf.ink.withValues(alpha: 0.62)),
              ),
            ),
            Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: SfType.caption.copyWith(
                fontSize: 10.5,
                height: 1.2,
                color: Sf.ink,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Round or rounded seller mark used by the store rails and store cards.
class SfSellerLogo extends StatelessWidget {
  const SfSellerLogo({super.key, required this.seller, this.size = 46, this.radius});

  final Seller seller;
  final double size;
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final r = radius ?? size / 2;
    final logo = seller.logoUrl.trim();
    return ClipRRect(
      borderRadius: BorderRadius.circular(r),
      child: SizedBox(
        width: size,
        height: size,
        child: logo.isEmpty
            ? Container(
                color: Sf.soft,
                alignment: Alignment.center,
                child: Text(
                  seller.emoji.trim().isEmpty ? '🏪' : seller.emoji.trim(),
                  style: TextStyle(fontSize: size * 0.44),
                ),
              )
            : SfImage(logo, fit: BoxFit.cover, radius: 0, background: Sf.soft),
      ),
    );
  }
}
