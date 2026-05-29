import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractTickers } from './ticker-parser';

export interface RedditTickerSignal {
  ticker: string;
  mentions: number;
  totalScore: number;
  totalComments: number;
}

export type RedditSource = 'oauth' | 'old-reddit' | 'rss' | 'cache';

export interface RedditFetchMetadata {
  source: RedditSource;
  postCount: number;
  fallbackReason?: string;
  cachedAt?: string;
  cacheAgeHours?: number;
}

export interface RedditRawPost {
  title: string;
  score: number;
  numComments: number;
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

interface RedditPostCache {
  cachedAt: string;
  source: Exclude<RedditSource, 'cache'>;
  posts: RedditPost[];
}

let cachedToken: { value: string; expiresAt: number } | null = null;
const CACHE_PATH = join(process.cwd(), '.cache', 'reddit-posts.json');

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

function parseScore(value: string | undefined): number {
  if (!value || value === '•') return 0;

  const normalized = value.trim().toLowerCase().replace(/,/g, '');
  const multiplier = normalized.endsWith('k') ? 1000 : 1;
  const parsed = Number.parseFloat(normalized.replace(/k$/, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * multiplier) : 0;
}

function parseOldRedditPosts(html: string): RedditPost[] {
  const posts = new Map<string, RedditPost>();
  const blocks = html.match(/<div[^>]+class="[^"]*\bthing\b[\s\S]*?(?=<div[^>]+class="[^"]*\bthing\b|<p class="next-button"|<div class="footer-parent"|$)/g) ?? [];

  for (const block of blocks) {
    const titleMatch = block.match(/<a[^>]+class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;

    const title = decodeXmlEntities(titleMatch[1].replace(/<[^>]+>/g, '')).trim();
    if (!title) continue;

    const scoreTitle = block.match(/<div[^>]+class="[^"]*\bscore\b[^"]*"[^>]*title="([^"]*)"/i)?.[1];
    const scoreText = block.match(/<div[^>]+class="[^"]*\bscore\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const commentsText = block.match(/>([\d,.]+k?)\s+comments?<\/a>/i)?.[1];

    posts.set(title, {
      title,
      score: parseScore(decodeXmlEntities(scoreTitle ?? scoreText ?? '')),
      num_comments: parseScore(commentsText),
    });
  }

  return Array.from(posts.values());
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

async function fetchOldRedditPage(path: '' | 'new/'): Promise<RedditPost[]> {
  const res = await fetch(`https://old.reddit.com/r/wallstreetbets/${path}`, {
    headers: { 'User-Agent': getUserAgent() },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Old Reddit fetch failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  return parseOldRedditPosts(await res.text());
}

async function fetchOldRedditPosts(): Promise<RedditPost[]> {
  const pages = await Promise.all([fetchOldRedditPage(''), fetchOldRedditPage('new/')]);
  const posts = new Map<string, RedditPost>();

  for (const pagePosts of pages) {
    for (const post of pagePosts) {
      const existing = posts.get(post.title);
      posts.set(post.title, existing ? {
        ...post,
        score: Math.max(existing.score, post.score),
        num_comments: Math.max(existing.num_comments, post.num_comments),
      } : post);
    }
  }

  return Array.from(posts.values());
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

async function savePostCache(source: Exclude<RedditSource, 'cache'>, posts: RedditPost[]): Promise<void> {
  try {
    await mkdir(join(process.cwd(), '.cache'), { recursive: true });
    const cache: RedditPostCache = {
      cachedAt: new Date().toISOString(),
      source,
      posts,
    };
    await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.warn('Failed to write Reddit cache:', err);
  }
}

async function loadPostCache(fallbackReason: string): Promise<{ posts: RedditPost[]; metadata: RedditFetchMetadata }> {
  const cache = JSON.parse(await readFile(CACHE_PATH, 'utf8')) as RedditPostCache;
  const cacheAgeHours = Math.round((Date.now() - new Date(cache.cachedAt).getTime()) / 36_000) / 100;

  return {
    posts: cache.posts,
    metadata: {
      source: 'cache',
      postCount: cache.posts.length,
      fallbackReason,
      cachedAt: cache.cachedAt,
      cacheAgeHours,
    },
  };
}

async function withPostCache(
  source: Exclude<RedditSource, 'cache'>,
  posts: RedditPost[],
): Promise<{ posts: RedditPost[]; metadata: RedditFetchMetadata }> {
  await savePostCache(source, posts);
  return { posts, metadata: { source, postCount: posts.length } };
}

async function fetchPosts(): Promise<{ posts: RedditPost[]; metadata: RedditFetchMetadata }> {
  let fallbackReason: string | undefined;

  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    try {
      const listing = await fetchOAuthPage();
      const posts = listing.data.children.map(c => c.data);
      return withPostCache('oauth', posts);
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
      console.warn('Reddit OAuth fetch failed, falling back to Old Reddit:', err);
    }
  }

  try {
    const posts = await fetchOldRedditPosts();
    const result = await withPostCache('old-reddit', posts);
    return { ...result, metadata: { ...result.metadata, fallbackReason } };
  } catch (err) {
    const oldRedditReason = err instanceof Error ? err.message : String(err);
    fallbackReason = fallbackReason ? `${fallbackReason}; ${oldRedditReason}` : oldRedditReason;
    console.warn('Old Reddit fetch failed, falling back to RSS:', err);
  }

  try {
    const posts = await fetchRssPosts();
    const result = await withPostCache('rss', posts);
    return { ...result, metadata: { ...result.metadata, fallbackReason } };
  } catch (err) {
    const rssReason = err instanceof Error ? err.message : String(err);
    fallbackReason = fallbackReason ? `${fallbackReason}; ${rssReason}` : rssReason;
    console.warn('Reddit RSS fetch failed, falling back to cached Reddit posts:', err);
  }

  return loadPostCache(fallbackReason);
}

export async function fetchWSBSignals(): Promise<{
  signals: RedditTickerSignal[];
  rawPosts: RedditRawPost[];
  metadata: RedditFetchMetadata;
  source: RedditSource;
}> {
  const { posts, metadata } = await fetchPosts();

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

  return { signals, rawPosts, metadata, source: metadata.source };
}
