import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { parseCriteria } from '@/lib/matching/parse-criteria';
import { generateSearchQueries } from '@/lib/matching/generate-queries';
import { extractPatientData } from '@/lib/matching/extract-patient';
import { calculateMatch } from '@/lib/matching/calculate-match';
import { tavily, CROWDFUNDING_DOMAINS } from '@/lib/tavily/client';

export const maxDuration = 60; // Can take up to 60 seconds

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { trialDescription } = await request.json();

    if (!trialDescription || typeof trialDescription !== 'string') {
      return NextResponse.json(
        { error: 'Trial description is required' },
        { status: 400 }
      );
    }

    console.log('=== Starting trial search ===');
    console.log('Input:', trialDescription);

    // Step 1: Parse criteria with LLM
    console.log('[Step 1/5] Parsing criteria...');
    const criteria = await parseCriteria(trialDescription);
    console.log('Parsed criteria:', JSON.stringify(criteria, null, 2));

    // Step 2: Generate search queries
    console.log('[Step 2/5] Generating search queries...');
    const searchQueries = await generateSearchQueries(criteria);
    console.log('Generated queries:', searchQueries);

    // Step 3: Execute Tavily searches in parallel
    console.log('[Step 3/5] Searching with Tavily...');
    const searchPromises = searchQueries.map((query) =>
      tavily
        .search({
          query,
          searchDepth: 'advanced',
          maxResults: 10,
          includeDomains: CROWDFUNDING_DOMAINS,
          includeRawContent: true,
        })
        .catch((error) => {
          console.error(`Search failed for query "${query}":`, error);
          return { results: [] };
        })
    );

    const searchResults = await Promise.all(searchPromises);
    const allResults = searchResults.flatMap((result) => result.results || []);

    // Deduplicate by URL
    const uniqueResults = Array.from(
      new Map(allResults.map((r) => [r.url, r])).values()
    );

    console.log(`Found ${uniqueResults.length} unique campaigns`);

    if (uniqueResults.length === 0) {
      return NextResponse.json({
        parsedCriteria: criteria,
        searchQueries,
        totalResults: 0,
        matches: [],
        message:
          'No crowdfunding campaigns found. Try broadening your search criteria or different condition names.',
      });
    }

    // Step 4: Extract patient data from each result (limit to 20 for performance)
    console.log('[Step 4/5] Extracting patient data...');
    const resultsToProcess = uniqueResults.slice(0, 20);
    const patientPromises = resultsToProcess.map((result) =>
      extractPatientData(result.content || result.rawContent || '', result.url)
    );

    const patients = await Promise.all(patientPromises);
    console.log(`Extracted data for ${patients.length} patients`);

    // Step 5: Calculate match scores
    console.log('[Step 5/5] Calculating match scores...');
    const matches = patients
      .map((patient) => {
        const match = calculateMatch(patient, criteria);
        return {
          patient,
          matchScore: match.score,
          criteriaBreakdown: match.breakdown,
        };
      })
      .filter((m) => m.matchScore > 0) // Filter out 0% matches
      .sort((a, b) => b.matchScore - a.matchScore); // Sort by score descending

    console.log(`Found ${matches.length} matches with score > 0`);
    console.log('=== Search complete ===');

    return NextResponse.json({
      parsedCriteria: criteria,
      searchQueries,
      totalResults: uniqueResults.length,
      matches,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Search failed',
        details: error.stack || 'No details available',
      },
      { status: 500 }
    );
  }
}
