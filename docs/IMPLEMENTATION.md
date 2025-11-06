# Implementation Guide - Clinical Trial Patient Matching

## Timeline: 1-2 Weeks

This guide provides step-by-step instructions to build the patient matching system.

---

## Prerequisites

### 1. Get API Keys

**Tavily API Key** (REQUIRED)
- Sign up: https://tavily.com/
- Get API key from dashboard
- Free tier: 1000 searches/month

**OpenAI API Key** (REQUIRED)
- Sign up: https://platform.openai.com/
- Create API key
- Add $10-20 credits

**Alternative: Anthropic Claude**
- Sign up: https://console.anthropic.com/
- Create API key

### 2. Set Environment Variables

Add to Vercel or `.env.local`:
```env
TAVILY_API_KEY=tvly-...
OPENAI_API_KEY=sk-...
POSTGRES_URL=postgresql://...
AUTH_SECRET=...  # Already have
```

---

## Week 1: Core Functionality

### Day 1-2: Database & API Setup

#### Step 1: Update Database Schema

The schema is already updated with minimal tables. Just add the search history table:

```typescript
// Already added to lib/db/schema.ts:
// - patients table (won't use much)
// - clinicalTrials table (will use for search history)
```

#### Step 2: Install Tavily SDK

```bash
npm install @tavily/core
# or
pnpm add @tavily/core
```

#### Step 3: Create Tavily Client

Create file: `lib/tavily/client.ts`

```typescript
import { Tavily } from '@tavily/core';

if (!process.env.TAVILY_API_KEY) {
  throw new Error('TAVILY_API_KEY is required');
}

export const tavily = new Tavily({
  apiKey: process.env.TAVILY_API_KEY,
});

export const CROWDFUNDING_DOMAINS = [
  'gofundme.com',
  'givesendgo.com',
  'fundly.com',
  'giveforward.com',
];
```

---

### Day 3-4: LLM Functions

#### Create: `lib/matching/parse-criteria.ts`

```typescript
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const criteriaSchema = z.object({
  age: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  gender: z.array(z.enum(['male', 'female', 'non-binary'])).optional(),
  conditions: z.array(z.string()).optional(),
  location: z.string().optional(),
  exclusions: z.array(z.string()).optional(),
});

export async function parseCriteria(trialDescription: string) {
  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: criteriaSchema,
    prompt: `Extract clinical trial eligibility criteria from this description:

"${trialDescription}"

Return structured JSON with age range, gender requirements, medical conditions, location preferences, and any exclusion criteria.`,
  });

  return object;
}
```

#### Create: `lib/matching/generate-queries.ts`

```typescript
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const queriesSchema = z.object({
  queries: z.array(z.string()),
});

export async function generateSearchQueries(criteria: any) {
  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: queriesSchema,
    prompt: `Generate 4-6 search queries to find patients on crowdfunding platforms (GoFundMe, GiveSendGo, etc.) who match these criteria:

${JSON.stringify(criteria, null, 2)}

Each query should:
- Target crowdfunding campaigns for medical help
- Include relevant condition names
- Include location if specified
- Use variations like "patient", "help", "fundraiser", "medical bills"

Return array of search query strings.`,
  });

  return object.queries;
}
```

#### Create: `lib/matching/extract-patient.ts`

```typescript
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const patientSchema = z.object({
  name: z.string().optional(),
  age: z.number().optional(),
  gender: z.enum(['male', 'female', 'non-binary', 'unknown']).optional(),
  conditions: z.array(z.string()),
  location: z.string().optional(),
});

export async function extractPatientData(
  campaignContent: string,
  campaignUrl: string
) {
  try {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: patientSchema,
      prompt: `Extract patient information from this crowdfunding campaign content:

"${campaignContent.slice(0, 2000)}"  // Limit to avoid token limits

Extract:
- Name (first name or alias only for privacy)
- Age (approximate if mentioned)
- Gender (if clearly stated)
- Medical conditions (all mentioned)
- Location (city/state if mentioned)

Only include information that is explicitly stated. Return "unknown" or empty array if not found.`,
    });

    return {
      ...object,
      campaign_url: campaignUrl,
      raw_description: campaignContent.slice(0, 500),
    };
  } catch (error) {
    console.error('Failed to extract patient data:', error);
    return {
      name: 'Unknown',
      conditions: [],
      campaign_url: campaignUrl,
      raw_description: campaignContent.slice(0, 500),
    };
  }
}
```

#### Create: `lib/matching/calculate-match.ts`

