const fs = require('fs-extra');
const ytdl = require('ytdl-core');
const pathModule = require('path');

async function downloadMusicFromYoutube(link, path) {
    const timestart = Date.now();
    if (!link) return 'Link missing';

    return new Promise(async (resolve, reject) => {
        try {
            const stream = ytdl(link, { filter: 'audioonly' });
            stream.pipe(fs.createWriteStream(path))
                .on("finish", async () => {
                    const data = await ytdl.getInfo(link);
                    const result = {
                        title: data.videoDetails.title,
                        dur: Number(data.videoDetails.lengthSeconds),
                        viewCount: data.videoDetails.viewCount,
                        likes: data.videoDetails.likes || 0,
                        author: data.videoDetails.author.name,
                        timestart
                    };
                    resolve(result);
                })
                .on("error", reject);
        } catch (err) {
            reject(err);
        }
    });
}

module.exports.config = {
    name: "song",
    version: "1.1.0",
    permission: 0,
    credits: "Nayan",
    description: "Download YouTube songs",
    prefix: true,
    category: "Media",
    usages: "user",
    cooldowns: 5,
    dependencies: {
        "ytdl-core": "",
        "youtube-search-api": ""
    }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
    try {
        const { createReadStream } = require("fs-extra");
        const path = `${__dirname}/cache/1.mp3`;
        const data = await downloadMusicFromYoutube('https://www.youtube.com/watch?v=' + handleReply.link[event.body - 1], path);

        if (fs.statSync(path).size > 26214400) {
            fs.unlinkSync(path);
            return api.sendMessage('The file is bigger than 25MB and cannot be sent.', event.threadID, event.messageID);
        }

        api.unsendMessage(handleReply.messageID);
        return api.sendMessage({
            body: `🎵 Title: ${data.title}\n🎶 Channel: ${data.author}\n⏱️ Duration: ${this.convertHMS(data.dur)}\n👀 Views: ${data.viewCount}\n👍 Likes: ${data.likes}\n⏱️ Processed in: ${Math.floor((Date.now() - data.timestart)/1000)} sec\n💿====DISME PROJECT====💿`,
            attachment: createReadStream(path)
        }, event.threadID, () => fs.unlinkSync(path), event.messageID);
    } catch (e) {
        console.log(e);
    }
};

module.exports.convertHMS = function(value) {
    const sec = parseInt(value, 10);
    let hours = Math.floor(sec / 3600);
    let minutes = Math.floor((sec % 3600) / 60);
    let seconds = sec % 60;

    if (hours < 10) hours = "0" + hours;
    if (minutes < 10) minutes = "0" + minutes;
    if (seconds < 10) seconds = "0" + seconds;

    return (hours != '00' ? hours + ':' : '') + minutes + ':' + seconds;
}

module.exports.run = async function ({ api, event, args }) {
    if (!args.length) return api.sendMessage('» তোমার গান সিলেক্ট করতে হবে।', event.threadID, event.messageID);

    const keywordSearch = args.join(" ");
    const path = `${__dirname}/cache/1.mp3`;
    if (fs.existsSync(path)) fs.unlinkSync(path);

    if (keywordSearch.startsWith("https://")) {
        try {
            const data = await downloadMusicFromYoutube(keywordSearch, path);
            if (fs.statSync(path).size > 26214400) return api.sendMessage('Unable to send file >25MB.', event.threadID, () => fs.unlinkSync(path), event.messageID);

            return api.sendMessage({
                body: `🎵 Title: ${data.title}\n🎶 Channel: ${data.author}\n⏱️ Duration: ${this.convertHMS(data.dur)}\n👀 Views: ${data.viewCount}\n👍 Likes: ${data.likes}\n⏱️ Processed in: ${Math.floor((Date.now() - data.timestart)/1000)} sec\n💿====DISME PROJECT====💿`,
                attachment: fs.createReadStream(path)
            }, event.threadID, () => fs.unlinkSync(path), event.messageID);

        } catch (e) {
            console.log(e);
        }
    } else {
        try {
            const Youtube = require('youtube-search-api');
            const data = (await Youtube.GetListByKeyword(keywordSearch, false, 6)).items;
            const link = [];
            let msg = "";

            data.forEach((video, i) => {
                link.push(video.id);
                msg += `${i + 1} - ${video.title} (${video.length.simpleText})\n\n`;
            });

            const body = `»🔎 Found ${link.length} results:\n\n${msg}» Reply with a number to select.`;
            return api.sendMessage({ body }, event.threadID, (error, info) => {
                global.client.handleReply.push({
                    type: 'reply',
                    name: this.config.name,
                    messageID: info.messageID,
                    author: event.senderID,
                    link
                });
            }, event.messageID);

        } catch (e) {
            return api.sendMessage('An error occurred: ' + e, event.threadID, event.messageID);
        }
    }
}
