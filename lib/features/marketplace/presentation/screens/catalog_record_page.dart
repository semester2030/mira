import 'package:flutter/material.dart';

import '../../../../core/constants/marketplace_copy.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../data/catalog_provenance.dart';
import '../../data/discover_catalog_gateway.dart';
import '../widgets/marketplace_data_banner.dart';
import 'product_detail_screen.dart';
import 'service_detail_screen.dart';

class CatalogRecordPage extends StatefulWidget {
  const CatalogRecordPage({
    super.key,
    required this.gateway,
    required this.kind,
    required this.id,
    required this.transport,
    this.matchKnown = false,
    this.matchScore = 0,
  });

  final DiscoverCatalogGateway gateway;
  final String kind;
  final String id;
  final CatalogTransport? transport;
  final bool matchKnown;
  final int matchScore;

  @override
  State<CatalogRecordPage> createState() => _CatalogRecordPageState();
}

class _CatalogRecordPageState extends State<CatalogRecordPage> {
  late Future<CatalogRecordResult> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<CatalogRecordResult> _load() {
    return widget.gateway.loadRecord(kind: widget.kind, id: widget.id, transport: widget.transport);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CatalogRecordResult>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return Scaffold(
            appBar: AppBar(backgroundColor: AppColors.background),
            body: const Center(child: Text('جاري تحميل التفاصيل')),
          );
        }
        final result = snapshot.data;
        if (result == null || result.status == CatalogRecordStatus.network) {
          return Scaffold(
            appBar: AppBar(backgroundColor: AppColors.background),
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('تعذر تحميل البيانات', style: AppTypography.bodyLarge),
                  TextButton(
                    onPressed: () => setState(() => _future = _load()),
                    child: const Text('إعادة المحاولة'),
                  ),
                ],
              ),
            ),
          );
        }
        if (result.status == CatalogRecordStatus.missing || (result.product == null && result.service == null)) {
          return Scaffold(
            appBar: AppBar(backgroundColor: AppColors.background),
            body: Center(child: Text('هذا العنصر غير متاح أو لم يعد منشورًا', style: AppTypography.bodyLarge, textAlign: TextAlign.center)),
          );
        }
        final banner = result.transport == null || result.contentMark == null
            ? null
            : MarketplaceDataBanner(transport: result.transport!, contentMark: result.contentMark!);
        final product = result.product;
        if (product != null) {
          return ProductDetailScreen(
            product: widget.matchKnown ? product.withKnownMatch(widget.matchScore) : product,
            provenance: banner,
          );
        }
        final service = result.service!;
        return ServiceDetailScreen(
          service: widget.matchKnown ? service.withKnownMatch(widget.matchScore) : service,
          provenance: banner,
        );
      },
    );
  }
}
