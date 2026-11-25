import 'dart:ui' show FontFeature;
import 'package:flutter/material.dart';
import 'core/ustanomi_domain.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const UstanomiFlutterApp());
}

/// UI/UX Pro Max Design Tokens (`.agents/design-system/MASTER.md`)
class UstanomiTokens {
  static const Color bgPrimary = Color(0xFF0A0F1D);
  static const Color bgSurface = Color(0xFF111A2E);
  static const Color bgElevated = Color(0xFF1A2642);
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color accentPrimary = Color(0xFF2563EB);
  static const Color accentSecondary = Color(0xFF10B981);
  static const Color accentCoral = Color(0xFFF43F5E);
  static const Color accentAmber = Color(0xFFF59E0B);
  static const Color borderSubtle = Color(0xFF1E2D4A);

  static const TextStyle tabularMono = TextStyle(
    fontFeatures: <FontFeature>[FontFeature.tabularFigures()],
    fontWeight: FontWeight.w800,
    color: textPrimary,
  );
}

class UstanomiFlutterApp extends StatelessWidget {
  const UstanomiFlutterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ustanomi',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: UstanomiTokens.bgPrimary,
        colorScheme: const ColorScheme.dark(
          primary: UstanomiTokens.accentPrimary,
          secondary: UstanomiTokens.accentSecondary,
          surface: UstanomiTokens.bgSurface,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: UstanomiTokens.bgPrimary,
          elevation: 0,
        ),
      ),
      home: const UstanomiHomeShell(),
    );
  }
}

class UstanomiHomeShell extends StatefulWidget {
  const UstanomiHomeShell({super.key});

  @override
  State<UstanomiHomeShell> createState() => _UstanomiHomeShellState();
}

class _UstanomiHomeShellState extends State<UstanomiHomeShell> {
  int _currentTab = 0; // 0: Reels, 1: Acil, 2: Sanayi B2B, 3: DM, 4: Profil
  String _currency = 'TRY';
  String _proSchedule = 'OPEN_NOW'; // OPEN_NOW, DUTY_24_7, CLOSED
  int _profileSubTab = 0; // 0: 3x3 Grid, 1: Fiyatlar, 2: Cuzdan & Kargo
  bool _proformaLockedInDm = false;
  bool _waybillBuyerSigned = true;
  MarketplaceFilterCriteria _filterCriteria = const MarketplaceFilterCriteria();

  final List<MarketplaceItem> _allItems = <MarketplaceItem>[
    const MarketplaceItem(
      id: 'REEL-01',
      title: 'Maslak Bimmer N20/B48 Motor Revizyon & OEM Turbo Paketi',
      proName: 'Kaan Özdemir • Maslak Bimmer',
      handle: '@maslakbimmer',
      category: 'AUTO_LOGISTICS',
      city: 'İstanbul',
      district: 'Sarıyer / Maslak',
      distanceKm: 1.8,
      priceKurus: 1850000,
      rating: 4.97,
      urgencyCode: 'P1_CRITICAL',
      workMode: 'WORKSHOP',
      scheduleState: 'OPEN_NOW',
      verifiedKyc: true,
      escrowEligible: true,
      corporateInvoice: true,
      warrantyMonths: 12,
      likesCount: 1420,
      hiresCount: 94,
    ),
    const MarketplaceItem(
      id: 'REEL-02',
      title: '7/24 Nöbetçi Kombi Anakart & Termal Kamera Kaçak Tespiti',
      proName: 'Murat Usta • Kadıköy Teknik',
      handle: '@muratustateknik',
      category: 'HOME_REPAIR',
      city: 'İstanbul',
      district: 'Kadıköy',
      distanceKm: 3.4,
      priceKurus: 145000,
      rating: 4.92,
      urgencyCode: 'P1_CRITICAL',
      workMode: 'ONSITE',
      scheduleState: 'DUTY_24_7',
      verifiedKyc: true,
      escrowEligible: true,
      corporateInvoice: true,
      warrantyMonths: 24,
      likesCount: 980,
      hiresCount: 162,
    ),
    const MarketplaceItem(
      id: 'REEL-03',
      title: '5 Eksen CNC Alüminyum Kalıp & Seri Yedek Parça İmalatı',
      proName: 'İvedik CNC Metal Sanayi A.Ş.',
      handle: '@ivedikcnc',
      category: 'INDUSTRIAL_B2B',
      city: 'Ankara',
      district: 'Yenimahalle / İvedik OSB',
      distanceKm: 6.0,
      priceKurus: 4200000,
      rating: 4.95,
      urgencyCode: 'P2_HIGH',
      workMode: 'WORKSHOP',
      scheduleState: 'OPEN_NOW',
      verifiedKyc: true,
      escrowEligible: true,
      corporateInvoice: true,
      warrantyMonths: 24,
      likesCount: 740,
      hiresCount: 58,
    ),
    const MarketplaceItem(
      id: 'REEL-04',
      title: 'Full-Stack Flutter & Kurumsal ERP Entegrasyon Paketi',
      proName: 'Selin Kaya • Dijital Stüdyo',
      handle: '@selinkayadev',
      category: 'IT_FREELANCE',
      city: 'İzmir',
      district: 'Konak / Alsancak',
      distanceKm: 2.1,
      priceKurus: 1250000,
      rating: 4.99,
      urgencyCode: 'P3_NORMAL',
      workMode: 'REMOTE',
      scheduleState: 'OPEN_NOW',
      verifiedKyc: true,
      escrowEligible: true,
      corporateInvoice: true,
      warrantyMonths: 12,
      likesCount: 2150,
      hiresCount: 118,
    ),
  ];

