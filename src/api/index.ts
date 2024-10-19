import express from 'express';
import {
  getUnsummarizedConversations,
  checkDatabaseConnection,
} from '../services/database';
import { summarizeConversations } from '../services/summarizer';
import { getConversationsInMemory } from '../services/conversationHandler';

const app = express();
app.use(express.json());

app.post('/summarize', async (req: any, res: any) => {
  const { chatId } = req.body;

  try {
    const unsummarizedConversations = await getUnsummarizedConversations(
      chatId
    );

    if (unsummarizedConversations.length === 0) {
      return res.json({ message: 'No new conversations to summarize.' });
    }

    const summaries = await summarizeConversations(
      chatId,
      unsummarizedConversations
    );
    res.json({ summaries });
  } catch (error) {
    console.error('Error in summarize API:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while generating summaries.' });
  }
});

app.get('/state', async (req, res) => {
  try {
    const dbAlive = await checkDatabaseConnection();
    const memoryUsage = getConversationsInMemory();

    res.json({
      databaseConnection: dbAlive ? 'alive' : 'dead',
      conversationsInMemory: memoryUsage,
    });
  } catch (error) {
    console.error('Error in state API:', error);
    res
      .status(500)
      .json({ error: 'An error occurred while fetching application state.' });
  }
});

export function startServer(port: any) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
