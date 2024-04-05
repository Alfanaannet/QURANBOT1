import { Database } from "st.db";
import inquirer from "inquirer";
import startBot from "./bot.js";
import { Interval } from "quickinterval";
import { Database as ReplitDB } from "quick.replit";
const is_replit =
  process.env.REPL_ID && process.env.REPL_SLUG && process.env.REPL_OWNER;
const shuruhatik = `█▀ █░█ █░█ █▀█ █░█ █░█ ▄▀█ ▀█▀ █ █▄▀\n▄█ █▀█ █▄█ █▀▄ █▄█ █▀█ █▀█ ░█░ █ █░█`;
const settings = new Database("./config.yml");

async function runAction(auto_run) {
    return await runAction(false, settings);
}

function sendDM(member, content, file) {
  return new Promise((resolve, reject) => {
    (member.user || member)
      .getDMChannel()
      .then((channel) => {
        channel.createMessage(content, file).then(resolve).catch(reject);
      })
      .catch(reject);
  });
}

function clearTextPrompt(str, status_bot = false) {
  return !status_bot
    ? str.trim().replaceAll("\\", "").replaceAll(" ", "").replaceAll("~", "")
    : str.trim().replaceAll("\\", "").replaceAll("~", "");
}
function getRandomNumber(length, excludedNumbers) {
  if (excludedNumbers === void 0) {
    excludedNumbers = [];
  }
  var number = 0;
  do {
    number = Math.floor(Math.random() * length) + 1;
  } while (excludedNumbers.includes(number));
  return number;
}
async function startProject() {
  let timeEnd =
    (await settings.has("reset")) && (await settings.has("token")) ? 200 : 3000;
  new Interval(async (int) => {
    // process.stdout.write('\x1Bc');
    // process.stdout.write(`\r\u001b[38;5;${getRandomNumber(230)}m${shuruhatik}\u001b[0m\n\n\u001b[1mﻲﺒﻨﻟﺍ ﻰﻠﻋ ةﻼﺻﻭ رﺎﻔﻐﺘﺳﻻﺍ ﺮﺜﻛﻭ ،ﻪﻠﻟﺍ ﺮﻛﺫ َﺲﻨﺗ ﻻ\u001b[0m`);
    if (int.elapsedTime >= timeEnd) {
      int.pause();
      await runAction();
    }
  }, 100).start();
}

export { startProject, shuruhatik };
