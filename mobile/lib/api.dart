import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;

/// Talks to the same Next.js API the Sure Foodz website uses, so the app and
/// the site share one database, one auth flow and one set of business rules.
class ApiClient {
  ApiClient._();

  static final ApiClient instance = ApiClient._();

  /// Override with `--dart-define=API_BASE_URL=https://surefoodz.com`.
  static String get baseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    if (configured.isNotEmpty) return configured;
    if (kIsWeb) return Uri.base.origin;
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  final http.Client _client = http.Client();

  String? _token;
  String? _apiKey;

  /// Firebase ID token for the signed-in buyer, sent as a bearer token.
  void setToken(String? token) => _token = token;

  /// Public Firebase web API key, used to exchange the backend's custom token.
  String? get firebaseApiKey => _apiKey;

  Map<String, String> get _headers => {
    'accept': 'application/json',
    if (_token != null) 'authorization': 'Bearer $_token',
  };

  Future<Map<String, dynamic>> _get(String path) async {
    final response = await _client
        .get(Uri.parse('$baseUrl$path'), headers: _headers)
        .timeout(const Duration(seconds: 20));
    return _decode(response);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body, {
    bool authenticated = true,
  }) async {
    final response = await _client
        .post(
          Uri.parse('$baseUrl$path'),
          headers: {
            ..._headers,
            if (authenticated) 'content-type': 'application/json',
          },
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 25));
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final Map<String, dynamic> payload = response.body.isEmpty
        ? <String, dynamic>{}
        : (jsonDecode(response.body) as Map<String, dynamic>);
    if (response.statusCode >= 400) {
      throw ApiException(
        (payload['error'] as String?) ?? 'Something went wrong. Try again.',
        response.statusCode,
      );
    }
    return payload;
  }

  /* --------------------------------------------------------------- catalog */

  Future<List<Product>> products() async {
    final payload = await _get('/api/products');
    final list = (payload['products'] as List<dynamic>? ?? const []);
    return list.whereType<Map<String, dynamic>>().map(Product.fromJson).toList(growable: false);
  }

  Future<List<Category>> categories() async {
    try {
      final payload = await _get('/api/categories');
      final list = (payload['categories'] as List<dynamic>? ?? const []);
      return list
          .map(
            (entry) => entry is Map
                ? Category(
                    id: (entry['id'] ?? entry['name'] ?? '').toString(),
                    name: (entry['name'] ?? '').toString(),
                  )
                : Category(id: entry.toString(), name: entry.toString()),
          )
          .where((category) => category.name.isNotEmpty)
          .toList(growable: false);
    } on ApiException {
      return const [];
    }
  }

  Future<Product?> product(String id) async {
    try {
      final payload = await _get('/api/products/$id');
      final product = payload['product'];
      return product is Map<String, dynamic> ? Product.fromJson(product) : null;
    } on ApiException {
      return null;
    }
  }

  Future<List<Seller>> sellers(String role) async {
    try {
      final payload = await _get('/api/marketplace/sellers?role=$role');
      final list = (payload['sellers'] as List<dynamic>? ?? const []);
      return list
          .whereType<Map<String, dynamic>>()
          .map(Seller.fromJson)
          .toList(growable: false);
    } on ApiException {
      return const [];
    }
  }

  /* ------------------------------------------------------------------ auth */

  /// The public Firebase web config the backend already exposes to its own
  /// browser bundle. Cached for the session.
  Future<String?> publicApiKey() async {
    if (_apiKey != null) return _apiKey;
    try {
      final payload = await _get('/api/config');
      final key = (payload['firebaseApiKey'] ?? '').toString();
      if (key.isNotEmpty) _apiKey = key;
      return _apiKey;
    } on ApiException {
      return null;
    }
  }

  Future<void> requestCode({
    required String email,
    required String purpose,
    String? role,
    String? displayName,
    String? phone,
    String? location,
  }) async {
    await _post('/api/auth/request-code', {
      'email': email,
      'purpose': purpose,
      'role': ?role,
      'displayName': ?displayName,
      'phone': ?phone,
      'location': ?location,
    }, authenticated: false);
  }

  /// Verifies the emailed code and returns the backend's Firebase custom token.
  Future<AuthTicket> verifyCode({required String email, required String code}) async {
    final payload = await _post(
      '/api/auth/verify-code',
      {'email': email, 'code': code},
      authenticated: false,
    );
    final profile = (payload['profile'] as Map<String, dynamic>?) ?? const {};
    return AuthTicket(
      customToken: (payload['token'] as String?) ?? '',
      uid: (profile['uid'] ?? '').toString(),
      email: (profile['email'] ?? email).toString(),
      role: (profile['role'] ?? 'buyer').toString(),
      verificationStatus: (profile['verificationStatus'] ?? '').toString(),
    );
  }

  /// Exchanges a Firebase custom token for a real session through the public
  /// Identity Toolkit REST API — no native Firebase config needed.
  Future<Session> exchangeCustomToken(String customToken) async {
    final key = await publicApiKey();
    if (key == null) {
      throw ApiException('Sign-in is not configured on the server yet.', 503);
    }
    final response = await _client
        .post(
          Uri.parse(
            'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=$key',
          ),
          headers: {'content-type': 'application/json'},
          body: jsonEncode({'token': customToken, 'returnSecureToken': true}),
        )
        .timeout(const Duration(seconds: 20));
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      final error = (payload['error'] as Map<String, dynamic>?) ?? const {};
      throw ApiException(
        (error['message'] ?? 'Could not start your session.').toString(),
        response.statusCode,
      );
    }
    final session = Session(
      idToken: (payload['idToken'] ?? '').toString(),
      refreshToken: (payload['refreshToken'] ?? '').toString(),
      expiresAt: DateTime.now().add(
        Duration(seconds: int.tryParse('${payload['expiresIn'] ?? 3600}') ?? 3600),
      ),
      apiKey: key,
    );
    _token = session.idToken;
    return session;
  }

  Future<Session> refreshSession(String refreshToken, String apiKey) async {
    final response = await _client
        .post(
          Uri.parse('https://securetoken.googleapis.com/v1/token?key=$apiKey'),
          headers: {'content-type': 'application/x-www-form-urlencoded'},
          body: 'grant_type=refresh_token&refresh_token=$refreshToken',
        )
        .timeout(const Duration(seconds: 20));
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw ApiException('Your session expired. Please sign in again.', response.statusCode);
    }
    final session = Session(
      idToken: (payload['id_token'] ?? '').toString(),
      refreshToken: (payload['refresh_token'] ?? refreshToken).toString(),
      expiresAt: DateTime.now().add(
        Duration(seconds: int.tryParse('${payload['expires_in'] ?? 3600}') ?? 3600),
      ),
      apiKey: apiKey,
    );
    _token = session.idToken;
    return session;
  }

  /* --------------------------------------------------------------- account */

  Future<Profile> profile() async {
    final payload = await _get('/api/profile');
    final data = (payload['profile'] as Map<String, dynamic>?) ?? payload;
    return Profile.fromJson(data);
  }

  Future<List<Order>> orders() async {
    final payload = await _get('/api/orders?mine=purchases');
    final list = (payload['orders'] as List<dynamic>? ?? const []);
    return list.whereType<Map<String, dynamic>>().map(Order.fromJson).toList(growable: false);
  }

  Future<Order?> order(String id) async {
    try {
      final payload = await _get('/api/orders/$id');
      final data = payload['order'];
      return data is Map<String, dynamic> ? Order.fromJson(data) : null;
    } on ApiException {
      return null;
    }
  }

  /// Places the cart through the same endpoint the website checkout uses.
  Future<List<Order>> placeOrder({
    required String checkoutId,
    required Map<String, int> items,
    required String phone,
    required String deliveryAddress,
  }) async {
    final payload = await _post('/api/orders', {
      'checkoutId': checkoutId,
      'items': items.entries.map((entry) => {'productId': entry.key, 'quantity': entry.value}).toList(),
      'phone': phone,
      'deliveryAddress': deliveryAddress,
    });
    final list = (payload['orders'] as List<dynamic>? ?? const []);
    return list.whereType<Map<String, dynamic>>().map(Order.fromJson).toList(growable: false);
  }

  Future<List<Activity>> activities() async {
    final payload = await _get('/api/activity');
    final list = (payload['activities'] as List<dynamic>? ?? const []);
    return list.whereType<Map<String, dynamic>>().map(Activity.fromJson).toList(growable: false);
  }

  Future<Map<String, dynamic>?> payLaterApplication() async {
    try {
      final payload = await _get('/api/pay-later/applications');
      final application = payload['application'];
      return application is Map<String, dynamic> ? application : null;
    } on ApiException {
      return null;
    }
  }

  Future<void> submitSpecialOrder(Map<String, dynamic> body) async {
    await _post('/api/special-orders', body, authenticated: false);
  }
}

