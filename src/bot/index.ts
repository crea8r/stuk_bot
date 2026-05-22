// src/bot.ts
import { Telegraf, Context } from 'telegraf';
import { TELEGRAM_BOT_TOKEN } from '../config';
import { addMessageToConversation } from '../services/conversationHandler';
import { MessageObject } from '../types';
import { queryAIWelcome } from '../services/aiwelcomeApi';
import { checkRateLimit } from '../services/rateLimiter';
import {
  getUpcomingEvents,
  getRecentTweets,
  getRecentSubstack,
  getActiveJobs,
  getActiveBounties,
} from '../services/database';

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

function formatDate(d: any): string {
  if (!d) return 'N/A';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return 'N/A';
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

bot.command('events', async (ctx) => {
  try {
    const events = await getUpcomingEvents(5);
    if (events.length === 0) {
      return ctx.reply('📅 No upcoming events found. Check back later or visit [lu.ma/superteam](https://lu.ma/superteam).', { parse_mode: 'Markdown' });
    }

    let text = '*📅 Upcoming Superteam UK Events*\n\n';
    events.forEach((ev, idx) => {
      const dateStr = formatDate(ev.start_time);
      const loc = ev.location || 'Online / TBA';
      text += `${idx + 1}. *${ev.title}*\n`;
      text += `   🗓️ Date: ${dateStr}\n`;
      text += `   📍 Location: ${loc}\n`;
      text += `   🔗 [Register Here](${ev.url})\n\n`;
    });
    text += '👉 Visit [lu.ma/superteam](https://lu.ma/superteam) to view the full calendar.';
    await ctx.reply(text, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } } as any);
  } catch (error) {
    console.error('Error in /events command:', error);
    ctx.reply('Sorry, unable to retrieve events right now.');
  }
});

bot.command('jobs', async (ctx) => {
  try {
    const jobs = await getActiveJobs(5);
    if (jobs.length === 0) {
      return ctx.reply('💼 No active job listings found at the moment.\n\nTo submit a job listing:\n👉 [Submit a Job Listing](https://earn.superteam.fun/)', { parse_mode: 'Markdown' });
    }

    let text = '*💼 Active Solana & Superteam Ecosystem Jobs*\n\n';
    jobs.forEach((job, idx) => {
      const sourceLabel = job.source === 'solana_jobs' ? 'Solana Jobs' : 'Superteam Earn';
      const companyLabel = job.company ? ` at *${job.company}*` : '';
      text += `${idx + 1}. *${job.title}*${companyLabel}\n`;
      text += `   💼 Source: ${sourceLabel}\n`;
      text += `   ℹ️ Description: ${job.description || 'N/A'}\n`;
      text += `   🔗 [Apply Here](${job.url})\n\n`;
    });
    text += '✉️ *Are you hiring?*\nTo list a job and reach the best Solana talent in the UK, submit your listing here:\n👉 [Submit a Job Listing](https://earn.superteam.fun/)';
    await ctx.reply(text, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } } as any);
  } catch (error) {
    console.error('Error in /jobs command:', error);
    ctx.reply('Sorry, unable to retrieve jobs right now.');
  }
});

bot.command('bounties', async (ctx) => {
  try {
    const bounties = await getActiveBounties(5);
    if (bounties.length === 0) {
      return ctx.reply('🏆 No active bounties found. Check official listings at [earn.superteam.fun](https://earn.superteam.fun/).', { parse_mode: 'Markdown' });
    }

    let text = '*🏆 Active Solana Bounties*\n\n';
    bounties.forEach((bounty, idx) => {
      const reward = bounty.reward || 'USDC';
      const deadlineStr = formatDate(bounty.deadline);
      text += `${idx + 1}. *${bounty.title}*\n`;
      text += `   💰 Reward: ${reward}\n`;
      text += `   📅 Deadline: ${deadlineStr}\n`;
      text += `   🔗 [Apply for Bounty](${bounty.url})\n\n`;
    });
    text += '⚠️ *Disclaimer:* These bounties are scraped from Superteam Earn. Always check the official website for full rules, details, and the most up-to-date listings:\n👉 [Superteam Earn](https://earn.superteam.fun/)';
    await ctx.reply(text, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } } as any);
  } catch (error) {
    console.error('Error in /bounties command:', error);
    ctx.reply('Sorry, unable to retrieve bounties right now.');
  }
});

bot.command('news', async (ctx) => {
  try {
    const substack = await getRecentSubstack(3);
    const tweets = await getRecentTweets(3);

    let text = '*📰 Superteam UK Community News*\n\n';
    
    text += '*Substack Newsletters:*\n';
    if (substack.length === 0) {
      text += '• No newsletter updates available.\n\n';
    } else {
      substack.forEach((post) => {
        const dateStr = formatDate(post.published_at);
        text += `• *${post.title}* (${dateStr})\n  _${post.summary || 'Click below to read'}_ \n  👉 [Read Article](${post.url})\n\n`;
      });
    }

    text += '*Latest Twitter Updates:*\n';
    if (tweets.length === 0) {
      text += '• No recent tweets found.\n';
    } else {
      tweets.forEach((tweet) => {
        const dateStr = formatDate(tweet.created_at);
        const tweetText = tweet.text.length > 150 ? `${tweet.text.substring(0, 150)}...` : tweet.text;
        text += `• "${tweetText}"\n  🗓️ ${dateStr} | 🔗 [Link to Tweet](${tweet.url})\n\n`;
      });
    }

    text += '👉 Follow us on Twitter [twitter.com/SuperteamUK](https://twitter.com/SuperteamUK) and subscribe to our newsletter at [superteamuk.substack.com](https://superteamuk.substack.com).';
    await ctx.reply(text, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } } as any);
  } catch (error) {
    console.error('Error in /news command:', error);
    ctx.reply('Sorry, unable to retrieve community news right now.');
  }
});

bot.command('submitjob', async (ctx) => {
  const text = `*✉️ Submit a Job to Superteam UK*

Are you a founder, employer, or sponsor looking for top-tier Solana talent in the United Kingdom?

You can submit your job opportunities directly through the official Superteam Earn platform:
👉 [Submit your job listing on Superteam Earn](https://earn.superteam.fun/)

Your listing will automatically be featured in our community channels, active job listings, and databases!`;
  await ctx.reply(text, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } } as any);
});

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

    const chatType = ctx.message.chat.type;
    if (chatType === 'private') {
      await handleMessage(ctx, ctx.message.text, true);
    } else if (chatType === 'group' || chatType === 'supergroup') {
      // only add messages to conversation if it's a group chat
      addMessageToConversation(chatId, messageObj);
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
