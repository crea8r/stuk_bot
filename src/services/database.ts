import { Pool } from 'pg';
import { DATABASE_URL } from '../config';
import { Conversation } from '../types';

const pool = new Pool({ connectionString: DATABASE_URL });

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        messages JSONB NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        summary TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_chat_id_time ON conversations (chat_id, start_time, end_time);
    `);
  } finally {
    client.release();
  }
}

export async function saveConversationsToDatabase(
  chatId: string,
  conversations: Conversation[]
): Promise<void> {
  if (conversations.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const query = `
      INSERT INTO conversations (chat_id, messages, start_time, end_time)
      VALUES ($1, $2, $3, $4)
    `;
    for (const conversation of conversations) {
      const messages = JSON.stringify(conversation.messages);
      const startTime = conversation.messages[0].date;
      const endTime =
        conversation.messages[conversation.messages.length - 1].date;
      await client.query(query, [chatId, messages, startTime, endTime]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getUnsummarizedConversations(
  chatId: string
): Promise<any[]> {
  const result = await pool.query(
    `
    SELECT id, messages
    FROM conversations
    WHERE chat_id = $1 AND summary IS NULL
    ORDER BY start_time ASC
  `,
    [chatId]
  );
  return result.rows;
}

export async function getRecentConversationSummaries(
  chatId: string,
  limit: number = 3
): Promise<string[]> {
  const result = await pool.query(
    `
    SELECT summary
    FROM conversations
    WHERE chat_id = $1 AND summary IS NOT NULL
    ORDER BY end_time DESC
    LIMIT $2
  `,
    [chatId, limit]
  );

  return result.rows.map((row) => row.summary);
}

export async function saveSummary(id: number, summary: string): Promise<void> {
  await pool.query('UPDATE conversations SET summary = $1 WHERE id = $2', [
    summary,
    id,
  ]);
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1');
    return result.rowCount === 1;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
}
