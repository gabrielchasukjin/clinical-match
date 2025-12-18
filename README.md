# Clinical Trial Patient Matching System

An AI-powered system that leverages real-time web search across crowdfunding platforms to identify and match patients with clinical trial eligibility criteria. Built with Next.js, Anthropic Claude, Tavily Search API, and PostgreSQL.

## 🎯 Overview

This system enables clinical researchers to:
- Search for patients matching trial eligibility criteria in natural language
- Discover relevant patient campaigns across 10+ crowdfunding platforms (GoFundMe, GiveSendGo, Fundly, etc.)
- Extract structured patient data using LLMs
- Calculate match scores and rank results by relevance

## ✨ Key Features

- **Real-time Search**: No database maintenance required; always current information
- **AI-Powered Extraction**: Uses Anthropic Claude for structured data extraction
- **Natural Language Input**: Researchers input trial descriptions in plain English
- **Smart Matching**: Dynamic weighted scoring algorithm prioritizes criteria
- **Privacy-Friendly**: Minimal data storage; uses only publicly available information
- **Serverless Architecture**: Hosted on Vercel with automatic scaling

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **AI/LLM**: Anthropic Claude (Claude 3.5 Haiku, Claude Sonnet 4)
- **Search API**: Tavily Search API
- **Database**: PostgreSQL (Neon)
- **Deployment**: Vercel (serverless functions)
- **Authentication**: NextAuth.js

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ and **pnpm** installed
- **PostgreSQL database** (Neon, Supabase, or self-hosted)
- API keys for:
  - **Tavily API** (Required) - [Get API key](https://tavily.com/)
  - **Anthropic Claude API** (Required) - [Get API key](https://console.anthropic.com/)
  - **X.AI (Grok)** (Optional, for chat) - [Get API key](https://x.ai/)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd clinical-match

# Install dependencies
pnpm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database (Required)
POSTGRES_URL=postgresql://user:password@host:port/database

# Authentication (Required)
AUTH_SECRET=your-auth-secret-here
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here

# Tavily Search API (Required)
TAVILY_API_KEY=tvly-xxxxxxxxxxxxx

# Anthropic Claude API (Required)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# X.AI (Optional - for chat functionality)
XAI_API_KEY=xai-xxxxxxxxxxxxx
```

**Getting API Keys:**

1. **Tavily API Key**:
   - Sign up at https://tavily.com/
   - Get your API key from the dashboard
   - Free tier: 1000 searches/month

2. **Anthropic Claude API Key**:
   - Sign up at https://console.anthropic.com/
   - Create an API key
   - Add credits to your account ($5-10 recommended for testing)

3. **PostgreSQL Database**:
   - Use [Neon](https://neon.tech/) (recommended for Vercel)
   - Or [Supabase](https://supabase.com/)
   - Or any PostgreSQL database

4. **Auth Secret**:
   - Generate a random secret: `openssl rand -base64 32`
   - Use the same value for both `AUTH_SECRET` and `NEXTAUTH_SECRET`

### 3. Database Setup

```bash
# Run database migrations
pnpm db:migrate

# (Optional) Open database studio to verify
pnpm db:studio
```

The database schema includes:
- `TrialSearchSession`: Stores search queries and metadata
- `TrialSearchResult`: Stores extracted patient data and match scores
- User authentication tables (via NextAuth)

### 4. Run Development Server

```bash
pnpm dev
```

The application will be available at http://localhost:3000

### 5. Test the System

1. Navigate to http://localhost:3000/trials/search
2. Enter a trial description, for example:
   ```
   Looking for female patients over 50 with Type 2 Diabetes in Boston area
   ```
3. Click "Search for Patients"
4. Wait 10-30 seconds for results
5. Review the matching patients table

## 📁 Project Structure

```
clinical-match/
├── app/
│   ├── (auth)/              # Authentication pages
│   ├── (chat)/              # Chat interface
│   │   └── trials/
│   │       └── search/      # Patient search page
│   └── api/
│       └── trials/
│           ├── search/      # Main search API endpoint
│           ├── extract-from-paper/  # Extract criteria from research papers
│           └── history/     # Search history endpoint
├── lib/
│   ├── ai/                  # AI model providers and configurations
│   ├── db/                  # Database schema and queries
│   ├── matching/            # Core matching logic
│   │   ├── parse-criteria.ts      # LLM: Parse natural language to structured criteria
│   │   ├── generate-queries.ts    # LLM: Generate search queries
│   │   ├── extract-patient.ts     # LLM: Extract patient data from campaigns
│   │   └── calculate-match.ts     # Match scoring algorithm
│   └── tavily/              # Tavily Search API client
├── components/              # React components
└── docs/                    # Documentation
```

## 🔧 Available Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm db:migrate       # Run database migrations
pnpm db:studio        # Open Drizzle Studio (database GUI)
pnpm db:generate      # Generate migration files
pnpm db:push          # Push schema changes to database

# Code Quality
pnpm lint             # Run linter
pnpm lint:fix         # Fix linting issues
pnpm format           # Format code with Biome

# Testing
pnpm test             # Run Playwright tests
```

## 🌐 Deployment

### Deploy to Vercel

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Import to Vercel**:
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel will detect Next.js automatically

3. **Add Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all variables from `.env.local`:
     - `POSTGRES_URL`
     - `AUTH_SECRET`
     - `NEXTAUTH_URL` (production URL)
     - `NEXTAUTH_SECRET`
     - `TAVILY_API_KEY`
     - `ANTHROPIC_API_KEY`
     - `XAI_API_KEY` (optional)

4. **Configure Database**:
   - If using Neon, connect it via Vercel Marketplace
   - Or add `POSTGRES_URL` manually

5. **Deploy**:
   - Vercel will auto-deploy on push
   - Or trigger deployment manually from dashboard

6. **Run Migrations**:
   ```bash
   # Connect to production database and run:
   pnpm db:migrate
   ```

## 🔍 How It Works

1. **Criteria Parsing**: LLM (Claude 3.5 Haiku) converts natural language trial description into structured criteria
2. **Query Generation**: LLM generates 3-4 optimized search queries for crowdfunding platforms
3. **Search Execution**: Tavily Search API searches across 10+ platforms in parallel
4. **Data Cleaning**: URLs are deduplicated and filtered to valid campaign pages
5. **Patient Extraction**: LLM (Claude Sonnet 4) extracts structured patient data from campaign content
6. **Match Scoring**: Dynamic weighted algorithm calculates match scores (0-100%)
7. **Results Display**: Patients are ranked by match score and displayed in a sortable table

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test tests/e2e/chat.test.ts

# Run tests in UI mode
pnpm test --ui
```
