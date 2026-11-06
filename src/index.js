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

const CLOUDSTREAM_PLUGIN_LIST =
  "https://raw.githubusercontent.com/Abodabodd/re-3arabi/refs/heads/builds/plugins.json";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=30, s-maxage=60",
      ...extraHeaders,
    },
  });
}

function textParam(url, key, fallback = "", max = 100) {
  return (url.searchParams.get(key) || fallback).trim().slice(0, max);
}

function safeId(value) {
  return /^[a-zA-Z0-9._-]{1,160}$/.test(value || "");
}

async function upstream(url, ttl = 60) {
  const response = await fetch(url, {
    headers: { "User-Agent": "ArabStream/1.0", Accept: "application/json" },
    cf: { cacheTtl: ttl, cacheEverything: true },
  });
  if (!response.ok) throw new Error("Provider returned HTTP " + response.status);
  return response.json();
}

function getAddon(id) {
  return ADDONS[id] || null;
}

function normalizePlugin(plugin) {
  const types = Array.isArray(plugin.tvTypes) ? plugin.tvTypes : [];
  return {
    id: String(plugin.internalName || plugin.name || ""),
    name: String(plugin.name || plugin.internalName || "Unnamed extension"),
    language: String(plugin.language || "unknown"),
    types,
    version: plugin.version ?? null,
    description: String(plugin.description || ""),
    icon: String(plugin.iconUrl || ""),
    runtime: "CloudStream / Kotlin",
    compatible: false,
    status: "catalog-only",
  };
}

function matchesPlugin(plugin, query, language, type) {
  const haystack = [plugin.name, plugin.id, plugin.description, plugin.language, ...plugin.types]
    .join(" ")
    .toLocaleLowerCase();
  return (!query || haystack.includes(query)) &&
    (!language || plugin.language.toLocaleLowerCase() === language) &&
    (!type || plugin.types.some((item) => String(item).toLocaleLowerCase() === type));
}

async function pluginIndex(url) {
  const source = await upstream(CLOUDSTREAM_PLUGIN_LIST, 300);
  if (!Array.isArray(source)) throw new Error("Invalid CloudStream plugin list");

  const all = source
    .filter((item) => item && item.status === 1)
    .filter((item) => !/youtube/i.test([item.name, item.internalName, item.url].filter(Boolean).join(" ")))
    .map(normalizePlugin)
    .filter((item) => item.id);

  const query = textParam(url, "q", "", 80).toLocaleLowerCase();
  const language = textParam(url, "language", "", 30).toLocaleLowerCase();
  const type = textParam(url, "type", "", 40).toLocaleLowerCase();
  const filtered = all.filter((item) => matchesPlugin(item, query, language, type));

  const languages = [...new Set(all.map((item) => item.language).filter(Boolean))].sort();
  const types = [...new Set(all.flatMap((item) => item.types).map(String))].sort();
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0);

  return {
    repository: "3rabi عربي",
    source: CLOUDSTREAM_PLUGIN_LIST,
    runtime: "CloudStream / Kotlin",
    compatibleWithArabStream: false,
    note: "الفهرس يعرض معلومات الإضافات فقط. ملفات CloudStream/Kotlin لا تعمل مباشرة داخل مشغل الويب.",
    total: filtered.length,
    allTotal: all.length,
    offset,
    limit,
    hasMore: offset + limit < filtered.length,
    filters: { q: query, language, type },
    availableLanguages: languages,
    availableTypes: types,
    plugins: filtered.slice(offset, offset + limit),
  };
}

async function addonManifest(id) {
  const addon = getAddon(id);
  if (!addon) return null;
  const manifest = await upstream(addon.manifest, 120);
  return { addon, manifest };
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        return json({
          name: "ArabStream API",
          version: "1.0.0",
          status: "ok",
          features: ["addons", "catalogs", "metadata", "streams-proxy", "cloudstream-index"],
        });
      }

      if (url.pathname === "/api/cloudstream/plugins") {
        return json(await pluginIndex(url), 200, { "Cache-Control": "public, max-age=60, s-maxage=300" });
      }

      if (url.pathname === "/api/addons") {
        const addons = await Promise.all(Object.entries(ADDONS).map(async ([id, addon]) => {
          try {
            const manifest = await upstream(addon.manifest, 120);
            return {
              id,
              name: manifest.name || addon.name,
              description: manifest.description || "",
              version: manifest.version || null,
              types: manifest.types || [],
              catalogsCount: Array.isArray(manifest.catalogs) ? manifest.catalogs.length : 0,
              manifest: addon.manifest,
              available: true,
            };
          } catch {
            return { id, name: addon.name, manifest: addon.manifest, available: false };
          }
        }));
        return json({ total: addons.length, addons });
      }

      if (parts[0] === "api" && parts[1] === "addons" && parts[3] === "manifest") {
        const result = await addonManifest(parts[2]);
        if (!result) return json({ error: "Unknown add-on" }, 404);
        return json(result.manifest);
      }

      if (parts[0] === "api" && parts[1] === "addons" && parts[3] === "catalogs") {
        const result = await addonManifest(parts[2]);
        if (!result) return json({ error: "Unknown add-on" }, 404);
        const catalogs = Array.isArray(result.manifest.catalogs) ? result.manifest.catalogs : [];
        return json({
          addon: { id: parts[2], name: result.manifest.name || result.addon.name },
          types: result.manifest.types || [],
          catalogs: catalogs.map((catalog) => ({
            id: catalog.id,
            type: catalog.type,
            name: catalog.name,
            extra: catalog.extra || [],
          })),
          total: catalogs.length,
        });
      }

      if (parts[0] === "api" && ["catalog", "meta", "streams"].includes(parts[1])) {
        const kind = parts[1];
        const addonId = parts[2];
        const mediaType = parts[3];
        const itemId = parts.slice(4).join("/");
        const addon = getAddon(addonId);

        if (!addon) return json({ error: "Unknown add-on" }, 404);
        if (!["movie", "series"].includes(mediaType)) {
          return json({ error: "media_type must be movie or series" }, 400);
        }
        if (!safeId(itemId)) return json({ error: "Invalid catalog or item ID" }, 400);

        const base = addon.manifest.slice(0, addon.manifest.lastIndexOf("/"));
        let target;
        if (kind === "catalog") {
          target = new URL(`${base}/catalog/${encodeURIComponent(mediaType)}/${encodeURIComponent(itemId)}.json`);
          for (const key of ["skip", "search"]) {
            const value = url.searchParams.get(key);
            if (value !== null) target.searchParams.set(key, value.slice(0, 120));
          }
          // Forward only declared-style catalog filters; never forward arbitrary URL parameters.
          for (const [key, value] of url.searchParams.entries()) {
            if (/^[a-zA-Z][a-zA-Z0-9_-]{0,30}$/.test(key) && !["skip", "search"].includes(key)) {
              target.searchParams.set(key, value.slice(0, 120));
            }
          }
        } else {
          target = new URL(`${base}/${kind === "meta" ? "meta" : "stream"}/${encodeURIComponent(mediaType)}/${encodeURIComponent(itemId)}.json`);
        }
        return json(await upstream(target.toString(), 60));
      }

      return json({ error: "Not found", path: url.pathname }, 404);
    } catch (error) {
      return json({
        error: "Provider request failed",
        detail: String(error.message || error),
      }, 502);
    }
  },
};
