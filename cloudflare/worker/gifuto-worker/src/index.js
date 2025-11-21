// src/index.js

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Gifuto-Params,X-Gifuto-Config,X-Gifuto-Sketch-Key,X-Gifuto-User-ID",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

// ---- KV 読み書き ----
async function loadItems(env) {
  const json = await env.GIFUTO_ITEMS.get("items");
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

async function saveItems(env, items) {
  await env.GIFUTO_ITEMS.put("items", JSON.stringify(items));
}

// ---- Content-Type → 拡張子判定 ----
function detectExtAndType(contentType) {
  const ct = (contentType || "").toLowerCase();

  if (ct.startsWith("video/webm")) {
    return { ext: "webm", mime: "video/webm" };
  }
  if (ct === "image/gif") {
    return { ext: "gif", mime: "image/gif" };
  }
  if (ct === "image/webp") {
    return { ext: "webp", mime: "image/webp" };
  }

  throw new Error("unsupported content-type: " + contentType);
}

// 拡張子からざっくり MIME を決める（R2 から取り出すとき用）
function guessMimeFromExt(ext) {
  const e = (ext || "").toLowerCase();
  if (e === "webm") return "video/webm";
  if (e === "gif") return "image/gif";
  if (e === "webp") return "image/webp";
  return "application/octet-stream";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 動作確認
    if (pathname === "/api/hello" && request.method === "GET") {
      return jsonResponse({ message: "やっほー！" });
    }

    // ------------------------
    // 1. アップロード: POST /api/upload
    // ------------------------
    if (pathname === "/api/upload" && request.method === "POST") {
      try {
        const bucket = env.GIFUTO_BUCKET || env.gifuto_media;
        if (!bucket) throw new Error("No R2 bucket bound");

        const contentType = request.headers.get("content-type") || "";
        let ext, mime;
        try {
          ({ ext, mime } = detectExtAndType(contentType));
        } catch (e) {
          return jsonResponse({ error: "invalid content-type" }, 400);
        }

        const arrayBuffer = await request.arrayBuffer();
        const body = new Uint8Array(arrayBuffer);

        const now = Date.now();
        const id = crypto.randomUUID(); // Use UUID
        const key = `${id}.${ext}`;

        await bucket.put(key, body, {
          httpMetadata: { contentType: mime },
        });

        const publicUrl = `${url.origin}/media/${id}.${ext}`;

        // メタデータ取得 (Headerから)
        const sketchKey = request.headers.get("X-Gifuto-Sketch-Key") || "default";
        const paramsJson = request.headers.get("X-Gifuto-Params") || "{}";
        const configJson = request.headers.get("X-Gifuto-Config") || "{}";

        let params = {};
        let config = {};
        try {
          params = JSON.parse(paramsJson);
          config = JSON.parse(configJson);
        } catch (e) {
          console.warn("metadata parse error", e);
        }

        // Ensure duration is available at top level
        const duration = config.durationSec || 0;

        const item = {
          id,
          url: publicUrl,
          format: ext, // "webm" / "gif" / "webp" など
          sketchKey,
          params,
          config,
          duration, // Add duration here
          title: "",
          tags: [],
          createdAt: now,
        };

        const items = await loadItems(env);
        items.unshift(item);

        // Limit items to 50 to prevent KV size issues for MVP
        if (items.length > 50) {
          items.length = 50;
        }

        await saveItems(env, items);

        return jsonResponse({ id, url: publicUrl, format: ext }, 201);
      } catch (err) {
        console.error("upload error:", err);
        return jsonResponse(
          { error: "upload failed", detail: String(err) },
          500
        );
      }
    }

    // ------------------------
    // 2. 最新ループ取得: GET /api/items/latest?limit=10
    // ------------------------
    if (pathname === "/api/items/latest" && request.method === "GET") {
      const limitParam = searchParams.get("limit") || "5";
      const limit = Math.max(1, Math.min(20, parseInt(limitParam, 10) || 5));

      const items = await loadItems(env);
      const latest = items.slice(0, limit);

      return jsonResponse(latest);
    }

    // ------------------------
    // 3. R2 からメディア読み出し: GET /media/:id(.ext)
    // ------------------------
    if (pathname.startsWith("/media/") && request.method === "GET") {
      const filePart = pathname.replace("/media/", "").trim();
      if (!filePart) {
        return new Response("Bad Request", {
          status: 400,
          headers: CORS_HEADERS,
        });
      }

      const bucket = env.GIFUTO_BUCKET || env.gifuto_media;
      if (!bucket) {
        return jsonResponse({ error: "No R2 bucket bound" }, 500);
      }

      // filePart が "id.ext" または "id"
      let key = filePart;

      // 後方互換: 拡張子が無い場合は .webm とみなす
      if (!key.includes(".")) {
        key = `${key}.webm`;
      }

      const obj = await bucket.get(key);
      if (!obj || !obj.body) {
        return new Response("Not found", {
          status: 404,
          headers: CORS_HEADERS,
        });
      }

      // 拡張子から MIME を推定
      const ext = key.split(".").pop();
      const mime = guessMimeFromExt(ext);

      return new Response(obj.body, {
        status: 200,
        headers: {
          "Content-Type": mime,
          ...CORS_HEADERS,
        },
      });
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};
