import { NextRequest } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { parseCriteria } from '@/lib/matching/parse-criteria';
import { generateSearchQueries } from '@/lib/matching/generate-queries';
import { extractPatientData } from '@/lib/matching/extract-patient';
import { calculateMatch } from '@/lib/matching/calculate-match';
import { tavily, CROWDFUNDING_DOMAINS } from '@/lib/tavily/client';
import { db } from '@/lib/db';
import { trialSearchSession, trialSearchResult } from '@/lib/db/schema';

export const maxDuration = 60; // Can take up to 60 seconds

// Helper to send streaming updates
function sendUpdate(encoder: TextEncoder, controller: ReadableStreamDefaultController, data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(message));
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { trialDescription } = await request.json();

  if (!trialDescription || typeof trialDescription !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Trial description is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  console.log('=== Starting trial search ===');
  console.log('Input:', trialDescription);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Parse criteria
        sendUpdate(encoder, controller, {
          type: 'status',
          step: 1,
          message: 'Parsing criteria with AI...',
        });

        console.log('[Step 1/6] Parsing criteria...');
        const criteria = await parseCriteria(trialDescription);
        console.log('Parsed criteria:', JSON.stringify(criteria, null, 2));

        sendUpdate(encoder, controller, {
          type: 'criteria',
          data: criteria,
        });

        // Step 2: Generate search queries
        sendUpdate(encoder, controller, {
          type: 'status',
          step: 2,
          message: 'Generating search queries...',
        });

        console.log('[Step 2/6] Generating search queries...');
        const searchQueries = await generateSearchQueries(criteria);
        console.log('Generated queries:', searchQueries);

        sendUpdate(encoder, controller, {
          type: 'queries',
          data: searchQueries,
        });

        // Step 3: Search Tavily
        sendUpdate(encoder, controller, {
          type: 'status',
          step: 3,
          message: `Searching crowdfunding platforms...`,
        });

        console.log('[Step 3/6] Searching with Tavily...');
        const searchPromises = searchQueries.map((query) =>
          tavily
            .search(
              `${query} (gofundme OR fundly OR justgiving OR fundrazr OR givesendgo OR plumfund OR givebutter) medical fundraiser`,
              {
                searchDepth: 'advanced',
                maxResults: 10,
                includeRawContent: 'text',
              }
            )
            .catch((error) => {
              console.error(`Search failed for query "${query}":`, error);
              return { results: [] };
            })
        );

        const searchResults = await Promise.all(searchPromises);
        const allResults = searchResults.flatMap((result) => result.results || []);
        const uniqueResults = Array.from(
          new Map(allResults.map((r) => [r.url, r])).values()
        );

        const crowdfundingCampaigns = uniqueResults.filter((result) => {
          const url = result.url.toLowerCase();
          return CROWDFUNDING_DOMAINS.some((domain) => url.includes(domain));
        });

        const excludePatterns = [
          '/c/start/', '/c/blog/', '/c/questions', '/c/about', '/search', '/discover',
          '/help', '/support', '/contact', '/terms', '/privacy', '/pricing',
          '/signin', '/signup', '/login', '/register', '/sitemaps/', 'sitemap',
          '.xml', '/en-gb', '/en-au', '/en-ca', '/en-ie',
          'facebook.com/share', 'facebook.com/groups', 'facebook.com/pages',
        ];

        const isCampaignUrl = (url: string): boolean => {
          const urlLower = url.toLowerCase();
          if (urlLower.includes('gofundme.com') && urlLower.includes('/f/')) return true;
          if (urlLower.includes('fundly.com') && (urlLower.includes('/campaign/') || urlLower.includes('/fundraiser/'))) return true;
          if (urlLower.includes('justgiving.com') && urlLower.includes('/fundraising/')) return true;
          if (urlLower.includes('fundrazr.com') && urlLower.includes('/campaign')) return true;
          if (urlLower.includes('givesendgo.com') && (urlLower.includes('/campaign/') || urlLower.includes('/gsg/'))) return true;
          if (urlLower.includes('plumfund.com') && urlLower.includes('/plum/')) return true;
          if (urlLower.includes('givebutter.com') && urlLower.match(/\/[a-z0-9-]+$/)) return true;
          if (urlLower.includes('facebook.com') && urlLower.includes('/donate/')) return true;
          if ((urlLower.includes('mightycause.com') || urlLower.includes('spotfund.com') || urlLower.includes('gogetfunding.com') || urlLower.includes('donorbox.org') || urlLower.includes('paypal.com')) && !excludePatterns.some((pattern) => urlLower.includes(pattern))) return true;
          return false;
        };

        const likelyCampaigns = crowdfundingCampaigns.filter((result) => {
          const url = result.url.toLowerCase();
          return isCampaignUrl(url) && !excludePatterns.some((pattern) => url.includes(pattern.toLowerCase()));
        });

        console.log(`Found ${likelyCampaigns.length} valid campaign pages`);

        sendUpdate(encoder, controller, {
          type: 'campaigns_found',
          count: likelyCampaigns.length,
        });

        if (likelyCampaigns.length === 0) {
          sendUpdate(encoder, controller, {
            type: 'complete',
            data: {
              parsedCriteria: criteria,
              searchQueries,
              totalResults: 0,
              matches: [],
              message: 'No crowdfunding campaigns found. Try broadening your search criteria.',
            },
          });
          controller.close();
          return;
        }

        // Step 4: Extract patient data
        const campaignsToProcess = likelyCampaigns.slice(0, 15);
        const extractedContents = campaignsToProcess.map((result) => ({
          url: result.url,
          content: result.rawContent || result.content || '',
        }));

        sendUpdate(encoder, controller, {
          type: 'status',
          step: 4,
          message: `Extracting patient data from ${extractedContents.length} campaigns...`,
        });

        console.log('[Step 4/6] Extracting patient data with AI (parallel processing)...');

        // Process all extractions in parallel using Anthropic API
        const extractionPromises = extractedContents.map(async (item, i) => {
          console.log(`Starting extraction ${i + 1}/${extractedContents.length}: ${item.url.split('/').pop()}...`);

          const patientData = await extractPatientData(item.content, item.url);

          console.log(`Completed extraction ${i + 1}/${extractedContents.length}`);

          // Send the extracted patient data immediately
          const match = calculateMatch(patientData, criteria);
          sendUpdate(encoder, controller, {
            type: 'patient_extracted',
            data: {
              patient: patientData,
              matchScore: match.score,
              criteriaBreakdown: match.breakdown,
            },
          });

          return patientData;
        });

        const patients = await Promise.all(extractionPromises);

        console.log(`Extracted data for ${patients.length} patients`);

        // Step 5: Calculate matches
        sendUpdate(encoder, controller, {
          type: 'status',
          step: 5,
          message: 'Calculating match scores...',
        });

        console.log('[Step 5/6] Calculating match scores...');
        let dynamicWeights: { age: number; gender: number; conditions: number; location: number } | undefined;
        const matches = patients
          .map((patient) => {
            const match = calculateMatch(patient, criteria);
            if (!dynamicWeights) {
              dynamicWeights = match.weights;
            }
            return {
              patient,
              matchScore: match.score,
              criteriaBreakdown: match.breakdown,
            };
          })
          .sort((a, b) => b.matchScore - a.matchScore);

        console.log('=== Search complete ===');
        console.log(`Total matches: ${matches.length}`);

        // Save search session and results to database
        try {
          sendUpdate(encoder, controller, {
            type: 'status',
            step: 6,
            message: 'Saving results to database...',
          });

          console.log('[Step 6/6] Saving to database...');

          // Insert search session
          // Transform criteria to match database schema (convert null to undefined)
          const dbCriteria = {
            age: criteria.age ? {
              min: criteria.age.min ?? undefined,
              max: criteria.age.max ?? undefined,
            } : undefined,
            gender: criteria.gender,
            conditions: criteria.conditions,
            location: criteria.location,
          };

          const [searchSession] = await db
            .insert(trialSearchSession)
            .values({
              user_id: session.user.id!,
              search_query: trialDescription,
              parsed_criteria: dbCriteria,
              search_queries: searchQueries,
              total_results: likelyCampaigns.length,
              match_count: matches.length,
            })
            .returning();

          console.log(`Created search session: ${searchSession.id}`);

          // Insert all match results
          if (matches.length > 0) {
            const matchRecords = matches.map((match) => ({
              session_id: searchSession.id,
              patient_name: match.patient.name || null,
              organizer_name: match.patient.organizerName || null,
              patient_age: match.patient.age || null,
              patient_gender: match.patient.gender || null,
              patient_conditions: match.patient.conditions || [],
              patient_location: match.patient.location || null,
              campaign_url: match.patient.campaign_url,
              match_score: match.matchScore,
              criteria_breakdown: match.criteriaBreakdown,
            }));

            await db.insert(trialSearchResult).values(matchRecords);
            console.log(`Saved ${matchRecords.length} match results`);
          }
        } catch (dbError: any) {
          console.error('Failed to save to database:', dbError);
          // Don't fail the entire request if DB save fails
        }

        // Send final results
        sendUpdate(encoder, controller, {
          type: 'complete',
          data: {
            parsedCriteria: criteria,
            searchQueries,
            totalResults: likelyCampaigns.length,
            dynamicWeights,
            matches,
          },
        });

        controller.close();
      } catch (error: any) {
        console.error('Search error:', error);
        sendUpdate(encoder, controller, {
          type: 'error',
          message: error.message || 'Search failed',
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
