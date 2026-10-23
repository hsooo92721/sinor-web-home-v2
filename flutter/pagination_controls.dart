import 'package:flutter/material.dart';

/// Integration component; connect to the existing gathering repository.
/// Do not replace the current cards, authentication or write APIs.
class GatheringPagination extends StatelessWidget {
  static const int pageSize = 8;
  final int totalItems;
  final int currentPage;
  final bool loading;
  final ValueChanged<int> onPageChanged;

  const GatheringPagination({super.key, required this.totalItems,
    required this.currentPage, required this.onPageChanged,
    this.loading = false});

  @override
  Widget build(BuildContext context) {
    final totalPages = (totalItems / pageSize).ceil();
    if (totalPages <= 0) return const SizedBox.shrink();
    final page = currentPage.clamp(1, totalPages).toInt();
    final first = ((page - 1) ~/ 5) * 5 + 1;
    final end = (first + 4).clamp(1, totalPages).toInt();
    final primary = Theme.of(context).colorScheme.primary;
    return Semantics(label: '새로 개설된 모임 페이지 이동', child: Wrap(
      alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 4, children: [
        IconButton(tooltip: '이전 페이지', icon: const Icon(Icons.chevron_left),
          onPressed: loading || page == 1 ? null : () => onPageChanged(page - 1)),
        for (int p = first; p <= end; p++)
          Semantics(selected: p == page, label: '$p페이지', child: SizedBox(
            width: 36, height: 36, child: TextButton(
              style: TextButton.styleFrom(padding: EdgeInsets.zero,
                backgroundColor: p == page ? primary.withAlpha(20) : Colors.transparent,
                foregroundColor: p == page ? primary : Theme.of(context).colorScheme.onSurfaceVariant,
                shape: const CircleBorder()),
              onPressed: loading ? null : () => onPageChanged(p), child: Text('$p')))),
        IconButton(tooltip: '다음 페이지', icon: const Icon(Icons.chevron_right),
          onPressed: loading || page == totalPages ? null : () => onPageChanged(page + 1)),
      ]));
  }
}
