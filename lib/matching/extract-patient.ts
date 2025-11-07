import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

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
    if (contentLength <= 3000) {
      truncatedContent = campaignContent;
    } else {
      // Take first 2000 chars (main content) + last 1000 chars (organizer section)
      truncatedContent = `${campaignContent.slice(0, 2000)}\n...\n${campaignContent.slice(-1000)}`;
    }

    const { object } = await generateObject({
      model: anthropic('claude-3-5-haiku-20241022'),
      schema: patientSchema,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(15000), // 15 second timeout for complex extraction
      prompt: `Extract patient information from this crowdfunding campaign:

"${truncatedContent}"

Extract these fields:
- name: patient's first name (if mentioned)
- organizerName: if you see "Organizer:", "Created by", or "Fundraiser" followed by a name, extract it
- age: number only if clearly stated
- gender: "male", "female", "non-binary", or "unknown"
- conditions: **IMPORTANT** - Extract ALL medical conditions, diseases, or health issues mentioned. Look for terms like: heart disease, diabetes, cancer, stroke, surgery needed, organ failure, etc. Return as array (e.g., ["heart disease"], ["Type 2 Diabetes", "High Blood Pressure"])
- location: city/state if mentioned

RULES:
1. **ALWAYS extract conditions** - this is the most important field
2. If you find any health-related words, include them in conditions
3. Default gender to "unknown" if not stated
4. All fields except conditions are optional

Return JSON with the fields you found.`,
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