  final Map<String, int> _extraLikes = <String, int>{};

  void _cycleCurrency() {
    setState(() {
      if (_currency == 'TRY') {
        _currency = 'USD';
      } else if (_currency == 'USD') {
        _currency = 'EUR';
      } else {
        _currency = 'TRY';
      }
    });
  }

  void _likeItem(MarketplaceItem item) {
    setState(() {
      _extraLikes[item.id] = (_extraLikes[item.id] ?? 0) + 1;
    });
  }

  void _openStoryRadarModal(MarketplaceItem item) {
    showDialog<void>(
      context: context,
      builder: (BuildContext ctx) {
        final EscrowSplitResult split =
            UstanomiDomain.calculateEscrowSplitKurus(item.priceKurus);
        return Dialog.fullscreen(
          backgroundColor: UstanomiTokens.bgPrimary,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  LinearProgressIndicator(
                    value: 0.72,
                    backgroundColor: UstanomiTokens.borderSubtle,
                    color: UstanomiTokens.accentSecondary,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: <Widget>[
                      const CircleAvatar(
                        backgroundColor: UstanomiTokens.accentPrimary,
                        child: Icon(Icons.verified, color: Colors.white),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              item.proName,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                            Text(
                              '📍 ${item.distanceKm.toStringAsFixed(1)} km • ${item.district} • ⚡ Nöbetçi Radar',
                              style: const TextStyle(
                                color: UstanomiTokens.accentSecondary,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: UstanomiTokens.bgSurface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: UstanomiTokens.borderSubtle),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        const Text(
                          'CANLI SAHA STORY VİTRİNİ',
                          style: TextStyle(
                            color: UstanomiTokens.accentSecondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.1,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          item.title,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Paket Fiyatı: ${UstanomiDomain.formatMoneyFromKurus(item.priceKurus, currency: _currency)}',
                          style: UstanomiTokens.tabularMono.copyWith(
                            fontSize: 18,
                            color: UstanomiTokens.accentSecondary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Usta Net (%88): ${UstanomiDomain.formatMoneyFromKurus(split.proPayoutKurus, currency: _currency)} • Havuz Güvencesi (%12): ${UstanomiDomain.formatMoneyFromKurus(split.platformFeeKurus, currency: _currency)}',
                          style: const TextStyle(
                            color: UstanomiTokens.textMuted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: UstanomiTokens.accentSecondary,
                        foregroundColor: Colors.black,
                      ),
                      onPressed: () {
                        Navigator.of(ctx).pop();
                        setState(() => _currentTab = 3);
                      },
                      icon: const Icon(Icons.handshake),
                      label: const Text(
                        '🤝 Seninle Çalışmak İstiyorum (DM & Proforma)',
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _open10PlatformImporterSheet() {
    final TextEditingController urlCtrl = TextEditingController(
      text: 'https://www.sahibinden.com/ilan/vasita-yedek-parca-1189402190/detay',
    );
    ImportedCommerceListing preview =
        UstanomiDomain.parseExternalCommerceListing(urlCtrl.text);

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: UstanomiTokens.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (BuildContext ctx) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Text(
                    '🔗 10-Platform Otomatik İlan & Vitrin Çekici',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Sahibinden.com, Arabam.com, Instagram, TikTok, Trendyol, Google Maps ve Armut linklerini yapıştırın; fiyat ve görseller otomatik senkronize olsun.',
                    style: TextStyle(
                      color: UstanomiTokens.textMuted,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: urlCtrl,
                    onChanged: (String val) {
                      setSheetState(() {
                        preview =
                            UstanomiDomain.parseExternalCommerceListing(val);
                      });
                    },
                    decoration: InputDecoration(
                      labelText: 'İlan URL veya Sahibinden İlan No',
                      filled: true,
                      fillColor: UstanomiTokens.bgPrimary,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: UstanomiTokens.bgSurface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: UstanomiTokens.borderSubtle),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          'Algılanan Platform: ${preview.platformLabel} (#${preview.externalId})',
                          style: const TextStyle(
                            color: UstanomiTokens.accentSecondary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(preview.suggestedTitle),
                        const SizedBox(height: 4),
                        Text(
                          'Önerilen Havuz Fiyatı: ${UstanomiDomain.formatMoneyFromKurus(preview.suggestedPriceKurus, currency: _currency)}',
                          style: UstanomiTokens.tabularMono,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton.icon(
                      onPressed: () {
                        Navigator.of(ctx).pop();
                        ScaffoldMessenger.of(this.context).showSnackBar(
                          SnackBar(
                            content: Text(
                              '✅ ${preview.platformLabel} (#${preview.externalId}) vitrine ve B2B kataloğa aktarıldı!',
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.bolt),
                      label: const Text('Tek Tıkla Vitrine & Havuza Aktar'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _open12DFilterSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: UstanomiTokens.bgElevated,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (BuildContext ctx) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setSheetState) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  const Text(
                    '🎛️ 12 Boyutlu Akıllı Filtre & Sıralama',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: <Widget>[
                      FilterChip(
                        label: const Text('🟢 Şimdi Açık / Nöbetçi'),
                        selected: _filterCriteria.onlyOpenNow,
                        onSelected: (bool val) {
                          setSheetState(() {
                            _filterCriteria = MarketplaceFilterCriteria(
                              onlyOpenNow: val,
                              onlyVerifiedKyc: _filterCriteria.onlyVerifiedKyc,
                              onlyEscrow: _filterCriteria.onlyEscrow,
                              sortBy: _filterCriteria.sortBy,
                            );
                          });
                          setState(() {});
                        },
                      ),
                      FilterChip(
                        label: const Text('🛡️ TCKN/VKN Onaylı Usta'),
                        selected: _filterCriteria.onlyVerifiedKyc,
                        onSelected: (bool val) {
                          setSheetState(() {
                            _filterCriteria = MarketplaceFilterCriteria(
                              onlyOpenNow: _filterCriteria.onlyOpenNow,
                              onlyVerifiedKyc: val,
                              onlyEscrow: _filterCriteria.onlyEscrow,
                              sortBy: _filterCriteria.sortBy,
                            );
                          });
                          setState(() {});
                        },
                      ),
                      FilterChip(
                        label: const Text('🔒 %88/%12 Havuz Garantili'),
                        selected: _filterCriteria.onlyEscrow,
                        onSelected: (bool val) {
                          setSheetState(() {
                            _filterCriteria = MarketplaceFilterCriteria(
                              onlyOpenNow: _filterCriteria.onlyOpenNow,
                              onlyVerifiedKyc: _filterCriteria.onlyVerifiedKyc,
                              onlyEscrow: val,
                              sortBy: _filterCriteria.sortBy,
                            );
                          });
                          setState(() {});
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Filtreleri Uygula'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final List<MarketplaceItem> filteredItems =
        UstanomiDomain.filterMarketplaceListings(_allItems, _filterCriteria);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: <Widget>[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: UstanomiTokens.accentPrimary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'USTANOMİ',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                  letterSpacing: 1.1,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'Reels & Havuz',
              style: TextStyle(
                fontSize: 13,
                color: UstanomiTokens.textMuted,
              ),
            ),
          ],
        ),
        actions: <Widget>[
          TextButton(
            onPressed: _cycleCurrency,
            child: Text(
              _currency,
              style: UstanomiTokens.tabularMono.copyWith(
                color: UstanomiTokens.accentSecondary,
              ),
            ),
          ),
          IconButton(
            tooltip: '12 Boyutlu Filtre',
            onPressed: _open12DFilterSheet,
            icon: const Icon(Icons.tune),
          ),
          IconButton(
            tooltip: '10-Platform İlan Çekici',
            onPressed: _open10PlatformImporterSheet,
            icon: const Icon(Icons.add_box_outlined),
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentTab,
        children: <Widget>[
          _buildTikTokReelsTab(filteredItems),
          _buildUrgentJobsTab(filteredItems),
          _buildB2bProformaTab(),
          _buildInstagramDmTab(),
          _buildInstagramProfileTab(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: UstanomiTokens.bgSurface,
        selectedIndex: _currentTab,
        onDestinationSelected: (int index) =>
            setState(() => _currentTab = index),
        destinations: const <NavigationDestination>[
          NavigationDestination(
            icon: Icon(Icons.play_circle_outline),
            selectedIcon: Icon(Icons.play_circle_fill),
            label: 'Keşfet',
          ),
          NavigationDestination(
            icon: Icon(Icons.flash_on_outlined),
            selectedIcon: Icon(Icons.flash_on),
            label: 'Acil İş',
          ),
          NavigationDestination(
            icon: Icon(Icons.precision_manufacturing_outlined),
            selectedIcon: Icon(Icons.precision_manufacturing),
            label: 'Sanayi B2B',
          ),
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon: Icon(Icons.chat_bubble),
            label: 'DM Havuz',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profil',
          ),
        ],
      ),
    );
  }

  /// TAB 0: Instagram Stories Radar + Full-screen Vertical TikTok Talent Reels (`PageView.builder`)
  Widget _buildTikTokReelsTab(List<MarketplaceItem> items) {
    return Column(
      children: <Widget>[
        // Horizontal Instagram Story Radar Strip
        SizedBox(
          height: 92,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 14),
            itemBuilder: (BuildContext context, int index) {
              final MarketplaceItem item = items[index];
              return GestureDetector(
                onTap: () => _openStoryRadarModal(item),
                child: Column(
                  children: <Widget>[
                    Container(
                      padding: const EdgeInsets.all(2.5),
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: <Color>[
                            UstanomiTokens.accentSecondary,
                            UstanomiTokens.accentPrimary,
                          ],
                        ),
                      ),
                      child: CircleAvatar(
                        radius: 24,
                        backgroundColor: UstanomiTokens.bgSurface,
                        child: Text(
                          item.proName.substring(0, 2).toUpperCase(),
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${item.distanceKm.toStringAsFixed(1)} km',
                      style: UstanomiTokens.tabularMono.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        // Full-Screen Vertical TikTok Reels Feed
        Expanded(
          child: PageView.builder(
            scrollDirection: Axis.vertical,
            itemCount: items.length,
            itemBuilder: (BuildContext context, int index) {
              final MarketplaceItem item = items[index];
              final int liveLikes =
                  item.likesCount + (_extraLikes[item.id] ?? 0);
              final EscrowSplitResult split =
                  UstanomiDomain.calculateEscrowSplitKurus(item.priceKurus);

              return Container(
                margin: const EdgeInsets.fromLTRB(12, 4, 12, 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: <Color>[
                      UstanomiTokens.bgElevated,
                      UstanomiTokens.bgSurface,
                      UstanomiTokens.bgPrimary,
                    ],
                  ),
                  border: Border.all(color: UstanomiTokens.borderSubtle),
                ),
                child: Stack(
                  children: <Widget>[
                    // Top status badges
                    Positioned(
                      top: 16,
                      left: 16,
                      right: 16,
                      child: Row(
                        children: <Widget>[
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: UstanomiTokens.accentSecondary
                                  .withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              item.scheduleState == 'DUTY_24_7'
                                  ? '⚡ 7/24 NÖBETÇİ AÇIK'
                                  : '🟢 ŞU AN AÇIK',
                              style: const TextStyle(
                                color: UstanomiTokens.accentSecondary,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.black45,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              '📍 ${item.distanceKm.toStringAsFixed(1)} km • ${item.city}',
                              style: const TextStyle(fontSize: 11),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Right TikTok Floating Action Rail
                    Positioned(
                      right: 14,
                      bottom: 110,
                      child: Column(
                        children: <Widget>[
                          IconButton.filledTonal(
                            onPressed: () => _likeItem(item),
                            icon: const Icon(
                              Icons.favorite,
                              color: UstanomiTokens.accentCoral,
                            ),
                          ),
                          Text(
                            '$liveLikes',
                            style: UstanomiTokens.tabularMono
                                .copyWith(fontSize: 12),
                          ),
                          const SizedBox(height: 12),
                          IconButton.filledTonal(
                            onPressed: () => setState(() => _currentTab = 3),
                            icon: const Icon(Icons.chat_bubble_outline),
                          ),
                          const Text('DM', style: TextStyle(fontSize: 11)),
                          const SizedBox(height: 12),
                          IconButton.filledTonal(
                            onPressed: () => _openStoryRadarModal(item),
                            icon: const Icon(Icons.radar),
                          ),
                          const Text('Radar', style: TextStyle(fontSize: 11)),
                        ],
                      ),
                    ),

                    // Bottom Creator Details & Direct Hire Escrow CTA
                    Positioned(
                      left: 16,
                      right: 76,
                      bottom: 20,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Row(
                            children: <Widget>[
                              Text(
                                item.handle,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: UstanomiTokens.accentSecondary,
                                ),
                              ),
                              const SizedBox(width: 6),
                              if (item.verifiedKyc)
                                const Icon(
                                  Icons.verified,
                                  size: 16,
                                  color: UstanomiTokens.accentPrimary,
                                ),
                              const SizedBox(width: 6),
                              Text(
                                '★ ${item.rating.toStringAsFixed(2)}',
                                style: UstanomiTokens.tabularMono
                                    .copyWith(fontSize: 12),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            item.title,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Açık Fiyat: ${UstanomiDomain.formatMoneyFromKurus(item.priceKurus, currency: _currency)}  (Usta %88: ${UstanomiDomain.formatMoneyFromKurus(split.proPayoutKurus, currency: _currency)})',
                            style: UstanomiTokens.tabularMono.copyWith(
                              fontSize: 13,
                              color: UstanomiTokens.accentSecondary,
                            ),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            height: 46,
                            child: FilledButton.icon(
                              style: FilledButton.styleFrom(
                                backgroundColor: UstanomiTokens.accentPrimary,
                              ),
                              onPressed: () => setState(() => _currentTab = 3),
                              icon: const Icon(Icons.handshake, size: 18),
                              label: const Text(
                                '🤝 Seninle Çalışmak İstiyorum (%88/%12 Havuz)',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  /// TAB 1: Minimal Urgent Jobs (`⚡ Acil İşler`)
  Widget _buildUrgentJobsTab(List<MarketplaceItem> items) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (BuildContext context, int index) {
        final MarketplaceItem item = items[index];
        final EscrowSplitResult split =
            UstanomiDomain.calculateEscrowSplitKurus(item.priceKurus);
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: UstanomiTokens.bgSurface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: UstanomiTokens.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: UstanomiTokens.accentCoral.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      '🚨 ${item.urgencyCode} • ${item.distanceKm.toStringAsFixed(1)} km',
                      style: const TextStyle(
                        color: UstanomiTokens.accentCoral,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  Text(
                    UstanomiDomain.formatMoneyFromKurus(
                      item.priceKurus,
                      currency: _currency,
                    ),
                    style: UstanomiTokens.tabularMono.copyWith(
                      fontSize: 16,
                      color: UstanomiTokens.accentSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                item.title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '${item.proName} • ${item.district} • ${item.warrantyMonths} Ay Garanti',
                style: const TextStyle(
                  color: UstanomiTokens.textMuted,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text(
                    'Usta Hakediş (%88): ${UstanomiDomain.formatMoneyFromKurus(split.proPayoutKurus, currency: _currency)}',
                    style:
                        UstanomiTokens.tabularMono.copyWith(fontSize: 12),
                  ),
                  FilledButton.tonal(
                    onPressed: () => setState(() => _currentTab = 3),
                    child: const Text('Hemen Teklif Ver'),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  /// TAB 2: B2B Sanayi & Oto Parça Gizli Proforma (`PRF-2026`) & Sabit Sözleşme (`SZL-2026`)
  Widget _buildB2bProformaTab() {
    final B2bProformaContract contract =
        UstanomiDomain.buildB2bProformaContract(
      tenderCode: 'TNDR-9042',
      buyerTitle: 'Anadolu Filo Lojistik A.Ş.',
      supplierTitle: 'Maslak Bimmer Oto Yedek Parça Ltd.',
      subtotalKurus: 4500000, // 45.000,00 TL + %20 KDV
      vatRatePct: 20,
      warrantyMonths: 12,
      deliveryDays: 2,
    );

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: UstanomiTokens.bgSurface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: UstanomiTokens.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Text(
                    '🔒 GİZLİ PROFORMA (${contract.proformaNo})',
                    style: const TextStyle(
                      color: UstanomiTokens.accentSecondary,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    contract.contractNo,
                    style: UstanomiTokens.tabularMono.copyWith(fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'BMW F30/G20 N20 OEM Turboşarj + Enjektör Revizyon İhalesi',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(
                'Alıcı: ${contract.buyerTitle}\nTedarikçi: ${contract.supplierTitle}',
                style: const TextStyle(
                  color: UstanomiTokens.textMuted,
                  fontSize: 12,
                ),
              ),
              const Divider(height: 24, color: UstanomiTokens.borderSubtle),
              _buildFinanceRow(
                'KDV Hariç Ara Toplam',
                UstanomiDomain.formatMoneyFromKurus(
                  contract.subtotalKurus,
                  currency: _currency,
                ),
              ),
              _buildFinanceRow(
                'Hesaplanan KDV (%${contract.vatRatePct})',
                UstanomiDomain.formatMoneyFromKurus(
                  contract.vatKurus,
                  currency: _currency,
                ),
              ),
              _buildFinanceRow(
                'Sabit Sözleşme Toplamı (Havuz)',
                UstanomiDomain.formatMoneyFromKurus(
                  contract.grandTotalKurus,
                  currency: _currency,
                ),
                highlight: true,
              ),
              _buildFinanceRow(
                'Tedarikçi Net Hakediş (%88)',
                UstanomiDomain.formatMoneyFromKurus(
                  contract.supplierNetPayoutKurus,
                  currency: _currency,
                ),
              ),
              _buildFinanceRow(
                'Platform Escrow Kesintisi (%12)',
                UstanomiDomain.formatMoneyFromKurus(
                  contract.platformCommissionKurus,
                  currency: _currency,
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: UstanomiTokens.accentSecondary,
                    foregroundColor: Colors.black,
                  ),
                  onPressed: () => setState(() => _currentTab = 3),
                  icon: const Icon(Icons.lock),
                  label: const Text(
                    'Gizli Proformayı Onayla & Havuza Kilitle',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// TAB 3: Instagram Direct `💬 DM` + In-Chat Sealed Proforma Escrow Card
  Widget _buildInstagramDmTab() {
    final B2bProformaContract dmContract =
        UstanomiDomain.buildB2bProformaContract(
      tenderCode: 'DM8812',
      buyerTitle: 'Sami Erdoğan (Alıcı)',
      supplierTitle: 'Kaan Özdemir • Maslak Bimmer',
      subtotalKurus: 1500000,
    );

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: UstanomiTokens.bgSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: UstanomiTokens.borderSubtle),
            ),
            child: const Row(
              children: <Widget>[
                CircleAvatar(
                  backgroundColor: UstanomiTokens.accentPrimary,
                  child: Text('MB'),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Kaan Özdemir • @maslakbimmer',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '🟢 Aktif • GİB e-Fatura & %88/%12 Havuz Onaylı',
                        style: TextStyle(
                          fontSize: 11,
                          color: UstanomiTokens.accentSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: UstanomiTokens.bgElevated,
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Text(
              'Ustam merhaba, Sahibinden #1189402190 OEM Turbo + montaj paketi için gizli proforma faturanızı DM üzerinden gönderdim. Onayladığınızda tutar BDDK lisanslı havuza kilitlenir.',
              style: TextStyle(fontSize: 13),
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: UstanomiTokens.bgSurface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: _proformaLockedInDm
                    ? UstanomiTokens.accentSecondary
                    : UstanomiTokens.accentPrimary,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  _proformaLockedInDm
                      ? '✅ HAVUZDA KİLİTLİ (${dmContract.proformaNo})'
                      : '📄 DM PROFORMA TEKLİFİ (${dmContract.proformaNo})',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: UstanomiTokens.accentSecondary,
                  ),
                ),
                const SizedBox(height: 8),
                _buildFinanceRow(
                  'KDV Dahil Toplam',
                  UstanomiDomain.formatMoneyFromKurus(
                    dmContract.grandTotalKurus,
                    currency: _currency,
                  ),
                  highlight: true,
                ),
                _buildFinanceRow(
                  'Usta Hakediş (%88)',
                  UstanomiDomain.formatMoneyFromKurus(
                    dmContract.supplierNetPayoutKurus,
                    currency: _currency,
                  ),
                ),
                _buildFinanceRow(
                  'Garanti & Teslimat',
                  '${dmContract.warrantyMonths} Ay Garanti • ${dmContract.deliveryDays} Gün',
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () {
                      setState(() => _proformaLockedInDm = true);
                    },
                    child: Text(
                      _proformaLockedInDm
                          ? '🔒 Tutar Havuzda Güvende (İrsaliye Bekleniyor)'
                          : '🔒 Proformayı Onayla & Havuza Kilitle',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// TAB 4: Clean Instagram Profile (`3x3 Grid` | `🏷️ Fiyatlar` | `💳 Cüzdan & Kargo İrsaliye`)
  Widget _buildInstagramProfileTab() {
    final CargoWaybillDecision waybillDecision =
        UstanomiDomain.evaluateCargoWaybillRelease(
      carrier: 'Yurtiçi Kargo',
      trackingNumber: 'YK908412773',
      deliveryStatus: 'DELIVERED',
      buyerApprovedOrSigned: _waybillBuyerSigned,
      hoursSinceDelivery: 12,
    );

    return ListView(
      padding: const EdgeInsets.all(16),
      children: <Widget>[
        Row(
          children: <Widget>[
            const CircleAvatar(
              radius: 34,
              backgroundColor: UstanomiTokens.accentPrimary,
              child: Text(
                'MB',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: <Widget>[
                  _buildStatCol('142', 'Teslim İş'),
                  _buildStatCol('4.97 ★', 'Puan'),
                  _buildStatCol('%88', 'Net Havuz'),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text(
          'Kaan Özdemir • Maslak Bimmer Servis',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
        ),
        Text(
          'TCKN/VKN Onaylı • Maskeli Kimlik: ${UstanomiDomain.maskPiiValue("10000000146")}',
          style: const TextStyle(color: UstanomiTokens.textMuted, fontSize: 12),
        ),
        const SizedBox(height: 12),
        // Working Hours 3-State Toggle
        SegmentedButton<String>(
          segments: const <ButtonSegment<String>>[
            ButtonSegment<String>(value: 'OPEN_NOW', label: Text('🟢 Açık')),
            ButtonSegment<String>(
              value: 'DUTY_24_7',
              label: Text('⚡ 7/24 Nöbetçi'),
            ),
            ButtonSegment<String>(value: 'CLOSED', label: Text('🔴 Kapalı')),
          ],
          selected: <String>{_proSchedule},
          onSelectionChanged: (Set<String> s) =>
              setState(() => _proSchedule = s.first),
        ),
        const SizedBox(height: 14),
        // Sub-tabs: 3x3 Grid | Fiyatlar | Cuzdan & Kargo
        SegmentedButton<int>(
          segments: const <ButtonSegment<int>>[
            ButtonSegment<int>(value: 0, label: Text('▦ Vitrin')),
            ButtonSegment<int>(value: 1, label: Text('🏷️ Fiyatlar')),
            ButtonSegment<int>(value: 2, label: Text('💳 Cüzdan & Kargo')),
          ],
          selected: <int>{_profileSubTab},
          onSelectionChanged: (Set<int> s) =>
              setState(() => _profileSubTab = s.first),
        ),
        const SizedBox(height: 16),
        if (_profileSubTab == 0)
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 6,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
            ),
            itemBuilder: (BuildContext context, int idx) {
              return Container(
                decoration: BoxDecoration(
                  color: UstanomiTokens.bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: UstanomiTokens.borderSubtle),
                ),
                alignment: Alignment.center,
                child: Text(
                  'Reels #${idx + 1}\n❤️ ${(idx + 2) * 310}',
                  textAlign: TextAlign.center,
                  style: UstanomiTokens.tabularMono.copyWith(fontSize: 12),
                ),
              );
            },
          )
        else if (_profileSubTab == 1)
          Column(
            children: _allItems.map((MarketplaceItem item) {
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(item.title),
                subtitle: Text('${item.warrantyMonths} Ay Garantili'),
                trailing: Text(
                  UstanomiDomain.formatMoneyFromKurus(
                    item.priceKurus,
                    currency: _currency,
                  ),
                  style: UstanomiTokens.tabularMono.copyWith(
                    color: UstanomiTokens.accentSecondary,
                  ),
                ),
              );
            }).toList(),
          )
        else
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: UstanomiTokens.bgSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: UstanomiTokens.borderSubtle),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Text(
                  '📦 Kargo İrsaliye & %88 Havuz Çözüm Kilidi',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(
                  'Kargo: ${waybillDecision.carrier} (${waybillDecision.trackingNumber})',
                ),
                Text(
                  'Durum: ${waybillDecision.canRelease ? "✅ %88 Hakediş IBAN’a Aktarıma Hazır" : "⏳ Muayene Süresi Bekleniyor"} (${waybillDecision.reason})',
                  style: const TextStyle(
                    color: UstanomiTokens.accentSecondary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 10),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Alıcı Islak İmza / Teslim Onayı'),
                  value: _waybillBuyerSigned,
                  onChanged: (bool val) =>
                      setState(() => _waybillBuyerSigned = val),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildStatCol(String value, String label) {
    return Column(
      children: <Widget>[
        Text(
          value,
          style: UstanomiTokens.tabularMono.copyWith(fontSize: 16),
        ),
        Text(
          label,
          style: const TextStyle(
            color: UstanomiTokens.textMuted,
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildFinanceRow(
    String label,
    String value, {
    bool highlight = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              color: highlight
                  ? UstanomiTokens.textPrimary
                  : UstanomiTokens.textMuted,
              fontWeight: highlight ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: UstanomiTokens.tabularMono.copyWith(
              color: highlight
                  ? UstanomiTokens.accentSecondary
                  : UstanomiTokens.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
