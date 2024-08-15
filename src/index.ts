import { Telegraf } from 'telegraf';
require('dotenv').config();

console.log('token: ', process.env.BOT_TOKEN);
const bot = new Telegraf(process.env.BOT_TOKEN as string);
//{{base_url}}/projects/{{project_id}}/chatengines/{{chat_engine}}/query
const api_key = process.env.AIWELCOME_API_KEY as string;
const base_url = process.env.AIWELCOME_BASE_URL as string;
const project_id = process.env.AIWELCOME_PROJECT_ID as string;
const chat_engine = process.env.AIWELCOME_CHAT_ENGINE as string;
const chat_origin = process.env.AIWELCOME_CHAT_ORIGIN as string;
const url = `${base_url}/projects/${project_id}/chatengines/${chat_engine}/query`;

const answer = (question: any, ctx: any) => {
  const formData = new URLSearchParams();
  formData.append('prompt', question);
  formData.append('k', api_key);
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: chat_origin,
    },
    body: formData.toString(),
  }).then((response) => {
    if (response.status === 200) {
      response.json().then((data: any) => {
        if (!data.error) {
          ctx.reply(data.textRaw, {
            reply_to_message_id: ctx.message.message_id,
          });
        } else {
          ctx.reply('Sorry, something is wroing. Ask @HeyCap for support', {
            reply_to_message_id: ctx.message.message_id,
          });
        }
      });
    } else {
      ctx.reply('Sorry, Dandy is sleeping. Ask @HeyCap for support');
    }
  });
};

// the bot can take any question
bot.on('text', async (ctx, bot) => {
  const type = ctx.message.chat.type;
  if (type === 'private') {
    const question = ctx.message.text;
    answer(question, ctx);
  } else if (type === 'group' || type === 'supergroup') {
    if (ctx.message.text.includes('@superteamUK_bot')) {
      const question = ctx.message.text.replace('@superteamUK_bot', '');
      answer(question, ctx);
    }
  }
});
bot.launch();
