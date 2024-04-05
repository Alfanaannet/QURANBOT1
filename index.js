import { Client } from "oceanic.js";
import qlient from "discord.js";
const bot = new Client({
  intents: 32767,
});
import { Database } from "st.db";
import Discord from "discord.js";
import { Intents } from "discord.js";

import {
  VoiceConnectionStatus,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
} from "@discordjs/voice";
import axios from "axios";
import fs from "node:fs";
import { createSpinner } from "nanospinner";
import { Interval } from "quickinterval";
import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("Hello Express app!");
});

app.listen(9090, () => {
  console.log("server started");
});
const settings = new Database("./config.yml");
let interval_work = false;
let stop_radio = false;
const isInteger = (num) => /^-?[0-9]+$/.test(num + "");
const radio_channels = new Database("/radio");
const client = new Client({
  auth: "Bot " + process.env.token,
  rest: { requestTimeout: 60000 },
  gateway: { intents: ["GUILDS", "GUILD_VOICE_STATES"] },
});
let ready_first;
var spinner;
client.connect();

client.on("ready", async () => {
  console.log("ready");
  if (!ready_first) {
    ready_first = true;
    setInterval(async () => {
      client.editStatus(`idle`, [
        {
          name: (await settings.get("status_bot")) || "ITS QURAN",
          type: (await settings.get("status_type")) || 0,
        },
      ]);
    }, 30000);
  }
  axios
    .get("https://radio-quran.com/api/ar")
    .then(async (req) => {
      await fs.writeFileSync("./radio.json", JSON.stringify(req.data, null, 4));
    })
    .catch(() => {});
  await client.application.bulkEditGlobalCommands([
    {
      type: 1,
      name: "radio",
      description: "تشغيل اذاعة القران الكريم",
      options: [
        {
          type: 1,
          name: "start",
          description: "بدا تشغيل اذاعة القران الكريم",
          options: [
            {
              type: 7,
              name: "voice",
              required: true,
              channelTypes: [2, 13],
              description: "اختار الروم الصوتي للي تبيه",
            },
            {
              type: 3,
              name: "channel",
              required: true,
              channel_types: [2, 13],
              autocomplete: true,
              description: "اختار قناة الاذاعة للي تبيه",
            },
          ],
        },
        {
          type: 1,
          name: "stop",
          description: "بدا تشغيل اذاعة القران الكريم",
        },
      ],
      dmPermission: false,
      defaultMemberPermissions: 8,
    },
  ]);
});
client.on("interactionCreate", async (interaction) => {
  switch (interaction.type) {
    case 2: {
      if (
        interaction.data.name === "radio" &&
        interaction.data.options.getSubCommand() == "stop"
      ) {
        stop_radio = true;
        await settings.delete(`radio${interaction.guild.id}`);
        await interaction.guild.clientMember
          .edit({ channelID: null })
          .catch(() => {});
        await interaction.createMessage({
          embeds: [
            {
              color: 0x000000,
              title: ` تم إيقاف تشغيل الراديو بنجاح. آمل ألا يكون ذلك بسبب عدم رغبتك في الاستماع إلى الراديو \`✅\``,
            },
          ],
        });
      }
      if (
        interaction.data.name === "radio" &&
        interaction.data.options.getSubCommand() == "start"
      ) {
        let channel = interaction.data.options.getString("channel");
        let voice = interaction.data.options.getChannel("voice");
        stop_radio = false;
        await settings.set(`radio${interaction.guild.id}`, {
          guild_id: interaction.guild.id,
          channel,
          voice,
          at: Date.now(),
          by: interaction.user.id,
        });
        await radio(interaction.guild, channel, voice).catch();
        await interaction.createMessage({
          embeds: [
            {
              color: 0x000000,
              title: ` تم تشغيل الراديو بنجاح جزاكم الله كل خير \`✅\``,
            },
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  emoji: { name: "📻" },
                  label: "انقر للاستماع إلى الراديو",
                  url: `https://discord.com/channels/${interaction.guildID}/${voice.id}`,
                  style: 5,
                },
                {
                  type: 2,
                  label: "لديك مشاكل أو أسئلة ، تواصل مع الدعم الفني",
                  url: "https://discord.gg/awrp",
                  style: 5,
                },
              ],
            },
          ],
        });
      }
    }
    case 4: {
      if (
        interaction.data.options.getFocused() &&
        interaction.data.options.getFocused().name == "channel"
      ) {
        try {
          let input = clearRadioChannelText(
            interaction.data.options.getString("channel"),
          );
          if (isInteger(input) && radio_channels.raw[+input - 1]) {
            await interaction
              .result([radio_channels.raw[+input - 1]])
              .catch(() => {});
          } else {
            let search_results = radio_channels.raw.filter((el) =>
              clearRadioChannelText(el.name).includes(
                clearRadioChannelText(input),
              ),
            );
            if (search_results.length >= 25)
              search_results = search_results.slice(0, 25);
            await interaction.result(search_results).catch(() => {});
          }
        } catch (e) {
          // console.error(e)
        }
      }
    }
  }
});