```typescript
export interface MatchResult {
  score: number;
  breakdown: {
    age?: boolean;
    gender?: boolean;
    conditions?: boolean;
    location?: boolean;
  };
}

export function calculateMatch(patient: any, criteria: any): MatchResult {
  let score = 0;
  const breakdown: any = {};

  // Age check (25 points)
  if (criteria.age && patient.age) {
    const ageMin = criteria.age.min || 0;
    const ageMax = criteria.age.max || 999;
    if (patient.age >= ageMin && patient.age <= ageMax) {
      score += 25;
      breakdown.age = true;
    } else {
      breakdown.age = false;
    }
  }

  // Gender check (20 points)
  if (criteria.gender && patient.gender && patient.gender !== 'unknown') {
    const genderMatch = criteria.gender
      .map((g: string) => g.toLowerCase())
      .includes(patient.gender.toLowerCase());
    if (genderMatch) {
      score += 20;
      breakdown.gender = true;
    } else {
      breakdown.gender = false;
    }
  }

  // Conditions check (40 points)
  if (criteria.conditions && patient.conditions && patient.conditions.length > 0) {
    const hasMatchingCondition = criteria.conditions.some((requiredCondition: string) =>
      patient.conditions.some((patientCondition: string) =>
        patientCondition.toLowerCase().includes(requiredCondition.toLowerCase()) ||
        requiredCondition.toLowerCase().includes(patientCondition.toLowerCase())
      )
    );
    if (hasMatchingCondition) {
      score += 40;
      breakdown.conditions = true;
    } else {
      breakdown.conditions = false;
    }
  }

  // Location check (15 points)
  if (criteria.location && patient.location) {
    const locationMatch = patient.location
      .toLowerCase()
      .includes(criteria.location.toLowerCase());
    if (locationMatch) {
      score += 15;
      breakdown.location = true;
    } else {
      breakdown.location = false;
    }
  }

  return { score, breakdown };
}
```

---

### Day 5-6: API Route

#### Create: `app/api/trials/search/route.ts`

```typescript
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

    if (!trialDescription) {
      return NextResponse.json(
        { error: 'Trial description is required' },
        { status: 400 }
      );
    }

    // Step 1: Parse criteria with LLM
    console.log('Parsing criteria...');
    const criteria = await parseCriteria(trialDescription);

    // Step 2: Generate search queries
    console.log('Generating search queries...');
    const searchQueries = await generateSearchQueries(criteria);

    // Step 3: Execute Tavily searches
    console.log('Searching with Tavily...');
    const searchPromises = searchQueries.map((query) =>
      tavily.search({
        query,
        searchDepth: 'advanced',
        maxResults: 10,
        includeDomains: CROWDFUNDING_DOMAINS,
        includeRawContent: true,
      })
    );

    const searchResults = await Promise.all(searchPromises);
    const allResults = searchResults.flatMap((result) => result.results);

    // Deduplicate by URL
    const uniqueResults = Array.from(
      new Map(allResults.map((r) => [r.url, r])).values()
    );

    console.log(`Found ${uniqueResults.length} unique campaigns`);

    // Step 4: Extract patient data from each result
    console.log('Extracting patient data...');
    const patientPromises = uniqueResults.slice(0, 20).map((result) =>
      extractPatientData(result.content || '', result.url)
    );

    const patients = await Promise.all(patientPromises);

    // Step 5: Calculate match scores
    console.log('Calculating match scores...');
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
      .sort((a, b) => b.matchScore - a.matchScore); // Sort by score

    return NextResponse.json({
      parsedCriteria: criteria,
      searchQueries,
      totalResults: uniqueResults.length,
      matches,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}
```

---

### Day 7: UI Components

#### Create: `app/trials/search/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

