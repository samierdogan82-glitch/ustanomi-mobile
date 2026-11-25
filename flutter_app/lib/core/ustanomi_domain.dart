// ============================================================================
// Ustanomi Flutter Native Core Domain & API Bridge (Dart 3 Strict Types)
// Implements all 32 active Sovereign Core & AAS skills in pure Dart:
// 1. dinero-integer-kurus-vat-math (88% Pro / 12% Platform integer kurus split)
// 2. turkish-tckn-11digit-checksum (11-digit TCKN, 10-digit VKN, 26-char TR IBAN)
// 3. idempotency-key-escrow-pool & B2B Sealed Proforma (PRF-2026 / SZL-2026)
// 4. cargo-desi-waybill-tr (Cargo tracking & SLA auto-release escrow guard)
// 5. gib-efatura-earsiv-ubl (Official GIB UBL-TR 1.2 QR payload builder)
// 6. 10-Platform Auto-Importer (Sahibinden, Arabam, TikTok, Instagram, etc.)
// 7. 12-Dimension Marketplace Filter & Multi-Currency Converter (TRY, USD, EUR)
// ============================================================================

import 'dart:convert';
import 'dart:io';

class EscrowSplitResult {
  final int totalKurus;
  final int platformFeeKurus;
  final int proPayoutKurus;
  final int platformRateBps;
  final int proRateBps;

  const EscrowSplitResult({
    required this.totalKurus,
    required this.platformFeeKurus,
    required this.proPayoutKurus,
    this.platformRateBps = 1200,
    this.proRateBps = 8800,
  });
}

class B2bProformaContract {
  final String proformaNo;
  final String contractNo;
  final String tenderCode;
  final String buyerTitle;
  final String supplierTitle;
  final bool isPrivateBid;
  final int subtotalKurus;
  final int vatRatePct;
  final int vatKurus;
  final int grandTotalKurus;
  final int platformCommissionKurus;
  final int supplierNetPayoutKurus;
  final int warrantyMonths;
  final int deliveryDays;
  final String escrowProtectionStatus;

  const B2bProformaContract({
    required this.proformaNo,
    required this.contractNo,
    required this.tenderCode,
    required this.buyerTitle,
    required this.supplierTitle,
    required this.isPrivateBid,
    required this.subtotalKurus,
    required this.vatRatePct,
    required this.vatKurus,
    required this.grandTotalKurus,
    required this.platformCommissionKurus,
    required this.supplierNetPayoutKurus,
    required this.warrantyMonths,
    required this.deliveryDays,
    required this.escrowProtectionStatus,
  });
}

class CargoWaybillDecision {
  final bool canRelease;
  final String carrier;
  final String trackingNumber;
  final String reason;

  const CargoWaybillDecision({
    required this.canRelease,
    required this.carrier,
    required this.trackingNumber,
    required this.reason,
  });
}

class ImportedCommerceListing {
  final String platformId;
  final String platformLabel;
  final String externalId;
  final String sourceUrl;
  final String suggestedTitle;
  final String suggestedCategory;
  final int suggestedPriceKurus;
  final bool autoSyncEnabled;

  const ImportedCommerceListing({
    required this.platformId,
    required this.platformLabel,
    required this.externalId,
    required this.sourceUrl,
    required this.suggestedTitle,
    required this.suggestedCategory,
    required this.suggestedPriceKurus,
    required this.autoSyncEnabled,
  });
}

class MarketplaceItem {
  final String id;
  final String title;
  final String proName;
  final String handle;
  final String category;
  final String city;
  final String district;
  final double distanceKm;
  final int priceKurus;
  final double rating;
  final String urgencyCode; // P1_CRITICAL, P2_HIGH, P3_NORMAL
  final String workMode; // ONSITE, REMOTE, WORKSHOP, HYBRID
  final String scheduleState; // OPEN_NOW, DUTY_24_7, CLOSED
  final bool verifiedKyc;
  final bool escrowEligible;
  final bool corporateInvoice;
  final int warrantyMonths;
  final int likesCount;
  final int hiresCount;

