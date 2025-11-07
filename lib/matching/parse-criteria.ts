import { generateObject } from 'ai';
import { z } from 'zod';
import { bedrock } from '@/lib/ai/bedrock';

const criteriaSchema = z.object({
  age: z
    .object({
      min: z.number().nullish(),
      max: z.number().nullish(),
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
  const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

  const { object } = await generateObject({
    model: bedrock(BEDROCK_MODEL_ID),
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