class ApiException implements Exception {
  ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;
  @override
  String toString() => message;
}

class AuthTicket {
  const AuthTicket({
    required this.customToken,
    required this.uid,
    required this.email,
    required this.role,
    required this.verificationStatus,
  });
  final String customToken;
  final String uid;
  final String email;
  final String role;
  final String verificationStatus;
}

class Session {
  const Session({
    required this.idToken,
    required this.refreshToken,
    required this.expiresAt,
    required this.apiKey,
  });
  final String idToken;
  final String refreshToken;
  final DateTime expiresAt;
  final String apiKey;
}

class Category {
  const Category({required this.id, required this.name});
  final String id;
  final String name;
}

class Seller {
  const Seller({
    required this.id,
    required this.name,
    required this.logoUrl,
    required this.detail,
    required this.city,
    required this.region,
    required this.role,
    required this.badge,
    required this.emoji,
  });

  final String id;
  final String name;
  final String logoUrl;
  final String detail;
  final String city;
  final String region;
  final String role;
  final String badge;
  final String emoji;

  factory Seller.fromJson(Map<String, dynamic> json) => Seller(
    id: (json['id'] ?? '').toString(),
    name: (json['name'] ?? json['businessName'] ?? 'Sure Foodz seller').toString(),
    logoUrl: (json['logoUrl'] ?? '').toString(),
    detail: (json['detail'] ?? '').toString(),
    city: (json['city'] ?? '').toString(),
    region: (json['region'] ?? '').toString(),
    role: (json['role'] ?? '').toString(),
    badge: (json['badge'] ?? '').toString(),
    emoji: (json['emoji'] ?? '🏪').toString(),
  );
}