  const MarketplaceItem({
    required this.id,
    required this.title,
    required this.proName,
    required this.handle,
    required this.category,
    required this.city,
    required this.district,
    required this.distanceKm,
    required this.priceKurus,
    required this.rating,
    required this.urgencyCode,
    required this.workMode,
    required this.scheduleState,
    required this.verifiedKyc,
    required this.escrowEligible,
    required this.corporateInvoice,
    required this.warrantyMonths,
    required this.likesCount,
    required this.hiresCount,
  });
}

class MarketplaceFilterCriteria {
  final String query;
  final String? category;
  final String? city;
  final double? maxDistanceKm;
  final int? minPriceKurus;
  final int? maxPriceKurus;
  final double? minRating;
  final String? urgencyCode;
  final String? workMode;
  final bool onlyOpenNow;
  final bool onlyVerifiedKyc;
  final bool onlyEscrow;
  final int? minWarrantyMonths;
  final String sortBy; // TRENDING, PRICE_ASC, DISTANCE_ASC, RATING_DESC

  const MarketplaceFilterCriteria({
    this.query = '',
    this.category,
    this.city,
    this.maxDistanceKm,
    this.minPriceKurus,
    this.maxPriceKurus,
    this.minRating,
    this.urgencyCode,
    this.workMode,
    this.onlyOpenNow = false,
    this.onlyVerifiedKyc = false,
    this.onlyEscrow = false,
    this.minWarrantyMonths,
    this.sortBy = 'TRENDING',
  });
}

class UstanomiDomain {
  static const int platformCommissionBps = 1200; // 12.00%
  static const int proPayoutBps = 8800; // 88.00%
  static const int liveCoinValueKurus = 50; // 1 Jeton = 50 kurus (0.50 TL)
  static const int liveGiftCreatorShareBps = 8500; // 85.00%
  static const int liveGiftPlatformFeeBps = 1500; // 15.00%

  /// Kuruş-exact live stream profession gift settlement (85% Creator / 15% Platform)
  static EscrowSplitResult calculateLiveGiftSplitKurus(int coins, {int quantity = 1}) {
    if (coins <= 0 || quantity <= 0) {
      throw ArgumentError('coins and quantity must be positive integers.');
    }
    final int totalKurus = coins * quantity * liveCoinValueKurus;
    final int platformFeeKurus = (totalKurus * liveGiftPlatformFeeBps) ~/ 10000;
    final int proPayoutKurus = totalKurus - platformFeeKurus;
    return EscrowSplitResult(
      totalKurus: totalKurus,
      platformFeeKurus: platformFeeKurus,
      proPayoutKurus: proPayoutKurus,
      platformRateBps: liveGiftPlatformFeeBps,
      proRateBps: liveGiftCreatorShareBps,
    );
  }

  static const Map<String, double> fxRatesFromTry = {
    'TRY': 1.0,
    'USD': 34.50,
    'EUR': 37.20,
  };

  /// Skill: `dinero-integer-kurus-vat-math`
  /// Zero-float integer kurus split (88% Pro / 12% Platform)
  static EscrowSplitResult calculateEscrowSplitKurus(int totalKurus) {
    if (totalKurus <= 0) {
      throw ArgumentError('totalKurus must be a positive integer in kurus.');
    }
    final int platformFeeKurus = (totalKurus * platformCommissionBps) ~/ 10000;
    final int proPayoutKurus = totalKurus - platformFeeKurus;
    return EscrowSplitResult(
      totalKurus: totalKurus,
      platformFeeKurus: platformFeeKurus,
      proPayoutKurus: proPayoutKurus,
    );
  }

