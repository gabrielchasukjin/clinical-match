# DiscoverFlow AI: UI Design & User Flow

## Design Philosophy
**Task-Focused, Not Chat-Based**: Unlike traditional AI interfaces, DiscoverFlow uses a structured, guided workflow that shows tangible research progress through dedicated screens for each phase of the research process.

## User Flow Steps

### Step 1: Query Input
**Interface**: Clean, minimal interface with prominent search functionality
- Large search bar with placeholder: "Enter your research question or hypothesis"
- Below search: Recent searches or example queries for inspiration
- Submit button triggers immediate transition to agent workspace
- No chat interface - direct task entry

### Step 2: Intelligent Task Decomposition (Immediate Transition)
**Interface**: Brief loading state showing Lead Researcher analysis
- "Analyzing your research question..."
- "Breaking down into focused research areas..."
- Transition to agent deployment in 2-3 seconds

### Step 3: Parallel Agent Deployment
**Interface**: Real-time agent orchestration dashboard

#### Top Section: Research Breakdown
- Display decomposed research questions in cards/tiles
- Each card shows:
  - Question text (truncated with expand option)
  - Assigned agent name (Agent Alpha, Beta, etc.)
  - Current status: `queuing → searching → analyzing → complete`
  - Progress indicator (0-100%)

#### Middle Section: Live Agent Activity Feed
Real-time activity stream showing agent actions:
```
🔍 Agent Alpha: Searching PubMed for 'temporal vital signs prediction'
📊 Agent Beta: Found 47 papers on ArXiv, filtering for relevance...
🧠 Agent Gamma: Analyzing methodology relevance in 12 papers...
✅ Agent Delta: Completed search - 23 relevant papers identified
```

#### Bottom Section: Early Results Preview
- Total papers discovered counter (updating live)
- Papers by source distribution (PubMed: 23, ArXiv: 15, etc.)
- Relevance distribution chart (High: 8, Medium: 12, Low: 3)
- Mini-table showing papers as they're found

### Step 4: Comprehensive Literature Mining (Behind the Scenes)
**No Additional UI**: All searching happens during Step 3 display
- Each Explorer Agent conducts targeted searches via Tavily API
- Real-time progress updates fed to the activity stream
- Relevance evaluation and citation extraction happening live
- Results immediately saved to database

### Step 5: Results Presentation (Dual-Pane Interface)

#### Left Panel: Research Results Table
**Excel-style sortable/filterable data table**

**Columns**:
- `Favicon` (source icon for visual identification)
- `Title` (truncated, hover for full title)
- `URL` (clickable link to source)
- `Relevance Score` (0-100, color-coded)
- `Content Preview` (snippet from Tavily, show "null" if unavailable)

**Table Features**:
- Sort by any column
- Filter bar above table (by URL domain, relevance threshold)
- Search within results
- Color-coded relevance scores (green/yellow/red)
- Click row to load details in right panel

#### Right Panel: Paper Detail View
**Expandable sections for selected paper**:

1. **Paper Overview**
   - Full title, all authors, publication details
   - Abstract (full text)
   - DOI/URL link to original source

2. **Methodology Summary** (AI-generated)
   - Study design and approach
   - Sample size and characteristics
   - Data collection methods

3. **Key Findings** (AI-extracted)
   - Primary results and conclusions
   - Statistical significance
   - Clinical/practical implications

4. **Limitations & Gaps** (AI-identified)
   - Study limitations mentioned by authors
   - Potential biases or confounding factors
   - Areas for future research

5. **Related Work** (AI-suggested)
   - Links to similar papers in current results
   - Methodological comparisons

6. **Citation & Export**
   - Multiple citation formats (APA, MLA, etc.)
   - "Add to Review" button for research compilation
   - Export individual paper details

### Step 6: Interactive Analysis & Management

#### Analysis Features
- **Filter and Sort**: Dynamic table manipulation
- **Relevance Filtering**: Show only high-relevance sources
- **Source Filtering**: Focus on specific databases
- **Year Range**: Limit to recent publications
- **Keyword Search**: Find specific concepts within results

#### Export and Management
- **Export Full Results**: CSV/Excel download of all findings
- **Research Compilation**: Selected papers for detailed review
- **Session Save**: Return to results later via user account
- **Share Results**: Generate shareable link for collaboration

## Key UI Principles

### 1. Progress Transparency
Users always see what's happening - no black box operations

### 2. Data-Driven Interface
Everything centers around presenting research data efficiently

### 3. Academic Workflow Integration
Interface matches how researchers actually work with literature

### 4. Speed Optimization
Fast transitions between states, minimal loading times

### 5. Information Hierarchy
Critical information (relevance, source credibility) prominently displayed

## No Chat Interface
**Important**: Unlike the base template, DiscoverFlow does NOT use a chat interface. The entire workflow is guided through structured, task-specific screens that show concrete research progress and results.