from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
from typing import Any

app = FastAPI(title="ArabStream API", version="0.1.0")

# MVP: providers are fixed here; never accept arbitrary upstream URLs from clients.
ADDONS = {
    "bidooo": {
        "name": "Bidooo Arabic Catalog",
        "manifest": "https://ozpwgjjkvrpxbeuhmmdr.supabase.co/functions/v1/bidooo-addon/manifest.json",
    },
    "cartoon-aziz": {
        "name": "Cartoon Aziz",
        "manifest": "https://cartoon-aziz-addon.onrender.com/manifest.json",
    },
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to the Wix site domain before production.
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

TIMEOUT = httpx.Timeout(20.0, connect=10.0)

async def fetch_json(url: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "ArabStream/0.1"})
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError("Upstream response is not a JSON object")
            return data
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Provider request failed: {type(exc).__name__}") from exc

def addon_or_404(addon_id: str) -> dict[str, str]:
    addon = ADDONS.get(addon_id)
    if not addon:
        raise HTTPException(status_code=404, detail="Unknown add-on")
    return addon

@app.get("/")
async def root():
    return {"name": "ArabStream API", "status": "ok", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/api/addons")
async def list_addons():
    return {"addons": [{"id": key, "name": value["name"], "manifest": value["manifest"]} for key, value in ADDONS.items()]}

@app.get("/api/addons/{addon_id}/manifest")
async def addon_manifest(addon_id: str):
    addon = addon_or_404(addon_id)
    return await fetch_json(addon["manifest"])

@app.get("/api/catalog/{addon_id}/{media_type}/{catalog_id}")
async def catalog(
    addon_id: str,
    media_type: str,
    catalog_id: str,
    skip: int = Query(0, ge=0),
    search: str | None = None,
):
    addon = addon_or_404(addon_id)
    if media_type not in ("movie", "series"):
        raise HTTPException(status_code=400, detail="media_type must be movie or series")
    base = addon["manifest"].rsplit("/", 1)[0]
    url = f"{base}/catalog/{media_type}/{catalog_id}.json"
    params: dict[str, str] = {}
    if skip:
        params["skip"] = str(skip)
    if search:
        params["search"] = search
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            response = await client.get(url, params=params, headers={"User-Agent": "ArabStream/0.1"})
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Catalog request failed: {type(exc).__name__}") from exc

@app.get("/api/meta/{addon_id}/{media_type}/{item_id:path}")
async def metadata(addon_id: str, media_type: str, item_id: str):
    addon = addon_or_404(addon_id)
    if media_type not in ("movie", "series"):
        raise HTTPException(status_code=400, detail="media_type must be movie or series")
    base = addon["manifest"].rsplit("/", 1)[0]
    return await fetch_json(f"{base}/meta/{media_type}/{item_id}.json")

@app.get("/api/streams/{addon_id}/{media_type}/{item_id:path}")
async def streams(addon_id: str, media_type: str, item_id: str):
    addon = addon_or_404(addon_id)
    if media_type not in ("movie", "series"):
        raise HTTPException(status_code=400, detail="media_type must be movie or series")
    base = addon["manifest"].rsplit("/", 1)[0]
    return await fetch_json(f"{base}/stream/{media_type}/{item_id}.json")