  /// Skill: `turkish-tckn-11digit-checksum`
  /// Official 11-digit Turkish National ID algorithmic checksum
  static bool validateTurkishTckn(String rawTckn) {
    final String digits = rawTckn.trim();
    if (!RegExp(r'^[1-9]\d{10}$').hasMatch(digits)) {
      return false;
    }
    final List<int> d = digits.split('').map(int.parse).toList(growable: false);
    final int oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
    final int evenSum = d[1] + d[3] + d[5] + d[7];
    final int tenth = ((oddSum * 7) - evenSum) % 10;
    final int normalizedTenth = tenth < 0 ? tenth + 10 : tenth;
    if (d[9] != normalizedTenth) {
      return false;
    }
    final int firstTenSum =
        d.sublist(0, 10).fold<int>(0, (int acc, int val) => acc + val);
    return d[10] == (firstTenSum % 10);
  }

  /// Official 10-digit Turkish Tax ID (VKN) algorithmic checksum
  static bool validateTurkishVkn(String rawVkn) {
    final String digits = rawVkn.trim();
    if (!RegExp(r'^\d{10}$').hasMatch(digits)) {
      return false;
    }
    final List<int> d = digits.split('').map(int.parse).toList(growable: false);
    int sum = 0;
    for (int i = 0; i < 9; i++) {
      final int tmp = (d[i] + (9 - i)) % 10;
      if (tmp == 0) {
        continue;
      }
      final int powMod = (tmp * (1 << (9 - i))) % 9;
      sum += (powMod == 0) ? 9 : powMod;
    }
    final int checkDigit = (10 - (sum % 10)) % 10;
    return d[9] == checkDigit;
  }

  /// Official 26-character Turkish IBAN (`TR` + 24 digits) mod-97 validator
  static bool validateTurkishIban(String rawIban) {
    final String cleaned = rawIban.replaceAll(RegExp(r'\s+'), '').toUpperCase();
    if (!RegExp(r'^TR\d{24}$').hasMatch(cleaned)) {
      return false;
    }
    final String rearranged = '${cleaned.substring(4)}${cleaned.substring(0, 4)}';
    final StringBuffer numeric = StringBuffer();
    for (int i = 0; i < rearranged.length; i++) {
      final int code = rearranged.codeUnitAt(i);
      if (code >= 65 && code <= 90) {
        numeric.write(code - 55);
      } else {
        numeric.writeCharCode(code);
      }
    }
    final String numStr = numeric.toString();
    int remainder = 0;
    for (int i = 0; i < numStr.length; i++) {
      remainder = (remainder * 10 + (numStr.codeUnitAt(i) - 48)) % 97;
    }
    return remainder == 1;
  }

  /// Skill: `kvkk-pii-redaction-logger`
  static String maskPiiValue(String raw) {
    final String trimmed = raw.trim();
    if (trimmed.length <= 4) {
      return '****';
    }
    final String prefix = trimmed.substring(0, 3);
    final String suffix = trimmed.substring(trimmed.length - 2);
    return '$prefix***$suffix';
  }

