import 'dart:async';
import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import 'api.dart';
import 'theme.dart';

/* ------------------------------------------------------------------ buttons */

enum SfButtonVariant { primary, gold, dark, outline, ghost }

class SfButton extends StatefulWidget {
  const SfButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.variant = SfButtonVariant.primary,
    this.loading = false,
    this.expanded = true,
    this.height = 52,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final SfButtonVariant variant;
  final bool loading;
  final bool expanded;
  final double height;

  @override
  State<SfButton> createState() => _SfButtonState();
}

class _SfButtonState extends State<SfButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !widget.loading;
    late Color bg;
    late Color fg;
    Border? border;
    switch (widget.variant) {
      case SfButtonVariant.primary:
        bg = Sf.blue;
        fg = Sf.white;
      case SfButtonVariant.gold:
        bg = Sf.yellow;
        fg = Sf.ink;
      case SfButtonVariant.dark:
        bg = Sf.ink;
        fg = Sf.white;
      case SfButtonVariant.outline:
        bg = Sf.white;
        fg = Sf.ink;
        border = Border.all(color: Sf.line, width: 1.4);
      case SfButtonVariant.ghost:
        bg = Sf.blueWash;
        fg = Sf.blue;
    }
    final child = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: widget.expanded ? MainAxisSize.max : MainAxisSize.min,
      children: [
        if (widget.loading)
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2.2, color: fg),
          )
        else if (widget.icon != null) ...[
          Icon(widget.icon, size: 19, color: fg),
          const SizedBox(width: 8),
        ],
        if (!widget.loading)
          Flexible(
            child: Text(
              widget.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: SfType.button.copyWith(color: fg),
            ),
          ),
      ],
    );
    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _down = true) : null,
      onTapCancel: () => setState(() => _down = false),
      onTapUp: enabled ? (_) => setState(() => _down = false) : null,
      onTap: enabled ? widget.onPressed : null,
      child: AnimatedScale(
        scale: _down ? 0.97 : 1,
        duration: const Duration(milliseconds: 120),
        child: Opacity(
          opacity: enabled ? 1 : 0.5,
          child: Container(
            height: widget.height,
            padding: const EdgeInsets.symmetric(horizontal: 22),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(14),
              border: border,
              boxShadow: widget.variant == SfButtonVariant.primary
                  ? [
                      BoxShadow(
                        color: Sf.blue.withValues(alpha: 0.28),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                        spreadRadius: -8,
                      ),
                    ]
                  : null,
            ),
            alignment: Alignment.center,
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Round icon button with an optional unread/count badge.
class SfIconButton extends StatelessWidget {
  const SfIconButton({
    super.key,
    required this.icon,
    this.onPressed,
    this.badge = 0,
    this.filled = false,
    this.size = 42,
    this.tooltip,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final int badge;
  final bool filled;
  final double size;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final button = GestureDetector(
      onTap: onPressed,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: filled ? Sf.soft : Colors.transparent,
          shape: BoxShape.circle,
        ),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Icon(icon, size: size * 0.52, color: Sf.ink),
            if (badge > 0)
              Positioned(
                right: 2,
                top: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  constraints: const BoxConstraints(minWidth: 17),
                  decoration: BoxDecoration(
                    color: Sf.orange,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Sf.white, width: 1.6),
                  ),
                  child: Text(
                    badge > 99 ? '99+' : '$badge',
                    textAlign: TextAlign.center,
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
    );
    return tooltip == null ? button : Tooltip(message: tooltip!, child: button);
  }
}

/* ------------------------------------------------------------------- images */

/// Resolves a media path from the API (`/uploads/x.png`) against the API host.
String mediaUrl(String raw) {
  if (raw.isEmpty) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return '${ApiClient.baseUrl}$raw';
  return raw;
}

class SfImage extends StatelessWidget {
  const SfImage(
    this.url, {
    super.key,
    this.fit = BoxFit.cover,
    this.radius = 0,
    this.aspect,
    this.width,
    this.height,
    this.background = Sf.soft,
    this.alignment = Alignment.center,
  });

  final String url;
  final BoxFit fit;
  final double radius;
  final double? aspect;
  final double? width;
  final double? height;
  final Color background;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    final resolved = mediaUrl(url);
    Widget child;
    if (resolved.isEmpty) {
      child = _fallback();
    } else {
      child = Image.network(
        resolved,
        fit: fit,
        width: width,
        height: height,
        alignment: alignment,
        gaplessPlayback: true,
        frameBuilder: (context, image, frame, sync) {
          if (sync) return image;
          return AnimatedOpacity(
            opacity: frame == null ? 0 : 1,
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeOut,
            child: image,
          );
        },
        loadingBuilder: (context, image, progress) {
          if (progress == null) return image;
          return _fallback(shimmer: true);
        },
        errorBuilder: (_, _, _) => _fallback(),
      );
    }
    final sized = SizedBox(width: width, height: height, child: child);
    final clipped = radius <= 0
        ? sized
        : ClipRRect(borderRadius: BorderRadius.circular(radius), child: sized);
    if (aspect == null) return clipped;
    return AspectRatio(aspectRatio: aspect!, child: clipped);
  }

  Widget _fallback({bool shimmer = false}) {
    return Container(
      decoration: BoxDecoration(
        color: background,
        gradient: shimmer
            ? null
            : LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Sf.soft, Sf.blueWash],
              ),
      ),
      alignment: Alignment.center,
      child: shimmer
          ? const SfShimmer()
          : Icon(Icons.image_outlined, color: Sf.blue.withValues(alpha: 0.35), size: 26),
    );
  }
}

