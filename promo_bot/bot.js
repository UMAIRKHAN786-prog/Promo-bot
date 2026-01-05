const axios = require("axios")
const path = require("path")

// Inside bot.on("message") handler, UPLOAD section
if (ctx.session.upload) {
  let file, type

  if (ctx.message.photo) { 
    file = ctx.message.photo.pop().file_id; 
    type = "photo" 
  } 
  else if (ctx.message.video) { 
    file = ctx.message.video.file_id; 
    type = "video" 
  }
  else if (ctx.message.text && ctx.message.text.startsWith("http")) {
    // User ne URL diya
    const url = ctx.message.text
    const ext = path.extname(url).toLowerCase()

    type = ext.includes("mp4") ? "video" : "photo"
    const tmpFile = path.join(__dirname, "tmp_" + Date.now() + ext)

    try {
      const resp = await axios.get(url, { responseType: "arraybuffer" })
      await fs.writeFile(tmpFile, resp.data)

      if (type === "photo") file = { source: tmpFile }
      else file = { source: tmpFile }
    } catch (e) {
      ctx.reply("❌ Failed to fetch URL")
      return
    }
  } else {
    return ctx.reply("❌ Send only photo, video, or URL")
  }

  const id = Math.random().toString(36).substring(2, 12)
  db.media[id] = { file, type, tmpFile: file.source || null }
  saveDB()

  // Send file to user
  if (type === "photo") await ctx.replyWithPhoto(file)
  else await ctx.replyWithVideo(file)

  ctx.reply(`✅ Link generated:\nhttps://t.me/${bot.botInfo.username}?start=media_${id}`)

  ctx.session.upload = false

  // Clean tmp file after some time
  if (file.source) setTimeout(() => fs.remove(file.source), 60000)
  return
}