export default function TrialSearchPage() {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  async function handleSearch() {
    setLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/trials/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialDescription: description }),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Find Matching Patients</h1>

      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Enter Trial Criteria</h2>
        <Textarea
          placeholder="Example: Looking for female patients over 50 with Type 2 Diabetes in Boston area..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className="mb-4"
        />
        <Button
          onClick={handleSearch}
          disabled={loading || !description.trim()}
          className="w-full"
        >
          {loading ? 'Searching...' : 'Search for Patients'}
        </Button>
      </Card>

      {loading && (
        <Card className="p-6">
          <div className="text-center">
            <p className="text-lg">Searching crowdfunding platforms...</p>
            <p className="text-sm text-muted-foreground mt-2">
              This may take 10-30 seconds
            </p>
          </div>
        </Card>
      )}

      {results && (
        <div>
          <Card className="p-6 mb-4">
            <h3 className="font-semibold mb-2">Parsed Criteria:</h3>
            <pre className="text-sm bg-muted p-3 rounded overflow-auto">
              {JSON.stringify(results.parsedCriteria, null, 2)}
            </pre>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-4">
              Found {results.matches.length} Matching Patients
            </h2>

            {results.matches.length === 0 ? (
              <p className="text-muted-foreground">
                No patients found matching your criteria. Try broadening your search.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Age</th>
                      <th className="text-left p-2">Gender</th>
                      <th className="text-left p-2">Conditions</th>
                      <th className="text-left p-2">Location</th>
                      <th className="text-left p-2">Match</th>
                      <th className="text-left p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.matches.map((match: any, idx: number) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2">{match.patient.name || 'Unknown'}</td>
                        <td className="p-2">
                          {match.patient.age || '-'}{' '}
                          {match.criteriaBreakdown.age !== undefined &&
                            (match.criteriaBreakdown.age ? '✓' : '✗')}
                        </td>
                        <td className="p-2">
                          {match.patient.gender || '-'}{' '}
                          {match.criteriaBreakdown.gender !== undefined &&
                            (match.criteriaBreakdown.gender ? '✓' : '✗')}
                        </td>
                        <td className="p-2">
                          {match.patient.conditions?.join(', ') || '-'}{' '}
                          {match.criteriaBreakdown.conditions !== undefined &&
                            (match.criteriaBreakdown.conditions ? '✓' : '✗')}
                        </td>
                        <td className="p-2">
                          {match.patient.location || '-'}{' '}
                          {match.criteriaBreakdown.location !== undefined &&
                            (match.criteriaBreakdown.location ? '✓' : '✗')}
                        </td>
                        <td className="p-2">
                          <span
                            className={`font-semibold ${
                              match.matchScore >= 80
                                ? 'text-green-600'
                                : match.matchScore >= 50
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}
                          >
                            {match.matchScore}%
                          </span>
                        </td>
                        <td className="p-2">
                          <a
                            href={match.patient.campaign_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View Campaign
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
```

---

## Week 2: Polish & Deploy

### Day 1-2: Add Navigation

Update `app/layout.tsx` to add link to trial search:

```tsx
// Add link in navigation
<Link href="/trials/search">Find Patients</Link>
```

### Day 3: Testing

Test with various inputs:
1. "Female patients over 50 with diabetes in California"
2. "Male patients aged 30-45 with heart disease"
3. "Children under 12 with cancer, any location"

### Day 4: Error Handling

Add better error handling, loading states, and user feedback.

### Day 5: Deploy to Vercel

```bash
git add .
git commit -m "Add patient matching functionality"
git push origin master
```

Verify environment variables in Vercel:
- TAVILY_API_KEY
- OPENAI_API_KEY
- POSTGRES_URL
- AUTH_SECRET

---

## Testing Checklist

- [ ] Can input trial criteria
- [ ] LLM correctly parses criteria to JSON
- [ ] Tavily search executes successfully
- [ ] Patient data is extracted from campaigns
- [ ] Match scores are calculated correctly
- [ ] Results table displays with ✓/✗ indicators
- [ ] Results are sorted by match score
- [ ] Campaign URLs are clickable
- [ ] Works on mobile
- [ ] Loading states are clear
- [ ] Errors are handled gracefully

---

## Next Features (Post-MVP)

1. **Save Search History** - Store in database for later review
2. **Export Results** - Download as CSV/Excel
3. **Email Templates** - Generate outreach emails
4. **Advanced Filtering** - Filter results by score, location, etc.
5. **Multiple Trials** - Manage multiple trials simultaneously
6. **Analytics** - Track search success rates

---

## Troubleshooting

### "Tavily API Key Invalid"
- Verify key is correct in environment variables
- Check you have credits remaining

### "No patients found"
- Try broader search criteria
- Check that Tavily is searching the right domains
- Verify search queries are well-formed

### "LLM extraction failed"
- Check OpenAI API credits
- Verify campaign content isn't empty
- Add error handling for malformed responses

### "Search takes too long"
- Reduce number of search queries (4 instead of 6)
- Reduce max_results per query (5 instead of 10)
- Add timeout handling

---

## Done!

You now have a working patient matching system. The total build time should be 7-10 days of focused work.

**Need help?** See `ARCHITECTURE.md` for system design details.
