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

    // Command: !gifusion latest (or newest)
    if (message.content.startsWith('!gifusion latest') || message.content.startsWith('!gifusion newest')) {
        try {
            // Fetch latest renders
            const res = await fetch(`${API_BASE}/api/renders/latest?limit=1`);
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

            // Download file
            const fileRes = await fetch(fileUrl);
            if (!fileRes.ok) {
                message.reply("Failed to download video file.");
                return;
            }

            const arrayBuffer = await fileRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const attachment = new AttachmentBuilder(buffer, { name: `gifusion-${item.id}.webm` });

            await message.channel.send({
                content: `**Latest Render**\nID: \`${item.id}\`\nDuration: ${item.duration}s\nCreated: ${new Date(item.createdAt).toLocaleString()}`,
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            message.reply("An error occurred while fetching the latest render.");
        }
    }

    // Command: !gifusion send <id>
    if (message.content.startsWith('!gifusion send ')) {
        const args = message.content.split(' ');
        const id = args[2];
        if (!id) {
            message.reply("Usage: !gifusion send <id>");
            return;
        }

        try {
            // Fetch render metadata
            const res = await fetch(`${API_BASE}/api/renders/${id}`);
            if (res.status === 404) {
                message.reply("Render not found.");
                return;
            }
            if (!res.ok) {
                message.reply(`API Error: ${res.status}`);
                return;
            }

            const item = await res.json();
            const fileUrl = item.url;

            message.channel.sendTyping();

            const fileRes = await fetch(fileUrl);
            if (!fileRes.ok) {
                message.reply("Failed to download video file.");
                return;
            }

            const arrayBuffer = await fileRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const attachment = new AttachmentBuilder(buffer, { name: `gifusion-${item.id}.webm` });

            await message.channel.send({
                content: `**Render: ${item.id}**\nParams: \`${JSON.stringify(item.paramsUsed || {})}\``,
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            message.reply("An error occurred while fetching the render.");
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
