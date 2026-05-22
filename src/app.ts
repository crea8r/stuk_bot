// src/app.ts
import { initDatabase } from './services/database';
import { startBot } from './bot';
import { startServer } from './api';
import { PORT } from './config';
import { flushConversationsToDatabase } from './services/conversationHandler';
import { runScraperPipeline } from './services/scraper';

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

    // Scraper scheduler: run on startup (async, non-blocking) and then every 24 hours
    runScraperPipeline().catch((err) => {
      console.error('Initial background scraping failed:', err);
    });

    setInterval(async () => {
      try {
        console.log('[Scheduler] Running 24h interval scraper pipeline...');
        await runScraperPipeline();
      } catch (error) {
        console.error('Error during scheduled scraper run:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run every 24 hours
  } catch (error) {
    console.error('Error starting the application:', error);
    process.exit(1);
  }
}

main();
