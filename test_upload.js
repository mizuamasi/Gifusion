const fs = require('fs');
const path = require('path');

// const API_URL = "https://gifuto-worker.kenco-pc.workers.dev/api/renders";
const API_URL = "http://localhost:8787/api/renders"; // Local worker

async function upload() {
    const filePath = path.join(__dirname, "test_video.webm");

    // Create dummy file if not exists
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, Buffer.alloc(1024)); // 1KB dummy
    }

    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    const fileStream = fs.createReadStream(filePath);

    console.log(`Uploading ${filePath} (${fileSizeInBytes} bytes)...`);

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'video/webm',
                'X-Gifuto-Sketch-Key': 'test-sketch',
                'X-Gifuto-Params': JSON.stringify({ color: '#ff0000' }),
                'X-Gifuto-Config': JSON.stringify({ duration: 10 })
            },
            body: fs.readFileSync(filePath) // Use sync read for simplicity with fetch in node
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Upload failed: ${res.status} ${text}`);
        }

        const data = await res.json();
        console.log("Upload Success:", data);
    } catch (error) {
        console.error("Error:", error);
    }
}

upload();
