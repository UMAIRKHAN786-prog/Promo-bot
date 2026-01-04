const { Telegraf, Markup, session } = require("telegraf")
const fs = require("fs-extra")
const config = require("./config")

const PORT = process.env.PORT || 3000
const URL = process.env.RENDER_EXTERNAL_URL

const bot = new Telegraf(config.BOT_TOKEN)
bot.use(session())

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

// ---------------------
// ADD CHANNEL
bot.command("add", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  ctx.session.add_channel = true
  ctx.reply("Send channel link (must start with https://t.me/)", { reply_markup: { force_reply: true } })
})

bot.on("message", async ctx => {
  // ADD CHANNEL reply
  if (ctx.session.add_channel && ctx.message.reply_to_message) {
    const text = ctx.message.text
    if (!text.startsWith("https://t.me/")) return ctx.reply("❌ Please provide a valid Telegram channel link")
    db.channels.push(text)
    saveDB()
    ctx.reply("✅ Channel Added")
    ctx.session.add_channel = false
    return
  }

  // UPLOAD MEDIA reply
  if (ctx.session.upload && ctx.message.reply_to_message) {
    let file, type
    if (ctx.message.photo) { file = ctx.message.photo.pop().file_id; type = "photo" }
    else if (ctx.message.video) { file = ctx.message.video.file_id; type = "video" }
    else return ctx.reply("❌ Send only photo or video")

    const id = Math.random().toString(36).substring(2, 12)
    db.media[id] = { file, type }
    saveDB()
    ctx.reply(`✅ Link generated:\nhttps://t.me/${bot.botInfo.username}?start=media_${id}`)
    ctx.session.upload = false
    return
  }

  // BROADCAST reply
  if (ctx.session.broadcast && ctx.message.reply_to_message) {
    for (let u of db.users) {
      try { await bot.telegram.copyMessage(u, ctx.chat.id, ctx.message.message_id) } catch {}
    }
    ctx.reply("✅ Broadcast Sent")
    ctx.session.broadcast = false
    return
  }
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

// UPLOAD COMMAND
bot.command("upload", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  ctx.session.upload = true
  ctx.reply("Send photo or video", { reply_markup: { force_reply: true } })
})

// BROADCAST COMMAND
bot.command("send", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  ctx.session.broadcast = true
  ctx.reply("Send broadcast message", { reply_markup: { force_reply: true } })
})

// Launch bot with Render webhook
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
