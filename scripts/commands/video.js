const fs = require('fs');
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const joy = require("joy-video-downloader");
const Youtube = require('youtube-search-api');

// ✅ Safe URL function
function safeUrl(url) {
  if (!url) return url;
  return encodeURI(url).replace(/#/g,"%23").replace(/\+/g,"%2B");
}

async function downloadVideoFromYoutube(link, path) {
  if (!link) return 'Link Not Found';

  const timestart = Date.now();

  try {
    const data = await joy.downloadVideo(link);
    const videoUrlRaw = data.videoUrl || data.url;
    if (!videoUrlRaw) throw new Error("❌ Video URL not found.");

    const videoUrl = safeUrl(videoUrlRaw);

    return new Promise((resolve, reject) => {
      axios({
        method: 'get',
        url: videoUrl,
        responseType: 'stream'
      })
      .then(response => {
        const writeStream = fs.createWriteStream(path);
        response.data.pipe(writeStream)
          .on('finish', async () => {
            resolve({
              title: data.title,
              timestart
            });
          })
          .on('error', err => reject(err));
      })
      .catch(err => reject(err));
    });

  } catch (error) {
    return Promise.reject(error);
  }
}

module.exports = {
  config: {
    name: "video",
    version: "3.0.0",
    permssion: 0,
    credits: "Joy",
    description: "Download YouTube videos (mp4) with collage thumbnails",
    prefix: true,
    category: "Media",
    usages: "cksong [title/link]",
    cooldowns: 5,
    dependencies: {
      "axios": "",
      "fs": "",
      "canvas": "",
      "youtube-search-api": "",
      "joy-video-downloader": ""
    }
  },

  handleReply: async function ({ api, event, handleReply }) {
    const { createReadStream, unlinkSync, statSync } = require("fs-extra");
    try {
      const path = `${__dirname}/cache/1.mp4`;
      const data = await downloadVideoFromYoutube('https://www.youtube.com/watch?v=' + handleReply.link[event.body - 1], path);

      if (fs.statSync(path).size > 26214400)
        return api.sendMessage('❌ ভিডিও ফাইল 25MB এর বেশি হওয়ায় পাঠানো যাবে না।', event.threadID, () => fs.unlinkSync(path), event.messageID);

      api.unsendMessage(handleReply.messageID);
      return api.sendMessage({
        body: `🎬 Title: ${data.title}\n⏱️ Processing time: ${Math.floor((Date.now() - data.timestart)/1000)} sec\n💿==DISME PROJECT=💿`,
        attachment: createReadStream(path)
      }, event.threadID, () => unlinkSync(path), event.messageID);

    } catch (e) {
      console.log(e);
      return api.sendMessage('⚠️ ডাউনলোডে সমস্যা হয়েছে। আবার চেষ্টা করো!', event.threadID, event.messageID);
    }
  },

  run: async function ({ api, event, args }) {
    if (!args.length)
      return api.sendMessage('» উফফ আবাল, কি ভিডিও দেখতে চাস? 🤔', event.threadID, event.messageID);

    const keywordSearch = args.join(" ");
    const path = `${__dirname}/cache/1.mp4`;
    if (fs.existsSync(path)) fs.unlinkSync(path);

    if (args[0].startsWith("https://")) {
      // direct youtube link
      try {
        const data = await downloadVideoFromYoutube(args[0], path);

        if (fs.statSync(path).size > 26214400)
          return api.sendMessage('❌ ভিডিও ফাইল 25MB এর বেশি হওয়ায় পাঠানো যাবে না।', event.threadID, () => fs.unlinkSync(path), event.messageID);

        return api.sendMessage({
          body: `🎬 Title: ${data.title}\n⏱️ Processing time: ${Math.floor((Date.now() - data.timestart)/1000)} sec\n💿==DISME PROJECT=💿`,
          attachment: fs.createReadStream(path)
        }, event.threadID, () => fs.unlinkSync(path), event.messageID);

      } catch (e) {
        console.log(e);
        return api.sendMessage('⚠️ ডাউনলোডে সমস্যা হয়েছে। আবার চেষ্টা করো!', event.threadID, event.messageID);
      }

    } else {
      // search by keyword
      try {
        let link = [], msg = "", num = 0;
        const data = (await Youtube.GetListByKeyword(keywordSearch, false, 6)).items;

        for (let value of data) {
          link.push(value.id);
          num++;
          const duration = value.length?.simpleText || "❌ Unknown";
          msg += `${num} - ${value.title} (${duration})\n\n`;
        }

        // 🔥 ৬ টা থাম্বনেইল ক্যানভাসে আঁকা হচ্ছে
        const images = [];
        for (let value of data) {
          const thumbs = value.thumbnail?.thumbnails;
          if (thumbs?.length > 0) {
            try {
              const img = await loadImage(thumbs[thumbs.length - 1].url);
              images.push(img);
            } catch(e){ console.log("Thumbnail error:", e); }
          }
        }

        const width = 640, height = 360;
        const canvas = createCanvas(width*3, height*2);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#000";
        ctx.fillRect(0,0,canvas.width,canvas.height);

        for (let i=0; i<images.length; i++) {
          const x = (i % 3) * width;
          const y = Math.floor(i/3) * height;
          ctx.drawImage(images[i], x, y, width, height);
        }

        const imgPath = `${__dirname}/cache/collage.png`;
        fs.writeFileSync(imgPath, canvas.toBuffer("image/png"));

        const body = `🔍 Search results for: "${keywordSearch}"\n\n${msg}\n\n👉 Reply (number) to select which video you want to download.`;

        return api.sendMessage({
          body,
          attachment: fs.createReadStream(imgPath)
        }, event.threadID, (error, info) => {
          fs.unlinkSync(imgPath);
          global.client.handleReply.push({
            type: 'reply',
            name: this.config.name,
            messageID: info.messageID,
            author: event.senderID,
            link
          });
        }, event.messageID);

      } catch(e) {
        console.log(e);
        return api.sendMessage('⚠️ একটা এরর হয়েছে, আবার চেষ্টা করো!\n' + e, event.threadID, event.messageID);
      }
    }
  }
};
