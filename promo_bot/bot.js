const { Telegraf, Markup } = require("telegraf")
const fs = require("fs-extra")
const config = require("./config")
const bot = new Telegraf(config.BOT_TOKEN)

let db = fs.existsSync("./db.json") ? fs.readJsonSync("./db.json") : { channels: [], media: {}, users: [] }

function saveDB() {
  fs.writeJsonSync("./db.json", db, { spaces: 2 })
}

function isAdmin(id) {
  return config.ADMINS.includes(id)
}

// Save user
bot.use((ctx, next) => {
  if (ctx.from && !db.users.includes(ctx.from.id)) {
    db.users.push(ctx.from.id)
    saveDB()
  }
  return next()
})

// Check join
async function checkJoin(userId) {
  for (let ch of db.channels) {
    try {
      const member = await bot.telegram.getChatMember(ch, userId)
      if (["left", "kicked"].includes(member.status)) return false
    } catch {
      return false
    }
  }
  return true
}

function joinButtons() {
  const buttons = db.channels.map(c => [Markup.button.url("JOIN", c)])
  buttons.push([Markup.button.callback("♻️ Retry", "retry")])
  return Markup.inlineKeyboard(buttons)
}

// START
bot.start(async ctx => {
  const param = ctx.startPayload
  const joined = await checkJoin(ctx.from.id)

  if (!joined && db.channels.length > 0) {
    return ctx.reply("Please Join All My Update Channels To Use Me!", joinButtons())
  }

  if (param && param.startsWith("media_")) {
    const id = param.split("_")[1]
    const m = db.media[id]
    if (!m) return ctx.reply("File expired")

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

// Retry
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
  await ctx.reply("Send channel link")

  const handler = async (ctx2) => {
    if (ctx2.from.id !== ctx.from.id) return
    db.channels.push(ctx2.message.text)
    saveDB()
    await ctx2.reply("Channel Added")
    bot.off("text", handler)
  }

  bot.on("text", handler)
})

// DELETE CHANNEL
bot.command("delete", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  const link = ctx.message.text.split(" ")[1]
  db.channels = db.channels.filter(c => c !== link)
  saveDB()
  ctx.reply("Channel Deleted")
})

// DELETE ALL CHANNELS
bot.command("deleteall", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  db.channels = []
  saveDB()
  ctx.reply("All channels removed")
})

// UPLOAD
bot.command("upload", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  await ctx.reply("Send photo or video")

  const handler = async (ctx2) => {
    if (ctx2.from.id !== ctx.from.id) return

    let file, type
    if (ctx2.message.photo) {
      file = ctx2.message.photo.pop().file_id
      type = "photo"
    } else if (ctx2.message.video) {
      file = ctx2.message.video.file_id
      type = "video"
    } else {
      await ctx2.reply("Send only photo or video")
      return
    }

    const id = Date.now()
    db.media[id] = { file, type }
    saveDB()
    await ctx2.reply(`Link generated:\nhttps://t.me/${bot.botInfo.username}?start=media_${id}`)

    bot.off("message", handler)
  }

  bot.on("message", handler)
})

// BROADCAST
bot.command("send", async ctx => {
  if (!isAdmin(ctx.from.id)) return
  await ctx.reply("Send broadcast message")

  const handler = async (ctx2) => {
    if (ctx2.from.id !== ctx.from.id) return
    for (let u of db.users) {
      try {
        await bot.telegram.copyMessage(u, ctx2.chat.id, ctx2.message.message_id)
      } catch {}
    }
    await ctx2.reply("Broadcast Sent")
    bot.off("message", handler)
  }

  bot.on("message", handler)
})

bot.launch()
console.log("Promo bot running")
