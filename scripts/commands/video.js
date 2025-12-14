const fs = require('fs');
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const joy = require("joy-video-downloader"); // Nazrul বাদ, Joy ব্যবহার
const Youtube = require('youtube-search-api');

async function downloadVideoFromYoutube(link, path) {
  if (!link) return 'Link Not Found';

  const timestart = Date.now();

  try {
    const data = await joy.downloadVideo(link); // Joy ব্যবহার
    const videoUrlRaw = data.videoUrl || data.url; // ভিডিও URL
    if (!videoUrlRaw) throw new Error("❌ Video URL not found.");

    const videoUrl = encodeURI(videoUrlRaw); // ✅ URL encode fix

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
            try {
              const info = await joy.downloadVideo(link);
              const result = {
                title: info.title,
                timestart: timestart
              };
              resolve(result);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', (error) => reject(error));
      })
      .catch(error => reject(error));
    });

  } catch (error) {
    return Promise.reject(error);
  }
}

module.exports = {
  config: {
    name: "video",
    version: "2.4.0",
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
      var path = `${__dirname}/cache/1.mp4`;
      var data = await downloadVideoFromYoutube('https://www.youtube.com/watch?v=' + handleReply.link[event.body -1], path);

      if (fs.statSync(path).size > 26214400)
        return api.sendMessage('❌ ভিডিও ফাইল 25MB এর বেশি হওয়ায় পাঠানো যাবে না।', event.threadID, () => fs.unlinkSync(path), event.messageID);

      api.unsendMessage(handleReply.messageID);
      return api.sendMessage({
        body: `🎬 Title: ${data.title}\n⏱️ Processing time: ${Math.floor((Date.now() - data.timestart)/1000)} sec\n💿==DISME PROJECT=💿`,
        attachment: createReadStream(path)
      },
      event.threadID,
      () => unlinkSync(path),
      event.messageID);
    }
    catch (e) {
      console.log(e);
      return api.sendMessage('⚠️ ডাউনলোডে সমস্যা হয়েছে। আবার চেষ্টা করো!', event.threadID, event.messageID);
    }
  },

  run: async function ({ api, event, args }) {
    if (args.length == 0 || !args)
      return api.sendMessage('» উফফ আবাল, কি ভিডিও দেখতে চাস? 🤔', event.threadID, event.messageID);

    const keywordSearch = args.join(" ");
    var path = `${__dirname}/cache/1.mp4`;
    if (fs.existsSync(path)) fs.unlinkSync(path);

    if (args.join(" ").indexOf("https://") == 0) {
      // direct youtube link
      try {
        var data = await downloadVideoFromYoutube(args.join(" "), path);
        if (fs.statSync(path).size > 26214400)
          return api.sendMessage('❌ ভিডিও ফাইল 25MB এর বেশি হওয়ায় পাঠানো যাবে না।', event.threadID, () => fs.unlinkSync(path), event.messageID);

        return api.sendMessage({
          body: `🎬 Title: ${data.title}\n⏱️ Processing time: ${Math.floor((Date.now() - data.timestart)/1000)} sec\n💿==DISME PROJECT=💿`,
          attachment: fs.createReadStream(path)
        },
        event.threadID,
        () => fs.unlinkSync(path),
        event.messageID);

      } catch (e) {
        console.log(e);
        return api.sendMessage('⚠️ ডাউনলোডে সমস্যা হয়েছে। আবার চেষ্টা করো!', event.threadID, event.messageID);
      }
    } else {
      // search by keyword
      try {
        var link = [], msg = "", num = 0;
        var data = (await Youtube.GetListByKeyword(keywordSearch, false, 6)).items;

        for (let value of data) {
          link.push(value.id);
          num += 1;
          const duration = value.length?.simpleText || "❌ Unknown"; // safe check
          msg += (`${num} - ${value.title} (${duration})\n\n`);
        }

        // 🔥 ৬ টা থাম্বনেইল ক্যানভাসে আঁকা হচ্ছে
        let images = [];
        for (let value of data) {
          if (value.thumbnail?.thumbnails?.length > 0) {
            let imgUrl = value.thumbnail.thumbnails[value.thumbnail.thumbnails.length - 1].url;
            try {
              let img = await loadImage(imgUrl);
              images.push(img);
            } catch (e) { console.log("Thumbnail load error:", e); }
          }
        }

        // ক্যানভাস তৈরি (3x2 গ্রিড)
        const width = 640, height = 360;
        const canvas = createCanvas(width*3, height*2);
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#000";
        ctx.fillRect(0,0,canvas.width,canvas.height);

        for (let i = 0; i < images.length; i++) {
          let x = (i % 3) * width;
          let y = Math.floor(i / 3) * height;
          ctx.drawImage(images[i], x, y, width, height);
        }

        const buffer = canvas.toBuffer("image/png");
        const imgPath = `${__dirname}/cache/collage.png`;
        fs.writeFileSync(imgPath, buffer);

        var body = `🔍 Search results for: "${keywordSearch}"\n\n${msg}\n\n👉 Reply (number) to select which video you want to download.`;

        return api.sendMessage({
          body: body,
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