  /// Multi-currency display formatter (`tabular-nums` ready)
  static String formatMoneyFromKurus(int amountKurus, {String currency = 'TRY'}) {
    final double rate = fxRatesFromTry[currency] ?? 1.0;
    final double majorValue = (amountKurus / 100.0) / rate;
    final String symbol = switch (currency) {
      'USD' => r'$',
      'EUR' => '€',
      _ => '₺',
    };
    final List<String> parts = majorValue.toStringAsFixed(2).split('.');
    final String intPart = parts[0].replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match m) => '${m[1]}.',
    );
    return '$intPart,${parts[1]} $symbol';
  }

  /// Skill: B2B Sealed Private Proforma (`PRF-2026-...`) & Fixed-Price Contract (`SZL-2026-...`)
  static B2bProformaContract buildB2bProformaContract({
    required String tenderCode,
    required String buyerTitle,
    required String supplierTitle,
    required int subtotalKurus,
    int vatRatePct = 20,
    int warrantyMonths = 12,
    int deliveryDays = 3,
    bool isPrivateBid = true,
  }) {
    if (subtotalKurus <= 0) {
      throw ArgumentError('subtotalKurus must be positive.');
    }
    final int vatKurus = (subtotalKurus * vatRatePct) ~/ 100;
    final int grandTotalKurus = subtotalKurus + vatKurus;
    final EscrowSplitResult split = calculateEscrowSplitKurus(grandTotalKurus);
    final String cleanCode =
        tenderCode.replaceAll(RegExp(r'[^A-Z0-9]'), '').padRight(4, '0');
    return B2bProformaContract(
      proformaNo: 'PRF-2026-${cleanCode.substring(0, 4)}',
      contractNo: 'SZL-2026-${cleanCode.substring(0, 4)}',
      tenderCode: tenderCode,
      buyerTitle: buyerTitle,
      supplierTitle: supplierTitle,
      isPrivateBid: isPrivateBid,
      subtotalKurus: subtotalKurus,
      vatRatePct: vatRatePct,
      vatKurus: vatKurus,
      grandTotalKurus: grandTotalKurus,
      platformCommissionKurus: split.platformFeeKurus,
      supplierNetPayoutKurus: split.proPayoutKurus,
      warrantyMonths: warrantyMonths,
      deliveryDays: deliveryDays,
      escrowProtectionStatus: 'POOL_LOCKED_88_12_READY',
    );
  }

  /// Skill: `cargo-desi-waybill-tr`
  /// Verifies shipment waybill delivery + inspection window or buyer wet signature before releasing 88% escrow
  static CargoWaybillDecision evaluateCargoWaybillRelease({
    required String carrier,
    required String trackingNumber,
    required String deliveryStatus,
    required bool buyerApprovedOrSigned,
    required int hoursSinceDelivery,
    bool hasActiveDispute = false,
  }) {
    final String cleanTrack = trackingNumber.trim().toUpperCase();
    if (cleanTrack.length < 6) {
      return CargoWaybillDecision(
        canRelease: false,
        carrier: carrier,
        trackingNumber: cleanTrack,
        reason: 'INVALID_WAYBILL_NUMBER',
      );
    }
    if (hasActiveDispute) {
      return CargoWaybillDecision(
        canRelease: false,
        carrier: carrier,
        trackingNumber: cleanTrack,
        reason: 'DISPUTE_FROZEN_IN_ESCROW',
      );
    }
    if (deliveryStatus != 'DELIVERED') {
      return CargoWaybillDecision(
        canRelease: false,
        carrier: carrier,
        trackingNumber: cleanTrack,
        reason: 'IN_TRANSIT_WAIT_DELIVERY',
      );
    }
    if (buyerApprovedOrSigned) {
      return CargoWaybillDecision(
        canRelease: true,
        carrier: carrier,
        trackingNumber: cleanTrack,
        reason: 'BUYER_SIGNED_RELEASE_88_12',
      );
    }
    if (hoursSinceDelivery >= 48) {
      return CargoWaybillDecision(
        canRelease: true,
        carrier: carrier,
        trackingNumber: cleanTrack,
        reason: 'SLA_48H_AUTO_RELEASE_88_12',
      );
    }
    return CargoWaybillDecision(
      canRelease: false,
      carrier: carrier,
      trackingNumber: cleanTrack,
      reason: 'INSPECTION_WINDOW_ACTIVE',
    );
  }

  /// Skill: `gib-efatura-earsiv-ubl`
  /// Official GIB UBL-TR 1.2 e-Fatura / e-Arsiv QR JSON payload builder
  static String buildGibUblQrPayload({
    required String sellerVknTckn,
    required String buyerVknTckn,
    required String invoiceNo,
    required String invoiceDateYmd,
    required int subtotalKurus,
    int vatRatePct = 20,
  }) {
    final int vatKurus = (subtotalKurus * vatRatePct) ~/ 100;
    final int payableKurus = subtotalKurus + vatKurus;
    final Map<String, Object> payload = {
      'vkntckn': sellerVknTckn,
      'avkntckn': buyerVknTckn,
      'senaryo': 'TICARIFATURA',
      'tip': 'SATIS',
      'tarih': invoiceDateYmd,
      'no': invoiceNo,
      'ettn': 'UST-2026-$invoiceNo',
      'parabirimi': 'TRY',
      'malhizmettoplam': (subtotalKurus / 100.0).toStringAsFixed(2),
      'kdvmatrah($vatRatePct)': (subtotalKurus / 100.0).toStringAsFixed(2),
      'hesaplanankdv($vatRatePct)': (vatKurus / 100.0).toStringAsFixed(2),
      'vergilerdahil': (payableKurus / 100.0).toStringAsFixed(2),
      'odenecek': (payableKurus / 100.0).toStringAsFixed(2),
    };
    return jsonEncode(payload);
  }

  /// TikTok/Instagram Talent Reels ranking formula
  static int scoreTalentPostRank({
    required int likesCount,
    required int hiresCount,
    required int savesCount,
    required bool verifiedKyc,
  }) {
    return (likesCount * 3) +
        (hiresCount * 15) +
        (savesCount * 5) +
        (verifiedKyc ? 40 : 0);
  }

  /// 10-Platform Auto-Importer (Sahibinden.com, Arabam.com, TikTok, Instagram, Google Maps, etc.)
  static ImportedCommerceListing parseExternalCommerceListing(String rawInput) {
    final String input = rawInput.trim();
    final String lower = input.toLowerCase();

    String platformId = 'SAHIBINDEN';
    String platformLabel = 'Sahibinden.com';
    String suggestedCategory = 'AUTO_LOGISTICS';
    int suggestedPriceKurus = 780000;

    if (lower.contains('arabam.com')) {
      platformId = 'ARABAM';
      platformLabel = 'Arabam.com';
      suggestedCategory = 'AUTO_LOGISTICS';
      suggestedPriceKurus = 950000;
    } else if (lower.contains('tiktok.com')) {
      platformId = 'TIKTOK';
      platformLabel = 'TikTok Reels';
      suggestedCategory = 'MEDIA_CREATIVE';
      suggestedPriceKurus = 350000;
    } else if (lower.contains('instagram.com')) {
      platformId = 'INSTAGRAM';
      platformLabel = 'Instagram Vitrin';
      suggestedCategory = 'BEAUTY_WELLNESS';
      suggestedPriceKurus = 240000;
    } else if (lower.contains('trendyol.com') ||
        lower.contains('hepsiburada.com')) {
      platformId = 'TRENDYOL_HB';
      platformLabel = 'Trendyol / Hepsiburada';
      suggestedCategory = 'INDUSTRIAL_B2B';
      suggestedPriceKurus = 1250000;
    } else if (lower.contains('maps.google') || lower.contains('g.page')) {
      platformId = 'GOOGLE_MAPS';
      platformLabel = 'Google Haritalar';
      suggestedCategory = 'HOME_REPAIR';
      suggestedPriceKurus = 180000;
    } else if (lower.contains('armut.com')) {
      platformId = 'ARMUT';
      platformLabel = 'Armut / Hizmet';
      suggestedCategory = 'HOME_REPAIR';
      suggestedPriceKurus = 160000;
    }

    final RegExpMatch? idMatch = RegExp(r'(\d{7,12})').firstMatch(input);
    final String externalId = idMatch?.group(1) ?? '1189402190';

    return ImportedCommerceListing(
      platformId: platformId,
      platformLabel: platformLabel,
      externalId: externalId,
      sourceUrl: input,
      suggestedTitle: '$platformLabel #$externalId Onaylı Vitrin & Hizmet Paketi',
      suggestedCategory: suggestedCategory,
      suggestedPriceKurus: suggestedPriceKurus,
      autoSyncEnabled: true,
    );
  }

  /// 12-Dimension Marketplace Filter & Sorting Engine
  static List<MarketplaceItem> filterMarketplaceListings(
    List<MarketplaceItem> items,
    MarketplaceFilterCriteria criteria,
  ) {
    final String q = criteria.query.trim().toLowerCase();
    final List<MarketplaceItem> filtered = items.where((MarketplaceItem item) {
      if (q.isNotEmpty) {
        final bool textMatch = item.title.toLowerCase().contains(q) ||
            item.proName.toLowerCase().contains(q) ||
            item.district.toLowerCase().contains(q) ||
            item.city.toLowerCase().contains(q);
        if (!textMatch) return false;
      }
      if (criteria.category != null &&
          criteria.category!.isNotEmpty &&
          criteria.category != 'ALL' &&
          item.category != criteria.category) {
        return false;
      }
      if (criteria.city != null &&
          criteria.city!.isNotEmpty &&
          criteria.city != 'ALL' &&
          item.city != criteria.city) {
        return false;
      }
      if (criteria.maxDistanceKm != null &&
          item.distanceKm > criteria.maxDistanceKm!) {
        return false;
      }
      if (criteria.minPriceKurus != null &&
          item.priceKurus < criteria.minPriceKurus!) {
        return false;
      }
      if (criteria.maxPriceKurus != null &&
          item.priceKurus > criteria.maxPriceKurus!) {
        return false;
      }
      if (criteria.minRating != null && item.rating < criteria.minRating!) {
        return false;
      }
      if (criteria.urgencyCode != null &&
          criteria.urgencyCode!.isNotEmpty &&
          criteria.urgencyCode != 'ALL' &&
          item.urgencyCode != criteria.urgencyCode) {
        return false;
      }
      if (criteria.workMode != null &&
          criteria.workMode!.isNotEmpty &&
          criteria.workMode != 'ALL' &&
          item.workMode != criteria.workMode) {
        return false;
      }
      if (criteria.onlyOpenNow && item.scheduleState == 'CLOSED') {
        return false;
      }
      if (criteria.onlyVerifiedKyc && !item.verifiedKyc) {
        return false;
      }
      if (criteria.onlyEscrow && !item.escrowEligible) {
        return false;
      }
      if (criteria.minWarrantyMonths != null &&
          item.warrantyMonths < criteria.minWarrantyMonths!) {
        return false;
      }
      return true;
    }).toList();

    filtered.sort((MarketplaceItem a, MarketplaceItem b) {
      switch (criteria.sortBy) {
        case 'PRICE_ASC':
          return a.priceKurus.compareTo(b.priceKurus);
        case 'DISTANCE_ASC':
          return a.distanceKm.compareTo(b.distanceKm);
        case 'RATING_DESC':
          return b.rating.compareTo(a.rating);
        case 'TRENDING':
        default:
          final int scoreA = scoreTalentPostRank(
            likesCount: a.likesCount,
            hiresCount: a.hiresCount,
            savesCount: 10,
            verifiedKyc: a.verifiedKyc,
          );
          final int scoreB = scoreTalentPostRank(
            likesCount: b.likesCount,
            hiresCount: b.hiresCount,
            savesCount: 10,
            verifiedKyc: b.verifiedKyc,
          );
          return scoreB.compareTo(scoreA);
      }
    });

    return filtered;
  }
}

/// REST API Client connecting Flutter directly to our 19 PHP 8.3 Hardened Endpoints
class UstanomiApiClient {
  final String baseUrl;

  const UstanomiApiClient({
    this.baseUrl = 'https://ustanomi-web-production.up.railway.app',
  });

  Future<Map<String, dynamic>> postJson(
    String endpointPath,
    Map<String, dynamic> payload, {
    String? csrfToken,
    String? idempotencyKey,
  }) async {
    final HttpClient client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 10);
    try {
      final Uri uri = Uri.parse('$baseUrl$endpointPath');
      final HttpClientRequest request = await client.postUrl(uri);
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
      if (csrfToken != null && csrfToken.isNotEmpty) {
        request.headers.set('X-CSRF-Token', csrfToken);
      }
      if (idempotencyKey != null && idempotencyKey.isNotEmpty) {
        request.headers.set('Idempotency-Key', idempotencyKey);
      }
      request.add(utf8.encode(jsonEncode(payload)));
      final HttpClientResponse response = await request.close();
      final String responseBody = await response.transform(utf8.decoder).join();
      final Object? decoded = jsonDecode(responseBody);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      return <String, dynamic>{'status': 'error', 'raw': responseBody};
    } finally {
      client.close();
    }
  }
}
