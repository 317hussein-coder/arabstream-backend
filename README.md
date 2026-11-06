# ArabStream Backend — Cloudflare Workers

JavaScript API for the ArabStream web interface. It combines the configured Stremio-compatible catalogs behind one same-origin-friendly API and exposes a searchable metadata index for the separate CloudStream repository.

## Deploy
Cloudflare Workers Builds:
- Build command: `npm install`
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler dev`

## Routes

### Status and providers
- `GET /health`
- `GET /api/addons` — configured providers and live availability.
- `GET /api/addons/{addon_id}/manifest` — provider manifest.
- `GET /api/addons/{addon_id}/catalogs` — catalog IDs, types, names, and supported extras.

### Catalog content
- `GET /api/catalog/{addon_id}/{media_type}/{catalog_id}?skip=0&search=`
- `GET /api/meta/{addon_id}/{media_type}/{item_id}`
- `GET /api/streams/{addon_id}/{media_type}/{item_id}`

Provider IDs: `bidooo`, `cartoon-aziz`. Media types: `movie`, `series`.

### CloudStream discovery index
- `GET /api/cloudstream/plugins`
- Optional filters: `q`, `language`, `type`, `limit`, `offset`.
- Response includes available languages/types, pagination, and extension metadata.
- YouTube entries are filtered out.

Example:
```
/api/cloudstream/plugins?q=arabic&limit=20
/api/cloudstream/plugins?language=ar&type=movie&offset=20
```

## Important compatibility notes
- CloudStream `.cs3` extensions are Kotlin-based and are **not** Stremio add-ons. This API indexes their public metadata only; it does not execute them or claim they work in the ArabStream player.
- Only providers explicitly configured in `ADDONS` are proxied. Add a provider only when its API and media use are authorized.
- The Worker proxies provider JSON; it does not host or download video files.
- Provider uptime, returned stream availability, browser CORS, and media format support remain dependent on each provider and browser.
- Cartoon Aziz may declare catalog types differently from its displayed category; the API preserves provider metadata rather than silently rewriting IDs.
- CORS is open for the MVP. Restrict `Access-Control-Allow-Origin` to the deployed ArabStream frontend domain before production.
- No DRM or access-control bypass is implemented.
