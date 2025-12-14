const fs = require('fs');
const joy = require("joy-video-downloader");
const axios = require("axios");
const Youtube = require('youtube-search-api');

async function downloadMusicFromYoutube(link, path) {
    if (!link) return 'Link Not Found';
    const timestart = Date.now();

    try {
        const data = await joy.download(link); // latest method
        const audioUrl = data.audio; // audio URL from joy module

        return new Promise((resolve, reject) => {
            axios({
                method: 'get',
                url: audioUrl,
                responseType: 'stream'
            }).then(response => {
                const writeStream = fs.createWriteStream(path);
                response.data.pipe(writeStream)
                    .on('finish', () => resolve({ title: data.title, timestart }))
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
        version: "1.3.0",
        permission: 0,
        credits: "Joy",
        description: "Download songs from YouTube directly via keyword or link",
        prefix: true,
        category: "Media",
        usages: "song [title/link]",
        cooldowns: 5,
        dependencies: {
            "axios": "",
            "fs": ""
        }
    },

    run: async function ({ api, event, args }) {
        if (!args || args.length === 0)
            return api.sendMessage('» উফফ আবাল কি গান শুনতে চাস? 🤔', event.threadID, event.messageID);

        const keywordSearch = args.join(" ");
        const path = `${__dirname}/cache/1.mp3`;
        if (fs.existsSync(path)) fs.unlinkSync(path);

        try {
            let link = keywordSearch;

            if (!keywordSearch.startsWith("https://")) {
                // keyword => first YouTube result
                const data = (await Youtube.GetListByKeyword(keywordSearch, false, 1)).items;
                if (!data || data.length === 0) 
                    return api.sendMessage('❌ কোন গান পাওয়া যায়নি!', event.threadID, event.messageID);
                link = 'https://www.youtube.com/watch?v=' + data[0].id;
            }

            const musicData = await downloadMusicFromYoutube(link, path);

            if (fs.statSync(path).size > 26214400)
                return api.sendMessage('❌ ফাইল 25MB এর বেশি হওয়ায় পাঠানো যাবে না।', event.threadID, () => fs.unlinkSync(path), event.messageID);

            return api.sendMessage({
                body: `🎵 Title: ${musicData.title}\n⏱️ Processing time: ${Math.floor((Date.now() - musicData.timestart) / 1000)} sec\n💿====DISME PROJECT====💿`,
                attachment: fs.createReadStream(path)
            }, event.threadID, () => fs.unlinkSync(path), event.messageID);

        } catch (e) {
            console.log(e);
            return api.sendMessage('⚠️ কিছু ভুল হয়েছে, আবার চেষ্টা করো!', event.threadID, event.messageID);
        }
    }
};
