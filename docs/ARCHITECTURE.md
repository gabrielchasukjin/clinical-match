# Clinical Trial Patient Matching - System Architecture

## Overview
Real-time AI-powered system that searches crowdfunding platforms to find patients matching clinical trial eligibility criteria using Tavily Search API.

---

## How It Works

### User Flow
```
Researcher → Input Trial Criteria → LLM Parses → Tavily Searches → LLM Extracts Patient Data → Display Matches
```

### Detailed Flow

#### 1. Researcher Input
```
Input: "Looking for female patients over 50 with Type 2 Diabetes in Boston area"
```

#### 2. LLM Criteria Parsing
```javascript
// LLM converts natural language to structured criteria
{
  age: {min: 50, max: null},
  gender: ["female"],
  conditions: ["Type 2 Diabetes", "diabetes"],
  location: "Boston",
  exclusions: []
}
```

#### 3. Search Query Generation
```javascript
// LLM generates multiple search queries optimized for crowdfunding platforms
[
  "female diabetes patient help GoFundMe Boston",
  "woman type 2 diabetes crowdfunding Massachusetts",
  "type 2 diabetes fundraiser Boston area medical bills",
  "diabetes help Boston female patient"
]
```

#### 4. Tavily Search Execution
```javascript
// Parallel searches across crowdfunding platforms
for (query of searchQueries) {
  results = await tavily.search({
    query: query,
    search_depth: "advanced",
    max_results: 10,
    include_domains: ["gofundme.com", "givesendgo.com", "fundly.com"]
  });
}
```

#### 5. Patient Data Extraction
```javascript
// LLM extracts structured data from campaign pages
for (result of tavilyResults) {
  patient = await extractPatientInfo(result.content);
  // Returns: {
  //   name: "Sarah M.",
  //   age: 52,
  //   gender: "female",
  //   conditions: ["Type 2 Diabetes"],
  //   location: "Boston, MA",
  //   campaign_url: "https://gofundme.com/...",
  //   raw_description: "..."
  // }
}
```

#### 6. Match Calculation
```javascript
// Calculate match percentage for each patient
matchScore = 0;
if (patient.age >= criteria.age.min) matchScore += 25;
if (criteria.gender.includes(patient.gender)) matchScore += 25;
if (hasMatchingCondition(patient, criteria)) matchScore += 40;
if (locationMatches(patient, criteria)) matchScore += 10;
```

#### 7. Results Display
```
┌──────────────────────────────────────────────────────────┐
│ Patient │ Age │ Gender │ Condition │ Location │ Match │  │
├─────────┼─────┼────────┼───────────┼──────────┼───────┼──┤
│ Sarah M.│ 52✓ │ F ✓   │ T2D ✓    │ Boston✓  │ 100% │📧│
│ Mary K. │ 48✗ │ F ✓   │ T2D ✓    │ Boston✓  │  85% │📧│
│ Linda S.│ 55✓ │ F ✓   │ T2D ✓    │ NYC ✗   │  70% │📧│
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Core Framework
- **Next.js 15** - App Router with Server Actions
- **React 19** - UI components
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

### APIs & Services
- **Tavily Search API** - Real-time web search (REQUIRED)
- **OpenAI GPT-4** or **Anthropic Claude** - LLM processing (REQUIRED)
- **PostgreSQL** - Store search history only
- **Vercel** - Deployment

### Database
- **Minimal**: Only 1 table for search history
- **No patient storage**: Everything real-time via Tavily

---

## Database Schema (Minimal)

### Table: `trial_searches`
```sql
CREATE TABLE trial_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User"(id),

  -- Input
  trial_description TEXT NOT NULL,

  -- Parsed Criteria
  parsed_criteria JSONB NOT NULL,
  /* Example:
  {
    "age": {"min": 50},
    "gender": ["female"],
    "conditions": ["Type 2 Diabetes"],
    "location": "Boston"
  }
  */

  -- Search Results (cached)
  search_results JSONB,
  /* Stores Tavily results + extracted patient data */

  -- Metadata
  results_count INTEGER DEFAULT 0,
  top_match_score INTEGER DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trial_searches_user ON trial_searches(user_id);
CREATE INDEX idx_trial_searches_created ON trial_searches(created_at DESC);
```

**That's it!** No `patients` table needed.

---

## API Endpoints

### 1. Create Trial Search
```
POST /api/trials/search

Body:
{
  "trialDescription": "Female patients over 50 with Type 2 Diabetes in Boston"
}

Response:
{
  "searchId": "uuid",
  "parsedCriteria": {...},
  "matches": [
    {
      "name": "Sarah M.",
      "age": 52,
      "gender": "female",
      "conditions": ["Type 2 Diabetes"],
      "location": "Boston, MA",
      "campaign_url": "https://gofundme.com/...",
      "matchScore": 100,
      "criteriaBreakdown": {
        "age": true,
        "gender": true,
        "conditions": true,
        "location": true
      }
    }
  ]
}
```

### 2. Get Search History
```
GET /api/trials/history?userId={id}

Response:
{
  "searches": [
    {
      "id": "uuid",
      "trialDescription": "...",
      "resultsCount": 12,
      "topMatchScore": 95,
      "createdAt": "2024-01-15T..."
    }
  ]
}
```

### 3. Get Saved Search Results
```
GET /api/trials/[searchId]/results

Response:
{
  "search": {...},
  "matches": [...]
}
```

---

## LLM Integration Points

### 1. Parse Trial Criteria (GPT-4o-mini or Claude Haiku)
**Input:** User's natural language description
**Output:** Structured JSON criteria
**Cost:** ~$0.001 per parse

```typescript
const systemPrompt = `Extract clinical trial eligibility criteria as JSON.
Output format:
{
  "age": {"min": number, "max": number},
  "gender": ["male" | "female" | "non-binary"],
  "conditions": ["condition names"],
  "location": "city/state",
  "exclusions": ["excluded conditions"]
}`;

