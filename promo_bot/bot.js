import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import fs from "fs-extra";
import path from "path";

const BOT_TOKEN = "YOUR_BOT_TOKEN"; // Telegram bot token
const UPDATE_CHANNEL = "https://t.me/+Dy-sla1PBGBmYTZl";

const bot = new Telegraf(BOT_TOKEN);

// Temp folder
const TEMP_DIR = path.join(process.cwd(), "temp");
fs.ensureDirSync(TEMP_DIR);

// Helper to stylize text (small caps)
function smallCaps(text) {
  const map = {
    a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ",
    h: "ʜ", i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ",
    o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ", s: "s", t: "ᴛ", u: "ᴜ",
    v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ",
    A: "ᴀ", B: "ʙ", C: "ᴄ", D: "ᴅ", E: "ᴇ", F: "ꜰ", G: "ɢ",
    H: "ʜ", I: "ɪ", J: "ᴊ", K: "ᴋ", L: "ʟ", M: "ᴍ", N: "ɴ",
    O: "ᴏ", P: "ᴘ", Q: "ǫ", R: "ʀ", S: "s", T: "ᴛ", U: "ᴜ",
    V: "ᴠ", W: "ᴡ", X: "x", Y: "ʏ", Z: "ᴢ",
  };
  return text.split("").map(c => map[c] || c).join("");
}

// Command /start
bot.start((ctx) =>
  ctx.reply(
    smallCaps("Welcome! Send me a photo/video URL or use /upload to upload media.")
  )
);

// /upload command
bot.command("upload", async (ctx) => {
  await ctx.reply(smallCaps("Send photo or video URL now..."));

  bot.on("text", async (ctx2) => {
    const url = ctx2.message.text;

    if (!url.startsWith("http")) {
      return ctx2.reply(smallCaps("⚠️ Please provide a valid URL!"));
    }

    const tempFile = path.join(
      TEMP_DIR,
      `${Date.now()}_${Math.random().toString(36).slice(2)}`
    );

    // Warn + Inline button
    await ctx2.reply(
      smallCaps(
        `NEW - ⚠️ Important:\n\nAll messages will be deleted after 1 hours. Please save or forward these messages to your personal saved messages to avoid losing them!`
      ),
      Markup.inlineKeyboard([
        Markup.button.url(smallCaps("📢 Uᴘᴅᴀᴛᴇ Cʜᴀɴɴᴇʟ"), UPDATE_CHANNEL),
      ])
    );

    // Progress animation
    const progressMsg = await ctx2.reply(smallCaps("Pʟᴇᴀsᴇ ᴡᴀɪᴛ...\n."));
    const dots = [".", "..", "...", "..", "."];
    let i = 0;

    const anim = setInterval(async () => {
      try {
        await ctx2.telegram.editMessageText(
          ctx2.chat.id,
          progressMsg.message_id,
          undefined,
          smallCaps(`Pʟᴇᴀsᴇ ᴡᴀɪᴛ...\n${dots[i % dots.length]}`)
        );
        i++;
      } catch {}
    }, 30000); // every 30 sec

    try {
      // Fetch media
      const resp = await axios.get(url, { responseType: "arraybuffer" });
      const ext = url.split(".").pop().split("?")[0];
      const finalFile = tempFile + "." + ext;
      await fs.writeFile(finalFile, resp.data);

      // Stop animation
      clearInterval(anim);

      // Send media
      if (["mp4", "mov", "webm"].includes(ext.toLowerCase())) {
        await ctx2.replyWithVideo({ source: finalFile });
      } else {
        await ctx2.replyWithPhoto({ source: finalFile });
      }

      // Schedule deletion of user message after 1 hour
      setTimeout(async () => {
        try {
          await ctx2.deleteMessage(ctx2.message.message_id);
        } catch {}
      }, 3600 * 1000); // 1 hour

    } catch (err) {
      clearInterval(anim);
      await ctx2.reply(smallCaps("⚠️ Failed to fetch media. Check URL."));
    }
  });
});

// Launch bot
bot.launch();
console.log("Promo bot running");

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