/// Animated shimmer placeholder used by every loading state.
class SfShimmer extends StatefulWidget {
  const SfShimmer({super.key, this.radius = 0, this.height, this.width = double.infinity});

  final double radius;
  final double? height;
  final double width;

  @override
  State<SfShimmer> createState() => _SfShimmerState();
}

class _SfShimmerState extends State<SfShimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(-1 + 2 * t, 0),
              end: Alignment(1 + 2 * t, 0),
              colors: [Sf.soft, Sf.soft, Sf.line.withValues(alpha: 0.55), Sf.soft, Sf.soft],
              stops: const [0, 0.35, 0.5, 0.65, 1],
            ),
          ),
        );
      },
    );
  }
}

/* -------------------------------------------------------------------- badges */

class SfTag extends StatelessWidget {
  const SfTag({
    super.key,
    required this.label,
    this.color = Sf.orange,
    this.icon,
    this.solid = true,
  });

  final String label;
  final Color color;
  final IconData? icon;
  final bool solid;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: solid ? color : color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: solid ? Sf.white : color),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: TextStyle(
              color: solid ? Sf.white : color,
              fontSize: 10.5,
              height: 1.1,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

class SfChip extends StatelessWidget {
  const SfChip({
    super.key,
    required this.label,
    this.selected = false,
    this.onTap,
    this.icon,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? Sf.ink : Sf.soft,
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: selected ? Sf.ink : Sf.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: selected ? Sf.white : Sf.muted),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                height: 1.1,
                fontWeight: FontWeight.w700,
                color: selected ? Sf.white : Sf.ink,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SfStars extends StatelessWidget {
  const SfStars({super.key, required this.value, this.size = 12, this.showValue = true});

  final double value;
  final double size;
  final bool showValue;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < 5; i++)
          Icon(
            value >= i + 0.75
                ? Icons.star_rounded
                : value >= i + 0.25
                ? Icons.star_half_rounded
                : Icons.star_rounded,
            size: size,
            color: value >= i + 0.25 ? Sf.yellow : Sf.line,
          ),
        if (showValue) ...[
          const SizedBox(width: 4),
          Text(value.toStringAsFixed(1), style: SfType.caption.copyWith(fontWeight: FontWeight.w800)),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ pricing */

class SfPrice extends StatelessWidget {
  const SfPrice({
    super.key,
    required this.product,
    this.big = false,
    this.onSoft = false,
  });

  final Product product;
  final bool big;
  final bool onSoft;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Flexible(
          child: Text(
            naira(product.priceMinor),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: (big ? SfType.display.copyWith(fontSize: 30) : SfType.price).copyWith(
              color: onSoft ? Sf.ink : (big ? Sf.blue : Sf.ink),
            ),
          ),
        ),
        if (product.discounted) ...[
          const SizedBox(width: 6),
          Padding(
            padding: EdgeInsets.only(bottom: big ? 4 : 1),
            child: Text(
              naira(product.compareAtMinor!),
              style: SfType.caption.copyWith(
                decoration: TextDecoration.lineThrough,
                color: Sf.muted,
                fontSize: big ? 14 : 11.5,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------- section */

class SfSectionHeader extends StatelessWidget {
  const SfSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.onSeeAll,
    this.actionLabel = 'See all',
    this.icon,
    this.padding = const EdgeInsets.fromLTRB(Sf.gutter, 22, Sf.gutter, 12),
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onSeeAll;
  final String actionLabel;
  final IconData? icon;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (icon != null) ...[
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: Sf.yellowWash,
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(icon, size: 19, color: Sf.ink),
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: SfType.h2),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: SfType.bodyMuted.copyWith(fontSize: 12.5),
                    ),
                  ),
              ],
            ),
          ),
          if (onSeeAll != null)
            GestureDetector(
              onTap: onSeeAll,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Row(
                  children: [
                    Text(
                      actionLabel,
                      style: SfType.caption.copyWith(color: Sf.blue, fontWeight: FontWeight.w800),
                    ),
                    const Icon(Icons.chevron_right_rounded, size: 18, color: Sf.blue),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/* ---------------------------------------------------------------- countdown */

class SfCountdown extends StatefulWidget {
  const SfCountdown({
    super.key,
    required this.endsAt,
    this.onDark = true,
    this.compact = false,
  });

  final DateTime endsAt;
  final bool onDark;
  final bool compact;

  @override
  State<SfCountdown> createState() => _SfCountdownState();
}

class _SfCountdownState extends State<SfCountdown> {
  Timer? _timer;
  Duration _left = Duration.zero;

  @override
  void initState() {
    super.initState();
    _tick();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    final left = widget.endsAt.difference(DateTime.now());
    if (!mounted) return;
    setState(() => _left = left.isNegative ? Duration.zero : left);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _two(int value) => value.toString().padLeft(2, '0');

  @override
  Widget build(BuildContext context) {
    final parts = [_two(_left.inHours), _two(_left.inMinutes % 60), _two(_left.inSeconds % 60)];
    final boxColor = widget.onDark ? Sf.ink : Sf.white;
    final fg = widget.onDark ? Sf.white : Sf.ink;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < parts.length; i++) ...[
          if (i > 0)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Text(
                ':',
                style: TextStyle(
                  color: fg,
                  fontWeight: FontWeight.w900,
                  fontSize: widget.compact ? 12 : 14,
                ),
              ),
            ),
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: widget.compact ? 5 : 7,
              vertical: widget.compact ? 3 : 5,
            ),
            decoration: BoxDecoration(
              color: boxColor,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              parts[i],
              style: TextStyle(
                color: fg,
                fontWeight: FontWeight.w900,
                fontSize: widget.compact ? 12 : 14,
                height: 1,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/* ------------------------------------------------------------------ stepper */

class SfQty extends StatelessWidget {
  const SfQty({
    super.key,
    required this.value,
    required this.onChanged,
    this.min = 1,
    this.max = 99,
    this.compact = false,
  });

  final int value;
  final ValueChanged<int> onChanged;
  final int min;
  final int max;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final dim = compact ? 28.0 : 34.0;
    Widget button(IconData icon, VoidCallback? onTap, {bool filled = false}) {
      return GestureDetector(
        onTap: onTap,
        child: Container(
          width: dim,
          height: dim,
          decoration: BoxDecoration(
            color: filled ? Sf.ink : Sf.soft,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Icon(icon, size: compact ? 15 : 18, color: filled ? Sf.white : Sf.ink),
        ),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        button(Icons.remove_rounded, value > min ? () => onChanged(value - 1) : null),
        Container(
          width: compact ? 30 : 38,
          alignment: Alignment.center,
          child: Text(
            '$value',
            style: SfType.h3.copyWith(fontSize: compact ? 13 : 15),
          ),
        ),
        button(Icons.add_rounded, value < max ? () => onChanged(value + 1) : null, filled: true),
      ],
    );
  }
}

/* ------------------------------------------------------------- product card */

class SfProductCard extends StatefulWidget {
  const SfProductCard({
    super.key,
    required this.product,
    required this.onTap,
    required this.onAdd,
    this.wishlisted = false,
    this.onWishlist,
    this.heroTag,
  });

  final Product product;
  final VoidCallback onTap;
  final VoidCallback onAdd;
  final bool wishlisted;
  final VoidCallback? onWishlist;
  final String? heroTag;

  @override
  State<SfProductCard> createState() => _SfProductCardState();
}

class _SfProductCardState extends State<SfProductCard> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    return GestureDetector(
      onTapDown: (_) => setState(() => _down = true),
      onTapCancel: () => setState(() => _down = false),
      onTapUp: (_) => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? 0.985 : 1,
        duration: const Duration(milliseconds: 130),
        child: Container(
          decoration: BoxDecoration(
            color: Sf.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Sf.line),
            boxShadow: Sf.cardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(7),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: AspectRatio(
                        aspectRatio: 1,
                        child: SfImage(
                          p.imageUrl,
                          fit: BoxFit.cover,
                          background: Sf.soft,
                        ),
                      ),
                    ),
                  ),
                  if (p.discounted)
                    Positioned(
                      left: 13,
                      top: 13,
                      child: SfTag(label: '-${p.discountPercent}%', color: Sf.orange),
                    ),
                  if (p.soldOut)
                    Positioned.fill(
                      child: Container(
                        margin: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: Sf.ink.withValues(alpha: 0.42),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        alignment: Alignment.center,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Sf.white,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('Sold out', style: SfType.caption),
                        ),
                      ),
                    ),
                  Positioned(
                    right: 11,
                    top: 11,
                    child: GestureDetector(
                      onTap: widget.onWishlist,
                      child: Container(
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          color: Sf.white.withValues(alpha: 0.94),
                          shape: BoxShape.circle,
                          boxShadow: Sf.cardShadow,
                        ),
                        child: Icon(
                          widget.wishlisted ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                          size: 16,
                          color: widget.wishlisted ? Sf.orange : Sf.ink,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(11, 2, 11, 11),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      height: 34,
                      child: Text(
                        p.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: SfType.body.copyWith(fontSize: 12.8, height: 1.3, fontWeight: FontWeight.w600),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(child: SfPrice(product: p)),
                        GestureDetector(
                          onTap: p.soldOut ? null : widget.onAdd,
                          child: Container(
                            width: 30,
                            height: 30,
                            decoration: BoxDecoration(
                              color: p.soldOut ? Sf.line : Sf.blue,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              Icons.add_rounded,
                              size: 19,
                              color: p.soldOut ? Sf.muted : Sf.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        if (p.sellerVerified)
                          const Padding(
                            padding: EdgeInsets.only(right: 3),
                            child: Icon(Icons.verified_rounded, size: 12, color: Sf.blue),
                          ),
                        Expanded(
                          child: Text(
                            p.sellerName.isEmpty ? 'Sure Foodz seller' : p.sellerName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: SfType.caption.copyWith(fontSize: 10.5),
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

/// Compact horizontal product row used in cart-adjacent and vendor views.
class SfProductRow extends StatelessWidget {
  const SfProductRow({
    super.key,
    required this.product,
    required this.onTap,
    this.trailing,
    this.subtitle,
  });

  final Product product;
  final VoidCallback onTap;
  final Widget? trailing;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 64,
              height: 64,
              child: SfImage(product.imageUrl),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SfType.h3.copyWith(fontSize: 14),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle ?? product.sellerName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: SfType.caption,
                ),
                const SizedBox(height: 4),
                Text(
                  naira(product.priceMinor),
                  style: SfType.price.copyWith(fontSize: 14.5),
                ),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
        ],
      ),
    );
  }
}

/* ------------------------------------------------------------------- sheets */

Future<T?> sfSheet<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  bool scrollable = true,
  bool dismissible = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    isDismissible: dismissible,
    enableDrag: dismissible,
    backgroundColor: Colors.transparent,
    builder: (context) {
      final media = MediaQuery.of(context);
      final child = Container(
        decoration: const BoxDecoration(
          color: Sf.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(Sf.radiusLg)),
        ),
        padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
        child: SafeArea(
          top: false,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: media.size.height * 0.9),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: 10),
                Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Sf.line,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                Flexible(
                  child: scrollable
                      ? SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
                          child: builder(context),
                        )
                      : Padding(
                          padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
                          child: builder(context),
                        ),
                ),
              ],
            ),
          ),
        ),
      );
      return child;
    },
  );
}

/* -------------------------------------------------------------------- toast */

class SfToast {
  static void show(
    BuildContext context,
    String message, {
    IconData icon = Icons.check_circle_rounded,
    Color color = Sf.green,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => _ToastHost(
        message: message,
        icon: icon,
        color: color,
        actionLabel: actionLabel,
        onAction: onAction,
        onDone: () {
          if (entry.mounted) entry.remove();
        },
      ),
    );
    overlay.insert(entry);
  }
}

class _ToastHost extends StatefulWidget {
  const _ToastHost({
    required this.message,
    required this.icon,
    required this.color,
    required this.onDone,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final IconData icon;
  final Color color;
  final VoidCallback onDone;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  State<_ToastHost> createState() => _ToastHostState();
}

class _ToastHostState extends State<_ToastHost> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 280),
  )..forward();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 2400), () async {
      if (!mounted) return;
      await _controller.reverse();
      if (mounted) widget.onDone();
    });
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
    return Positioned(
      top: MediaQuery.of(context).padding.top + 10,
      left: 14,
      right: 14,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, -1.2), end: Offset.zero).animate(curved),
        child: FadeTransition(
          opacity: curved,
          child: Material(
            color: Colors.transparent,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Sf.ink,
                borderRadius: BorderRadius.circular(14),
                boxShadow: Sf.liftShadow,
              ),
              child: Row(
                children: [
                  Icon(widget.icon, color: widget.color, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      widget.message,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Sf.white,
                        fontSize: 13,
                        height: 1.3,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (widget.actionLabel != null)
                    GestureDetector(
                      onTap: () {
                        widget.onAction?.call();
                        widget.onDone();
                      },
                      child: Padding(
                        padding: const EdgeInsets.only(left: 10),
                        child: Text(
                          widget.actionLabel!,
                          style: const TextStyle(
                            color: Sf.yellow,
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/* -------------------------------------------------------------------- empty */

class SfEmpty extends StatelessWidget {
  const SfEmpty({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
    this.compact = false,
  });

  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 28, vertical: compact ? 26 : 52),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 78,
            height: 78,
            decoration: BoxDecoration(
              color: Sf.blueWash,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 34, color: Sf.blue),
          ),
          const SizedBox(height: 16),
          Text(title, textAlign: TextAlign.center, style: SfType.h3),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, textAlign: TextAlign.center, style: SfType.bodyMuted),
          ],
          if (action != null) ...[const SizedBox(height: 18), action!],
        ],
      ),
    );
  }
}

/* -------------------------------------------------------------------- tiles */

class SfTile extends StatelessWidget {
  const SfTile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.tint = Sf.blue,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Color tint;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: tint.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: tint),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: SfType.h3.copyWith(fontSize: 14.5)),
                  if (subtitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: Text(subtitle!, style: SfType.caption),
                    ),
                ],
              ),
            ),
            trailing ?? const Icon(Icons.chevron_right_rounded, color: Sf.muted, size: 20),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------------------------------------------- chrome */

