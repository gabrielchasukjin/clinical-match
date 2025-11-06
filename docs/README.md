# Clinical Trial Patient Matching - Documentation

## Overview

This system uses AI and real-time web search to find patients on crowdfunding platforms who match clinical trial eligibility criteria.

**How it works:**
1. Researcher describes their clinical trial requirements
2. LLM parses criteria into structured format
3. System searches crowdfunding platforms via Tavily API
4. LLM extracts patient data from campaign pages
5. Algorithm calculates match scores
6. Results displayed in sortable table

---

## Documentation Structure

### 🚀 [QUICK-START.md](./QUICK-START.md)
**Start here!** Get the system running in under an hour.
- API key setup
- Installation commands
- File creation checklist
- Test search examples

### 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md)
Complete system design and technical specifications.
- Detailed flow diagrams
- Database schema (minimal!)
- API integration details
- LLM prompts and functions
- Matching algorithm
- Cost estimates

### 📋 [IMPLEMENTATION.md](./IMPLEMENTATION.md)
Step-by-step build guide for the full system.
- Week-by-week timeline
- Complete code for each file
- API route implementation
- UI component code
- Testing checklist
- Troubleshooting guide

---

## Key Features

### ✅ What's Included
- Real-time patient search (no database needed!)
- LLM-powered criteria parsing
- Tavily search across crowdfunding platforms
- Automatic patient data extraction
- Match score calculation
- Results table with ✓/✗ indicators
- Clickable campaign links

### ❌ What's NOT Included (Yet)
- Patient database (using real-time search instead)
- Email outreach automation
- Advanced analytics
- Multiple trial management
- CSV export (easy to add later)

---

## Tech Stack

### Core
- **Next.js 15** - Framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **PostgreSQL** - Minimal (search history only)

### APIs
- **Tavily Search** - Find crowdfunding campaigns
- **OpenAI GPT-4** - Parse criteria + extract patient data
- **NextAuth** - Authentication (already set up)

---

## Timeline

- **Quick Start**: 1-2 hours
- **Full MVP**: 1-2 weeks
- **Production Ready**: 2-3 weeks

---

## Cost Estimate

### Development
- **DIY**: 1-2 weeks
- **Freelancer**: $3,000-$8,000

### Monthly Operating ($35-70/month)
- Tavily API: $2-3
- OpenAI API: $10-20
- PostgreSQL: $0-25
- Vercel Hosting: $20

### Per Search (~$0.13-0.25)
- Tavily: $0.02-0.03
- OpenAI: $0.11-0.22

---

## Quick Start Commands

```bash
# 1. Install dependencies
npm install @tavily/core @ai-sdk/openai

# 2. Add environment variables
echo "TAVILY_API_KEY=tvly-xxx" >> .env.local
echo "OPENAI_API_KEY=sk-xxx" >> .env.local

# 3. Create required folders
mkdir -p lib/tavily lib/matching app/api/trials/search app/trials/search

# 4. Copy code from IMPLEMENTATION.md

# 5. Run dev server
npm run dev

# 6. Test at http://localhost:3000/trials/search
```

---

## File Structure

```
clinical-match/
├── lib/
│   ├── tavily/
│   │   └── client.ts              # Tavily API client
│   └── matching/
│       ├── parse-criteria.ts      # LLM criteria parser
│       ├── generate-queries.ts    # Search query generator
│       ├── extract-patient.ts     # Patient data extractor
│       └── calculate-match.ts     # Match scoring algorithm
│
├── app/
│   ├── api/
│   │   └── trials/
│   │       └── search/
│   │           └── route.ts       # Main search API endpoint
│   └── trials/
│       └── search/
│           └── page.tsx           # Search UI page
│
└── docs/                          # This folder
    ├── README.md                  # This file
    ├── QUICK-START.md             # Get started fast
    ├── ARCHITECTURE.md            # System design
    └── IMPLEMENTATION.md          # Build guide
```

---

## Sample Search

**Input:**
```
Looking for female patients over 50 with Type 2 Diabetes in Boston area
```

**Output Table:**
```
┌────────────────────────────────────────────────────────┐
│ Patient│ Age│ Gender│ Condition│ Location│ Match│ Link│
├────────┼────┼───────┼──────────┼─────────┼──────┼─────┤
│ Sarah  │ 52✓│ F ✓  │ T2D ✓   │ Boston✓ │ 100% │  🔗 │
│ Mary   │ 48✗│ F ✓  │ T2D ✓   │ Boston✓ │  85% │  🔗 │
│ Linda  │ 55✓│ F ✓  │ T2D ✓   │ NYC ✗  │  70% │  🔗 │
└────────────────────────────────────────────────────────┘
```

---

## Advantages Over Database Approach

| Feature | Database Version | Real-Time Search (This) |
|---------|-----------------|------------------------|
| Setup Time | 3+ weeks | 1-2 weeks |
| Data Freshness | Stale | Always current |
| Legal Risk | High (scraping) | Low (API) |
| Maintenance | High | Low |
| Storage Cost | High | Low |
| Scalability | Limited | Unlimited |

---

## Legal & Ethical Considerations

### ✅ Safe Practices
- Only searches public crowdfunding campaigns
- Uses Tavily API (respects ToS)
- No data storage (privacy-friendly)
- Requires researcher to manually contact patients

### ⚠️ Important Notes
- Still need IRB approval for contacting patients
- Must get explicit consent before enrollment
- Respect platform terms of service
- Follow HIPAA guidelines if collecting PHI

---

## Success Criteria

### MVP Complete When:
- [ ] Can input trial criteria
- [ ] LLM parses correctly (>90% accuracy)
- [ ] Tavily finds relevant campaigns
- [ ] Patient data extracted accurately
- [ ] Match scores make sense
- [ ] Results display in table
- [ ] Campaign links work

### Production Ready When:
- [ ] All MVP criteria met
- [ ] Error handling robust
- [ ] Loading states polished
- [ ] Mobile responsive
- [ ] Tested with 10+ different criteria
- [ ] User feedback incorporated

---

## Support

### Documentation
1. **QUICK-START.md** - Get started fast
2. **ARCHITECTURE.md** - Understand the system
3. **IMPLEMENTATION.md** - Build step-by-step

### Common Issues

**No patients found**
→ Try broader criteria, different condition names

**API errors**
→ Check API keys, check credits remaining

**Slow searches**
→ Reduce number of queries, reduce maxResults

### Need Help?
- Check console logs in browser
- Check Vercel deployment logs
- Review error messages in API responses

---

## Next Steps

### After MVP Works:
1. Save search history to database
2. Add CSV export
3. Generate email templates
4. Add advanced filtering
5. Create analytics dashboard
6. Support multiple trials

### Future Enhancements:
- Automated patient follow-up tracking
- Integration with ClinicalTrials.gov
- Custom matching algorithms per trial type
- Machine learning for better extraction
- API for external integrations

---

## Ready to Build?

1. Read: [QUICK-START.md](./QUICK-START.md)
2. Get: Tavily + OpenAI API keys
3. Build: Follow implementation guide
4. Test: Try sample searches
5. Deploy: Push to Vercel
6. Iterate: Get user feedback

**Estimated time: 1-2 hours for basic version, 1-2 weeks for full MVP**

Good luck! 🚀
