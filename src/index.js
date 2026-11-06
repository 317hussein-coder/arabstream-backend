const ADDONS = {
  bidooo: {
    name: "Bidooo Arabic Catalog",
    manifest: "https://ozpwgjjkvrpxbeuhmmdr.supabase.co/functions/v1/bidooo-addon/manifest.json",
  },
  "cartoon-aziz": {
    name: "Cartoon Aziz",
    manifest: "https://cartoon-aziz-addon.onrender.com/manifest.json",
  },
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function upstream(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "ArabStream/0.2" },
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  if (!response.ok) {
    throw new Error("Provider returned HTTP " + response.status);
  }
  return response.json();
}

function getAddon(id) {
  return ADDONS[id] || null;
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        return json({ name: "ArabStream API", status: "ok" });
      }
      if (url.pathname === "/api/addons") {
        return json({ addons: Object.entries(ADDONS).map(([id, a]) => ({
          id, name: a.name, manifest: a.manifest,
        })) });
      }

      if (parts[0] === "api" && parts[1] === "addons" && parts[3] === "manifest") {
        const addon = getAddon(parts[2]);
        if (!addon) return json({ error: "Unknown add-on" }, 404);
        return json(await upstream(addon.manifest));
      }

      if (parts[0] === "api" && ["catalog", "meta", "streams"].includes(parts[1])) {
        const kind = parts[1];
        const addon = getAddon(parts[2]);
        const mediaType = parts[3];
        const itemId = parts.slice(4).join("/");
        if (!addon) return json({ error: "Unknown add-on" }, 404);
        if (!["movie", "series"].includes(mediaType)) {
          return json({ error: "media_type must be movie or series" }, 400);
        }
        if (!itemId) return json({ error: "Missing catalog or item ID" }, 400);

        const base = addon.manifest.slice(0, addon.manifest.lastIndexOf("/"));
        let target;
        if (kind === "catalog") {
          target = new URL(`${base}/catalog/${encodeURIComponent(mediaType)}/${itemId}.json`);
          for (const key of ["skip", "search"]) {
            const value = url.searchParams.get(key);
            if (value !== null) target.searchParams.set(key, value);
          }
        } else {
          target = new URL(`${base}/${kind === "meta" ? "meta" : "stream"}/${encodeURIComponent(mediaType)}/${itemId}.json`);
        }
        return json(await upstream(target.toString()));
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: "Provider request failed", detail: String(error.message || error) }, 502);
    }
  },
};
