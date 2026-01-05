import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const bot = new Telegraf(process.env.BOT_TOKEN);
const TEMP_DIR = './temp';

// Temp folder create agar exist nahi karta
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

// /start command
bot.start((ctx) => {
  ctx.reply(
    "Welcome! Send me a video/photo URL to upload.",
    Markup.inlineKeyboard([
      Markup.button.url("📢 Uᴘᴅᴀᴛᴇ Cʜᴀɴɴᴇʟ", "https://t.me/+Dy-sla1PBGBmYTZl")
    ])
  );
});

// Handle URL messages
bot.on('text', async (ctx) => {
  const url = ctx.message.text;

  if (!url.startsWith('http')) {
    return ctx.reply("⚠️ Pʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴠᴀʟɪᴅ ʟɪɴᴋ");
  }

  // Send warning + animation
  const warnMsg = await ctx.reply(
    "New - ⚠️ Important:\nAll Messages will be deleted after 1 hour. Please save or forward these messages to your personal saved messages to avoid losing them!\n\n📢 Uᴘᴅᴀᴛᴇ Cʜᴀɴɴᴇʟ",
    Markup.inlineKeyboard([
      Markup.button.url("📢 Uᴘᴅᴀᴛᴇ Cʜᴀɴɴᴇʟ", "https://t.me/+Dy-sla1PBGBmYTZl")
    ])
  );

  const waitMsg = await ctx.reply("Pʟᴇᴀsᴇ ᴡᴀɪᴛ...\n.");

  // Animate ... sequence for 1:30 sec
  const dots = ['.', '..', '...'];
  for (let i = 0; i < 30; i++) {
    await sleep(1500); // 1.5 sec per step → 30*1.5 ≈ 45 sec (adjust to 90s if needed)
    const dot = dots[i % dots.length];
    try { await ctx.telegram.editMessageText(ctx.chat.id, waitMsg.message_id, undefined, `Pʟᴇᴀsᴇ ᴡᴀɪᴛ...\n${dot}`) } catch {}
  }

  // Fetch media
  const filename = path.join(TEMP_DIR, `media_${Date.now()}`);
  try {
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    const ext = url.split('.').pop().split('?')[0];
    const filepath = filename + '.' + ext;
    fs.writeFileSync(filepath, resp.data);

    // Send media
    if (['mp4', 'mov', 'webm'].includes(ext)) {
      await ctx.replyWithVideo({ source: filepath });
    } else if (['jpg','jpeg','png','gif'].includes(ext)) {
      await ctx.replyWithPhoto({ source: filepath });
    } else {
      await ctx.reply("⚠️ Unsupported file type.");
    }

    // Delete temp file after 1 hour
    setTimeout(() => {
      fs.unlink(filepath, (err) => {});
    }, 1000*60*60); // 1 hour

  } catch (err) {
    console.log(err);
    await ctx.reply("⚠️ Failed to fetch media. Please check the URL.");
  }

  // Delete warning + wait messages after 1 hour
  setTimeout(() => {
    ctx.deleteMessage(warnMsg.message_id).catch(()=>{});
    ctx.deleteMessage(waitMsg.message_id).catch(()=>{});
  }, 1000*60*60);
});

bot.launch({
  webhook: {
    domain: process.env.WEBHOOK_DOMAIN,
    port: process.env.PORT || 3000
  }
});

console.log("Promo bot running");
