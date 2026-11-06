# ArabStream Backend — Cloudflare Workers

A lightweight JavaScript Worker that exposes a unified API for the initial Stremio-compatible providers.

## Deploy
Cloudflare Workers Builds:
- Build command: `npm install`
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler dev`

The repository includes `wrangler.toml` and `package.json`.

## Routes
- `GET /health`
- `GET /api/addons`
- `GET /api/addons/{addon_id}/manifest`
- `GET /api/catalog/{addon_id}/{media_type}/{catalog_id}?skip=0&search=`
- `GET /api/meta/{addon_id}/{media_type}/{item_id}`
- `GET /api/streams/{addon_id}/{media_type}/{item_id}`

Provider IDs: `bidooo`, `cartoon-aziz`. Media types: `movie`, `series`.

## Notes
- This Worker proxies provider JSON; it does not host or download video files.
- Provider uptime, returned stream availability, browser CORS, and media format support are outside this Worker's control.
- Cartoon Aziz currently declares its movies catalog using type `series`; this Worker does not rewrite provider IDs or catalog types.
- CloudStream `.cs3` extensions are not Stremio add-ons and are not executed here.
- CORS is open for the MVP. Restrict `Access-Control-Allow-Origin` to the Wix site domain before production.
- Use only sources and streams you are authorized to access. No DRM or access-control bypass is implemented.
