import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

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
  priorityOrder: z
    .array(z.enum(['age', 'gender', 'conditions', 'location']))
    .optional(),
});

export type TrialCriteria = z.infer<typeof criteriaSchema>;

export async function parseCriteria(
  trialDescription: string,
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
- priorityOrder: array indicating the order in which criteria are mentioned in the input text (in order of appearance)

For priorityOrder - IMPORTANT RULES:
1. If medical conditions/diseases are mentioned, "conditions" MUST be first in the priority order
2. After conditions (if present), list other criteria in the order they appear in the text
3. Only include criteria that are explicitly mentioned

Examples:
- "diabetes patient in Boston" → ["conditions", "location"] (condition always first)
- "female around 20 years old with heart disease" → ["conditions", "gender", "age", "location"] (condition first, then order of mention)
- "female, over 50+ age, living in Austin" → ["gender", "age", "location"] (no condition mentioned, so order of appearance)
- "patients in New York with cancer" → ["conditions", "location"] (condition first even if mentioned later)

Only include fields that are explicitly mentioned. Be conservative and accurate.`,
  });

  return object;
}