/// Frosted header used when content scrolls underneath it.
class SfGlassHeader extends StatelessWidget {
  const SfGlassHeader({super.key, required this.child, this.opacity = 0.92});

  final Widget child;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          color: Sf.white.withValues(alpha: opacity),
          child: child,
        ),
      ),
    );
  }
}

/// Sticky bottom action bar with an upward shadow, safe-area aware.
class SfBottomBar extends StatelessWidget {
  const SfBottomBar({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Sf.white,
        border: const Border(top: BorderSide(color: Sf.line)),
        boxShadow: [
          BoxShadow(
            color: Sf.ink.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      padding: padding ??
          EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.of(context).padding.bottom),
      child: child,
    );
  }
}

/// Three-dot loading rows for list screens.
class SfListSkeleton extends StatelessWidget {
  const SfListSkeleton({super.key, this.count = 5, this.height = 74});

  final int count;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < count; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Row(
              children: [
                SfShimmer(height: height, width: height, radius: 14),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SfShimmer(height: 13, radius: 6),
                      const SizedBox(height: 8),
                      FractionallySizedBox(
                        widthFactor: 0.6,
                        child: SfShimmer(height: 11, radius: 6),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class SfGridSkeleton extends StatelessWidget {
  const SfGridSkeleton({super.key, this.count = 6});

  final int count;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(Sf.gutter),
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.64,
      ),
      itemCount: count,
      itemBuilder: (context, index) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: SfShimmer(radius: 16)),
          const SizedBox(height: 8),
          SfShimmer(height: 12, radius: 6),
          const SizedBox(height: 6),
          FractionallySizedBox(widthFactor: 0.5, child: SfShimmer(height: 12, radius: 6)),
        ],
      ),
    );
  }
}
