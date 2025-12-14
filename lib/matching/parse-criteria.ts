import { generateObject } from 'ai';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';

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

RETURN ONLY VALID JSON. NO EXPLANATIONS. NO MARKDOWN. NO REASONING.

JSON schema:
{
  "age": { "min": <number>, "max": <number> },  // optional
  "gender": ["male" | "female" | "non-binary"],  // OPTIONAL, only when there is an explicit gender restriction
  "conditions": ["condition1", "condition2"],     // array of strings
  "location": "City, State" OR "State",           // MUST be a flat string, NOT an object
  "exclusions": ["exclusion1", "exclusion2"],     // array of strings
  "priorityOrder": ["conditions", "gender", "age", "location"]  // order of criteria importance based on input
}

IMPORTANT RULES:
- Only include fields that are explicitly mentioned as *restrictions*.
- GENDER:
  * If the text does NOT explicitly restrict gender (e.g. "women only", "male patients", "no men"),
    then DO NOT include a gender field at all.
  * Do NOT infer gender from disease, location, or typical population.
  * Do NOT default to ["male", "female", "non-binary"]. If there is no restriction, omit "gender".
- AGE:
  * Only fill "age" if there is an explicit age range or minimum/maximum.
- LOCATION:
  * location MUST be a string: "California" NOT {"state": "California"}.
- CONDITIONS:
  * Include the main disease/condition(s) explicitly mentioned.
- Be conservative and accurate.

PriorityOrder rules:
1. If medical conditions/diseases are mentioned, "conditions" MUST be first in the priority order.
2. After conditions (if present), list other criteria in the order they appear in the text.
3. Only include criteria that are explicitly mentioned.

Examples:
✓ {"gender": ["male"], "location": "California"}
✓ {"location": "California", "conditions": ["Type 2 Diabetes"]}
✗ {"gender": ["male", "female", "non-binary"]}   // INVALID unless the text literally says this list

Priority order examples:
- "diabetes patient in Boston" → priorityOrder: ["conditions", "location"]
- "female around 20 years old with heart disease" → priorityOrder: ["conditions", "gender", "age"]
- "female, over 50+ age, living in Austin" → priorityOrder: ["gender", "age", "location"]
- "patients in New York with cancer" → priorityOrder: ["conditions", "location"]`,
  });

  // ---- NORMALIZE GENDER: "all genders" = no restriction ----
  const normalized: TrialCriteria = { ...object };

  if (!normalized.gender || normalized.gender.length === 0) {
    // No explicit gender restriction
    delete normalized.gender;
  } else {
    const set = new Set(normalized.gender);
    const all = ['male', 'female', 'non-binary'] as const;
    const hasAll = all.every((g) => set.has(g));

    // If all three are present, treat it as no restriction
    if (hasAll) {
      delete normalized.gender;
    }
  }

  return normalized;
}
