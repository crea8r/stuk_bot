import axios from 'axios';
import {
  upsertScrapedEvents,
  upsertScrapedTweets,
  upsertScrapedSubstack,
  upsertScrapedJobs,
  upsertScrapedBounties,
  deleteOldTweets,
} from './database';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface ScrapedEvent {
  title: string;
  description: string;
  url: string;
  startTime: string | null;
  location: string;
}

export interface ScrapedTweet {
  tweetId: string;
  text: string;
  createdAt: string;
  url: string;
}

export interface ScrapedSubstack {
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
}

export interface ScrapedJob {
  title: string;
  company: string;
  url: string;
  description: string;
  source: 'solana_jobs' | 'earn_projects';
}

export interface ScrapedBounty {
  title: string;
  description: string;
  url: string;
  reward: string;
  deadline: string | null;
}

// 1. LUMA EVENTS SCRAPER
export async function scrapeLuma(): Promise<ScrapedEvent[]> {
  const urls = [
    'https://lu.ma/superteam',
    'https://lu.ma/user/usr-QGytgR4teGNHdKK'
  ];
  const eventsMap = new Map<string, ScrapedEvent>();

  for (const url of urls) {
    try {
      console.log(`[Scraper] Fetching Luma Calendar/User URL: ${url}`);
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000
      });

      const match = response.data.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (!match) {
        console.warn(`[Scraper] __NEXT_DATA__ not found on Luma page: ${url}`);
        continue;
      }

      const parsed = JSON.parse(match[1]);
      const initialData = parsed.props?.pageProps?.initialData || {};
      const calData = initialData.data || {};
      const featuredItems = calData.featured_items || [];

      console.log(`[Scraper] Found ${featuredItems.length} featured items on Luma page: ${url}`);

      for (const item of featuredItems) {
        const ev = item.event;
        if (!ev) continue;

        // Deduplicate using URL or api_id
        const eventUrl = `https://lu.ma/${ev.url}`;
        
        let loc = 'Online Event';
        if (ev.location_type === 'offline') {
          const address = ev.geo_address_info;
          loc = address 
            ? `${address.name || ''} ${address.city || ''} ${address.address || ''}`.trim() 
            : 'Offline Event';
        }

        const scrapedEvent: ScrapedEvent = {
          title: ev.name || 'Unnamed Event',
          description: ev.event_type || 'SuperteamUK Event',
          url: eventUrl,
          startTime: ev.start_at || null,
          location: loc || 'TBA'
        };

        eventsMap.set(eventUrl, scrapedEvent);
      }
    } catch (error: any) {
      console.error(`[Scraper] Error scraping Luma URL ${url}:`, error.message);
    }
  }

  return Array.from(eventsMap.values());
}

// 2. SUBSTACK SCRAPER
export async function scrapeSubstack(): Promise<ScrapedSubstack[]> {
  const posts: ScrapedSubstack[] = [];
  try {
    const feedUrl = 'https://superteamuk.substack.com/feed';
    console.log(`[Scraper] Fetching Substack Feed: ${feedUrl}`);
    const response = await axios.get(feedUrl, { timeout: 10000 });

    const xml = response.data;
    const matchAll = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

    for (const match of matchAll) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemXml.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
      const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemXml.match(/<description>([\s\S]*?)<\/description>/);

      if (titleMatch && linkMatch && dateMatch) {
        posts.push({
          title: titleMatch[1].trim(),
          url: linkMatch[1].trim(),
          publishedAt: dateMatch[1].trim(),
          summary: descMatch ? descMatch[1].replace(/<[^>]*>?/gm, '').substring(0, 300).trim() : ''
        });
      }
    }
  } catch (error: any) {
    console.error('[Scraper] Error scraping Substack:', error.message);
  }
  return posts;
}

// 3. TWITTER/X SCRAPER (NITTER FALLBACK PIPELINE)
export async function scrapeTwitter(): Promise<ScrapedTweet[]> {
  const hosts = [
    'https://nitter.net',
    'https://nitter.mint.lgbt',
    'https://nitter.poast.org',
    'https://nitter.no-logs.com'
  ];
  const tweets: ScrapedTweet[] = [];

  for (const host of hosts) {
    const url = `${host}/SuperteamUK/rss`;
    try {
      console.log(`[Scraper] Trying Twitter feed via Nitter host: ${url}`);
      const response = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 8000
      });

      const xml = response.data;
      const matchAll = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

      for (const match of matchAll) {
        const itemXml = match[1];
        const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemXml.match(/<description>([\s\S]*?)<\/description>/);
        const dateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);

        if (linkMatch && descMatch && dateMatch) {
          const link = linkMatch[1].trim();
          const tweetIdMatch = link.match(/status\/(\d+)/);
          const tweetId = tweetIdMatch ? tweetIdMatch[1] : `tw_${Date.now()}`;
          const tweetText = descMatch[1].replace(/<[^>]*>?/gm, '').trim();

          tweets.push({
            tweetId,
            text: tweetText || 'Twitter update from SuperteamUK',
            createdAt: dateMatch[1].trim(),
            url: `https://twitter.com/SuperteamUK/status/${tweetId}`
          });
        }
      }

      console.log(`[Scraper] Successfully scraped ${tweets.length} tweets from: ${host}`);
      // Break out of loop since we got a working host!
      return tweets;
    } catch (e: any) {
      console.warn(`[Scraper] Nitter host failed ${host}: ${e.message}`);
    }
  }

  console.error('[Scraper] All Nitter hosts failed to scrape Twitter. Return empty array.');
  return [];
}