class Profile {
  const Profile({
    required this.uid,
    required this.displayName,
    required this.email,
    required this.phone,
    required this.location,
    required this.role,
    required this.avatarUrl,
    required this.verificationStatus,
  });

  final String uid;
  final String displayName;
  final String email;
  final String phone;
  final String location;
  final String role;
  final String avatarUrl;
  final String verificationStatus;

  String get firstName {
    final parts = displayName.trim().split(RegExp(r'\s+'));
    return parts.isEmpty || parts.first.isEmpty ? 'there' : parts.first;
  }

  factory Profile.fromJson(Map<String, dynamic> json) => Profile(
    uid: (json['uid'] ?? '').toString(),
    displayName: (json['displayName'] ?? '').toString(),
    email: (json['email'] ?? '').toString(),
    phone: (json['phone'] ?? '').toString(),
    location: (json['location'] ?? '').toString(),
    role: (json['role'] ?? 'buyer').toString(),
    avatarUrl: (json['avatarUrl'] ?? '').toString(),
    verificationStatus: (json['verificationStatus'] ?? '').toString(),
  );
}

class OrderLine {
  const OrderLine({required this.name, required this.quantity, required this.lineTotalMinor, required this.imageUrl});

  final String name;
  final int quantity;
  final int lineTotalMinor;
  final String imageUrl;

  factory OrderLine.fromJson(Map<String, dynamic> json) => OrderLine(
    name: (json['name'] ?? 'Item').toString(),
    quantity: int.tryParse('${json['quantity'] ?? 1}') ?? 1,
    lineTotalMinor: int.tryParse('${json['lineTotalMinor'] ?? 0}') ?? 0,
    imageUrl: (json['imageUrl'] ?? '').toString(),
  );
}

class Order {
  const Order({
    required this.id,
    required this.status,
    required this.paymentStatus,
    required this.totalMinor,
    required this.subtotalMinor,
    required this.createdAt,
    required this.lines,
    required this.deliveryAddress,
    required this.sellerName,
    required this.customerName,
  });

  final String id;
  final String status;
  final String paymentStatus;
  final int totalMinor;
  final int subtotalMinor;
  final DateTime? createdAt;
  final List<OrderLine> lines;
  final String deliveryAddress;
  final String sellerName;
  final String customerName;

  bool get delivered => status.toLowerCase() == 'delivered';
  bool get active => !delivered && !status.toLowerCase().contains('cancel');

  /// Human progress 0..1 for the tracking rail.
  double get progress {
    final s = status.toLowerCase();
    if (s.contains('deliver')) return 1;
    if (s.contains('out for delivery') || s.contains('transit') || s.contains('shipped')) return 0.75;
    if (s.contains('confirmed') || s.contains('preparing') || s.contains('processing')) return 0.45;
    if (s.contains('pending')) return 0.2;
    return 0.1;
  }

