export interface NewsHeadline {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
}

export async function fetchNewsHeadlines(tickers: string[]): Promise<NewsHeadline[]> {
  const apiKey = process.env.NEWS_API_KEY!;

  // Build query: top ticker names + general finance terms
  const tickerQuery = tickers.slice(0, 5).join(' OR ');
  const query = encodeURIComponent(`(${tickerQuery}) AND (stock OR shares OR earnings OR rally)`);

  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const url = `https://newsapi.org/v2/everything?q=${query}&from=${from}&language=en&sortBy=popularity&pageSize=30&apiKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NewsAPI error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as {
    articles: Array<{ title: string; source: { name: string }; publishedAt: string; url: string }>;
  };

  return data.articles.map(a => ({
    title: a.title,
    source: a.source.name,
    publishedAt: a.publishedAt,
    url: a.url,
  }));
}
