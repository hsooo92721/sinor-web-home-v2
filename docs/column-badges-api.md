# Column badge configuration

The demo stores badge rules under the site's `sinor-column-badges:<base path>` localStorage key. With no override, `cms/column-badges.json` supplies the shared NEW rule. Demo changes follow the existing same-browser CMS behavior; company-wide persistence requires the API below.

- `GET /columns/badges` returns `{ "rules": [...] }` for readers and administrators.
- `PUT /admin/columns/badges` accepts the same object and persists the complete ordered rules array. Protect this endpoint with company authentication when enabled.
- Rule fields: `id`, `label` (1–20 characters), `background` and `color` (six-digit HEX), `radius` (0–100 px), `enabled`, `condition`.
- Conditions: `{type:"recent",value:7}`, `{type:"topViews",value:5}`, `{type:"minViews",value:100}`, `{type:"category",ids:["health"]}`, `{type:"manual",ids:["post-id"]}`.
- Recent uses the configured original `displayDate`, not migration/update timestamps. Future dates do not qualify.
- View-based rules use actual finite numeric `viewCount` fields on published articles. No inferred/fabricated counts are supplied. Top N is evaluated across all published articles before category filtering or pagination. Equal view counts are ordered deterministically by post ID.
- Full labels appear in admin. Reader list cards show the first character only when multiple rules match, retaining full labels in title/aria-label attributes. Homepage cards remain without badges.
- Validate the same constraints server-side. An empty array intentionally disables all badges.
