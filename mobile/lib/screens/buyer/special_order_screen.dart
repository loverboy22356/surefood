import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';

class SpecialOrderScreen extends StatefulWidget {
  const SpecialOrderScreen({super.key});

  @override
  State<SpecialOrderScreen> createState() => _SpecialOrderScreenState();
}

class _SpecialOrderScreenState extends State<SpecialOrderScreen> {
  static const _eventTypes = [
    ('wedding', 'Wedding', Icons.favorite_rounded),
    ('birthday', 'Birthday', Icons.cake_rounded),
    ('corporate', 'Corporate', Icons.business_center_rounded),
    ('festival', 'Festival', Icons.celebration_rounded),
    ('religious', 'Religious', Icons.church_rounded),
    ('other', 'Other', Icons.more_horiz_rounded),
  ];

  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _guests = TextEditingController();
  final _address = TextEditingController();
  final _items = TextEditingController();
  final _notes = TextEditingController();

  String _eventType = 'wedding';
  DateTime? _date;
  bool _consent = false;
  bool _loading = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_name.text.isEmpty) {
      final state = AppScope.read(context);
      final profile = state.profile;
      _name.text = profile?.displayName ?? '';
      _email.text = profile?.email ?? state.email;
      _phone.text = profile?.phone ?? '';
      _address.text = state.defaultAddress?.line ??
          (profile?.location.isNotEmpty == true ? profile!.location : '');
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _guests.dispose();
    _address.dispose();
    _items.dispose();
    _notes.dispose();
    super.dispose();
  }

  String _formatDate(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date ?? now.add(const Duration(days: 14)),
      firstDate: now.add(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365)),
      helpText: 'Event date',
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(colorScheme: Theme.of(context).colorScheme),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    final guests = int.tryParse(_guests.text.trim()) ?? 0;
    String? error;
    if (_name.text.trim().length < 2) {
      error = 'Enter the name on the request.';
    }
    else if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(_email.text.trim())) {
      error = 'Enter a valid email address.';
    } else if (_phone.text.trim().length < 7) {
      error = 'Enter a phone number we can call.';
    } else if (_date == null) {
      error = 'Choose your event date.';
    } else if (guests < 10 || guests > 10000) {
      error = 'Guest count must be between 10 and 10,000.';
    } else if (_address.text.trim().length < 5) {
      error = 'Enter the delivery address or city.';
    } else if (_items.text.trim().length < 10) {
      error = 'List the food items and quantities you need.';
    } else if (!_consent) {
      error = 'Confirm that this is a request for a quote.';
    }
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AppScope.read(context).api.submitSpecialOrder({
        'consent': true,
        'fullName': _name.text.trim(),
        'email': _email.text.trim(),
        'phone': _phone.text.trim(),
        'eventType': _eventType,
        'eventDate': _formatDate(_date!),
        'guestCount': guests,
        'deliveryAddress': _address.text.trim(),
        'items': _items.text.trim(),
        'notes': _notes.text.trim(),
      });
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.check_circle_rounded, color: Sf.green, size: 40),
          title: const Text('Request received'),
          content: const Text(
            'Our team will come back to you with a quote. The earlier your event date, '
            'the bigger the planning discount your quote can include.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Done'),
            ),
          ],
        ),
      );
      if (mounted) Navigator.of(context).maybePop();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'We could not send the request. Try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Sf.soft,
      appBar: AppBar(title: const Text('Special order'), backgroundColor: Sf.white),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(Sf.gutter, 14, Sf.gutter, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: Sf.gradientBlue,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Sf.yellow,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '24H QUOTES',
                        style: SfType.micro.copyWith(color: Sf.ink, fontSize: 9.5),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  'Feeding a crowd?\nWe plan it with you.',
                  style: SfType.h1.copyWith(color: Sf.white, fontSize: 22, height: 1.15),
                ),
                const SizedBox(height: 8),
                Text(
                  'Weddings, offices, festivals and family events — tell us the menu, the '
                  'headcount and the date, and our team sources it from verified sellers.',
                  style: SfType.caption.copyWith(
                    color: Sf.white.withValues(alpha: 0.88),
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Sf.orangeWash,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Sf.orange.withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, size: 17, color: Sf.orange),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: SfType.caption.copyWith(color: Sf.ink, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          _Card(
            title: 'Event details',
            children: [
              Text('EVENT TYPE', style: SfType.micro.copyWith(color: Sf.muted)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final type in _eventTypes)
                    GestureDetector(
                      onTap: () => setState(() => _eventType = type.$1),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: _eventType == type.$1 ? Sf.ink : Sf.soft,
                          borderRadius: BorderRadius.circular(30),
                          border: Border.all(
                            color: _eventType == type.$1 ? Sf.ink : Sf.line,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              type.$3,
                              size: 14,
                              color: _eventType == type.$1 ? Sf.white : Sf.muted,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              type.$2,
                              style: SfType.caption.copyWith(
                                color: _eventType == type.$1 ? Sf.white : Sf.ink,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              _field('FULL NAME', _name, 'Your full name', TextCapitalization.words),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: _pickDate,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
                        decoration: BoxDecoration(
                          color: Sf.soft,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Sf.line),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.event_rounded, size: 17, color: Sf.muted),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _date == null ? 'Event date' : _formatDate(_date!),
                                style: SfType.body.copyWith(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: _date == null ? Sf.muted : Sf.ink,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _guests,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      style: SfType.body.copyWith(fontWeight: FontWeight.w600),
                      decoration: const InputDecoration(hintText: 'Guests'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _field('FOOD & QUANTITIES', _items, 'e.g. 20 bags of rice, 5 crates of eggs', TextCapitalization.sentences, maxLines: 3),
            ],
          ),
          const SizedBox(height: 12),
          _Card(
            title: 'Contact & delivery',
            children: [
              _field('EMAIL', _email, 'you@example.com', TextCapitalization.none, keyboard: TextInputType.emailAddress),
              _field('PHONE', _phone, '0803 000 0000', TextCapitalization.none, keyboard: TextInputType.phone),
              _field('DELIVERY ADDRESS', _address, 'Venue address or city', TextCapitalization.sentences),
              _field('NOTES (OPTIONAL)', _notes, 'Anything else we should know?', TextCapitalization.sentences, maxLines: 2),
            ],
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => setState(() => _consent = !_consent),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: _consent ? Sf.blue : Sf.white,
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(color: _consent ? Sf.blue : Sf.line, width: 1.6),
                  ),
                  child: _consent
                      ? const Icon(Icons.check_rounded, size: 15, color: Sf.white)
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'This is a request for a quote. I understand a Sure Foodz planner will '
                    'confirm availability and pricing before anything is charged.',
                    style: SfType.caption.copyWith(height: 1.45, fontSize: 11.5),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          SfButton(
            label: 'Request a quote',
            icon: Icons.send_rounded,
            loading: _loading,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller,
    String hint,
    TextCapitalization capitalization, {
    TextInputType? keyboard,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: SfType.micro.copyWith(color: Sf.muted)),
        const SizedBox(height: 5),
        TextField(
          controller: controller,
          keyboardType: keyboard,
          maxLines: maxLines,
          textCapitalization: capitalization,
          style: SfType.body.copyWith(fontWeight: FontWeight.w600),
          decoration: InputDecoration(hintText: hint),
        ),
        const SizedBox(height: 12),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Sf.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Sf.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: SfType.h3.copyWith(fontSize: 14)),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}
