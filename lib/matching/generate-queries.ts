import { generateObject } from 'ai';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';
import type { TrialCriteria } from './parse-criteria';

const queriesSchema = z.object({
  queries: z.array(z.string()),
});

export async function generateSearchQueries(
  criteria: TrialCriteria
): Promise<string[]> {
  const { object } = await generateObject({
    model: anthropic('claude-3-5-haiku-20241022'),
    schema: queriesSchema,
    prompt: `Generate exactly 3 search queries to find patients on crowdfunding platforms (GoFundMe, GiveSendGo, etc.) who match these clinical trial criteria:

${JSON.stringify(criteria, null, 2)}

Each query should:
- Target medical crowdfunding campaigns
- Include relevant condition names and synonyms
- Include location if specified
- Use variations like "patient", "help", "fundraiser", "medical bills", "treatment"
- Be natural search queries (not just keywords)

Return ONLY valid JSON matching this EXACT schema:
{
  "queries": ["query1", "query2", "query3"]
}

CRITICAL:
- Return ONLY the JSON object, NO explanatory text before or after
- Do NOT include phrases like "I'll generate..." or "Here are..."
- Start directly with { and end with }

Example valid response:
{"queries": ["male heart disease fundraiser California", "cardiovascular patient medical bills San Francisco", "cardiac surgery help Southern California", "heart patient crowdfunding Los Angeles"]}`,
  });

  return object.queries;
}
