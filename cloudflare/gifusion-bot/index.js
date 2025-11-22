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
const CLIENT_ID = secrets.CLIENT_ID;
const GUILD_ID = secrets.GUILD_ID;
const BACKEND_BASE_URL = secrets.GIFUTO_API_BASE_URL;
const FRONTEND_BASE_URL = secrets.GIFUTO_FRONTEND_BASE_URL;

if (!TOKEN || !CLIENT_ID || !GUILD_ID || !BACKEND_BASE_URL || !FRONTEND_BASE_URL) {
  console.error("secrets.json の中身が足りない。キー名/値を確認しろ。");
  console.error({ TOKEN, CLIENT_ID, GUILD_ID, BACKEND_BASE_URL, FRONTEND_BASE_URL });
  process.exit(1);
}

// ---------------- スラッシュコマンド定義 ----------------

// /gifuto create / latest / random
const commands = [
  new SlashCommandBuilder()
    .setName("gifusion")
    .setDescription("Gifusion: ループネタ生成")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("生成ページを開くためのURLを発行する")
        .addStringOption((opt) =>
          opt
            .setName("template")
            .setDescription("テンプレ名（例: kusa, uso, ome）")
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("text")
            .setDescription("表示したいテキスト")
            .setRequired(false)
        )
        .addNumberOption((opt) =>
          opt
            .setName("tempo")
            .setDescription("テンポ（1.0 が基準）")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("latest")
        .setDescription("Gifutoで登録された最新のループを1件表示する")
    )
    .addSubcommand((sub) =>
      sub
        .setName("random")
        .setDescription("最近のループからランダムに1件表示する")
    ),
].map((c) => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

// async function registerCommands() {
//   await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
//     body: commands,
//   });
//   console.log("Slash commands registered");
// }
async function registerCommands() {
  try {
    console.log("Registering GLOBAL commands as app:", CLIENT_ID);
    const data = await rest.put(
      Routes.applicationCommands(CLIENT_ID), // ★ここを変える
      { body: commands }
    );
    console.log(
      "Registered global commands:",
      data.map((c) => `${c.name} (${c.id})`)
    );
  } catch (err) {
    console.error("Failed to register global commands");
    console.error(err.rawError ?? err);
    process.exit(1);
  }
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
  if (interaction.commandName !== "gifusion") return;

  const sub = interaction.options.getSubcommand();

  // /gifuto create
  if (sub === "create") {
    const template = interaction.options.getString("template") || "default";
    const text = interaction.options.getString("text") || "";
    const tempo = interaction.options.getNumber("tempo") || 1.0;

    const params = new URLSearchParams({
      template,
      text,
      tempo: String(tempo),
      source: "discord",
      user: interaction.user.id,
    });

    const url = `${FRONTEND_BASE_URL}/?${params.toString()}`;

    await interaction.reply({
      content: `ここで編集して生成：\n${url}`,
      ephemeral: true, // DMっぽく返す
    });
    return;
  }

  // /gifuto latest
  if (sub === "latest") {
    await interaction.deferReply();

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/items/latest?limit=1`);
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
      await interaction.editReply("エラーで死んだ。ログを見て。");
    }
    return;
  }

  // /gifuto random
  if (sub === "random") {
    await interaction.deferReply();

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/items/latest?limit=10`);
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
