import 'package:flutter_test/flutter_test.dart';
import 'package:ustanomi_flutter/core/ustanomi_domain.dart';

void main() {
  group('UstanomiDomain Core Skills Verification', () {
    test('88/12 kurus-exact integer escrow split never loses a single kurus', () {
      final EscrowSplitResult split =
          UstanomiDomain.calculateEscrowSplitKurus(250000); // 2.500,00 TL
      expect(split.totalKurus, 250000);
      expect(split.platformFeeKurus, 30000); // 12%
      expect(split.proPayoutKurus, 220000); // 88%
      expect(split.platformFeeKurus + split.proPayoutKurus, split.totalKurus);
    });

    test('validates 11-digit Turkish TCKN, 10-digit VKN, and 26-char TR IBAN', () {
      expect(UstanomiDomain.validateTurkishTckn('10000000146'), isTrue);
      expect(UstanomiDomain.validateTurkishTckn('10000000147'), isFalse);
      expect(
        UstanomiDomain.validateTurkishIban('TR330006100519786457841326'),
        isTrue,
      );
      expect(
        UstanomiDomain.validateTurkishIban('TR000006100519786457841326'),
        isFalse,
      );
    });

    test('builds B2B Sealed Proforma (PRF-2026) and Fixed Contract (SZL-2026)', () {
      final B2bProformaContract contract =
          UstanomiDomain.buildB2bProformaContract(
        tenderCode: 'TNDR-9042',
        buyerTitle: 'Anadolu Filo A.S.',
        supplierTitle: 'Maslak Bimmer Ltd.',
        subtotalKurus: 1000000,
        vatRatePct: 20,
      );
      expect(contract.proformaNo, startsWith('PRF-2026-'));
      expect(contract.contractNo, startsWith('SZL-2026-'));
      expect(contract.grandTotalKurus, 1200000);
      expect(
        contract.supplierNetPayoutKurus + contract.platformCommissionKurus,
        1200000,
      );
    });

    test('enforces Cargo Waybill Escrow guard before releasing 88% payout', () {
      final CargoWaybillDecision transit =
          UstanomiDomain.evaluateCargoWaybillRelease(
        carrier: 'Yurtici Kargo',
        trackingNumber: 'YK908412773',
        deliveryStatus: 'IN_TRANSIT',
        buyerApprovedOrSigned: false,
        hoursSinceDelivery: 0,
      );
      expect(transit.canRelease, isFalse);

      final CargoWaybillDecision deliveredSigned =
          UstanomiDomain.evaluateCargoWaybillRelease(
        carrier: 'Yurtici Kargo',
        trackingNumber: 'YK908412773',
        deliveryStatus: 'DELIVERED',
        buyerApprovedOrSigned: true,
        hoursSinceDelivery: 4,
      );
      expect(deliveredSigned.canRelease, isTrue);
    });

    test('parses 10-platform external commerce URLs including Sahibinden.com', () {
      final ImportedCommerceListing listing =
          UstanomiDomain.parseExternalCommerceListing(
        'https://www.sahibinden.com/ilan/vasita-yedek-parca-1189402190/detay',
      );
      expect(listing.platformId, 'SAHIBINDEN');
      expect(listing.externalId, '1189402190');
      expect(listing.autoSyncEnabled, isTrue);
    });
  });
}