function clearRadioChannelText(text) {
  return `${text}`;
}

async function startRadio(guid, room, voice) {
  if (await settings.has(`radio${guid}`)) {
    let data = await settings.get(`radio${guid}`);
    let voice = data.voice;
    let radio_channel = data.channel;
    let guild = await client.guilds.get(data.guild_id);
    if (guild) {
      await guild.clientMember.edit({ channelID: null }).catch(() => {});
      const voiceConnection = client.joinVoiceChannel({
        channelID: voice.id,
        guildID: guild.id,
        selfDeaf: true,
        selfMute: false,
        voiceAdapterCreator: guild.voiceAdapterCreator,
      });
      voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
        if (!stop_radio) voiceConnection.rejoin();
        if (!stop_radio && voice.type == 13)
          await guild
            .editUserVoiceState(client.user.id, {
              channelID: voice.id,
              suppress: false,
            })
            .catch();
      });
      const player = createAudioPlayer();
      voiceConnection.subscribe(player);

      player.on(AudioPlayerStatus.Playing, () => {
        console.log("Started playing");
      });
      player.on(AudioPlayerStatus.Idle, () => {
        console.log("The player is not playing any audio");
      });
      if (stop_radio) {
        await player.stop();
      } else {
        const audio = createAudioResource(radio_channel);
        await player.play(audio);
      }
      if (voice.type == 13)
        await guild
          .editUserVoiceState(client.user.id, {
            channelID: voice.id,
            suppress: false,
          })
          .catch(console.error);
    }
  }
}

async function radio(guid, room, voice) {
  if (await settings.has(`radio${guid.id}`))
    await startRadio(guid.id, room, voice.id);
  if (!interval_work) {
    new Interval(async (int) => {
      console.log(int.elapsedTime, int.startTime);
      if (await settings.has(`radio${guid.id}`)) {
        interval_work = true;
        await startRadio(guid.id, room, voice.id);
      } else {
        console.log("done paused");
        interval_work = false;
        int.pause();
      }
    }, 300000).start();
  }
}

process.on("unhandledRejection", (reason, p) => {
  console.log(
    "\u001b[38;5;93m[antiCrash] :: Unhandled Rejection/Catch\u001b[0m",
  );
  // console.log(reason, p);
});

process.on("uncaughtException", (err, origin) => {
  console.log(
    "\u001b[38;5;93m[antiCrash] :: Uncaught Exception/Catch\u001b[0m",
  );
  // console.log(err, origin);
});

process.on("uncaughtExceptionMonitor", (err, origin) => {
  console.log(
    "\u001b[38;5;93m[antiCrash] :: Uncaught Exception/Catch (MONITOR)\u001b[0m",
  );
  // console.log(err, origin);
});
