# API Endpoints Specification

## Research Session Management

### POST /api/research/start
**Purpose**: Initialize new research session with Lead Researcher Agent

**Request Body**:
```typescript
{
  query: string; // User's research question/hypothesis
}
```

**Response**:
```typescript
{
  sessionId: string;
  researchQuestions: Array<{
    index: number;
    question: string;
    agentName: string;
    focusAreas: string[];
  }>;
  estimatedCompletionTime: number; // seconds
}
```

**Process Flow**:
1. Create research_sessions record
2. Trigger Lead Researcher Agent to decompose question
3. Create agent_status records for each Explorer Agent
4. Return session details and question breakdown
5. Begin parallel Explorer Agent execution in background

---

### GET /api/research/[sessionId]/status
**Purpose**: Real-time agent progress and session status

**Query Parameters**:
- `includeResults?: boolean` - Include partial results in response

**Response**:
```typescript
{
  sessionStatus: 'active' | 'completed' | 'failed';
  agents: Array<{
    agentName: string;
    status: 'queuing' | 'searching' | 'analyzing' | 'complete' | 'failed';
    progress: number; // 0-100
    currentAction: string;
    papersFound: number;
    estimatedTimeRemaining: number; // seconds
  }>;
  overallProgress: {
    totalPapersFound: number;
    totalAgentsComplete: number;
    totalAgents: number;
    estimatedTimeRemaining: number;
  };
  partialResults?: SearchResult[]; // If includeResults=true
}
```

**WebSocket Alternative**: For real-time updates
```typescript
// WebSocket message types
interface AgentProgressUpdate {
  type: 'agent_progress';
  sessionId: string;
  agentName: string;
  status: string;
  progress: number;
  currentAction: string;
}

interface NewPaperFound {
  type: 'paper_found';
  sessionId: string;
  paper: SearchResult;
  totalCount: number;
}
```

---

### GET /api/research/[sessionId]/results
**Purpose**: Retrieve all search results for a session

**Query Parameters**:
- `page?: number` (default: 1)
- `limit?: number` (default: 20, max: 100)
- `domain?: string[]` - Filter by URL domain ['pubmed.gov', 'arxiv.org', etc.]
- `minRelevance?: number` - Minimum relevance score (0-100)
- `sortBy?: string` - Sort field ('relevance', 'title', 'url')
- `sortOrder?: string` - Sort direction ('asc', 'desc')

**Response**:
```typescript
{
  results: SearchResult[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalResults: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters: {
    domainDistribution: Record<string, number>;
    relevanceRange: { min: number; max: number; };
  };
}

interface SearchResult {
  id: string;
  title: string;
  url: string;
  contentPreview: string | null;
  faviconUrl: string | null;
  relevanceScore: number;
  tavilyScore: number;
  createdAt: string;
}
```

---

### POST /api/research/[sessionId]/extract
**Purpose**: Extract detailed content for specific paper

**Request Body**:
```typescript
{
  searchResultId: string;
}
```

**Response**:
```typescript
{
  extractedContent: {
    id: string;
    fullAbstract: string;
    methodologyDetails: string;
    resultsSection: string;
    conclusions: string;
    limitationsSection: string;
    referencesExtracted: Citation[];
    wordCount: number;
    readingTimeMinutes: number;
    keyConcepts: string[];
  };
  extractionMetadata: {
    extractionTime: number; // milliseconds
    extractionSuccessful: boolean;
    extractionError?: string;
  };
}

interface Citation {
  title: string;
  authors: string[];
  journal?: string;
  year?: number;
  doi?: string;
  url?: string;
}
```

**Process**:
1. Check if content already extracted for this search result
2. If not extracted, call Tavily Extract API
3. Process extracted content with AI for structured analysis
4. Save to extracted_content table
5. Return processed content

---

### GET /api/research/history
**Purpose**: Get user's research session history

**Query Parameters**:
- `page?: number` (default: 1)
- `limit?: number` (default: 10)
- `status?: string[]` - Filter by status

**Response**:
```typescript
{
  sessions: Array<{
    id: string;
    originalQuery: string;
    status: string;
    totalPapersFound: number;
    createdAt: string;
    completedAt?: string;
    researchQuestions: Array<{
      question: string;
      agentName: string;
    }>;
  }>;
  pagination: PaginationInfo;
}
```

## Internal Agent APIs (Background Processing)

### POST /api/agents/search
**Purpose**: Internal endpoint for Explorer Agents to save search results

**Request Body**:
```typescript
{
  sessionId: string;
  agentName: string;
  researchQuestionIndex: number;
  searchResults: Array<{
    title: string;
    authors: string[];
    source: string;
    url: string;
    publicationYear?: number;
    doi?: string;
    abstract?: string;
    tavilyScore: number;
    tavilyContentSnippet: string;
  }>;
  searchMetadata: {
    queryUsed: string;
    searchSource: string;
    resultsReturned: number;
    searchDurationMs: number;
    apiCostCredits: number;
  };
}
```

**Response**:
```typescript
{
  success: boolean;
  savedResults: number;
  duplicatesSkipped: number;
  errors?: string[];
}
```

---

### POST /api/agents/status
**Purpose**: Update agent status during execution

**Request Body**:
```typescript
{
  sessionId: string;
  agentName: string;
  status: 'queuing' | 'searching' | 'analyzing' | 'complete' | 'failed';
  progress: number; // 0-100
  currentAction: string;
  papersFound?: number;
  errorMessage?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  broadcastSent: boolean; // Whether update was sent via WebSocket
}
```

## External API Integration

### Tavily Search Integration
```typescript
interface TavilySearchRequest {
  query: string;
  search_depth: 'advanced';
  max_results: 20;
  topic: 'general';
  include_domains?: string[]; // Academic domains
  exclude_domains?: string[]; // Non-academic domains
}

// Academic domain targeting
const ACADEMIC_DOMAINS = [
  'pubmed.ncbi.nlm.nih.gov',
  'arxiv.org',
  'scholar.google.com',
  'ieee.org',
  'acm.org',
  'springer.com',
  'elsevier.com',
  'nature.com',
  'science.org',
  'wiley.com',
  'sciencedirect.com'
];
```

### Tavily Extract Integration
```typescript
interface TavilyExtractRequest {
  urls: string;
  extract_depth: 'advanced';
  format: 'markdown';
  include_images: false;
}
```

## Error Handling

### Standard Error Response
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}
```

### Error Codes
- `INVALID_SESSION` - Session not found or expired
- `AGENT_FAILED` - Agent execution failed
- `EXTRACTION_FAILED` - Content extraction failed
- `RATE_LIMIT_EXCEEDED` - Tavily API rate limit hit
- `INSUFFICIENT_CREDITS` - Tavily API credits depleted
- `VALIDATION_ERROR` - Request validation failed

## Rate Limiting

### API Rate Limits
- Research session creation: 10 per hour per user
- Status checks: 60 per minute per session
- Result queries: 30 per minute per session
- Content extraction: 20 per hour per user

### Implementation
```typescript
// Redis-based rate limiting
const rateLimiter = {
  sessionCreation: '10/hour/user',
  statusChecks: '60/minute/session',
  resultQueries: '30/minute/session',
  contentExtraction: '20/hour/user'
};
```