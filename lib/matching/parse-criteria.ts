import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

const criteriaSchema = z.object({
  age: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  gender: z.array(z.enum(['male', 'female', 'non-binary'])).optional(),
  conditions: z.array(z.string()).optional(),
  location: z.string().optional(),
  exclusions: z.array(z.string()).optional(),
});

export type TrialCriteria = z.infer<typeof criteriaSchema>;

export async function parseCriteria(
  trialDescription: string
): Promise<TrialCriteria> {
  const { object } = await generateObject({
    model: anthropic('claude-3-5-haiku-20241022'),
    schema: criteriaSchema,
    prompt: `Extract clinical trial eligibility criteria from this description:

"${trialDescription}"

Return structured JSON with:
- age range (min/max)
- gender requirements
- medical conditions
- location preferences
- exclusion criteria

Only include fields that are explicitly mentioned. Be conservative and accurate.`,
  });

  return object;
}
