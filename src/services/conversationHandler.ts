import { ChatStore, MessageObject, Conversation } from '../types';
import {
  CONVERSATION_TIME_THRESHOLD,
  MAX_MESSAGES_PER_CONVERSATION,
  MIN_MESSAGES_PER_CONVERSATION,
} from '../config';
import { saveConversationsToDatabase } from './database';

const conversationStore: ChatStore = {};

export function addMessageToConversation(
  chatId: string,
  message: MessageObject
): void {
  if (!conversationStore[chatId]) {
    conversationStore[chatId] = [];
  }

  const conversations = conversationStore[chatId];
  const currentConversation = conversations[conversations.length - 1];

  if (
    !currentConversation ||
    (message.date.getTime() -
      currentConversation.messages[
        currentConversation.messages.length - 1
      ].date.getTime() >
      CONVERSATION_TIME_THRESHOLD &&
      !message.reply_to_message) ||
    currentConversation.messages.length >= MAX_MESSAGES_PER_CONVERSATION
  ) {
    // Start a new conversation
    conversations.push({ messages: [message] });
  } else {
    // Add to existing conversation
    currentConversation.messages.push(message);
  }

  // Merge short conversations
  mergeShortConversations(chatId);

  // Save to database if there are many conversations
  if (conversations.length > 5) {
    saveConversationsToDatabase(chatId, conversations).catch(console.error);
    conversationStore[chatId] = [];
  }
}

function mergeShortConversations(chatId: string): void {
  const conversations = conversationStore[chatId];
  if (conversations.length < 2) return;

  for (let i = 0; i < conversations.length - 1; i++) {
    if (conversations[i].messages.length < MIN_MESSAGES_PER_CONVERSATION) {
      // Merge with the next conversation
      conversations[i + 1].messages = [
        ...conversations[i].messages,
        ...conversations[i + 1].messages,
      ];
      conversations.splice(i, 1);
      i--; // Recheck this index as it now contains a new conversation
    }
  }
}

export function getConversationsInMemory(): { [chatId: string]: number } {
  return Object.keys(conversationStore).reduce(
    (acc: { [key: string]: number }, chatId) => {
      acc[chatId] = conversationStore[chatId].reduce(
        (sum, conv) => sum + conv.messages.length,
        0
      );
      return acc;
    },
    {}
  );
}

export async function flushConversationsToDatabase(): Promise<void> {
  for (const chatId in conversationStore) {
    await saveConversationsToDatabase(chatId, conversationStore[chatId]);
    delete conversationStore[chatId];
  }
  console.log('All conversations flushed to database successfully.');
}
