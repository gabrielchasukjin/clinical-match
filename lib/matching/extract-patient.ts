import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

const patientSchema = z.object({
  name: z.string().optional(),
  age: z.number().optional(),
  gender: z.enum(['male', 'female', 'non-binary', 'unknown']).optional(),
  conditions: z.array(z.string()),
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
    // Limit content to avoid token limits
    const truncatedContent = campaignContent.slice(0, 3000);

    const { object } = await generateObject({
      model: anthropic('claude-3-5-sonnet-20241022'),
      schema: patientSchema,
      prompt: `Extract patient information from this crowdfunding campaign content:

"${truncatedContent}"

Extract:
- name (first name or alias only for privacy, e.g., "Sarah" or "Sarah M.")
- age (exact number if stated, or approximate if mentioned like "in her 50s" = 55)
- gender (if clearly stated: "male", "female", "non-binary", or "unknown")
- conditions (array of all medical conditions mentioned)
- location (city/state if mentioned, e.g., "Boston, MA" or "California")

IMPORTANT:
- Only include information that is EXPLICITLY stated in the content
- For conditions, include the specific medical terms used (e.g., "Type 2 Diabetes", "breast cancer", "heart disease")
- If something is not clear or not mentioned, use optional fields or "unknown"
- Be conservative - don't infer or guess

Return valid JSON only.`,
    });

    return {
      ...object,
      campaign_url: campaignUrl,
      raw_description: campaignContent.slice(0, 500),
    };
  } catch (error) {
    console.error('Failed to extract patient data:', error);
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
