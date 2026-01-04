const { Telegraf, Markup } = require("telegraf")
const fs = require("fs-extra")
const config = require("./config")

const PORT = process.env.PORT || 3000
const URL = process.env.RENDER_EXTERNAL_URL

const bot = new Telegraf(config.BOT_TOKEN)

// Load or init DB
let db = fs.existsSync("./db.json") ? fs.readJsonSync("./db.json") : { channels: [], media: {}, users: [] }
function saveDB() { fs.writeJsonSync("./db.json", db, { spaces: 2 }) }

// Admin check
function isAdmin(id) { return config.ADMINS.includes(id) }

// Save new users
bot.use((ctx, next) => {
  if (ctx.from && !db.users.includes(ctx.from.id)) {
    db.users.push(ctx.from.id)
    saveDB()
  }
  return next()
})

// Check if user joined all channels
async function checkJoin(userId) {
  for (let ch of db.channels) {
    try {
      const member = await bot.telegram.getChatMember(ch, userId)
      if (["left", "kicked"].includes(member.status)) return false
    } catch { return false }
  }
  return true
}

// Inline join buttons
function joinButtons() {
  const buttons = db.channels.map(c => [Markup.button.url("JOIN", c)])
  buttons.push([Markup.button.callback("♻️ Retry", "retry")])
  return Markup.inlineKeyboard(buttons)
}

// START
bot.start(async ctx => {
  const payload = ctx.startPayload

  // Invalid payload detection
  if (payload && !payload.startsWith("media_")) {
    return ctx.reply("❌ Please provide a valid link")
  }

  const joined = await checkJoin(ctx.from.id)

  if (!joined && db.channels.length > 0) {
    return ctx.reply("Please Join All My Update Channels To Use Me!", joinButtons())
  }

  if (payload && payload.startsWith("media_")) {
    const id = payload.split("_")[1]
    const m = db.media[id]
    if (!m) return ctx.reply("❌ This media link is expired or invalid")

    let msg
    if (m.type === "photo") msg = await ctx.replyWithPhoto(m.file)
    else msg = await ctx.replyWithVideo(m.file)

    const warn = await ctx.reply("⚠️ This media will be deleted in 1 hour")

    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id)
        await ctx.telegram.deleteMessage(ctx.chat.id, warn.message_id)
      } catch {}
    }, 3600000)
    return
  }

  ctx.reply(`Hey ${ctx.from.first_name}\n\nPlease Join All My Update Channels To Use Me!`, joinButtons())
})

// Retry button
bot.action("retry", async ctx => {
  const ok = await checkJoin(ctx.from.id)
  if (ok) {
    ctx.answerCbQuery("✅ Access Granted")
    ctx.editMessageText("You can now use the bot")
  } else {
    ctx.answerCbQuery("Join all channels first")
  }
})

// ADD CHANNEL
bot.command("add", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const msg = await ctx.reply("Send channel link (must start with https://t.me/)", { reply_markup: { force_reply: true } })

  const filter = (ctx2) => ctx2.message?.reply_to_message?.message_id === msg.message_id && ctx2.from.id === ctx.from.id

  const listener = async function handler(ctx2) {
    if (!filter(ctx2)) return
    bot.off("message", handler)  // remove listener after first reply

    const text = ctx2.message.text.trim()
    if (!text.startsWith("https://t.me/")) {
      return ctx2.reply("❌ Please provide a valid Telegram channel link")
    }

    db.channels.push(text)
    saveDB()
    await ctx2.reply("✅ Channel Added")
  }

  bot.on("message", listener)
})

// DELETE CHANNEL
bot.command("delete", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const link = ctx.message.text.split(" ")[1]
  db.channels = db.channels.filter(c => c !== link)
  saveDB()
  ctx.reply("✅ Channel Deleted")
})

// DELETE ALL
bot.command("deleteall", ctx => {
  if (!isAdmin(ctx.from.id)) return
  db.channels = []
  saveDB()
  ctx.reply("✅ All channels removed")
})

// UPLOAD MEDIA
bot.command("upload", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const msg = await ctx.reply("Send photo or video", { reply_markup: { force_reply: true } })

  const filter = (ctx2) => ctx2.message?.reply_to_message?.message_id === msg.message_id && ctx2.from.id === ctx.from.id

  const listener = async function handler(ctx2) {
    if (!filter(ctx2)) return
    bot.off("message", handler)

    let file, type
    if (ctx2.message.photo) { file = ctx2.message.photo.pop().file_id; type = "photo" }
    else if (ctx2.message.video) { file = ctx2.message.video.file_id; type = "video" }
    else return ctx2.reply("❌ Send only photo or video")

    // Secure random media ID
    const id = Math.random().toString(36).substring(2, 12)
    db.media[id] = { file, type }
    saveDB()

    await ctx2.reply(`✅ Link generated:\nhttps://t.me/${bot.botInfo.username}?start=media_${id}`)
  }

  bot.on("message", listener)
})

// BROADCAST
bot.command("send", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const msg = await ctx.reply("Send broadcast message", { reply_markup: { force_reply: true } })

  const filter = (ctx2) => ctx2.message?.reply_to_message?.message_id === msg.message_id && ctx2.from.id === ctx.from.id

  const listener = async function handler(ctx2) {
    if (!filter(ctx2)) return
    bot.off("message", handler)

    for (let u of db.users) {
      try { await bot.telegram.copyMessage(u, ctx2.chat.id, ctx2.message.message_id) } catch {}
    }
    await ctx2.reply("✅ Broadcast Sent")
  }

  bot.on("message", listener)
})

// Launch bot with Render webhook mode
if (URL) {
  bot.launch({
    webhook: {
      domain: URL,
      port: PORT
    }
  })
  console.log(`Promo bot running on webhook mode at port ${PORT}`)
} else {
  bot.launch()
  console.log("Promo bot running on polling mode")
}
