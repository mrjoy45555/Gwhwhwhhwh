const fs = require('fs');
const { createCanvas, loadImage } = require("canvas");
const joy = require("joy-video-downloader"); // ✅ nazrul gone, joy used
const axios = require("axios");

async function downloadMusicFromYoutube(link, path) {
    if (!link) return 'Link Not Found';

    const timestart = Date.now();

    try {
        const data = await joy.ytdown(link); // ✅ joy instead of nazrul
        const audioUrl = data.data.audio;

        return new Promise((resolve, reject) => {
            axios({
                method: 'get',
                url: audioUrl,
                responseType: 'stream'
            }).then(response => {
                const writeStream = fs.createWriteStream(path);
                response.data.pipe(writeStream)
                    .on('finish', async () => {
                        try {
                            const info = await joy.ytdown(link); // ✅ joy here too
                            resolve({ title: info.data.title, timestart });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', reject);
            }).catch(reject);
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

module.exports = {
    config: {
        name: "song",
        version: "1.1.0",
        permission: 0,
        credits: "Joy",
        description: "Download songs from YouTube with collage thumbnails",
        prefix: true,
        category: "Media",
        usages: "song [title/link]",
        cooldowns: 5,
        dependencies: {
            "axios": "",
            "fs": "",
            "canvas": ""
        }
    },

    handleReply: async function ({ api, event, handleReply }) {
        const { createReadStream, unlinkSync, statSync } = require("fs-extra");
        try {
            const path = `${__dirname}/cache/1.mp3`;
            const data = await downloadMusicFromYoutube(
                'https://www.youtube.com/watch?v=' + handleReply.link[event.body - 1],
                path
            );

            if (statSync(path).size > 26214400)
                return api.sendMessage('❌ ফাইল 25MB এর বেশি হওয়ায় পাঠানো যাবে না।', event.threadID, () => unlinkSync(path), event.messageID);

            api.unsendMessage(handleReply.messageID);
            return api.sendMessage({
                body: `🎵 Title: ${data.title}\n⏱️ Processing time: ${Math.floor((Date.now() - data.timestart) / 1000)} sec\n💿====DISME PROJECT====💿`,
                attachment: createReadStream(path)
            }, event.threadID, () => unlinkSync(path), event.messageID);
        } catch (e) {
            console.log(e);
        }
    },

    run: async function ({ api, event, args }) {
        if (!args || args.length === 0)
            return api.sendMessage('» উফফ আবাল কি গান শুনতে চাস? 🤔', event.threadID, event.messageID);

        const keywordSearch = args.join(" ");
        const path = `${__dirname}/cache/1.mp3`;
        if (fs.existsSync(path)) fs.unlinkSync(path);

        if (keywordSearch.startsWith("https://")) {
            // direct youtube link
            try {
                const data = await downloadMusicFromYoutube(keywordSearch, path);
                if (fs.statSync(path).size > 26214400)
                    return api.sendMessage('❌ ফাইল 25MB এর বেশি হওয়ায় পাঠানো যাবে না।', event.threadID, () => fs.unlinkSync(path), event.messageID);

                return api.sendMessage({
                    body: `🎵 Title: ${data.title}\n⏱️ Processing time: ${Math.floor((Date.now() - data.timestart) / 1000)} sec\n💿====DISME PROJECT====💿`,
                    attachment: fs.createReadStream(path)
                }, event.threadID, () => fs.unlinkSync(path), event.messageID);
            } catch (e) {
                console.log(e);
            }
        } else {
            // search by keyword
            try {
                const Youtube = require('youtube-search-api');
                const data = (await Youtube.GetListByKeyword(keywordSearch, false, 6)).items;
                let link = [], msg = "";

                data.forEach((value, index) => {
                    link.push(value.id);
                    msg += `${index + 1} - ${value.title} (${value.length.simpleText})\n\n`;
                });

                // create collage
                const images = [];
                for (const value of data) {
                    if (value.thumbnail?.thumbnails?.length > 0) {
                        const imgUrl = value.thumbnail.thumbnails.slice(-1)[0].url;
                        try {
                            const img = await loadImage(imgUrl);
                            images.push(img);
                        } catch (e) {
                            console.log("Thumbnail load error:", e);
                        }
                    }
                }

                const width = 640, height = 360;
                const canvas = createCanvas(width * 3, height * 2);
                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                images.forEach((img, i) => {
                    const x = (i % 3) * width;
                    const y = Math.floor(i / 3) * height;
                    ctx.drawImage(img, x, y, width, height);
                });

                const imgPath = `${__dirname}/cache/collage.png`;
                fs.writeFileSync(imgPath, canvas.toBuffer("image/png"));

                const body = `There's ${link.length} result(s) matching your keyword:\n\n${msg}Reply with number to select one.`;
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
            } catch (e) {
                return api.sendMessage('⚠️ একটা এরর হয়েছে, আবার চেষ্টা করো!\n' + e, event.threadID, event.messageID);
            }
        }
    }
};
