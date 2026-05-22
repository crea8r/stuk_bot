import { Pool } from 'pg';
import { DATABASE_URL } from '../config';
import { Conversation } from '../types';

const pool = new Pool({ connectionString: DATABASE_URL });

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        messages JSONB NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        summary TEXT,
        fact_id UUID
      );
      CREATE INDEX IF NOT EXISTS idx_chat_id_time ON conversations (chat_id, start_time, end_time);

      CREATE TABLE IF NOT EXISTS objconvo (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        object_id UUID NOT NULL
      );

      -- Table for Luma Events
      CREATE TABLE IF NOT EXISTS scraped_events (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT UNIQUE NOT NULL,
        start_time TIMESTAMP,
        location TEXT,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table for Twitter Tweets
      CREATE TABLE IF NOT EXISTS scraped_tweets (
        id SERIAL PRIMARY KEY,
        tweet_id TEXT UNIQUE NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        url TEXT NOT NULL,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table for Substack posts
      CREATE TABLE IF NOT EXISTS scraped_substack (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT UNIQUE NOT NULL,
        published_at TIMESTAMP NOT NULL,
        summary TEXT,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table for Jobs (Solana Jobs + Earn projects)
      CREATE TABLE IF NOT EXISTS scraped_jobs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT,
        url TEXT UNIQUE NOT NULL,
        description TEXT,
        source TEXT NOT NULL,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Table for Bounties (Earn bounties)
      CREATE TABLE IF NOT EXISTS scraped_bounties (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT UNIQUE NOT NULL,
        reward TEXT,
        deadline TIMESTAMP,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
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

export async function saveFactId(id: number, factId: string): Promise<void> {
  await pool.query('UPDATE conversations SET fact_id = $1 WHERE id = $2', [
    factId,
    id,
  ]);
}

export async function upsertChatIdOrgId(
  chatId: string,
  objectId: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const query = `
      INSERT INTO objconvo (chat_id, object_id)
      VALUES ($1, $2)
      ON CONFLICT (chat_id) DO UPDATE SET object_id = $2
    `;
    await client.query(query, [chatId, objectId]);
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

// --- NEW SCRAPER UPSERT FUNCTIONS ---

export async function upsertScrapedEvents(events: any[]): Promise<number> {
  if (events.length === 0) return 0;
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    const query = `
      INSERT INTO scraped_events (title, description, url, start_time, location)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        start_time = EXCLUDED.start_time,
        location = EXCLUDED.location,
        scraped_at = CURRENT_TIMESTAMP
    `;
    for (const event of events) {
      await client.query(query, [
        event.title,
        event.description,
        event.url,
        event.startTime ? new Date(event.startTime) : null,
        event.location,
      ]);
      inserted++;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return inserted;
}

export async function upsertScrapedTweets(tweets: any[]): Promise<number> {
  if (tweets.length === 0) return 0;
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    const query = `
      INSERT INTO scraped_tweets (tweet_id, text, created_at, url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tweet_id) DO UPDATE SET
        text = EXCLUDED.text,
        created_at = EXCLUDED.created_at,
        url = EXCLUDED.url,
        scraped_at = CURRENT_TIMESTAMP
    `;
    for (const tweet of tweets) {
      await client.query(query, [
        tweet.tweetId,
        tweet.text,
        new Date(tweet.createdAt),
        tweet.url,
      ]);
      inserted++;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return inserted;
}

export async function upsertScrapedSubstack(posts: any[]): Promise<number> {
  if (posts.length === 0) return 0;
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    const query = `
      INSERT INTO scraped_substack (title, url, published_at, summary)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        published_at = EXCLUDED.published_at,
        summary = EXCLUDED.summary,
        scraped_at = CURRENT_TIMESTAMP
    `;
    for (const post of posts) {
      await client.query(query, [
        post.title,
        post.url,
        new Date(post.publishedAt),
        post.summary,
      ]);
      inserted++;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return inserted;
}

export async function upsertScrapedJobs(jobs: any[]): Promise<number> {
  if (jobs.length === 0) return 0;
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    const query = `
      INSERT INTO scraped_jobs (title, company, url, description, source)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        company = EXCLUDED.company,
        description = EXCLUDED.description,
        source = EXCLUDED.source,
        scraped_at = CURRENT_TIMESTAMP
    `;
    for (const job of jobs) {
      await client.query(query, [
        job.title,
        job.company,
        job.url,
        job.description,
        job.source,
      ]);
      inserted++;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return inserted;
}

export async function upsertScrapedBounties(bounties: any[]): Promise<number> {
  if (bounties.length === 0) return 0;
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    const query = `
      INSERT INTO scraped_bounties (title, description, url, reward, deadline)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (url) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        reward = EXCLUDED.reward,
        deadline = EXCLUDED.deadline,
        scraped_at = CURRENT_TIMESTAMP
    `;
    for (const bounty of bounties) {
      await client.query(query, [
        bounty.title,
        bounty.description,
        bounty.url,
        bounty.reward,
        bounty.deadline ? new Date(bounty.deadline) : null,
      ]);
      inserted++;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return inserted;
}

// --- NEW RETRIEVAL HELPERS FOR TELEGRAM COMMANDS ---

export async function getUpcomingEvents(limit: number = 5): Promise<any[]> {
  const result = await pool.query(
    `
    SELECT title, description, url, start_time, location
    FROM scraped_events
    WHERE start_time >= CURRENT_TIMESTAMP OR start_time IS NULL
    ORDER BY start_time ASC NULLS LAST
    LIMIT $1
  `,
    [limit]
  );
  return result.rows;
}

export async function getRecentTweets(limit: number = 5): Promise<any[]> {
  const result = await pool.query(
    `
    SELECT tweet_id, text, created_at, url
    FROM scraped_tweets
    ORDER BY created_at DESC
    LIMIT $1
  `,
    [limit]
  );
  return result.rows;
}

export async function getRecentSubstack(limit: number = 5): Promise<any[]> {
  const result = await pool.query(
    `
    SELECT title, url, published_at, summary
    FROM scraped_substack
    ORDER BY published_at DESC
    LIMIT $1
  `,
    [limit]
  );
  return result.rows;
}

export async function getActiveJobs(limit: number = 5): Promise<any[]> {
  const result = await pool.query(
    `
    SELECT title, company, url, description, source
    FROM scraped_jobs
    ORDER BY scraped_at DESC
    LIMIT $1
  `,
    [limit]
  );
  return result.rows;
}

export async function getActiveBounties(limit: number = 5): Promise<any[]> {
  const result = await pool.query(
    `
    SELECT title, description, url, reward, deadline
    FROM scraped_bounties
    WHERE deadline >= CURRENT_TIMESTAMP OR deadline IS NULL
    ORDER BY deadline ASC NULLS LAST
    LIMIT $1
  `,
    [limit]
  );
  return result.rows;
}

// --- NEW DELETION HELPER ---

export async function deleteOldTweets(days: number = 30): Promise<number> {
  const result = await pool.query(
    `
    DELETE FROM scraped_tweets
    WHERE created_at < NOW() - INTERVAL '1 day' * $1
  `,
    [days]
  );
  return result.rowCount || 0;
}
