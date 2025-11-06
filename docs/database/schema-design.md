# Database Schema Design for DiscoverFlow AI

## Schema Overview
The database schema is designed to support multi-agent research sessions with efficient querying and real-time updates. It replaces the chat-focused schema with research-focused tables.

## Core Tables

### 1. Users (Keep from Template)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(64), -- Nullable for guest users
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
```

### 2. Research Sessions
```sql
CREATE TABLE research_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Research context
  original_query TEXT NOT NULL,
  research_questions JSONB NOT NULL, -- Array of questions from Lead Researcher
  
  -- Session metadata
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'failed')),
  total_papers_found INTEGER DEFAULT 0,
  total_agents_spawned INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_research_sessions_user_id ON research_sessions(user_id);
CREATE INDEX idx_research_sessions_status ON research_sessions(status);
CREATE INDEX idx_research_sessions_created_at ON research_sessions(created_at DESC);

-- Example JSONB structure for research_questions:
-- [
--   {
--     "index": 0,
--     "question": "What existing research demonstrates vital sign patterns predicting readmissions?",
--     "agent_name": "Agent Alpha",
--     "focus_areas": ["vital signs", "readmissions", "temporal patterns"]
--   }
-- ]
```

### 3. Search Results (Papers)
```sql
CREATE TABLE search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  
  -- Agent context
  agent_name VARCHAR(50) NOT NULL, -- Agent Alpha, Beta, etc.
  research_question_index INTEGER NOT NULL, -- Which question (0-based)
  search_iteration INTEGER DEFAULT 1, -- Multiple searches per question
  
  -- Paper metadata (from Tavily API response)
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content_preview TEXT, -- Short snippet from Tavily
  favicon_url TEXT, -- Favicon URL from Tavily
  
  -- Tavily relevance scoring
  relevance_score INTEGER NOT NULL CHECK (relevance_score BETWEEN 0 AND 100),
  
  -- Tavily metadata
  tavily_score DECIMAL(5,4), -- Tavily's internal relevance score (0.0-1.0)
  
  -- Content extraction status
  content_extracted BOOLEAN DEFAULT FALSE,
  extraction_requested_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_search_results_session_id ON search_results(session_id);
CREATE INDEX idx_search_results_relevance_score ON search_results(relevance_score DESC);
CREATE INDEX idx_search_results_url ON search_results(url);
CREATE INDEX idx_search_results_agent_name ON search_results(agent_name);

-- Compound indexes for common queries
CREATE INDEX idx_search_results_session_relevance ON search_results(session_id, relevance_score DESC);
```

### 4. Extracted Content (On-Demand)
```sql
CREATE TABLE extracted_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_result_id UUID NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
  
  -- Full extracted content from Tavily Extract API
  raw_content TEXT NOT NULL,
  content_format VARCHAR(20) NOT NULL DEFAULT 'markdown', -- 'markdown' or 'text'
  
  -- AI-processed sections
  full_abstract TEXT,
  methodology_details TEXT,
  results_section TEXT,
  conclusions TEXT,
  limitations_section TEXT,
  references_extracted JSONB, -- Structured reference data
  
  -- Content analysis
  word_count INTEGER,
  reading_time_minutes INTEGER,
  key_concepts JSONB, -- Array of important concepts/keywords
  
  -- Extraction metadata
  extract_depth VARCHAR(20) NOT NULL, -- 'basic' or 'advanced'
  extraction_successful BOOLEAN NOT NULL DEFAULT TRUE,
  extraction_error TEXT, -- Error message if extraction failed
  tavily_response_time DECIMAL(4,2), -- API response time
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_extracted_content_search_result_id ON extracted_content(search_result_id);
CREATE INDEX idx_extracted_content_successful ON extracted_content(extraction_successful);

