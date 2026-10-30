# Footer settings

The existing site-settings API is reused: GET `/site/settings` and GET/PUT `/admin/site/settings`.

`footer` now includes `textColor` (six-digit HEX), `logo` (validated image URL or uploaded image data), and ordered `links` in addition to existing business information. Each link has `id`, `label`, `url`, `group` (`primary`, `policy`, `extra`) and `newTab` (`null` for existing default behavior, or boolean). Preserve an empty links array: it intentionally hides the menus. Relative and leading-slash page URLs resolve against the deployed site base path, including GitHub Pages project prefixes. Reject unsafe schemes server-side too.

The editor keeps changes in its form until Save. Demo saves use the existing browser-local site-settings key; production-wide persistence requires the company API to store and return these fields. Link edits modify footer navigation only, not page creation/deletion. Resetting the logo restores the original shared logo and its home link.
