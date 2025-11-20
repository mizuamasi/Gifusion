// index.js

import fs from "fs";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import fetch from "node-fetch";

// --- secrets.json 読み込み ---
let secrets = {};
try {
  const raw = fs.readFileSync("./secrets.json", "utf8");
  secrets = JSON.parse(raw);
} catch (e) {
  console.error("secrets.json が読めない。ファイルの有無とJSON構造を確認しろ。");
  process.exit(1);
}

const TOKEN = secrets.DISCORD_BOT_TOKEN;
const CLIENT_ID = secrets.DISCORD_CLIENT_ID;
const GUILD_ID = secrets.GUILD_ID;
const BACKEND_BASE_URL = secrets.GIFUTO_API_BASE_URL;

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !BACKEND_BASE_URL) {
  console.error("secrets.json の中身が足りない。キー名/値を確認しろ。");
  console.error({ TOKEN, CLIENT_ID, GUILD_ID, BACKEND_BASE_URL });
  process.exit(1);
}

// ---------------- スラッシュコマンド定義 ----------------

const commands = [
  new SlashCommandBuilder()
    .setName("gifuto-latest")
    .setDescription("Gifutoで登録された最新のループを1件表示する"),
  new SlashCommandBuilder()
    .setName("gifuto-random")
    .setDescription("Gifutoから最近のループの中からランダムに1件表示する"),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });
  console.log("Slash commands registered");
}

// ---------------- Bot本体 ----------------

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "gifuto-latest") {
    await interaction.deferReply();

    try {
      const res = await fetch(
        `${BACKEND_BASE_URL}/api/items/latest?limit=1`
      );
      if (!res.ok) {
        await interaction.editReply("Backendから取得に失敗した。");
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        await interaction.editReply("まだ登録されたループがない。");
        return;
      }

      const item = data[0];
      await interaction.editReply(item.url || "(urlがない)");
    } catch (e) {
      console.error(e);
      await interaction.editReply("エラーで死んだ。ログを見ろ。");
    }
  }

  if (interaction.commandName === "gifuto-random") {
    await interaction.deferReply();

    try {
      const res = await fetch(
        `${BACKEND_BASE_URL}/api/items/latest?limit=10`
      );
      if (!res.ok) {
        await interaction.editReply("Backendから取得に失敗した。");
        return;
      }

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        await interaction.editReply("まだ登録されたループがない。");
        return;
      }

      const item = data[Math.floor(Math.random() * data.length)];
      await interaction.editReply(item.url || "(urlがない)");
    } catch (e) {
      console.error(e);
      await interaction.editReply("エラーで死んだ。ログを見ろ。");
    }
  }
});

// ---------------- 起動 ----------------

(async () => {
  try {
    await registerCommands();
    await client.login(TOKEN);
  } catch (e) {
    console.error("起動時に死んだ:", e);
  }
})();
