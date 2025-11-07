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
        { status: 400 },
      );
    }

    console.log('=== Starting trial search ===');
    console.log('Input:', trialDescription);

    // Step 1: Parse criteria with LLM
    console.log('[Step 1/6] Parsing criteria...');
    const criteria = await parseCriteria(trialDescription);
    console.log('Parsed criteria:', JSON.stringify(criteria, null, 2));

    // Step 2: Generate search queries
    console.log('[Step 2/6] Generating search queries...');
    const searchQueries = await generateSearchQueries(criteria);
    console.log('Generated queries:', searchQueries);

    // Step 3: Execute Tavily searches in parallel (GoFundMe only)
    console.log('[Step 3/6] Searching with Tavily...');
    const searchPromises = searchQueries.map((query) =>
      tavily
        .search(`${query} site:gofundme.com`, {
          searchDepth: 'advanced',
          maxResults: 10,
          includeRawContent: 'text',
        })
        .catch((error) => {
          console.error(`Search failed for query "${query}":`, error);
          return { results: [] };
        }),
    );

    const searchResults = await Promise.all(searchPromises);
    const allResults = searchResults.flatMap((result) => result.results || []);

    // Deduplicate by URL
    const uniqueResults = Array.from(
      new Map(allResults.map((r) => [r.url, r])).values(),
    );

    // Filter for GoFundMe campaigns only
    const gofundmeCampaigns = uniqueResults.filter((result) =>
      result.url.toLowerCase().includes('gofundme.com'),
    );

    // Filter out non-campaign pages (info pages, blogs, FAQs, sitemaps, etc.)
    const excludePatterns = [
      '/c/start/',
      '/c/blog/',
      '/c/questions',
      '/c/about',
      '/search',
      '/discover',
      '/help',
      '/support',
      '/contact',
      '/terms',
      '/privacy',
      '/pricing',
      '/signin',
      '/signup',
      '/login',
      '/register',
      '/sitemaps/',
      'sitemap',
      '.xml',
      '/en-gb',
      '/en-au',
      '/en-ca',
      '/en-ie',
    ];

    const likelyCampaigns = gofundmeCampaigns.filter((result) => {
      const url = result.url.toLowerCase();
      // Must include /f/ (campaign pattern) and exclude problematic patterns
      return (
        url.includes('/f/') &&
        !excludePatterns.some((pattern) => url.includes(pattern.toLowerCase()))
      );
    });

    console.log(`Found ${uniqueResults.length} unique results`);
    console.log(`Filtered to ${gofundmeCampaigns.length} GoFundMe campaigns`);
    console.log(`Final count: ${likelyCampaigns.length} valid campaign pages`);

    if (likelyCampaigns.length === 0) {
      return NextResponse.json({
        parsedCriteria: criteria,
        searchQueries,
        totalResults: 0,
        matches: [],
        message:
          'No GoFundMe campaigns found. Try broadening your search criteria or using different condition names.',
      });
    }

    // Step 4: Extract clean content from URLs using Tavily Extract
    console.log('[Step 4/6] Extracting content from campaign URLs...');
    const urlsToProcess = likelyCampaigns.slice(0, 15).map((r) => r.url);

    // Use Tavily Extract to get clean content from URLs
    let extractedContents: Array<{ url: string; content: string }> = [];
    try {
      const extractResponse = await tavily.extract(urlsToProcess, {
        format: 'markdown',
        extract_depth: 'advanced', // Use advanced for more complete extraction
        timeout: 30, // 30 second timeout per URL
      });

      extractedContents = extractResponse.results.map((result: any) => ({
        url: result.url,
        content: result.raw_content || '',
      }));

      console.log(
        `Successfully extracted content from ${extractedContents.length} URLs`,
      );

      // Log content lengths for debugging
      const contentLengths = extractedContents.map((c) => ({
        url: c.url.split('/').pop(),
        length: c.content.length,
      }));
      console.log('Content lengths:', contentLengths);
    } catch (error) {
      console.error(
        'Tavily Extract failed, falling back to search content:',
        error,
      );
      // Fallback to original search content
      extractedContents = likelyCampaigns.slice(0, 15).map((result) => ({
        url: result.url,
        content: result.content || result.rawContent || '',
      }));
    }

    // Step 5: Extract patient data from content
    console.log('[Step 5/6] Extracting patient data with AI...');
    const batchSize = 5;
    const patients = [];

    for (let i = 0; i < extractedContents.length; i += batchSize) {
      const batch = extractedContents.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(extractedContents.length / batchSize)}...`,
      );

      const batchPromises = batch.map((item) =>
        extractPatientData(item.content, item.url),
      );

      const batchResults = await Promise.all(batchPromises);
      patients.push(...batchResults);
    }

    console.log(`Extracted data for ${patients.length} patients`);

    // Debug: Log how many patients have conditions
    const patientsWithConditions = patients.filter(
      (p) => p.conditions && p.conditions.length > 0
    );
    console.log(`Patients with conditions: ${patientsWithConditions.length}/${patients.length}`);

    // Debug: Show sample of extracted data
    if (patients.length > 0) {
      console.log('Sample patient data:', {
        name: patients[0].name,
        age: patients[0].age,
        gender: patients[0].gender,
        conditions: patients[0].conditions,
        location: patients[0].location,
        hasContent: patients[0].raw_description?.length > 0,
      });
    }

    // Step 6: Calculate match scores
    console.log('[Step 6/6] Calculating match scores...');
    const matches = patients
      .filter((patient) => patient.conditions && patient.conditions.length > 0) // Only patients with conditions
      .map((patient) => {
        const match = calculateMatch(patient, criteria);
        return {
          patient,
          matchScore: match.score,
          criteriaBreakdown: match.breakdown,
        };
      })
      .filter((match) => match.matchScore > 0) // Only matches with some score
      .sort((a, b) => b.matchScore - a.matchScore); // Sort by score descending

    console.log(`Found ${matches.length} matches with scores > 0`);
    console.log('=== Search complete ===');

    return NextResponse.json({
      parsedCriteria: criteria,
      searchQueries,
      totalResults: likelyCampaigns.length,
      matches,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Search failed',
        details: error.stack || 'No details available',
      },
      { status: 500 },
    );
  }
}