  factory Order.fromJson(Map<String, dynamic> json) {
    final rawLines = (json['items'] as List<dynamic>? ?? const []);
    return Order(
      id: (json['id'] ?? '').toString(),
      status: (json['status'] ?? 'Pending').toString(),
      paymentStatus: (json['paymentStatus'] ?? '').toString(),
      totalMinor: int.tryParse('${json['totalMinor'] ?? json['subtotalMinor'] ?? 0}') ?? 0,
      subtotalMinor: int.tryParse('${json['subtotalMinor'] ?? 0}') ?? 0,
      createdAt: parseDate(json['createdAt']),
      lines: rawLines.whereType<Map<String, dynamic>>().map(OrderLine.fromJson).toList(growable: false),
      deliveryAddress: (json['deliveryAddress'] ?? '').toString(),
      sellerName: (json['sellerName'] ?? '').toString(),
      customerName: (json['customerName'] ?? '').toString(),
    );
  }
}

class Activity {
  const Activity({required this.id, required this.action, required this.summary, required this.createdAt});
  final String id;
  final String action;
  final String summary;
  final DateTime? createdAt;

  factory Activity.fromJson(Map<String, dynamic> json) => Activity(
    id: (json['id'] ?? '').toString(),
    action: (json['action'] ?? '').toString(),
    summary: (json['summary'] ?? '').toString(),
    createdAt: parseDate(json['createdAt']),
  );
}

/// Firestore timestamps arrive either as ISO strings or `{_seconds, _nanoseconds}`.
DateTime? parseDate(Object? raw) {
  if (raw == null) return null;
  if (raw is String) return DateTime.tryParse(raw);
  if (raw is num) return DateTime.fromMillisecondsSinceEpoch(raw.toInt() * 1000);
  if (raw is Map) {
    final seconds = raw['_seconds'] ?? raw['seconds'];
    if (seconds is num) return DateTime.fromMillisecondsSinceEpoch(seconds.toInt() * 1000);
  }
  return null;
}

class Product {
  const Product({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.priceMinor,
    required this.stock,
    required this.imageUrl,
    required this.sellerId,
    required this.sellerName,
    required this.sellerLocation,
    required this.sellerLogoUrl,
    required this.sellerVerified,
    required this.sellerRole,
    required this.compareAtMinor,
    required this.productKind,
    required this.expiryDate,
    required this.nafdacNumber,
    required this.unit,
  });

  final String id;
  final String name;
  final String description;
  final String category;
  final int priceMinor;
  final int stock;
  final String imageUrl;
  final String sellerId;
  final String sellerName;
  final String sellerLocation;
  final String sellerLogoUrl;
  final bool sellerVerified;
  final String sellerRole;
  final int? compareAtMinor;
  final String productKind;
  final String expiryDate;
  final String nafdacNumber;
  final String unit;

  bool get soldOut => stock <= 0;
  bool get lowStock => !soldOut && stock <= 5;
  bool get discounted => compareAtMinor != null && compareAtMinor! > priceMinor;

  int get discountPercent => discounted
      ? ((1 - priceMinor / compareAtMinor!) * 100).round().clamp(0, 95)
      : 0;

  int get savingMinor => discounted ? compareAtMinor! - priceMinor : 0;

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? 'Product').toString(),
      description: (json['description'] ?? '').toString(),
      category: (json['category'] ?? '').toString(),
      priceMinor: int.tryParse('${json['priceMinor'] ?? 0}') ?? 0,
      stock: int.tryParse('${json['stock'] ?? 0}') ?? 0,
      imageUrl: (json['imageUrl'] ?? '').toString(),
      sellerId: (json['sellerId'] ?? '').toString(),
      sellerName: (json['sellerName'] ?? '').toString(),
      sellerLocation: (json['sellerLocation'] ?? '').toString(),
      sellerLogoUrl: (json['sellerLogoUrl'] ?? '').toString(),
      sellerVerified: json['sellerVerified'] == true,
      sellerRole: (json['sellerRole'] ?? '').toString(),
      compareAtMinor: json['compareAtMinor'] == null
          ? null
          : int.tryParse('${json['compareAtMinor']}'),
      productKind: (json['productKind'] ?? '').toString(),
      expiryDate: (json['expiryDate'] ?? '').toString(),
      nafdacNumber: (json['nafdacNumber'] ?? '').toString(),
      unit: (json['unit'] ?? '').toString(),
    );
  }
}

/// Naira formatting with the same grouping the website uses.
String naira(int minor) {
  final value = (minor / 100).round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < value.length; i++) {
    if (i > 0 && (value.length - i) % 3 == 0) buffer.write(',');
    buffer.write(value[i]);
  }
  return '₦${buffer.toString()}';
}
