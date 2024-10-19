// src/app.ts
import { initDatabase } from './services/database';
import { startBot } from './bot';
import { startServer } from './api';
import { PORT } from './config';
import { flushConversationsToDatabase } from './services/conversationHandler';

async function main() {
  try {
    await initDatabase();
    startBot();
    startServer(PORT);

    // Schedule hourly flushing of conversations to database
    setInterval(async () => {
      try {
        await flushConversationsToDatabase();
      } catch (error) {
        console.error('Error during scheduled flush:', error);
      }
    }, 60 * 60 * 1000); // Run every hour

    // TODO: Schedule every 8 hours to summarize conversations and create fact and push into Muninn
  } catch (error) {
    console.error('Error starting the application:', error);
    process.exit(1);
  }
}

main();
