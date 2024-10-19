import axios from 'axios';
import { MISTRAL_API_KEY } from '../config';
import { MessageObject } from '../types';
import { getRecentConversationSummaries, saveSummary } from './database';

export async function summarizeConversations(
  chatId: string,
  conversations: any[]
): Promise<string[]> {
  const recentSummaries = await getRecentConversationSummaries(chatId);
  const summaries: string[] = [];

  for (const row of conversations) {
    const conversation = JSON.parse(row.messages);
    const conversationText = conversation
      .map((msg: MessageObject) => `${msg.from}: ${msg.text}`)
      .join('\n');

    const contextText = recentSummaries.join('\n\n');

    const mistralResponse: any = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model: 'pixtral-12b-2409',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that summarizes conversations.',
          },
          {
            role: 'user',
            content: `Here's some context from recent conversations:\n\n${contextText}\n\nNow, please summarize the following conversation in two parts: 1) Key points discussed among parties, and 2) Next actions. Here's the conversation:\n\n${conversationText}`,
          },
        ],
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const summary = mistralResponse.data.choices[0].message.content;
    summaries.push(summary);

    await saveSummary(row.id, summary);
  }

  return summaries;
}
