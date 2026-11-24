import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../data/repositories/marketplace_repository_impl.dart';
import '../../domain/entities/creator_profile.dart';
import '../widgets/celebrity_avatar_orb.dart';

/// Directory of public creators — paginated grid (3×2 per page).
class CelebritiesDirectoryScreen extends StatefulWidget {
  const CelebritiesDirectoryScreen({super.key});

  @override
  State<CelebritiesDirectoryScreen> createState() => _CelebritiesDirectoryScreenState();
}

class _CelebritiesDirectoryScreenState extends State<CelebritiesDirectoryScreen> {
  final _repo = MarketplaceRepositoryImpl();
  final _scroll = ScrollController();
  final _items = <CreatorDirectoryCard>[];
  String? _nextCursor;
  bool _loading = false;
  bool _initial = true;
  bool _failed = false;
  bool _exhausted = false;

  static const _pageSize = 6;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _loadMore();
  }

  @override
  void dispose() {
    _scroll
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_exhausted || _loading || _failed) return;
    if (_scroll.position.pixels >= _scroll.position.maxScrollExtent - 120) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_loading || _exhausted) return;
    setState(() => _loading = true);
    final page = await _repo.listCreators(cursor: _nextCursor, limit: _pageSize);
    if (!mounted) return;
    setState(() {
      _loading = false;
      _initial = false;
      _failed = page.failed;
      if (!page.failed) {
        _items.addAll(page.items);
        _nextCursor = page.nextCursor;
        _exhausted = page.nextCursor == null && page.items.isEmpty;
        if (page.nextCursor == null && page.items.isNotEmpty && page.items.length < _pageSize) {
          _exhausted = true;
        }
      }
    });
  }

  Future<void> _refresh() async {
    setState(() {
      _items.clear();
      _nextCursor = null;
      _exhausted = false;
      _failed = false;
      _initial = true;
    });
    await _loadMore();
  }

  void _openProfile(CreatorDirectoryCard card) {
    Navigator.of(context).pushNamed(
      AppRoutes.celebrityProfile,
      arguments: card.id,
    );
  }

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    final orbD = ((w - 40 - 24) / 3).clamp(88.0, 120.0);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const MiraAppBar(pageTitle: 'المشاهير'),
      body: _body(orbD),
    );
  }

  Widget _body(double orbD) {
    if (_initial && _loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_failed && _items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('تعذر التحميل', style: AppTypography.bodyLarge),
            const SizedBox(height: 12),
            TextButton(onPressed: _refresh, child: const Text('إعادة المحاولة')),
          ],
        ),
      );
    }
    if (_items.isEmpty) {
      return Center(
        child: Text(
          'لا يوجد ملفات مشاهير متاحة حالياً',
          style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _refresh,
      child: GridView.builder(
        key: const PageStorageKey<String>('celebrities-directory-grid'),
        controller: _scroll,
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          mainAxisSpacing: 20,
          crossAxisSpacing: 12,
          childAspectRatio: orbD / (orbD + 52),
        ),
        itemCount: _items.length + (_loading && !_exhausted ? 1 : 0),
        itemBuilder: (context, i) {
          if (i >= _items.length) {
            return const Center(child: CircularProgressIndicator(strokeWidth: 2));
          }
          final card = _items[i];
          return CelebrityAvatarOrb(
            key: ValueKey('creator-${card.id}'),
            nameAr: card.displayNameAr,
            diameter: orbD,
            avatarUrl: card.avatarUrl,
            onTap: () => _openProfile(card),
          );
        },
      ),
    );
  }
}