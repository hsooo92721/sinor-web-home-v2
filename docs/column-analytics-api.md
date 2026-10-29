# Column analytics

`/admin/columns/statistics/` is the column-specific report. Demo mode shows **only records in this browser** and labels this scope throughout the dashboard/export. It is not a shared visitor count and is never used to fabricate public popularity. Collection starts on deployment; older historical traffic is unavailable. No demographic or geography values are invented.

## Company integration

- `POST /analytics/columns/events`: ingest/upsert by event `id`; repeated duration updates must not increment pageviews. Payload: id, at, visitor (random pseudonymous browser ID), session (30-minute idle session), postId (null for index/about), path, referrer (external hostname only), device (viewport class), seconds (visible active duration estimate).
- `GET /admin/analytics/columns?from=YYYY-MM-DD&to=YYYY-MM-DD`: authenticate/authorize administrator and return the aggregation shape from `aggregateColumnEvents` in `cms/column-analytics.js`: summary, daily series, post ranking, referrers, devices, hours. All date/hour grouping uses Asia/Seoul.
- For public popular search results, expose the real cumulative `viewCount` in the existing `/columns` response. The public search modal ranks only actual numeric viewCount values, never browser-local totals.
- Production ingestion must validate payloads, deduplicate event IDs, filter automated traffic, rate-limit and enforce administrator authorization for reports. Do not expose raw visitors/sessions in the public posts API. Server-side persistence is required; GitHub Pages alone does not provide it.

Preview/admin routes are not collected. Global Privacy Control / Do Not Track and blocked browser storage skip collection without preventing reading. Demo mode retains at most 5,000 page records / 90 days. Referrers omit URL paths, queries and keywords. Gender, age, country, search keywords, likes, comments and video playback are not collected. No past Naver/Imweb statistics are reconstructed.

Report v2: `summary` and every daily `series` row additionally expose `visits`, `frequency` (visits / unique visitors), `returningVisitors`, `returnRate` (visitors with >=2 distinct sessions within the selected range / visitors * 100), and `averageSeconds` (visible active seconds / sessions). Optional `demographics` and `countries` are arrays of `{name,views}` from an authorized analytics provider; absence displays an explicit unavailable notice. `/admin/columns/statistics/?view=...` selects individual reports; the base route opens today's daily overview. No social neighbor/video/like metrics are invented for features not implemented in this site.
