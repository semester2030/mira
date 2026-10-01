import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../data/catalog_provenance.dart';
import '../../data/catalog_record_scope.dart';
import '../../data/datasources/marketplace_api_data_source.dart';
import '../../data/discover_catalog_gateway.dart';
import '../../data/discover_favorite_client.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../widgets/commerce_common.dart';

/// Saved products and services for the signed-in account. Unpublished items show as unavailable.
class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key, this.loadKeys, this.gateway});

  /// Returns `kind:id` keys. Defaults to the favorites endpoint.
  final Future<Set<String>> Function()? loadKeys;
  final DiscoverCatalogGateway? gateway;

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoriteRow {
  const _FavoriteRow({required this.kind, required this.id, required this.title, required this.subtitle});

  final String kind;
  final String id;
  final String title;
  final String subtitle;
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  late final DiscoverCatalogGateway _gateway = widget.gateway ?? MarketplaceRepositoryImpl();
  final _rows = <_FavoriteRow>[];
  bool _loading = true;
  bool _needsLogin = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _needsLogin = false;
    });
    try {
      final keys = await (widget.loadKeys ?? MarketplaceApiDataSource().listFavoriteKeys)();
      final rows = await Future.wait(keys.map(_row));
      if (!mounted) return;
      setState(() {
        _rows
          ..clear()
          ..addAll(rows);
        _loading = false;
      });
    } on FavoriteAuthException {
      if (mounted) {
        setState(() {
          _needsLogin = true;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'تعذر قراءة المفضلة';
          _loading = false;
        });
      }
    }
  }

  Future<_FavoriteRow> _row(String key) async {
    final split = key.indexOf(':');
    final kind = split < 0 ? 'product' : key.substring(0, split);
    final id = split < 0 ? key : key.substring(split + 1);
    try {
      final record = await _gateway.loadRecord(kind: kind, id: id, transport: CatalogTransport.server);
      final product = record.product;
      final service = record.service;
      if (record.status == CatalogRecordStatus.ready && (product != null || service != null)) {
        return _FavoriteRow(
          kind: kind,
          id: id,
          title: product?.nameAr ?? service!.nameAr,
          subtitle: product?.partnerNameAr ?? service!.partnerNameAr,
        );
      }
    } catch (_) {}
    return _FavoriteRow(kind: kind, id: id, title: 'عنصر غير متاح', subtitle: 'لم يعد منشورًا');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: MarketplaceCopy.favoritesTitle),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_needsLogin) return const CommerceLoginRequired(message: MarketplaceCopy.loginRequiredFavorites);
    if (_error != null) return CommerceErrorRetry(message: _error!, onRetry: _load);
    if (_rows.isEmpty) return Center(child: Text(MarketplaceCopy.favoritesEmpty, style: AppTypography.bodyLarge));
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (final row in _rows)
          PremiumCard(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => CatalogRecordScope.page(kind: row.kind, id: row.id, gateway: widget.gateway),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(row.title, style: AppTypography.titleMedium),
                Text('${row.kind == 'service' ? 'خدمة' : 'منتج'} · ${row.subtitle}', style: AppTypography.bodySmall),
              ],
            ),
          ),
      ],
    );
  }
}
