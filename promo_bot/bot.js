import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

const tempDir = "./tmp";
await fs.ensureDir(tempDir);

const WAIT_DOTS = [".", "..", "..."];
const DELETE_AFTER_MS = 60 * 60 * 1000; // 1 hour

bot.start(async (ctx) => {
  await ctx.replyWithMarkdown(
    "New - ⚠️ Important:\n\nAll Messages will be deleted after 1 hours. Please save or forward these messages to your personal saved messages to avoid losing them!\n",
    Markup.inlineKeyboard([
      Markup.button.url("📢 Uᴘᴅᴀᴛᴇ Cʜᴀɴɴᴇʟ", "https://t.me/+Dy-sla1PBGBmYTZl")
    ])
  );
});

bot.command("upload", async (ctx) => {
  const text = ctx.message.text.split(" ")[1];
  if (!text) return ctx.reply("Please provide a URL.");

  const waitMsg = await ctx.reply("Pʟᴇᴀsᴇ ᴡᴀɪᴛ...\n.");

  try {
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 300)); // 1.5s animation
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        waitMsg.message_id,
        undefined,
        `Pʟᴇᴀsᴇ ᴡᴀɪᴛ...\n${WAIT_DOTS[i % 3]}`
      );
    }

    const resp = await axios.get(text, { responseType: "arraybuffer" });
    const ext = text.split(".").pop().split("?")[0];
    const filename = path.join(tempDir, `file_${Date.now()}.${ext}`);
    await fs.writeFile(filename, resp.data);

    const options = ext.match(/(mp4|mov|webm)/i) ? { video: filename } : { photo: filename };
    await ctx.replyWithDocument({ source: filename });

    setTimeout(async () => {
      await fs.remove(filename);
    }, 60 * 1000); // delete temp file after 1 min
  } catch (e) {
    await ctx.reply("Error fetching URL.");
  }
});

bot.command("add", async (ctx) => {
  const text = ctx.message.text.split(" ")[1];
  if (!text) return ctx.reply("Please provide item to add.");
  const dbFile = "./db.json";
  let db = [];
  if (await fs.pathExists(dbFile)) db = await fs.readJson(dbFile);
  db.push({ item: text, added_at: Date.now() });
  await fs.writeJson(dbFile, db);
  ctx.reply(`Added: ${text}`);
});

bot.launch();
console.log("Promo bot running");
