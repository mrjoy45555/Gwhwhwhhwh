const axios = require("axios");
const fs = require("fs");

// ========== Joy API loader ==========
let joyConfig = null;
const joyBase = async () => {
  if (joyConfig) return joyConfig;

  const { data } = await axios.get(
    "https://raw.githubusercontent.com/JUBAED-AHMED-JOY/Joy/main/api.json"
  );
  joyConfig = data;
  return data;
};

// Get API URL with fallback
const getApiUrl = async (type = "api") => {
  const cfg = await joyBase();
  return cfg[type] || cfg.api;
};

// ========== Command config ==========
module.exports.config = {
  name: "sing",
  version: "2.5.0",
  aliases: ["music", "play"],
  credits: "joy",
  countDown: 5,
  hasPermssion: 0,
  description: "Download audio from YouTube",
  category: "media",
  commandCategory: "media",
  usePrefix: true,
  prefix: true,
  usages:
    "{pn} [<song name>|<song link>]:" +
    "\n   Example:" +
    "\n{pn} chipi chipi chapa chapa",
};

// ========== Run ==========
module.exports.run = async ({ api, args, event }) => {
  const checkurl =
    /^(?:https?:\/\/)?(?:m\.|www\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))((\w|-){11})(?:\S+)?$/;

  const urlYtb = checkurl.test(args[0]);
  let videoID;

  if (urlYtb) {
    const match = args[0].match(checkurl);
    videoID = match ? match[1] : null;

    let data;
    try {
      const apiUrl = await getApiUrl("joy"); // sing API
      data = (await axios.get(`${apiUrl}/ytDl3?link=${videoID}&format=mp3`)).data;
    } catch (err) {
      console.log("Joy API failed, trying main API");
      const fallbackUrl = await getApiUrl("api");
      try {
        data = (await axios.get(`${fallbackUrl}/ytDl3?link=${videoID}&format=mp3`)).data;
      } catch (e) {
        return api.sendMessage(
          "❌ Both Sing and Main API failed: " + e.message,
          event.threadID,
          event.messageID
        );
      }
    }

    return api.sendMessage(
      {
        body: data.title,
        attachment: await joy(data.downloadLink, "audio.mp3"),
      },
      event.threadID,
      () => fs.unlinkSync("audio.mp3"),
      event.messageID
    );
  }

  // ========== Search by keyword ==========
  let keyWord = args.join(" ").replace("?feature=share", "");
  const maxResults = 6;
  let result;

  try {
    const apiUrl = await getApiUrl("joy"); // sing API
    result = (await axios.get(`${apiUrl}/ytFullSearch?songName=${keyWord}`)).data.slice(0, maxResults);
  } catch (err) {
    console.log("Joy API failed, trying main API");
    const fallbackUrl = await getApiUrl("api");
    try {
      result = (await axios.get(`${fallbackUrl}/ytFullSearch?songName=${keyWord}`)).data.slice(0, maxResults);
    } catch (e) {
      return api.sendMessage(
        "❌ Both Sing and Main API search failed: " + e.message,
        event.threadID,
        event.messageID
      );
    }
  }

  if (!result.length)
    return api.sendMessage(
      "⭕ No search results match: " + keyWord,
      event.threadID,
      event.messageID
    );

  // send search list
  let msg = "";
  let i = 1;
  const thumbnails = [];

  for (const info of result) {
    thumbnails.push(joySt(info.thumbnail, "photo.jpg"));
    msg += `${i++}. ${info.title}\nTime: ${info.time}\nChannel: ${
      info.channel.name
    }\n\n`;
  }

  api.sendMessage(
    {
      body: msg + "Reply with number (1-6) to play",
      attachment: await Promise.all(thumbnails),
    },
    event.threadID,
    (err, info) => {
      global.client.handleReply.push({
        name: this.config.name,
        messageID: info.messageID,
        author: event.senderID,
        result,
      });
    },
    event.messageID
  );
};

// ========== Handle Reply ==========
module.exports.handleReply = async ({ event, api, handleReply }) => {
  try {
    const { result } = handleReply;
    const choice = parseInt(event.body);

    if (!isNaN(choice) && choice > 0 && choice <= result.length) {
      const infoChoice = result[choice - 1];
      const idvideo = infoChoice.id;

      let data;
      try {
        const apiUrl = await getApiUrl("joy"); // sing API
        data = (await axios.get(`${apiUrl}/ytDl3?link=${idvideo}&format=mp3`)).data;
      } catch (err) {
        console.log("Joy API failed, trying main API");
        const fallbackUrl = await getApiUrl("api");
        try {
          data = (await axios.get(`${fallbackUrl}/ytDl3?link=${idvideo}&format=mp3`)).data;
        } catch (e) {
          return api.sendMessage(
            "❌ Both Sing and Main API failed: " + e.message,
            event.threadID,
            event.messageID
          );
        }
      }

      await api.unsendMessage(handleReply.messageID);

      await api.sendMessage(
        {
          body: `• Title: ${data.title}\n• Quality: ${data.quality}`,
          attachment: await joy(data.downloadLink, "audio.mp3"),
        },
        event.threadID,
        () => fs.unlinkSync("audio.mp3"),
        event.messageID
      );
    } else {
      api.sendMessage(
        "❌ Invalid choice (1-6)",
        event.threadID,
        event.messageID
      );
    }
  } catch (error) {
    console.log(error);
    api.sendMessage(
      "⭕ Sorry, audio size exceeded 26MB or API error",
      event.threadID,
      event.messageID
    );
  }
};

// ========== Helper functions ==========
async function joy(url, pathName) {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  fs.writeFileSync(pathName, Buffer.from(response.data));
  return fs.createReadStream(pathName);
}

async function joySt(url, pathName) {
  const response = await axios.get(url, { responseType: "stream" });
  response.data.path = pathName;
  return response.data;
}