const criteria = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {role: "system", content: systemPrompt},
    {role: "user", content: trialDescription}
  ]
});
```

### 2. Generate Search Queries (GPT-4o-mini)
**Input:** Parsed criteria
**Output:** Array of search queries
**Cost:** ~$0.001 per generation

```typescript
const systemPrompt = `Generate 4-6 search queries to find patients on crowdfunding platforms.
Focus on GoFundMe, GiveSendGo, and similar sites.
Include variations with:
- Different phrasings ("patient", "help", "fundraiser", "medical bills")
- Location variants
- Condition synonyms`;

const queries = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {role: "system", content: systemPrompt},
    {role: "user", content: JSON.stringify(criteria)}
  ]
});
```

### 3. Extract Patient Data (GPT-4o or Claude Sonnet)
**Input:** Campaign page content from Tavily
**Output:** Structured patient data
**Cost:** ~$0.01-0.02 per patient

```typescript
const systemPrompt = `Extract patient information from this crowdfunding campaign.
Return JSON with: name, age, gender, conditions, location.
Be conservative - only extract if clearly stated.`;

const patient = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    {role: "system", content: systemPrompt},
    {role: "user", content: campaignContent}
  ]
});
```

---

## Tavily Integration

### Search Configuration
```typescript
interface TavilySearchParams {
  query: string;
  search_depth: "basic" | "advanced";  // Use "advanced"
  max_results: number;                  // 10 per query
  include_domains: string[];            // Crowdfunding platforms
  include_answer: false;
  include_raw_content: true;            // Need full content for extraction
}

const CROWDFUNDING_DOMAINS = [
  "gofundme.com",
  "givesendgo.com",
  "fundly.com",
  "giveforward.com",
  "plumfund.com"
];
```

### Search Strategy
```typescript
async function searchForPatients(criteria, searchQueries) {
  const allResults = [];

  // Execute searches in parallel
  const searchPromises = searchQueries.map(query =>
    tavily.search({
      query,
      search_depth: "advanced",
      max_results: 10,
      include_domains: CROWDFUNDING_DOMAINS,
      include_raw_content: true
    })
  );

  const results = await Promise.all(searchPromises);

  // Flatten and deduplicate by URL
  const uniqueResults = deduplicateByUrl(results.flat());

  return uniqueResults;
}
```

---

## Matching Algorithm

### Match Score Calculation
```typescript
function calculateMatchScore(patient, criteria) {
  let score = 0;
  const breakdown = {};

  // Age check (25 points)
  if (criteria.age) {
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
  if (criteria.gender && patient.gender) {
    const genderMatch = criteria.gender
      .map(g => g.toLowerCase())
      .includes(patient.gender.toLowerCase());
    if (genderMatch) {
      score += 20;
      breakdown.gender = true;
    } else {
      breakdown.gender = false;
    }
  }

  // Conditions check (40 points)
  if (criteria.conditions && patient.conditions) {
    const hasMatchingCondition = criteria.conditions.some(requiredCondition =>
      patient.conditions.some(patientCondition =>
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

## Cost Estimate

### Per Search Session
- **Tavily Search**: 4-6 queries × $0.005 = $0.02-0.03
- **LLM Criteria Parsing**: $0.001
- **LLM Query Generation**: $0.001
- **LLM Patient Extraction**: 10-20 patients × $0.01 = $0.10-0.20
- **Total per search: ~$0.13-0.25**

### Monthly Costs (100 searches/month)
- Tavily: $2-3
- OpenAI: $10-20
- PostgreSQL: $0-25
- Vercel: $20
- **Total: ~$35-70/month**

---

## Environment Variables

```env
# Required
TAVILY_API_KEY=tvly-...           # Get from https://tavily.com/
OPENAI_API_KEY=sk-...             # Get from https://platform.openai.com/
POSTGRES_URL=postgresql://...     # Database connection
AUTH_SECRET=...                   # NextAuth secret

# Optional
ANTHROPIC_API_KEY=sk-ant-...      # Alternative to OpenAI
```

---

## Key Advantages Over Database Approach

| Feature | Database Approach | Real-Time Search (This) |
|---------|------------------|------------------------|
| **Setup Time** | 3+ weeks | 1-2 weeks |
| **Data Freshness** | Stale (needs scraping) | Always current |
| **Legal Risk** | High (automated scraping) | Low (using Tavily) |
| **Maintenance** | High (keep DB updated) | Low (no DB maintenance) |
| **Storage Costs** | High (patient data) | Low (only search history) |
| **Scalability** | Limited by DB | Unlimited via Tavily |

---

## Limitations & Considerations

### Limitations
1. **Tavily results quality**: Depends on Tavily's ability to find campaigns
2. **LLM extraction accuracy**: May miss patients with unclear descriptions
3. **Cost per search**: $0.13-0.25 per search (vs. free with database)
4. **Search speed**: 10-30 seconds per search (real-time processing)

### Privacy & Ethics
1. ✅ **No data storage**: Only search history, not patient data
2. ✅ **Public information only**: Crowdfunding campaigns are public
3. ✅ **Respects ToS**: Using Tavily API (not direct scraping)
4. ⚠️ **IRB approval**: Still needed for actual patient contact
5. ⚠️ **Consent**: Must get explicit consent before contacting

---

## Next Steps

See `IMPLEMENTATION.md` for step-by-step build guide.
