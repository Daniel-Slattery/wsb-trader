import Snoowrap from 'snoowrap';
import { extractTickers } from './ticker-parser';

export interface RedditTickerSignal {
  ticker: string;
  mentions: number;
  totalScore: number;
  totalComments: number;
}

let redditClient: Snoowrap | null = null;

function getClient(): Snoowrap {
  if (!redditClient) {
    redditClient = new Snoowrap({
      userAgent: 'WSBTrader/1.0',
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
      username: process.env.REDDIT_USERNAME!,
      password: process.env.REDDIT_PASSWORD!,
    });
  }
  return redditClient;
}

export async function fetchWSBSignals(): Promise<{
  signals: RedditTickerSignal[];
  rawPosts: Array<{ title: string; score: number; numComments: number }>;
}> {
  const client = getClient();

  // Fetch top 100 hot posts from last 24 hours
  const posts = await client.getSubreddit('wallstreetbets').getHot({ limit: 100 });

  const rawPosts = posts.map(p => ({
    title: p.title,
    score: p.score,
    numComments: p.num_comments,
  }));

  // Aggregate ticker signals
  const tickerMap = new Map<string, RedditTickerSignal>();

  for (const post of rawPosts) {
    const tickers = extractTickers(post.title);
    for (const ticker of tickers) {
      const existing = tickerMap.get(ticker) ?? {
        ticker,
        mentions: 0,
        totalScore: 0,
        totalComments: 0,
      };
      tickerMap.set(ticker, {
        ticker,
        mentions: existing.mentions + 1,
        totalScore: existing.totalScore + post.score,
        totalComments: existing.totalComments + post.numComments,
      });
    }
  }

  // Return sorted by total score descending, top 20
  const signals = Array.from(tickerMap.values())
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);

  return { signals, rawPosts };
}
