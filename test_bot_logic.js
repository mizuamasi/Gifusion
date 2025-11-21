// test_bot_logic.js
const API_BASE = "http://localhost:8787"; // Assuming local worker or use remote if needed

async function testLatest() {
    console.log("Testing !gifusion latest...");
    try {
        const res = await fetch(`${API_BASE}/api/renders/latest?limit=1`);
        if (!res.ok) {
            console.error(`API Error: ${res.status}`);
            return;
        }
        const items = await res.json();
        console.log("Items found:", items.length);
        if (items.length > 0) {
            console.log("Latest Item:", items[0]);
            return items[0].id;
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
    return null;
}

async function testSend(id) {
    if (!id) return;
    console.log(`Testing !gifusion send ${id}...`);
    try {
        const res = await fetch(`${API_BASE}/api/renders/${id}`);
        if (!res.ok) {
            console.error(`API Error: ${res.status}`);
            return;
        }
        const item = await res.json();
        console.log("Render found:", item);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

(async () => {
    const id = await testLatest();
    if (id) {
        await testSend(id);
    } else {
        console.log("No items to test send with.");
    }
})();
