import { generateObject } from 'ai';
import { z } from 'zod';
import { bedrock } from '@/lib/ai/bedrock';

const patientSchema = z.object({
  name: z.string().nullish(),
  organizerName: z.string().nullish(),
  age: z.number().nullish(),
  gender: z.enum(['male', 'female', 'non-binary', 'unknown']).nullish(),
  conditions: z.array(z.string()).nullish(),
  location: z.string().nullish(),
});

export type PatientData = z.infer<typeof patientSchema> & {
  campaign_url: string;
  raw_description: string;
};

export async function extractPatientData(
  campaignContent: string,
  campaignUrl: string,
): Promise<PatientData> {
  try {
    // Skip if content is empty or too short
    if (!campaignContent || campaignContent.trim().length < 50) {
      console.log(
        `Skipping extraction for ${campaignUrl} - content too short (${campaignContent?.length || 0} chars)`,
      );
      return {
        name: undefined,
        organizerName: undefined,
        age: undefined,
        gender: 'unknown',
        conditions: [],
        campaign_url: campaignUrl,
        raw_description: campaignContent?.slice(0, 500) || '',
      };
    }

    // Limit content to avoid token limits
    // Take content from both start and end to capture organizer info
    const contentLength = campaignContent.length;
    let truncatedContent: string;
    if (contentLength <= 4000) {
      truncatedContent = campaignContent;
    } else {
      // Take first 3000 chars (main content) + last 1000 chars (organizer section)
      truncatedContent = `${campaignContent.slice(0, 3000)}\n...\n${campaignContent.slice(-1000)}`;
    }

    const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

    const { object } = await generateObject({
      model: bedrock(BEDROCK_MODEL_ID),
      schema: patientSchema,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(15000), // 15 second timeout for complex extraction
      prompt: `Extract patient and campaign organizer information from this crowdfunding campaign:

"${truncatedContent}"

Extract and return ONLY valid JSON matching this schema:
{
  "name": "string or omit",
  "organizerName": "string or omit",
  "age": number or null,
  "gender": "male" | "female" | "non-binary" | "unknown",
  "conditions": ["condition1", "condition2"],
  "location": "City, State" or omit
}

Field requirements:
- name: patient's first name or alias if mentioned (e.g., "Sarah" or "Sarah M.")
- organizerName: IMPORTANT - Look for "Organizer:", "Created by", "Fundraiser" section. This is the person who created the campaign. Usually at the bottom of the page.
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
- For organizerName: Check the end of content for organizer section
- For other fields: Only extract what is clearly stated
- GoFundMe campaigns often use casual language - extract those too
- If you see phrases like "fighting", "battling", "diagnosed with", "suffering from" - extract the condition

Examples:
✓ "battling cancer" → ["cancer"]
✓ "heart problems" → ["heart disease"]
✓ "diagnosed with Type 2 Diabetes" → ["Type 2 Diabetes"]
✓ "kidney failure treatment" → ["kidney failure"]

Example output: {"name": "John", "organizerName": "Mary Smith", "age": 45, "gender": "male", "conditions": ["heart disease"], "location": "California"}`,
    });

    // Normalize the extracted data - filter out invalid values
    const cleanName =
      object.name &&
      object.name.toLowerCase() !== 'null' &&
      object.name.toLowerCase() !== 'unknown'
        ? object.name
        : undefined;

    const cleanOrganizerName =
      object.organizerName &&
      object.organizerName.toLowerCase() !== 'null' &&
      object.organizerName.toLowerCase() !== 'unknown'
        ? object.organizerName
        : undefined;

    const cleanLocation =
      object.location &&
      object.location.toLowerCase() !== 'null' &&
      object.location.toLowerCase() !== 'unknown' &&
      object.location !== '<UNKNOWN>'
        ? object.location
        : undefined;

    const cleanGender =
      object.gender && object.gender.toLowerCase() !== 'null'
        ? object.gender
        : 'unknown';

    const cleanConditions =
      object.conditions && Array.isArray(object.conditions)
        ? object.conditions.filter(
            (c) =>
              c && c.toLowerCase() !== 'null' && c.toLowerCase() !== 'unknown',
          )
        : [];

    return {
      name: cleanName,
      organizerName: cleanOrganizerName,
      age: object.age || undefined,
      gender: cleanGender,
      conditions: cleanConditions,
      location: cleanLocation,
      campaign_url: campaignUrl,
      raw_description: campaignContent.slice(0, 500),
    };
  } catch (error: any) {
    console.error(`Failed to extract patient data from ${campaignUrl}:`, {
      error: error.message,
      statusCode: error.statusCode,
      responseBody: error.responseBody,
      cause: error.cause?.message,
    });

    // Log the actual response if available for debugging
    if (error.text) {
      console.log('AI Response text:', error.text.substring(0, 500));
    }

    // Return minimal data if extraction fails
    return {
      name: undefined,
      organizerName: undefined,
      age: undefined,
      gender: 'unknown',
      conditions: [],
      campaign_url: campaignUrl,
      raw_description: campaignContent.slice(0, 500),
    };
  }
}
