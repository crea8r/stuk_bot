// src/bot.ts
import { Telegraf, Context } from 'telegraf';
import { TELEGRAM_BOT_TOKEN } from '../config';
import { addMessageToConversation } from '../services/conversationHandler';
import { MessageObject } from '../types';
import { queryAIWelcome } from '../services/aiwelcomeApi';
import { checkRateLimit } from '../services/rateLimiter';

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

async function handleMessage(ctx: any, question: string, isPrivate: boolean) {
  const userId = ctx.from?.id.toString();
  if (!userId) {
    ctx.reply('Unable to process your request. Please try again later.');
    return;
  }

  const withinLimit = checkRateLimit(userId);
  if (!withinLimit) {
    ctx.reply(
      'You have reached your daily limit for AI queries. Please try again tomorrow.'
    );
    return;
  }

  try {
    const answer = await queryAIWelcome(question);
    if (isPrivate) {
      ctx.reply(answer, {
        reply_to_message_id: ctx.message?.message_id,
        parse_mode: 'Markdown',
      });
    } else {
      ctx.reply(`${question}\n${answer}`, {
        chat_id: ctx.message?.from.id,
        parse_mode: 'Markdown',
      });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    ctx.reply(
      'Sorry, something went wrong. Please try again later or contact support.'
    );
  }
}

bot.on('text', async (ctx) => {
  if ('text' in ctx.message) {
    const chatId = ctx.message.chat.id.toString();
    const messageObj: MessageObject = {
      from: ctx.message.from.username || ctx.message.from.first_name,
      text: ctx.message.text,
      date: new Date(ctx.message.date * 1000),
      reply_to_message: ctx.message.reply_to_message
        ? ctx.message.reply_to_message.message_id
        : null,
    };

    addMessageToConversation(chatId, messageObj);

    const chatType = ctx.message.chat.type;
    if (chatType === 'private') {
      await handleMessage(ctx, ctx.message.text, true);
    } else if (chatType === 'group' || chatType === 'supergroup') {
      if (ctx.message.text.includes('@superteamUK_bot')) {
        const question = ctx.message.text
          .replace('@superteamUK_bot', '')
          .trim();
        await handleMessage(ctx, question, false);
      }
    }
  }
});

export function startBot() {
  bot.launch();
  console.log('Bot is running...');

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
