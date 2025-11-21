// const fetch = require('node-fetch'); // Native fetch in Node 18+

const API_URL = "https://gifuto-worker.rekahsnnig.workers.dev/api/upload";

async function testUpload() {
    // Create a dummy buffer (not a real WebM, but enough to test upload flow)
    const buffer = Buffer.from("dummy webm content");

    console.log("Uploading to:", API_URL);

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "video/webm",
                "X-Gifuto-Sketch-Key": "test",
                "X-Gifuto-Params": "{}",
                "X-Gifuto-Config": '{"durationSec": 1}'
            },
            body: buffer
        });

        if (!res.ok) {
            console.error("Upload failed:", res.status, await res.text());
            return;
        }

        const data = await res.json();
        console.log("Upload successful!");
        console.log(JSON.stringify(data, null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
}

testUpload();
