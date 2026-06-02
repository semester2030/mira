import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../entities/marketplace_match.dart';
import '../entities/partner_summary.dart';

abstract class MarketplaceRepository {
  Future<MarketplaceMatch> matchForReport(SkinReport report, {String? city});

  Future<List<PartnerSummary>> listPartners({String? type, String? city});

  Future<PartnerSummary?> getPartner(String id);
}
