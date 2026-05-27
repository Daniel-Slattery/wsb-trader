import OpenAI from 'openai';
import type { RedditTickerSignal } from './reddit';
import type { NewsHeadline } from './news';

export interface AgentPick {
  ticker: string;
  score: number;
  reasoning: string;
}

export interface AgentResult {
  picks: AgentPick[];
  summary: string;
}

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      // Supports GitHub Models (via Copilot subscription) by setting
      // OPENAI_BASE_URL=https://models.inference.ai.azure.com in .env.local
      // Leave unset to use the standard OpenAI API endpoint
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    });
  }
  return openaiClient;
}

function buildPrompt(
  redditSignals: RedditTickerSignal[],
  headlines: NewsHeadline[]
): string {
  const redditSection = redditSignals
    .map(s => `- ${s.ticker}: ${s.mentions} mentions, ${s.totalScore.toLocaleString()} upvotes, ${s.totalComments.toLocaleString()} comments`)
    .join('\n');

  const newsSection = headlines
    .slice(0, 20)
    .map(h => {
      const age = Math.round((Date.now() - new Date(h.publishedAt).getTime()) / 3_600_000);
      return `- "${h.title}" (${h.source}, ${age}h ago)`;
    })
    .join('\n');

  return `You are a momentum trading analyst. Based on the following signals from Reddit (r/wallstreetbets) and financial news in the last 24 hours, identify the top 5 most hyped US tech stocks most likely to make a significant move today.

REDDIT SIGNALS (r/wallstreetbets, last 24h):
${redditSection}

NEWS HEADLINES (last 24h):
${newsSection}

Instructions:
- Only include tickers that trade on US exchanges (NYSE/NASDAQ)
- Rank by combined momentum: social hype + news sentiment
- Score each pick 0–100 (100 = highest conviction)
- Keep each reasoning to 1–2 sentences

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "picks": [
    { "ticker": "NVDA", "score": 95, "reasoning": "Dominant WSB mentions with major earnings beat headline driving strong bullish sentiment." }
  ],
  "summary": "2–3 sentence plain English summary of today's overall market sentiment."
}`;
}

export async function runAgent(
  redditSignals: RedditTickerSignal[],
  headlines: NewsHeadline[]
): Promise<AgentResult> {
  const client = getClient();
  const prompt = buildPrompt(redditSignals, headlines);

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3, // low temp for consistent structured output
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error('Empty response from GPT-4o');

  const parsed = JSON.parse(content) as AgentResult;

  if (!Array.isArray(parsed.picks) || parsed.picks.length === 0) {
    throw new Error(`Invalid agent response: ${content}`);
  }

  // Sort by score descending and take top 5
  parsed.picks = parsed.picks
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return parsed;
}
