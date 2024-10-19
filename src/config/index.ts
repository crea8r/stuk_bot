// src/config.ts
import dotenv from 'dotenv';

dotenv.config();

export const CONVERSATION_TIME_THRESHOLD = 30 * 60 * 1000; // 30 minutes in milliseconds
export const MAX_MESSAGES_PER_CONVERSATION = 50;
export const MIN_MESSAGES_PER_CONVERSATION = 5;
export const DATABASE_URL = process.env.DATABASE_URL!;
export const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN!;
export const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;
export const PORT = process.env.PORT || 3000;

// AIWelcome API configuration
export const AIWELCOME_API_KEY = process.env.AIWELCOME_API_KEY!;
export const AIWELCOME_BASE_URL = process.env.AIWELCOME_BASE_URL!;
export const AIWELCOME_PROJECT_ID = process.env.AIWELCOME_PROJECT_ID!;
export const AIWELCOME_CHAT_ENGINE = process.env.AIWELCOME_CHAT_ENGINE!;
export const AIWELCOME_CHAT_ORIGIN = process.env.AIWELCOME_CHAT_ORIGIN!;

// Rate limiting configuration to prevent abuse
export const RATE_LIMIT_MAX = 50;
export const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
