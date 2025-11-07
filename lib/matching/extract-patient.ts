import { generateObject } from 'ai';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';

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

    // Limit content to avoid token limits - only truncate if absolutely necessary
    // Most GoFundMe campaigns are 5,000-15,000 chars, we can handle up to ~20,000
    const contentLength = campaignContent.length;
    let truncatedContent: string;
    if (contentLength <= 20000) {
      // Use full content for most campaigns
      truncatedContent = campaignContent;
    } else {
      // Only truncate very long campaigns
      // Take first 12000 chars (main content + full story) + last 3000 chars (organizer section)
      truncatedContent = `${campaignContent.slice(0, 12000)}\n...\n${campaignContent.slice(-3000)}`;
    }

    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
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
- conditions: Extract ALL medical conditions mentioned ANYWHERE in the text
  * Include PAST medical history (e.g., "had kidney cancer in 2018", "cancer in 2020")
  * Include CURRENT conditions (e.g., "battling heart disease", "diagnosed with diabetes")
  * Include COMPLICATIONS and related issues (e.g., "became paralyzed", "heart issues after covid", "spinal condition")
  * Include SPECIFIC disease names and types (e.g., "Merkel Cell Carcinoma", "Type 2 Diabetes", not just "cancer" or "diabetes")
  * Look for hospital/treatment mentions (e.g., "Moffitt Cancer Center" = cancer, "radiation" = cancer treatment)
  * Include chronic conditions (e.g., "rheumatoid arthritis", "kidney disease")
  * Extract both medical terms AND casual descriptions
  * Examples: "kidney cancer", "Merkel Cell Carcinoma", "rheumatoid arthritis", "paralyzed", "heart issues", "COVID-19"
- location: flat string like "Boston, MA" or "California"

CRITICAL EXTRACTION RULES:
- Return ONLY the JSON object, NO explanatory text
- For CONDITIONS: Be VERY generous - extract EVERY medical condition, past or present, mentioned ANYWHERE in the campaign
- For CONDITIONS: Read the ENTIRE story carefully - medical history is often detailed in paragraphs
- For CONDITIONS: Include the specific type of condition when mentioned (e.g., "Stage 4 lung cancer" not just "cancer")
- For organizerName: Check the end of content for organizer section
- For other fields: Only extract what is clearly stated
- GoFundMe campaigns often use casual language - extract those too
- If you see phrases like "fighting", "battling", "diagnosed with", "suffering from", "received diagnosis of" - extract the condition
- Look for timeline references like "in 2018", "after covid", "April of 2022" - these indicate multiple conditions

Examples:
✓ "battling cancer" → ["cancer"]
✓ "heart problems" → ["heart disease"]
✓ "diagnosed with Type 2 Diabetes" → ["Type 2 Diabetes"]
✓ "kidney failure treatment" → ["kidney failure"]
✓ "had kidney cancer in 2018...rheumatoid arthritis...heart issues...Merkel Cell Carcinoma...became paralyzed" → ["kidney cancer", "rheumatoid arthritis", "heart issues", "Merkel Cell Carcinoma", "paralyzed"]

Example output with multiple conditions: {"name": "Calvin", "organizerName": "Deserray Walters", "age": null, "gender": "male", "conditions": ["kidney cancer", "rheumatoid arthritis", "COVID-19", "heart issues", "Merkel Cell Carcinoma", "paralyzed"], "location": "Panama City, FL"}`,
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
