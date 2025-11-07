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
    if (criteria.priorityOrder) {
      console.log(
        'Priority order (based on user input):',
        criteria.priorityOrder,
      );
    }

    // Step 2: Generate search queries
    console.log('[Step 2/6] Generating search queries...');
    const searchQueries = await generateSearchQueries(criteria);
    console.log('Generated queries:', searchQueries);

    // Step 3: Execute Tavily searches in parallel (multiple crowdfunding sites)
    console.log('[Step 3/6] Searching with Tavily...');
    const searchPromises = searchQueries.map((query) =>
      tavily
        .search(
          `${query} (gofundme OR fundly OR justgiving OR fundrazr OR givesendgo OR plumfund OR givebutter) medical fundraiser`,
          {
            searchDepth: 'advanced',
            maxResults: 10,
            includeRawContent: 'text', // Get full raw content including organizer info
          },
        )
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

    // Filter for crowdfunding campaigns from supported platforms
    const crowdfundingCampaigns = uniqueResults.filter((result) => {
      const url = result.url.toLowerCase();
      return CROWDFUNDING_DOMAINS.some((domain) => url.includes(domain));
    });

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
      'facebook.com/share',
      'facebook.com/groups',
      'facebook.com/pages',
    ];

    // Campaign URL patterns for different platforms
    const isCampaignUrl = (url: string): boolean => {
      const urlLower = url.toLowerCase();

      // GoFundMe: must have /f/
      if (urlLower.includes('gofundme.com') && urlLower.includes('/f/')) {
        return true;
      }

      // Fundly: must have /campaign/ or /fundraiser/
      if (
        urlLower.includes('fundly.com') &&
        (urlLower.includes('/campaign/') || urlLower.includes('/fundraiser/'))
      ) {
        return true;
      }

      // JustGiving: must have /fundraising/
      if (
        urlLower.includes('justgiving.com') &&
        urlLower.includes('/fundraising/')
      ) {
        return true;
      }

      // FundRazr: must have /campaign/ or specific campaign pattern
      if (urlLower.includes('fundrazr.com') && urlLower.includes('/campaign')) {
        return true;
      }

      // GiveSendGo: must have /campaign/ or /gsg/
      if (
        urlLower.includes('givesendgo.com') &&
        (urlLower.includes('/campaign/') || urlLower.includes('/gsg/'))
      ) {
        return true;
      }

      // Plumfund: must have /plum/
      if (urlLower.includes('plumfund.com') && urlLower.includes('/plum/')) {
        return true;
      }

      // Givebutter: must have campaign path
      if (
        urlLower.includes('givebutter.com') &&
        urlLower.match(/\/[a-z0-9-]+$/)
      ) {
        return true;
      }

      // Facebook fundraisers: must have /donate/
      if (urlLower.includes('facebook.com') && urlLower.includes('/donate/')) {
        return true;
      }

      // For other platforms, accept if not in exclude patterns
      if (
        (urlLower.includes('mightycause.com') ||
          urlLower.includes('spotfund.com') ||
          urlLower.includes('gogetfunding.com') ||
          urlLower.includes('donorbox.org') ||
          urlLower.includes('paypal.com')) &&
        !excludePatterns.some((pattern) => urlLower.includes(pattern))
      ) {
        return true;
      }

      return false;
    };

    const likelyCampaigns = crowdfundingCampaigns.filter((result) => {
      const url = result.url.toLowerCase();
      // Must be a campaign URL and not in exclude patterns
      return (
        isCampaignUrl(url) &&
        !excludePatterns.some((pattern) => url.includes(pattern.toLowerCase()))
      );
    });

    console.log(`Found ${uniqueResults.length} unique results`);
    console.log(
      `Filtered to ${crowdfundingCampaigns.length} crowdfunding campaigns`,
    );
    console.log(`Final count: ${likelyCampaigns.length} valid campaign pages`);

    if (likelyCampaigns.length === 0) {
      return NextResponse.json({
        parsedCriteria: criteria,
        searchQueries,
        totalResults: 0,
        matches: [],
        message:
          'No crowdfunding campaigns found. Try broadening your search criteria or using different condition names.',
      });
    }

    // Step 4: Use search content with raw content for organizer info
    console.log('[Step 4/6] Preparing campaign content...');
    const campaignsToProcess = likelyCampaigns.slice(0, 15);

    // Use rawContent which includes more complete page content
    const extractedContents = campaignsToProcess.map((result) => ({
      url: result.url,
      content: result.rawContent || result.content || '',
    }));

    // Log content lengths for debugging
    const contentLengths = extractedContents.map((c) => ({
      url: c.url.split('/').pop(),
      length: c.content.length,
    }));
    console.log('Content lengths from search:', contentLengths);

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

    // Calculate first match to get weights for logging
    let dynamicWeights:
      | {
          age: number;
          gender: number;
          conditions: number;
          location: number;
        }
      | undefined;

    // Show ALL patients, even without conditions (they'll just get lower scores)
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
      .sort((a, b) => b.matchScore - a.matchScore); // Sort by score descending

    console.log('Dynamic weights applied:', dynamicWeights);
    console.log(`Total matches: ${matches.length}`);
    console.log(
      `Matches with conditions: ${matches.filter((m) => m.patient.conditions && m.patient.conditions.length > 0).length}`,
    );
    console.log(
      `Matches with score > 0: ${matches.filter((m) => m.matchScore > 0).length}`,
    );

    // Debug: Log first few matches
    if (matches.length > 0) {
      console.log('Top 3 matches:');
      matches.slice(0, 3).forEach((match, idx) => {
        console.log(
          `${idx + 1}. ${match.patient.name || 'Unknown'}: ${match.matchScore}%, conditions: ${match.patient.conditions?.length || 0}`,
        );
      });
    }

    console.log('=== Search complete ===');

    return NextResponse.json({
      parsedCriteria: criteria,
      searchQueries,
      totalResults: likelyCampaigns.length,
      dynamicWeights,
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
