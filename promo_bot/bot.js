import { Telegraf, Markup, session } from "telegraf";
import axios from "axios";
import fs from "fs";
import path from "path";

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

const TEMP_DIR = "./temp";
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

bot.start((ctx) => {
  ctx.replyWithMarkdown(
    "New - ⚠️ Important:\n\nAll Messages will be deleted after 1 hours. Please save or forward these messages to your personal saved messages to avoid losing them!\n\n📢 Uᴘᴅᴀᴛᴇ Cʜᴀɴɴᴇʟ",
    Markup.inlineKeyboard([
      Markup.button.url("📢 Uᴘᴅᴀᴛᴇ Cʜᴀɴɴᴇʟ", "https://t.me/+Dy-sla1PBGBmYTZl"),
    ])
  );
});

bot.command("upload", async (ctx) => {
  if (ctx.message.photo || ctx.message.video) {
    const fileId =
      ctx.message.photo?.[ctx.message.photo.length - 1].file_id ||
      ctx.message.video.file_id;
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const ext = path.extname(file.file_path) || ".dat";
    const filename = path.join(TEMP_DIR, `${fileId}${ext}`);
    const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(filename, response.data);
    await ctx.reply("✅ Uploaded and saved temporarily.");

    setTimeout(() => {
      if (fs.existsSync(filename)) fs.unlinkSync(filename);
    }, 3600 * 1000);
  }
});

bot.command("fetch", async (ctx) => {
  if (!ctx.session.fetching) {
    ctx.session.fetching = true;
    let dots = ".";
    const msg = await ctx.reply(
      "Pʟᴇᴀsᴇ ᴡᴀɪᴛ...\n📢 Uᴘᴅᴀᴛᴇ Cʜᴀɴɴᴇʟ"
    );

    const interval = setInterval(async () => {
      dots = dots.length < 3 ? dots + "." : ".";
      try {
        await ctx.telegram.editMessageText(
          msg.chat.id,
          msg.message_id,
          undefined,
          `Pʟᴇᴀsᴇ ᴡᴀɪᴛ...\n📢 Uᴘᴅᴀᴛᴇ Cʜᴀɴɴᴇʟ${dots}`
        );
      } catch {}
    }, 500);

    setTimeout(async () => {
      clearInterval(interval);
      await ctx.telegram.editMessageText(
        msg.chat.id,
        msg.message_id,
        undefined,
        "✅ Ready to send video/photo"
      );
      ctx.session.fetching = false;
    }, 90 * 1000);
  }
});

bot.on("text", async (ctx) => {
  if (ctx.message.text.startsWith("http")) {
    const url = ctx.message.text;
    try {
      const resp = await axios.get(url, { responseType: "arraybuffer" });
      const filename = path.join(TEMP_DIR, `download_${Date.now()}`);
      fs.writeFileSync(filename, resp.data);
      await ctx.replyWithDocument({ source: filename });
      setTimeout(() => {
        if (fs.existsSync(filename)) fs.unlinkSync(filename);
      }, 3600 * 1000);
    } catch {
      await ctx.reply("❌ Failed to fetch file from URL.");
    }
  }
});

bot.launch();
