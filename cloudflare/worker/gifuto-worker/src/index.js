
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Gifuto-Sketch-Key, X-Gifuto-Params, X-Gifuto-Config",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // DEBUG: Log all env keys to find the correct binding name
    console.log("Worker Request:", request.method, path);
    console.log("Env Keys JSON:", JSON.stringify(Object.keys(env)));

    if (!env.GIFUTO_ITEMS) console.error("GIFUTO_ITEMS is undefined!");

    // --- /api/sketches ---

    // POST /api/sketches - Save a new sketch
    if (path === "/api/sketches" && request.method === "POST") {
      try {
        const data = await request.json();
        const { title, code, paramsSchema, ownerId } = data;

        if (!code) return new Response("Code is required", { status: 400, headers: corsHeaders });

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        const sketch = {
          id,
          title: title || "Untitled Sketch",
          code,
          paramsSchema: paramsSchema || {},
          ownerId: ownerId || null,
          createdAt: now,
          updatedAt: now
        };

        // Save to KV
        await env.GIFUTO_ITEMS.put(`sketch:${id}`, JSON.stringify(sketch));

        // Add to latest list (separate list for sketches)
        const listKey = "latest_sketches";
        let list = await env.GIFUTO_ITEMS.get(listKey, { type: "json" }) || [];
        list.unshift({ id, title: sketch.title, createdAt: now });
        if (list.length > 50) list = list.slice(0, 50);
        await env.GIFUTO_ITEMS.put(listKey, JSON.stringify(list));

        return new Response(JSON.stringify(sketch), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response("Error saving sketch: " + e.message, { status: 500, headers: corsHeaders });
      }
    }

    // GET /api/sketches/latest
    if (path === "/api/sketches/latest" && request.method === "GET") {
      const list = await env.GIFUTO_ITEMS.get("latest_sketches", { type: "json" }) || [];
      return new Response(JSON.stringify(list), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // GET /api/sketches/:id
    if (path.startsWith("/api/sketches/") && request.method === "GET") {
      const id = path.split("/").pop();
      const sketch = await env.GIFUTO_ITEMS.get(`sketch:${id}`, { type: "json" });

      if (!sketch) {
        return new Response("Sketch not found", { status: 404, headers: corsHeaders });
      }

      return new Response(JSON.stringify(sketch), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- /api/renders (formerly /api/upload) ---

    if ((path === "/api/renders" || path === "/api/upload") && request.method === "POST") {
      try {
        const id = crypto.randomUUID();
        const key = `${id}.webm`;

        // Headers metadata
        const sketchKey = request.headers.get("X-Gifuto-Sketch-Key") || "unknown";
        const paramsJson = request.headers.get("X-Gifuto-Params") || "{}";
        const configJson = request.headers.get("X-Gifuto-Config") || "{}";

        let duration = 0;
        try {
          const config = JSON.parse(configJson);
          if (config.durationSec) duration = config.durationSec;
          else if (config.duration) duration = config.duration / 1000;
        } catch (e) { }

        // Save WebM to R2
        const bucket = env.GIFUTO_BUCKET || env.gifuto_bucket || env.gifuto_media;
        if (!bucket) throw new Error("Bucket binding not found. Env keys: " + JSON.stringify(Object.keys(env)));

        await bucket.put(key, request.body, {
          httpMetadata: { contentType: "video/webm" },
        });

        const url = `${env.R2_PUBLIC_URL}/${key}`;

        // Save Metadata to KV
        const metadata = {
          id,
          url,
          sketchId: sketchKey,
          paramsUsed: JSON.parse(paramsJson),
          duration,
          createdAt: new Date().toISOString(),
        };

        await env.GIFUTO_ITEMS.put(`render:${id}`, JSON.stringify(metadata));

        // Update Latest Renders List
        const listKey = "latest_renders";
        let list = await env.GIFUTO_ITEMS.get(listKey, { type: "json" }) || [];

        const item = { id, url, duration, createdAt: metadata.createdAt };

        list.unshift(item);
        if (list.length > 50) list = list.slice(0, 50);
        await env.GIFUTO_ITEMS.put(listKey, JSON.stringify(list));

        // Legacy support
        await env.GIFUTO_ITEMS.put("latest_items", JSON.stringify(list));

        return new Response(JSON.stringify({ success: true, url, id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        return new Response(`Upload failed: ${err.message}`, { status: 500, headers: corsHeaders });
      }
    }

    // GET /api/renders/latest (and legacy /api/items/latest)
    if ((path === "/api/renders/latest" || path === "/api/items/latest") && request.method === "GET") {
      const list = await env.GIFUTO_ITEMS.get("latest_renders", { type: "json" }) ||
        await env.GIFUTO_ITEMS.get("latest_items", { type: "json" }) || [];
      return new Response(JSON.stringify(list), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /api/renders/:id
    if (path.startsWith("/api/renders/") && request.method === "GET") {
      const id = path.split("/").pop();
      const metadata = await env.GIFUTO_ITEMS.get(`render:${id}`, { type: "json" });

      if (!metadata) {
        return new Response("Render not found", { status: 404, headers: corsHeaders });
      }

      return new Response(JSON.stringify(metadata), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Media serving (if needed via worker, though R2 public URL is preferred)
    if (path.startsWith("/media/")) {
      const key = path.replace("/media/", "");
      const bucket = env.GIFUTO_BUCKET || env.gifuto_bucket;
      if (!bucket) return new Response("Bucket not configured", { status: 500, headers: corsHeaders });

      const object = await bucket.get(key);
      if (!object) return new Response("Not found", { status: 404, headers: corsHeaders });
      return new Response(object.body, {
        headers: { ...corsHeaders, "Content-Type": object.httpMetadata.contentType }
      });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
