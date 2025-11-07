import { generateObject } from 'ai';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';

const paperCriteriaSchema = z.object({
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

export type PaperCriteria = z.infer<typeof paperCriteriaSchema>;

interface ExtractPaperCriteriaOptions {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export async function extractPaperCriteria(
  options: ExtractPaperCriteriaOptions
): Promise<PaperCriteria> {
  const { text, imageBase64, imageMimeType } = options;

  if (!text && !imageBase64) {
    throw new Error('Either text or image must be provided');
  }

  // Build the prompt content
  let promptContent: any[] = [];

  // Add image if provided
  if (imageBase64 && imageMimeType) {
    promptContent.push({
      type: 'image',
      image: imageBase64,
      mimeType: imageMimeType,
    });
  }

  // Add text instruction
  const instructionText = `${text ? `Research paper content:\n\n"${text}"\n\n` : 'Analyze the provided research paper image/abstract.'}

RETURN ONLY VALID JSON. NO EXPLANATIONS. NO MARKDOWN. NO REASONING.

Extract the following patient eligibility criteria from this research paper abstract or methods section:

JSON schema:
{
  "age": { "min": <number>, "max": <number> },  // optional
  "gender": ["male" | "female" | "non-binary"],  // MUST be an ARRAY
  "conditions": ["condition1", "condition2"],     // array of medical conditions/diseases
  "location": "City, State" OR "State",           // MUST be a flat string
  "exclusions": ["exclusion1", "exclusion2"],     // array of exclusion criteria
  "priorityOrder": ["conditions", "gender", "age", "location"]  // order of importance
}

CRITICAL RULES:
1. PRIORITY ORDER: 
   - "conditions" (medical conditions/diseases) should ALWAYS be first in priorityOrder
   - Then list other criteria in order of importance based on the paper
   
2. CONDITIONS: 
   - Extract ALL medical conditions, diseases, or health issues mentioned in inclusion criteria
   - Be specific (e.g., "Type 2 Diabetes", "heart disease", "cancer")
   - Include stage/severity if mentioned (e.g., "Stage 3 chronic kidney disease")
   
3. AGE: 
   - Extract exact age range if specified
   - If only "adults" → {"min": 18}
   - If only "elderly" → {"min": 65}
   
4. GENDER: 
   - MUST be an array: ["male"] NOT "male"
   - Only include if explicitly restricted
   - If both genders allowed, omit this field
   
5. LOCATION: 
   - MUST be a string: "California" NOT {"state": "California"}
   - Extract city, state, or region if mentioned
   - If multi-center study, extract main location
   - IMPORTANT: If location is NOT mentioned in the paper, OMIT this field entirely. DO NOT use placeholder values like "UNKNOWN", "N/A", "<UNKNOWN>", etc.
   
6. EXCLUSIONS:
   - Extract any exclusion criteria mentioned
   - Include conditions, medications, or circumstances that disqualify patients

Examples:
✓ Good: {"conditions": ["Type 2 Diabetes"], "age": {"min": 18, "max": 75}, "gender": ["male", "female"], "location": "Boston, MA", "priorityOrder": ["conditions", "age", "gender", "location"]}
✗ Bad: {"gender": "male", "location": {"state": "California"}}

Common research paper phrases to look for:
- "Inclusion criteria:", "Eligible patients", "Study population"
- "Exclusion criteria:", "Patients were excluded if"
- "Participants aged", "Adults with", "Patients diagnosed with"
- "Conducted at", "Study location", "Multi-center trial"`;

  promptContent.push({
    type: 'text',
    text: instructionText,
  });

  try {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: paperCriteriaSchema,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(30000), // 30 second timeout
      messages: [
        {
          role: 'user',
          content: promptContent,
        },
      ],
    });

    // Clean up the extracted data
    // Filter out invalid location values
    if (object.location) {
      const cleanLocation = object.location.trim();
      const invalidValues = ['<unknown>', 'unknown', 'n/a', 'na', 'not specified', 'not mentioned', 'none'];
      if (invalidValues.includes(cleanLocation.toLowerCase()) || cleanLocation.startsWith('<') || cleanLocation.endsWith('>')) {
        object.location = undefined;
      }
    }

    // Ensure priorityOrder always has conditions first if conditions are present
    if (object.conditions && object.conditions.length > 0) {
      const otherPriorities = (object.priorityOrder || []).filter(
        (p) => p !== 'conditions'
      );
      object.priorityOrder = ['conditions', ...otherPriorities] as any;
    }

    return object;
  } catch (error: any) {
    console.error('Failed to extract criteria from research paper:', {
      error: error.message,
      statusCode: error.statusCode,
      responseBody: error.responseBody,
      cause: error.cause?.message,
    });

    throw new Error(
      `Failed to extract criteria from research paper: ${error.message}`
    );
  }
}

