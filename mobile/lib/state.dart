import 'package:flutter/material.dart';

import 'api.dart';

/// One line in the basket.
class CartLine {
  CartLine({required this.product, required this.quantity});
  final Product product;
  int quantity;

  int get lineTotalMinor => product.priceMinor * quantity;
}

class DeliveryAddress {
  const DeliveryAddress({
    required this.id,
    required this.label,
    required this.line,
    required this.phone,
    this.isDefault = false,
  });

  final String id;
  final String label;
  final String line;
  final String phone;
  final bool isDefault;
}

/// App-wide buyer state: session, basket, wishlist, recently viewed, address book.
///
/// Business data always comes from the Sure Foodz API; only presentation state
/// (what's in the basket before checkout, what the buyer saved) lives here.
class AppState extends ChangeNotifier {
  final ApiClient _api = ApiClient.instance;

  Session? _session;
  Profile? _profile;
  String area = 'Nigeria';
  bool onboardingComplete = false;

  final List<CartLine> _cart = [];
  final Map<String, Product> _wishlist = {};
  final List<Product> _recents = [];
  final List<DeliveryAddress> _addresses = [];

  List<Product>? _products;
  List<Category>? _categories;
  List<Seller>? _vendors;
  List<Seller>? _suppliers;

  bool _busy = false;
  bool get busy => _busy;
  set busy(bool value) {
    if (_busy == value) return;
    _busy = value;
    notifyListeners();
  }

  bool get signedIn => _session != null;
  Profile? get profile => _profile;
  String get displayName => _profile?.displayName.isNotEmpty == true
      ? _profile!.displayName
      : (_session == null ? 'Guest' : 'Sure Foodz shopper');
  String get email => _profile?.email ?? '';
  String get phone => _profile?.phone ?? '';
  ApiClient get api => _api;

  /* --------------------------------------------------------------- catalog */

  Future<List<Product>> products({bool refresh = false}) async {
    if (refresh || _products == null) {
      try {
        _products = await _api.products();
      } catch (_) {
        _products = null;
        rethrow;
      }
      notifyListeners();
    }
    return _products!;
  }

  Future<List<Category>> categories({bool refresh = false}) async {
    if (refresh || _categories == null) {
      try {
        _categories = await _api.categories();
      } catch (_) {
        _categories = null;
        rethrow;
      }
      notifyListeners();
    }
    return _categories!;
  }

  Future<List<Seller>> vendors({bool refresh = false}) async {
    if (refresh || _vendors == null) {
      final results = await Future.wait([_api.sellers('vendor'), _api.sellers('supplier')]);
      _vendors = results[0];
      _suppliers = results[1];
      notifyListeners();
    }
    return _vendors ?? const [];
  }

  List<Seller> get suppliers => _suppliers ?? const [];

  /* ----------------------------------------------------------------- basket */

  List<CartLine> get cart => List.unmodifiable(_cart);
  int get cartCount => _cart.fold(0, (sum, line) => sum + line.quantity);
  int get cartTotalMinor => _cart.fold(0, (sum, line) => sum + line.lineTotalMinor);
  int get cartSavingsMinor => _cart.fold(
    0,
    (sum, line) => sum + (line.product.savingMinor * line.quantity),
  );
  bool get cartEmpty => _cart.isEmpty;

  int quantityOf(String productId) {
    for (final line in _cart) {
      if (line.product.id == productId) return line.quantity;
    }
    return 0;
  }

  void addToCart(Product product, {int quantity = 1}) {
    final index = _cart.indexWhere((line) => line.product.id == product.id);
    if (index >= 0) {
      final next = (_cart[index].quantity + quantity).clamp(1, product.stock.clamp(1, 99));
      _cart[index].quantity = next;
    } else {
      _cart.add(CartLine(product: product, quantity: quantity.clamp(1, product.stock.clamp(1, 99))));
    }
    notifyListeners();
  }

  void setQuantity(String productId, int quantity) {
    final index = _cart.indexWhere((line) => line.product.id == productId);
    if (index < 0) return;
    if (quantity <= 0) {
      _cart.removeAt(index);
    } else {
      _cart[index].quantity = quantity.clamp(1, _cart[index].product.stock.clamp(1, 99));
    }
    notifyListeners();
  }

