// js/api.js

const SketchAPI = {
    async save(sketch) {
        const res = await fetch(`${BACKEND_BASE_URL}/api/sketches`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sketch),
        });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    },

    async get(id) {
        const res = await fetch(`${BACKEND_BASE_URL}/api/sketches/${id}`);
        if (!res.ok) throw new Error("Sketch not found");
        return await res.json();
    },

    async listLatest(limit = 20) {
        const res = await fetch(`${BACKEND_BASE_URL}/api/sketches/latest?limit=${limit}`);
        if (!res.ok) return [];
        return await res.json();
    }
};

const RenderAPI = {
    async upload(blob, metadata) {
        const headers = {
            "Content-Type": "video/webm",
            "X-Gifuto-Sketch-Key": metadata.sketchId,
            "X-Gifuto-Params": JSON.stringify(metadata.params),
            "X-Gifuto-Config": JSON.stringify({ duration: metadata.duration })
        };

        const res = await fetch(`${BACKEND_BASE_URL}/api/renders`, {
            method: "POST",
            headers: headers,
            body: blob,
        });

        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    },

    async listLatest(limit = 10) {
        const res = await fetch(`${BACKEND_BASE_URL}/api/renders/latest?limit=${limit}`);
        if (!res.ok) return [];
        return await res.json();
    }
};
