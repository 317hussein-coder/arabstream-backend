# ArabStream Backend

FastAPI bridge for the initial Stremio-compatible ArabStream providers.

## Included providers
- `bidooo` — Bidooo Arabic Catalog
- `cartoon-aziz` — Cartoon Aziz

The API reads provider manifests and proxies catalog, metadata, and stream JSON. It does not download or host video files.

## Run locally
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `/docs` for the API explorer and `/health` for the health check.

## API routes
- `GET /health`
- `GET /api/addons`
- `GET /api/addons/{addon_id}/manifest`
- `GET /api/catalog/{addon_id}/{media_type}/{catalog_id}?skip=0&search=`
- `GET /api/meta/{addon_id}/{media_type}/{item_id}`
- `GET /api/streams/{addon_id}/{media_type}/{item_id}`

Supported add-on IDs: `bidooo`, `cartoon-aziz`. Supported media types: `movie`, `series`.

## Deploy on Render
1. In Render, choose **New +** → **Blueprint**.
2. Connect GitHub and select `317hussein-coder/arabstream-backend`.
3. Render detects `render.yaml`; review and create the service.
4. After deployment, test `https://YOUR-SERVICE.onrender.com/health`.

## Important integration notes
- This is an initial backend, not a completed streaming site deployment.
- Provider endpoints must be tested after deployment; availability and returned streams depend on each provider.
- The Cartoon Aziz manifest currently declares its movies catalog with type `series`; this adapter does not silently rewrite provider IDs or catalog types.
- Browser playback depends on the returned stream format, CORS, and browser support. MP4 and HLS are common formats, but not every source is guaranteed to play.
- CloudStream `.cs3` plugins are not Stremio add-ons and are not executable by this API. They need a separate compatible runtime or individually implemented adapters.
- CORS is open for the MVP. Before production, replace `allow_origins=["*"]` in `app/main.py` with the exact ArabStream Wix origin.
- Only connect sources and streams you are authorized to use. This project does not bypass DRM or access controls.
