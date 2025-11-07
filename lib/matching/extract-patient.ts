import { generateObject } from 'ai';
import { z } from 'zod';
import { bedrock } from '@/lib/ai/bedrock';

const patientSchema = z.object({
  name: z.string().optional(),
  age: z.number().nullish(),
  gender: z.enum(['male', 'female', 'non-binary', 'unknown']).optional(),
  conditions: z.array(z.string()).default([]),
  location: z.string().optional(),
});

export type PatientData = z.infer<typeof patientSchema> & {
  campaign_url: string;
  raw_description: string;
};

export async function extractPatientData(
  campaignContent: string,
  campaignUrl: string
): Promise<PatientData> {
  try {
    // Skip if content is empty or too short
    if (!campaignContent || campaignContent.trim().length < 100) {
      console.log(`Skipping extraction for ${campaignUrl} - content too short (${campaignContent?.length || 0} chars)`);
      return {
        name: 'Unknown',
        gender: 'unknown',
        conditions: [],
        campaign_url: campaignUrl,
        raw_description: campaignContent?.slice(0, 500) || '',
      };
    }

    // Limit content to avoid token limits
    const truncatedContent = campaignContent.slice(0, 2000); // Reduced from 3000

    const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

    const { object } = await generateObject({
      model: bedrock(BEDROCK_MODEL_ID),
      schema: patientSchema,
      maxRetries: 1, // Reduce retries for faster failure
      abortSignal: AbortSignal.timeout(10000), // 10 second timeout
      prompt: `Extract patient information from this crowdfunding campaign content:

"${truncatedContent}"

Extract and return ONLY valid JSON matching this schema:
{
  "name": "string or omit",
  "age": number or null,
  "gender": "male" | "female" | "non-binary" | "unknown",
  "conditions": ["condition1", "condition2"],
  "location": "City, State" or omit
}

Field requirements:
- name: first name or alias only (e.g., "Sarah" or "Sarah M.")
- age: exact number if stated, approximate if mentioned (e.g., "in her 50s" = 55)
- gender: MUST be one of: "male", "female", "non-binary", or "unknown"
- conditions: array of medical conditions mentioned
- location: flat string like "Boston, MA" or "California"

CRITICAL:
- Return ONLY the JSON object, NO explanatory text
- Only include information EXPLICITLY stated in content
- Be conservative - don't infer or guess
- If unclear, use "unknown" or omit the field

Example: {"name": "John", "age": 45, "gender": "male", "conditions": ["heart disease"], "location": "California"}`,
    });

    return {
      ...object,
      campaign_url: campaignUrl,
      raw_description: campaignContent.slice(0, 500),
    };
  } catch (error: any) {
    console.error(`Failed to extract patient data from ${campaignUrl}:`, {
      error: error.message,
      statusCode: error.statusCode,
      responseBody: error.responseBody,
    });
    // Return minimal data if extraction fails
    return {
      name: 'Unknown',
      gender: 'unknown',
      conditions: [],
      campaign_url: campaignUrl,
      raw_description: campaignContent.slice(0, 500),
    };
  }
}
