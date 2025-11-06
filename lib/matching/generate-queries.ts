import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
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
    prompt: `Generate 4-6 search queries to find patients on crowdfunding platforms (GoFundMe, GiveSendGo, etc.) who match these clinical trial criteria:

${JSON.stringify(criteria, null, 2)}

Each query should:
- Target medical crowdfunding campaigns
- Include relevant condition names and synonyms
- Include location if specified
- Use variations like "patient", "help", "fundraiser", "medical bills", "treatment"
- Be natural search queries (not just keywords)

Examples:
- "diabetes patient help medical bills Boston"
- "woman type 2 diabetes crowdfunding Massachusetts"
- "female diabetes fundraiser Boston area"

Return array of 4-6 diverse search query strings that would find matching patients.`,
  });

  return object.queries;
}
