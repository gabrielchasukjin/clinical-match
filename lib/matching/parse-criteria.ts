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
  priorityOrder: z
    .array(z.enum(['age', 'gender', 'conditions', 'location']))
    .optional(),
});

export type TrialCriteria = z.infer<typeof criteriaSchema>;

export async function parseCriteria(
  trialDescription: string,
): Promise<TrialCriteria> {
  const BEDROCK_MODEL_ID =
    process.env.BEDROCK_MODEL_ID ||
    'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

  const { object } = await generateObject({
    model: bedrock(BEDROCK_MODEL_ID),
    schema: criteriaSchema,
    prompt: `Extract clinical trial eligibility criteria from this description:

"${trialDescription}"

RETURN ONLY VALID JSON. NO EXPLANATIONS. NO MARKDOWN. NO REASONING.

JSON schema:
{
  "age": { "min": <number>, "max": <number> },  // optional
  "gender": ["male" | "female" | "non-binary"],  // MUST be an ARRAY, e.g., ["male"] or ["female", "male"]
  "conditions": ["condition1", "condition2"],     // array of strings
  "location": "City, State" OR "State",           // MUST be a flat string, NOT an object
  "exclusions": ["exclusion1", "exclusion2"],     // array of strings
  "priorityOrder": ["conditions", "gender", "age", "location"]  // order of criteria importance based on input
}

IMPORTANT RULES:
- gender MUST be an array: ["male"] NOT "male"
- location MUST be a string: "California" NOT {"state": "California"}
- Only include fields that are explicitly mentioned
- Be conservative and accurate

For priorityOrder - CRITICAL:
1. If medical conditions/diseases are mentioned, "conditions" MUST be first in the priority order
2. After conditions (if present), list other criteria in the order they appear in the text
3. Only include criteria that are explicitly mentioned
4. This determines matching weight distribution

Examples:
✓ {"gender": ["male"], "location": "California"}
✗ {"gender": "male", "location": {"state": "California"}}

Priority order examples:
- "diabetes patient in Boston" → priorityOrder: ["conditions", "location"]
- "female around 20 years old with heart disease" → priorityOrder: ["conditions", "gender", "age"]
- "female, over 50+ age, living in Austin" → priorityOrder: ["gender", "age", "location"]
- "patients in New York with cancer" → priorityOrder: ["conditions", "location"]`,
  });

  return object;
}
