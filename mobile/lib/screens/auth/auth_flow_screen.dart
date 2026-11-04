import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api.dart';
import '../../state.dart';
import '../../theme.dart';
import '../../ui.dart';

/// Opens the auth flow when a guest tries something that needs an account.
///
/// The caller simply awaits this and carries on with the original action when it
/// returns true, so a shopper's intention (add to cart, checkout, wishlist…) is
/// never lost: the action resumes exactly where it was interrupted.
Future<bool> ensureSignedIn(
  BuildContext context, {
  required String reason,
  bool startInSignUp = false,
}) async {
  final state = AppScope.read(context);
  if (state.signedIn) {
    await state.ensureFreshSession();
    return true;
  }
  final result = await Navigator.of(context, rootNavigator: true).push<bool>(
    sfSheetRoute(
      AuthFlowScreen(reason: reason, startInSignUp: startInSignUp),
    ),
  );
  return result == true;
}

enum _Mode { signIn, signUp }

class AuthFlowScreen extends StatefulWidget {
  const AuthFlowScreen({
    super.key,
    required this.reason,
    this.startInSignUp = false,
    this.resetMode = false,
  });

  final String reason;
  final bool startInSignUp;
  final bool resetMode;

  @override
  State<AuthFlowScreen> createState() => _AuthFlowScreenState();
}

class _AuthFlowScreenState extends State<AuthFlowScreen> {
  late _Mode _mode = widget.startInSignUp ? _Mode.signUp : _Mode.signIn;
  bool _codeStep = false;
  bool _loading = false;
  bool _resending = false;
  String? _error;
  int _resendIn = 0;
  Timer? _timer;

  final _email = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _location = TextEditingController();
  final _code = TextEditingController();
  final _codeFocus = FocusNode();