-- Ensure one extraction per search result
CREATE UNIQUE INDEX idx_extracted_content_unique_result ON extracted_content(search_result_id);
```

### 5. Agent Status Tracking
```sql
CREATE TABLE agent_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  
  -- Agent identification
  agent_name VARCHAR(50) NOT NULL, -- Agent Alpha, Beta, etc.
  research_question TEXT NOT NULL,
  research_question_index INTEGER NOT NULL,
  
  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'queuing' CHECK (status IN ('queuing', 'searching', 'analyzing', 'complete', 'failed')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  current_action TEXT, -- "Searching PubMed for 'temporal vital signs'"
  
  -- Progress metrics
  searches_completed INTEGER DEFAULT 0,
  papers_found INTEGER DEFAULT 0,
  papers_analyzed INTEGER DEFAULT 0,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_agent_status_session_id ON agent_status(session_id);
CREATE INDEX idx_agent_status_status ON agent_status(status);
CREATE INDEX idx_agent_status_updated_at ON agent_status(updated_at DESC);

-- Ensure one status record per agent per session
CREATE UNIQUE INDEX idx_agent_status_unique_agent ON agent_status(session_id, agent_name);
```

### 6. Search Analytics (Optional - for monitoring)
```sql
CREATE TABLE search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES research_sessions(id) ON DELETE CASCADE,
  
  -- Search details
  query_used TEXT NOT NULL,
  search_source VARCHAR(50) NOT NULL, -- Which database was searched
  agent_name VARCHAR(50) NOT NULL,
  
  -- Results
  results_returned INTEGER NOT NULL,
  search_duration_ms INTEGER,
  api_cost_credits DECIMAL(6,4), -- Tavily API cost tracking
  
  -- API response metadata
  tavily_response_time DECIMAL(4,2),
  api_success BOOLEAN NOT NULL DEFAULT TRUE,
  api_error_message TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX idx_search_analytics_session_id ON search_analytics(session_id);
CREATE INDEX idx_search_analytics_created_at ON search_analytics(created_at);
CREATE INDEX idx_search_analytics_source ON search_analytics(search_source);
```

## Data Relationships

```
users (1) ←→ (many) research_sessions
research_sessions (1) ←→ (many) search_results
research_sessions (1) ←→ (many) agent_status
search_results (1) ←→ (0 or 1) extracted_content
research_sessions (1) ←→ (many) search_analytics
```

## Key Design Decisions

### 1. JSONB Usage
- `research_questions` in research_sessions for flexible question storage
- `references_extracted` in extracted_content for structured citation data
- `key_concepts` for flexible keyword/concept storage

### 2. Status Tracking
- Agent status tracked separately for real-time UI updates
- Search results immediately persisted for incremental loading
- Content extraction flagged but only stored on user interaction

### 3. Performance Optimizations
- Strategic indexing for common query patterns
- Compound indexes for session-based filtering
- Separate tables to avoid large JOINs

### 4. Cost Management
- `content_extracted` flag prevents unnecessary API calls
- `extraction_requested_at` tracks user interaction timing
- `api_cost_credits` tracks Tavily API usage

## Queries for Common Operations

### Get Session Overview
```sql
SELECT 
  rs.*,
  COUNT(sr.id) as total_papers,
  AVG(sr.relevance_score) as avg_relevance
FROM research_sessions rs
LEFT JOIN search_results sr ON rs.id = sr.session_id
WHERE rs.id = $1
GROUP BY rs.id;
```

### Get Session Results with Filtering
```sql
SELECT * FROM search_results
WHERE session_id = $1
  AND relevance_score >= $2     -- minimum relevance
  AND url LIKE ANY($3)          -- ['%pubmed%', '%arxiv%'] for domain filtering
ORDER BY relevance_score DESC, created_at ASC
LIMIT $4 OFFSET $5;
```

### Get Real-time Agent Progress
```sql
SELECT 
  agent_name,
  status,
  progress_percentage,
  current_action,
  papers_found
FROM agent_status
WHERE session_id = $1
ORDER BY research_question_index;
```