  void removeFromCart(String productId) {
    _cart.removeWhere((line) => line.product.id == productId);
    notifyListeners();
  }

  void clearCart() {
    _cart.clear();
    notifyListeners();
  }

  /* --------------------------------------------------------------- wishlist */

  List<Product> get wishlist => _wishlist.values.toList(growable: false);
  int get wishlistCount => _wishlist.length;
  bool isWishlisted(String productId) => _wishlist.containsKey(productId);

  bool toggleWishlist(Product product) {
    if (_wishlist.containsKey(product.id)) {
      _wishlist.remove(product.id);
      notifyListeners();
      return false;
    }
    _wishlist[product.id] = product;
    notifyListeners();
    return true;
  }

  /* --------------------------------------------------------- recently seen */

  List<Product> get recents => List.unmodifiable(_recents);

  void remember(Product product) {
    _recents.removeWhere((item) => item.id == product.id);
    _recents.insert(0, product);
    if (_recents.length > 12) _recents.removeRange(12, _recents.length);
    notifyListeners();
  }

  /* ---------------------------------------------------------------- search */

  final List<String> _recentSearches = [];
  List<String> get recentSearches => List.unmodifiable(_recentSearches);

  void rememberSearch(String term) {
    final value = term.trim();
    if (value.isEmpty) return;
    _recentSearches.removeWhere((item) => item.toLowerCase() == value.toLowerCase());
    _recentSearches.insert(0, value);
    if (_recentSearches.length > 8) _recentSearches.removeRange(8, _recentSearches.length);
    notifyListeners();
  }

  void forgetSearch(String term) {
    _recentSearches.removeWhere((item) => item == term);
    notifyListeners();
  }

  void clearSearches() {
    _recentSearches.clear();
    notifyListeners();
  }

  /* --------------------------------------------------------------- address */

  List<DeliveryAddress> get addresses => List.unmodifiable(_addresses);
  DeliveryAddress? get defaultAddress =>
      _addresses.isEmpty ? null : _addresses.firstWhere((a) => a.isDefault, orElse: () => _addresses.first);

  void saveAddress(DeliveryAddress address) {
    _addresses.removeWhere((item) => item.id == address.id);
    _addresses.insert(0, address);
    if (_addresses.length == 1) area = address.label.isEmpty ? area : address.label;
    notifyListeners();
  }

  void removeAddress(String id) {
    _addresses.removeWhere((item) => item.id == id);
    notifyListeners();
  }

  /* ------------------------------------------------------------------ auth */

  Future<void> adoptSession(Session session, {Profile? profile}) async {
    _session = session;
    _api.setToken(session.idToken);
    _profile = profile;
    notifyListeners();
    if (profile == null) {
      try {
        _profile = await _api.profile();
        notifyListeners();
      } catch (_) {
        // The session is valid even if the profile call fails; screens retry.
      }
    }
  }

  Future<void> refreshProfile() async {
    if (!signedIn) return;
    try {
      _profile = await _api.profile();
      notifyListeners();
    } on ApiException {
      // Keep the cached profile; the session may simply be stale.
    }
  }

  /// Silently renews an expiring ID token so a session survives a long browse.
  Future<void> ensureFreshSession() async {
    final session = _session;
    if (session == null) return;
    if (session.expiresAt.difference(DateTime.now()) > const Duration(minutes: 4)) return;
    try {
      final renewed = await _api.refreshSession(session.refreshToken, session.apiKey);
      _session = renewed;
      notifyListeners();
    } on ApiException {
      signOut();
    }
  }

  void signOut() {
    _session = null;
    _profile = null;
    _api.setToken(null);
    notifyListeners();
  }

  void completeOnboarding() {
    onboardingComplete = true;
    notifyListeners();
  }

  void setArea(String value) {
    area = value;
    notifyListeners();
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
    : super(notifier: state);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope is missing above this widget');
    return scope!.notifier!;
  }

  /// Reads the state without subscribing to rebuilds (for callbacks).
  static AppState read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope is missing above this widget');
    return scope!.notifier!;
  }
}