  @override
  void dispose() {
    _timer?.cancel();
    _email.dispose();
    _name.dispose();
    _phone.dispose();
    _location.dispose();
    _code.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  bool _validEmail(String value) =>
      RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(value.trim());

  void _startResendTimer() {
    _timer?.cancel();
    _resendIn = 45;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _resendIn -= 1);
      if (_resendIn <= 0) timer.cancel();
    });
  }

  Future<void> _send() async {
    FocusScope.of(context).unfocus();
    final email = _email.text.trim();
    if (!_validEmail(email)) {
      setState(() => _error = 'Enter a valid email address so we can send your code.');
      return;
    }
    if (_mode == _Mode.signUp) {
      if (_name.text.trim().length < 2) {
        setState(() => _error = 'Enter your full name.');
        return;
      }
      if (_phone.text.trim().length < 7) {
        setState(() => _error = 'Enter a phone number the rider can call.');
        return;
      }
      if (_location.text.trim().length < 3) {
        setState(() => _error = 'Enter your delivery area, e.g. Ikeja, Lagos.');
        return;
      }
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AppScope.read(context).api.requestCode(
        email: email,
        purpose: _mode == _Mode.signUp ? 'signup' : 'login',
        role: 'buyer',
        displayName: _mode == _Mode.signUp ? _name.text.trim() : null,
        phone: _mode == _Mode.signUp ? _phone.text.trim() : null,
        location: _mode == _Mode.signUp ? _location.text.trim() : null,
      );
      if (!mounted) return;
      setState(() {
        _codeStep = true;
        _code.clear();
      });
      _startResendTimer();
      WidgetsBinding.instance.addPostFrameCallback((_) => _codeFocus.requestFocus());
      SfToast.show(
        context,
        'Code sent to $email',
        icon: Icons.mark_email_read_rounded,
        color: Sf.yellow,
      );
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'We could not reach Sure Foodz. Check your connection.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    if (_resendIn > 0 || _resending) return;
    setState(() => _resending = true);
    try {
      await AppScope.read(context).api.requestCode(
        email: _email.text.trim(),
        purpose: _mode == _Mode.signUp ? 'signup' : 'login',
        role: 'buyer',
        displayName: _mode == _Mode.signUp ? _name.text.trim() : null,
        phone: _mode == _Mode.signUp ? _phone.text.trim() : null,
        location: _mode == _Mode.signUp ? _location.text.trim() : null,
      );
      if (mounted) _startResendTimer();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  Future<void> _verify() async {
    FocusScope.of(context).unfocus();
    final code = _code.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'Enter the 6-digit code from your email.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final state = AppScope.read(context);
    try {
      final ticket = await state.api.verifyCode(email: _email.text.trim(), code: code);
      if (ticket.customToken.isEmpty) {
        throw ApiException('That code is no longer valid. Request a new one.', 401);
      }
      final session = await state.api.exchangeCustomToken(ticket.customToken);
      await state.adoptSession(session);
      if (!mounted) return;
      Navigator.of(context).pop(true);
      SfToast.show(
        context,
        'Welcome to Sure Foodz, ${state.displayName}',
        icon: Icons.verified_rounded,
        color: Sf.green,
      );
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'We could not verify that code. Try again.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    return Scaffold(
      backgroundColor: Sf.white,
      resizeToAvoidBottomInset: true,
      body: SingleChildScrollView(
        padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: media.size.height),
          child: Column(
            children: [
              _Header(
                title: _codeStep
                    ? 'Check your inbox'
                    : _mode == _Mode.signUp
                    ? 'Create your account'
                    : 'Welcome back',
                subtitle: _codeStep
                    ? 'We sent a 6-digit code to ${_email.text.trim()}'
                    : _mode == _Mode.signUp
                    ? 'One account for shopping, tracking and pay later.'
                    : 'Sign in to keep shopping where you left off.',
                onClose: () => Navigator.of(context).maybePop(),
              ),
              Transform.translate(
                offset: const Offset(0, -26),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                  padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
                  decoration: BoxDecoration(
                    color: Sf.white,
                    borderRadius: BorderRadius.circular(26),
                    boxShadow: Sf.liftShadow,
                  ),
                  child: _codeStep ? _codeForm() : _credentialForm(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _errorBanner() {
    if (_error == null) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Sf.orangeWash,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Sf.orange.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
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
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required String hint,
    IconData? icon,
    TextInputType? keyboard,
    TextCapitalization capitalization = TextCapitalization.none,
    List<TextInputFormatter>? formatters,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: SfType.micro.copyWith(color: Sf.muted)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboard,
          textCapitalization: capitalization,
          inputFormatters: formatters,
          style: SfType.body.copyWith(fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: icon == null ? null : Icon(icon, size: 19, color: Sf.muted),
          ),
        ),
        const SizedBox(height: 14),
      ],
    );
  }

  Widget _credentialForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: Sf.blueWash,
            borderRadius: BorderRadius.circular(30),
          ),
          child: Row(
            children: [
              for (final mode in _Mode.values)
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() {
                      _mode = mode;
                      _error = null;
                    }),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: _mode == mode ? Sf.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(30),
                        boxShadow: _mode == mode ? Sf.cardShadow : null,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        mode == _Mode.signIn ? 'Sign in' : 'Create account',
                        style: SfType.button.copyWith(
                          fontSize: 13.5,
                          color: _mode == mode ? Sf.ink : Sf.muted,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        _errorBanner(),
        if (_mode == _Mode.signUp) ...[
          _field(
            controller: _name,
            label: 'FULL NAME',
            hint: 'e.g. Amaka Okonkwo',
            icon: Icons.person_outline_rounded,
            keyboard: TextInputType.name,
            capitalization: TextCapitalization.words,
          ),
        ],
        _field(
          controller: _email,
          label: 'EMAIL ADDRESS',
          hint: 'you@example.com',
          icon: Icons.alternate_email_rounded,
          keyboard: TextInputType.emailAddress,
        ),
        if (_mode == _Mode.signUp) ...[
          _field(
            controller: _phone,
            label: 'PHONE NUMBER',
            hint: '0803 000 0000',
            icon: Icons.call_outlined,
            keyboard: TextInputType.phone,
          ),
          _field(
            controller: _location,
            label: 'DELIVERY AREA',
            hint: 'e.g. Ikeja, Lagos',
            icon: Icons.location_on_outlined,
            capitalization: TextCapitalization.words,
          ),
        ],
        const SizedBox(height: 4),
        SfButton(
          label: _mode == _Mode.signUp ? 'Create account' : 'Send sign-in code',
          icon: Icons.arrow_forward_rounded,
          loading: _loading,
          onPressed: _send,
        ),
        const SizedBox(height: 14),
        if (_mode == _Mode.signIn)
          Center(
            child: TextButton(
              onPressed: () => Navigator.of(context).push(
                sfRoute(const ForgotAccessScreen()),
              ),
              child: Text(
                'Trouble signing in?',
                style: SfType.caption.copyWith(color: Sf.blue, fontWeight: FontWeight.w800),
              ),
            ),
          ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Sf.soft,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              const Icon(Icons.lock_outline_rounded, size: 16, color: Sf.green),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Sure Foodz signs you in with an emailed code — no password to forget.',
                  style: SfType.caption.copyWith(fontSize: 11.5, height: 1.4),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _codeForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _errorBanner(),
        Text('ENTER CODE', style: SfType.micro.copyWith(color: Sf.muted)),
        const SizedBox(height: 8),
        TextField(
          controller: _code,
          focusNode: _codeFocus,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          onChanged: (value) {
            if (value.length == 6) _verify();
          },
          style: const TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w900,
            letterSpacing: 14,
            color: Sf.ink,
          ),
          decoration: const InputDecoration(
            counterText: '',
            hintText: '••••••',
            hintStyle: TextStyle(letterSpacing: 14, fontSize: 22, color: Sf.line),
          ),
        ),
        const SizedBox(height: 14),
        SfButton(
          label: 'Verify and continue',
          icon: Icons.verified_rounded,
          loading: _loading,
          onPressed: _verify,
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Didn\'t get it? ', style: SfType.caption),
            TextButton(
              onPressed: _resendIn > 0 || _resending ? null : _resend,
              child: Text(
                _resendIn > 0 ? 'Resend in ${_resendIn}s' : 'Resend code',
                style: SfType.caption.copyWith(
                  color: _resendIn > 0 ? Sf.muted : Sf.blue,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        Center(
          child: TextButton.icon(
            onPressed: () => setState(() {
              _codeStep = false;
              _error = null;
            }),
            icon: const Icon(Icons.arrow_back_rounded, size: 15, color: Sf.muted),
            label: Text(
              'Change email',
              style: SfType.caption.copyWith(color: Sf.muted, fontWeight: FontWeight.w700),
            ),
          ),
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.subtitle, required this.onClose});

  final String title;
  final String subtitle;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: Sf.gradientBlue,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(34)),
      ),
      padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 14, 20, 54),
      child: Stack(
        children: [
          Positioned(
            right: -50,
            top: -60,
            child: Container(
              width: 170,
              height: 170,
              decoration: BoxDecoration(
                color: Sf.yellow.withValues(alpha: 0.20),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Image.asset('assets/images/logo.png', height: 30, fit: BoxFit.contain),
                  const Spacer(),
                  GestureDetector(
                    onTap: onClose,
                    child: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: Sf.white.withValues(alpha: 0.18),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close_rounded, size: 18, color: Sf.white),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              Text(
                title,
                style: SfType.h1.copyWith(color: Sf.white, fontSize: 26),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: SfType.bodyMuted.copyWith(color: Sf.white.withValues(alpha: 0.88), height: 1.4),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Passwordless accounts have no password to reset; this explains the real
/// recovery path and sends a fresh sign-in code.
class ForgotAccessScreen extends StatefulWidget {
  const ForgotAccessScreen({super.key});

  @override
  State<ForgotAccessScreen> createState() => _ForgotAccessScreenState();
}

class _ForgotAccessScreenState extends State<ForgotAccessScreen> {
  final _email = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Forgot access')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(Sf.gutter),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('No password needed', style: SfType.h1),
            const SizedBox(height: 8),
            Text(
              'Sure Foodz accounts use a one-time code sent to your email instead of a '
              'password. Enter your email and we will send a fresh code so you can get '
              'straight back in.',
              style: SfType.bodyMuted.copyWith(height: 1.55),
            ),
            const SizedBox(height: 20),
            Text('EMAIL ADDRESS', style: SfType.micro.copyWith(color: Sf.muted)),
            const SizedBox(height: 6),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                hintText: 'you@example.com',
                prefixIcon: Icon(Icons.alternate_email_rounded, size: 19, color: Sf.muted),
              ),
            ),
            const SizedBox(height: 18),
            SfButton(
              label: 'Send me a sign-in code',
              loading: _loading,
              onPressed: () async {
                final email = _email.text.trim();
                if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(email)) {
                  SfToast.show(context, 'Enter a valid email address', icon: Icons.error_outline_rounded, color: Sf.orange);
                  return;
                }
                setState(() => _loading = true);
                final api = AppScope.read(context).api;
                final navigator = Navigator.of(context);
                try {
                  await api.requestCode(email: email, purpose: 'login');
                  if (!mounted) return;
                  navigator.pushReplacement(
                    sfRoute(AuthFlowScreen(reason: 'Sign in to your Sure Foodz account')),
                  );
                } on ApiException catch (error) {
                  if (!mounted) return;
                  SfToast.show(this.context, error.message, icon: Icons.error_outline_rounded, color: Sf.orange);
                } finally {
                  if (mounted) setState(() => _loading = false);
                }
              },
            ),
            const SizedBox(height: 22),
            _InfoRow(
              icon: Icons.support_agent_rounded,
              title: 'Still stuck?',
              body: 'Our team can check your account from support@surefoodz.com.',
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.title, required this.body});

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Sf.soft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 19, color: Sf.blue),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: SfType.h3.copyWith(fontSize: 13.5)),
                const SizedBox(height: 3),
                Text(body, style: SfType.caption.copyWith(height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
