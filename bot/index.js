require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
// Node 18+ has native fetch, but if older node is used, we might need node-fetch.
// Assuming Node 18+ for simplicity, or user will install node-fetch if needed.
// If node-fetch is installed via package.json, we can use it.
// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const API_BASE = process.env.API_BASE || "https://gifuto-worker.kenco-pc.workers.dev"; // Default or from env

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!gifusion latest')) {
        try {
            // 1. Fetch latest item metadata
            const res = await fetch(`${API_BASE}/api/items/latest?limit=1`);
            if (!res.ok) {
                message.reply(`API Error: ${res.status}`);
                return;
            }
            const items = await res.json();
            if (!items || items.length === 0) {
                message.reply("No items found.");
                return;
            }

            const item = items[0];
            const fileUrl = item.url;

            message.channel.sendTyping();

            // 2. Download the file
            // Discord needs a Buffer or Stream for attachment if we want it to be treated as a file upload
            // rather than just a link (which might not auto-embed or loop as nicely).
            const fileRes = await fetch(fileUrl);
            if (!fileRes.ok) {
                message.reply("Failed to download video file.");
                return;
            }

            const arrayBuffer = await fileRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // 3. Send as attachment
            const attachment = new AttachmentBuilder(buffer, { name: `gifusion-${item.id}.webm` });

            await message.channel.send({
                content: `**Latest Loop**\nID: \`${item.id}\`\nCreated: ${new Date(item.createdAt).toLocaleString()}`,
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            message.reply("An error occurred while fetching the latest loop.");
        }
    }
});

// Login
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
    console.error("Error: DISCORD_TOKEN is not set in .env");
    process.exit(1);
}

client.login(TOKEN);
