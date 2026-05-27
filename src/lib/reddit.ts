import { extractTickers } from './ticker-parser';

export interface RedditTickerSignal {
  ticker: string;
  mentions: number;
  totalScore: number;
  totalComments: number;
}

interface RedditPost {
  title: string;
  score: number;
  num_comments: number;
}

interface RedditListingChild {
  data: RedditPost;
}

interface RedditListingResponse {
  data: {
    children: RedditListingChild[];
    after: string | null;
  };
}

async function fetchPage(after?: string): Promise<RedditListingResponse> {
  const params = new URLSearchParams({ limit: '100', t: 'day' });
  if (after) params.set('after', after);

  const res = await fetch(
    `https://www.reddit.com/r/wallstreetbets/hot.json?${params}`,
    {
      headers: {
        'User-Agent': 'wsb-trader/1.0 (personal paper-trading simulator)',
      },
    }
  );

  if (!res.ok) throw new Error(`Reddit fetch failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<RedditListingResponse>;
}

export async function fetchWSBSignals(): Promise<{
  signals: RedditTickerSignal[];
  rawPosts: Array<{ title: string; score: number; numComments: number }>;
}> {
  const listing = await fetchPage();

  const rawPosts = listing.data.children.map(c => ({
    title: c.data.title,
    score: c.data.score,
    numComments: c.data.num_comments,
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
