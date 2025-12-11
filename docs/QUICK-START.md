# Quick Start Guide

Get the patient matching system running in under an hour.

---

## Prerequisites

### 1. Get API Keys

**Tavily** (REQUIRED)
```
https://tavily.com/
→ Sign up
→ Get API key
```

**OpenAI** (REQUIRED)
```
https://platform.openai.com/
→ Sign up
→ Create API key
→ Add $10-20 credits
```

---

## Setup (15 minutes)

### 1. Install Dependencies

```bash
cd clinical-match

# Install Tavily SDK
npm install @tavily/core

# Install AI SDK (if not already installed)
npm install @ai-sdk/openai
```

### 2. Add Environment Variables

Create `.env.local`:
```env
TAVILY_API_KEY=tvly-xxxxx
OPENAI_API_KEY=sk-xxxxx
POSTGRES_URL=postgresql://...  # Already have
AUTH_SECRET=...                 # Already have
```

Or add to Vercel:
```bash
vercel env add TAVILY_API_KEY
vercel env add OPENAI_API_KEY
```

### 3. Database is Already Set Up!

The minimal schema was already added. No migration needed!

---

## Build Core Files (30 minutes)

### Step 1: Create Tavily Client

Create: `lib/tavily/client.ts`
```typescript
import { Tavily } from '@tavily/core';

export const tavily = new Tavily({
  apiKey: process.env.TAVILY_API_KEY!,
});

export const CROWDFUNDING_DOMAINS = [
  'gofundme.com',
  'givesendgo.com',
  'fundly.com',
];
```

### Step 2: Create Matching Functions

Create folder:
```bash
mkdir -p lib/matching
```

Copy these 4 files from `IMPLEMENTATION.md`:
- `lib/matching/parse-criteria.ts`
- `lib/matching/generate-queries.ts`
- `lib/matching/extract-patient.ts`
- `lib/matching/calculate-match.ts`

### Step 3: Create API Route

Create: `app/api/trials/search/route.ts`

Copy full code from `IMPLEMENTATION.md` Day 5-6 section.

### Step 4: Create Search Page

Create: `app/trials/search/page.tsx`

Copy full code from `IMPLEMENTATION.md` Day 7 section.

---

## Test It! (5 minutes)

### 1. Start Dev Server

```bash
npm run dev
```

### 2. Navigate to Search Page

```
http://localhost:3000/trials/search
```

### 3. Try a Search

Input:
```
Looking for female patients over 50 with Type 2 Diabetes in Boston area
```

Click "Search for Patients"

Expected: 10-30 seconds later, see table of matching patients!

---

## Deploy to Vercel (10 minutes)

### 1. Commit Changes

```bash
git add .
git commit -m "Add patient matching with Tavily"
git push origin master
```

### 2. Add Environment Variables in Vercel

Go to: https://vercel.com/gabrielchasukjin/clinical-match/settings/environment-variables

Add:
- `TAVILY_API_KEY`
- `OPENAI_API_KEY`

### 3. Redeploy

Vercel will auto-deploy on push, or manually redeploy from dashboard.

---

## File Checklist

```
clinical-match/
├── lib/
│   ├── tavily/
│   │   └── client.ts               ✓ Create
│   └── matching/
│       ├── parse-criteria.ts       ✓ Create
│       ├── generate-queries.ts     ✓ Create
│       ├── extract-patient.ts      ✓ Create
│       └── calculate-match.ts      ✓ Create
│
├── app/
│   ├── api/
│   │   └── trials/
│   │       └── search/
│   │           └── route.ts        ✓ Create
│   └── trials/
│       └── search/
│           └── page.tsx            ✓ Create
│
└── .env.local                      ✓ Add keys
```

---

## Sample Test Inputs

Try these searches:

1. **Diabetes**
```
Looking for female patients over 50 with Type 2 Diabetes
```

2. **Cancer**
```
Need pediatric patients under 18 with leukemia
```

3. **Heart Disease**
```
Male patients aged 45-65 with coronary artery disease in California
```

4. **Location-Specific**
```
Diabetes patients in Boston or Massachusetts area
```

---

## Expected Results

### Successful Search:
- **Time**: 10-30 seconds
- **Results**: 5-15 matching patients
- **Table**: Shows name, age, gender, conditions, location, match %
- **Actions**: Clickable campaign URLs

### Common Issues:

**"No patients found"**
- Try broader criteria (remove location, widen age range)
- Different condition names ("diabetes" vs "Type 2 Diabetes")

**"API Error"**
- Check API keys are valid
- Check you have OpenAI credits
- Check Tavily account is active

**"Search timeout"**
- Increase `maxDuration` in route.ts
- Reduce number of search queries
- Reduce `maxResults` per query

---

## Cost per Search

- Tavily: 4 queries × $0.005 = **$0.02**
- OpenAI parsing: **$0.001**
- OpenAI query generation: **$0.001**
- OpenAI extraction: 10 patients × $0.01 = **$0.10**

**Total: ~$0.13 per search**

100 searches/month = **$13**

---

## Next Steps

Once working:

1. ✅ Test with various criteria
2. ✅ Show to potential users for feedback
3. ✅ Add search history saving
4. ✅ Add export to CSV
5. ✅ Add email template generation

See `IMPLEMENTATION.md` for full feature roadmap.

---

## Support

Issues? Check:
1. `ARCHITECTURE.md` - System design
2. `IMPLEMENTATION.md` - Detailed build guide
3. Console logs in browser DevTools
4. Vercel deployment logs

---

## You're Ready!

The system is simple but powerful:
1. Researcher describes trial
2. AI searches crowdfunding platforms
3. AI extracts patient data
4. System calculates matches
5. Display ranked results

**Time to build: 1-2 hours if following this guide exactly.**

Good luck! 🚀
