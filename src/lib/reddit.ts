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

interface RedditTokenResponse {
  access_token: string;
  expires_in: number;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function getUserAgent(): string {
  return process.env.REDDIT_USER_AGENT ?? 'wsb-trader/1.0 (personal paper-trading simulator)';
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(parseInt(num, 10)));
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': getUserAgent(),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Reddit token fetch failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  const token = await res.json() as RedditTokenResponse;
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };

  return cachedToken.value;
}

async function fetchOAuthPage(after?: string): Promise<RedditListingResponse> {
  const params = new URLSearchParams({ limit: '100', t: 'day' });
  if (after) params.set('after', after);

  const token = await getAccessToken();

  const res = await fetch(
    `https://oauth.reddit.com/r/wallstreetbets/hot?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': getUserAgent(),
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Reddit OAuth fetch failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  return res.json() as Promise<RedditListingResponse>;
}

async function fetchRssPosts(): Promise<RedditPost[]> {
  const res = await fetch('https://www.reddit.com/r/wallstreetbets/.rss', {
    headers: { 'User-Agent': getUserAgent() },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Reddit RSS fetch failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  const xml = await res.text();
  return Array.from(xml.matchAll(/<entry[\s\S]*?<\/entry>/g))
    .map(match => {
      const title = match[0].match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1];
      return title ? { title: decodeXmlEntities(title).trim(), score: 0, num_comments: 0 } : null;
    })
    .filter((post): post is RedditPost => Boolean(post));
}

async function fetchPosts(): Promise<{ posts: RedditPost[]; source: 'oauth' | 'rss' }> {
  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    try {
      const listing = await fetchOAuthPage();
      return { posts: listing.data.children.map(c => c.data), source: 'oauth' };
    } catch (err) {
      console.warn('Reddit OAuth fetch failed, falling back to RSS:', err);
    }
  }

  return { posts: await fetchRssPosts(), source: 'rss' };
}

export async function fetchWSBSignals(): Promise<{
  signals: RedditTickerSignal[];
  rawPosts: Array<{ title: string; score: number; numComments: number }>;
  source: 'oauth' | 'rss';
}> {
  const { posts, source } = await fetchPosts();

  const rawPosts = posts.map(post => ({
    title: post.title,
    score: post.score,
    numComments: post.num_comments,
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

  return { signals, rawPosts, source };
}
