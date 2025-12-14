module.exports.config = {
    name: "video",
    version: "1.1.0",
    credits: "joy", // এখানে credit joy দেওয়া হলো
    permission: 0,
    description: "YouTube থেকে ভিডিও সার্চ করে সিলেক্ট করা ভিডিও ডাউনলোড করে পাঠায় এবং লিস্ট আনসেন্ড করে।",
    category: "ডাউনলোডার",
    usages: "/video <গানের নাম>",
    prefix: true,
    premium: false,
    cooldown: 5,
    dependencies: {
        "joy-video-downloader": "",
        "yt-search": "",
        "axios": "",
        "fs": "",
        "path": ""
    }
}

module.exports.run = async ({ api, event, args }) => {
    const joy = require("joy-video-downloader");
    const ytSearch = require("yt-search");
    const axios = require("axios");
    const fs = require("fs");
    const path = require("path");

    const query = args.join(" ");
    if (!query) return api.sendMessage("❌ দয়া করে গান বা ভিডিওর নাম লিখুন। উদাহরণ: /video Shape of You", event.threadID);

    api.sendMessage(`🔎 "${query}" নামের ভিডিও খুঁজছি YouTube-এ...`, event.threadID);

    try {
        const results = await ytSearch(query);
        if (!results || !results.videos.length) return api.sendMessage("❌ কোনো ভিডিও পাওয়া যায়নি।", event.threadID);

        const videos = results.videos.slice(0, 5);
        let message = "📌 কোন ভিডিও ডাউনলোড করবেন, সংখ্যা লিখুন:\n";
        videos.forEach((v, i) => message += `${i + 1}. ${v.title} (${v.timestamp})\n`);

        api.sendMessage(message, event.threadID, async (err, info) => {
            if (err) return console.log(err);

            const listMessageID = info.messageID; // পাঠানো লিস্ট মেসেজের ID

            const handleReply = async (replyEvent) => {
                if (replyEvent.senderID !== event.senderID) return;

                const num = parseInt(replyEvent.body);
                if (!num || num < 1 || num > videos.length) {
                    return api.sendMessage("❌ ভুল সংখ্যা নির্বাচন করেছেন।", event.threadID);
                }

                // লিস্ট মেসেজ আনসেন্ড
                api.unsendMessage(listMessageID);

                const selectedVideoUrl = videos[num - 1].url;
                api.sendMessage("⬇️ ভিডিও ডাউনলোড হচ্ছে...", event.threadID);

                const info = await joy.ytdown(selectedVideoUrl);
                if (!info || !info.url) return api.sendMessage("❌ ভিডিও ডাউনলোড করা যায়নি।", event.threadID);

                const fileExt = info.url.includes(".mp3") ? "mp3" : "mp4";
                const fileName = `${info.title}.${fileExt}`.replace(/[/\\?%*:|"<>]/g, "-");
                const filePath = path.join(__dirname, fileName);

                const response = await axios({
                    url: info.url,
                    method: "GET",
                    responseType: "stream"
                });

                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

                writer.on("finish", () => {
                    api.sendMessage({ body: `✅ ডাউনলোড সম্পন্ন: ${fileName}\n💡 Credit: joy`, attachment: fs.createReadStream(filePath) }, event.threadID);
                    api.removeListener("message", handleReply);
                });

                writer.on("error", (err) => {
                    api.sendMessage(`❌ ত্রুটি: ${err.message}`, event.threadID);
                    api.removeListener("message", handleReply);
                });
            };

            api.listen("message", handleReply); // Bot framework অনুযায়ী পরিবর্তন করুন
        });

    } catch (err) {
        api.sendMessage(`❌ ত্রুটি: ${err.message}`, event.threadID);
    }
}