// 4. SUPERTEAM EARN PIPELINE
export async function scrapeEarn(): Promise<{ bounties: ScrapedBounty[]; jobs: ScrapedJob[] }> {
  const bounties: ScrapedBounty[] = [];
  const jobs: ScrapedJob[] = [];

  try {
    const url = 'https://earn.superteam.fun/api/listings';
    console.log(`[Scraper] Fetching Superteam Earn API: ${url}`);
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    const listings = Array.isArray(response.data) ? response.data : [];
    console.log(`[Scraper] Found ${listings.length} listings in Superteam Earn API`);

    for (const listing of listings) {
      // Only capture open opportunities
      if (listing.status !== 'OPEN') continue;

      const companyName = listing.sponsor?.name || 'Superteam';
      const detailUrl = `https://earn.superteam.fun/listings/${listing.type}/${listing.slug}`;

      if (listing.type === 'bounty') {
        const rewardStr = listing.rewardAmount 
          ? `${listing.rewardAmount} ${listing.token || 'USD'}` 
          : 'Reward pool';
          
        bounties.push({
          title: listing.title || 'Superteam Bounty',
          description: `Sponsor: ${companyName}`,
          url: detailUrl,
          reward: rewardStr,
          deadline: listing.deadline || null
        });
      } else {
        const compStr = listing.rewardAmount 
          ? `${listing.rewardAmount} ${listing.token || 'USD'}` 
          : 'Competitive';

        jobs.push({
          title: listing.title || 'Superteam Project Opportunity',
          company: companyName,
          url: detailUrl,
          description: `Compensation: ${compStr}`,
          source: 'earn_projects'
        });
      }
    }
  } catch (error: any) {
    console.error('[Scraper] Error scraping Superteam Earn API:', error.message);
  }

  return { bounties, jobs };
}

// 5. SOLANA JOBS PIPELINE
export async function scrapeSolanaJobs(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  try {
    const url = 'https://jobs.solana.com/jobs';
    console.log(`[Scraper] Fetching Solana Jobs: ${url}`);
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000
    });

    const match = response.data.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) {
      console.warn('[Scraper] __NEXT_DATA__ not found on Solana Jobs.');
      return [];
    }

    const parsed = JSON.parse(match[1]);
    const pageProps = parsed.props?.pageProps || {};
    const initialState = pageProps.initialState || {};
    const jobsState = initialState.jobs || {};
    const jobList = jobsState.found || [];

    console.log(`[Scraper] Found ${jobList.length} jobs on Solana Jobs page`);

    for (const job of jobList) {
      const companyName = job.organization?.name || 'Solana Ecosystem Company';
      const detailUrl = job.url || `https://jobs.solana.com/jobs/${job.slug}`;

      let desc = job.workMode || 'Remote';
      if (job.seniority) {
        desc += ` | Seniority: ${job.seniority}`;
      }

      jobs.push({
        title: job.title || 'Ecosystem Role',
        company: companyName,
        url: detailUrl,
        description: desc,
        source: 'solana_jobs'
      });
    }
  } catch (error: any) {
    console.error('[Scraper] Error scraping Solana Jobs:', error.message);
  }
  return jobs;
}

// --- CENTRAL SCRAPER EXECUTOR PIPELINE ---

export interface ScraperExecutionStats {
  eventsInserted: number;
  tweetsInserted: number;
  substackInserted: number;
  jobsInserted: number;
  bountiesInserted: number;
  tweetsCleaned: number;
  timestamp: string;
}

export async function runScraperPipeline(): Promise<ScraperExecutionStats> {
  console.log('[Scraper Pipeline] Starting full scrape execution loop...');
  const stats: ScraperExecutionStats = {
    eventsInserted: 0,
    tweetsInserted: 0,
    substackInserted: 0,
    jobsInserted: 0,
    bountiesInserted: 0,
    tweetsCleaned: 0,
    timestamp: new Date().toISOString()
  };

  try {
    // 1. Scrape Luma
    const events = await scrapeLuma();
    stats.eventsInserted = await upsertScrapedEvents(events);
    console.log(`[Scraper Pipeline] Saved ${stats.eventsInserted} events.`);

    // 2. Scrape Twitter
    const tweets = await scrapeTwitter();
    stats.tweetsInserted = await upsertScrapedTweets(tweets);
    console.log(`[Scraper Pipeline] Saved ${stats.tweetsInserted} tweets.`);

    // 3. Scrape Substack
    const posts = await scrapeSubstack();
    stats.substackInserted = await upsertScrapedSubstack(posts);
    console.log(`[Scraper Pipeline] Saved ${stats.substackInserted} substack posts.`);

    // 4. Scrape Earn
    const earnData = await scrapeEarn();
    stats.bountiesInserted = await upsertScrapedBounties(earnData.bounties);
    console.log(`[Scraper Pipeline] Saved ${stats.bountiesInserted} bounties.`);

    // 5. Scrape Solana Jobs
    const solJobs = await scrapeSolanaJobs();
    
    // Combine Earn jobs + Solana Jobs
    const combinedJobs = [...earnData.jobs, ...solJobs];
    stats.jobsInserted = await upsertScrapedJobs(combinedJobs);
    console.log(`[Scraper Pipeline] Saved ${stats.jobsInserted} jobs.`);

    // 6. Delete old tweets (> 30 days)
    stats.tweetsCleaned = await deleteOldTweets(30);
    console.log(`[Scraper Pipeline] Cleaned up ${stats.tweetsCleaned} tweets older than 30 days.`);

    console.log('[Scraper Pipeline] Scraping cycle finished successfully.');
  } catch (error: any) {
    console.error('[Scraper Pipeline] Critical error during execution:', error.message);
  }

  return stats;
}
