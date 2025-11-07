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
    const truncatedContent = campaignContent.slice(0, 4000); // Increased to capture more content

    const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

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
- conditions: array of medical conditions or health issues mentioned
  * Include both medical terms AND casual descriptions
  * Examples: "cancer", "battling cancer", "heart disease", "heart problems", "diabetes", "kidney failure", "stroke"
  * Include ANY health-related reason for fundraising
- location: flat string like "Boston, MA" or "California"

CRITICAL EXTRACTION RULES:
- Return ONLY the JSON object, NO explanatory text
- For CONDITIONS: Be generous - extract ANY medical or health-related terms mentioned
- For other fields: Only extract what is clearly stated
- GoFundMe campaigns often use casual language - extract those too
- If you see phrases like "fighting", "battling", "diagnosed with", "suffering from" - extract the condition

Examples:
✓ "battling cancer" → ["cancer"]
✓ "heart problems" → ["heart disease"]
✓ "diagnosed with Type 2 Diabetes" → ["Type 2 Diabetes"]
✓ "kidney failure treatment" → ["kidney failure"]

Example output: {"name": "John", "age": 45, "gender": "male", "conditions": ["heart disease"], "location": "California"}`,
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
