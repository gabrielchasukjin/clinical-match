# Multi-Agent Research System Architecture

## System Overview
The multi-agent literature search system transforms complex research queries into actionable results through intelligent task decomposition and parallel execution.

## Agent Types

### 1. Lead Researcher Agent (The Orchestrator)
**Role**: Acts as the research project manager

**Responsibilities**:
- Analyzes the user's hypothesis/research question
- Breaks it down into 2-8 specific, non-overlapping research questions
- Spawns Explorer agents (one per question)
- Monitors overall progress
- Coordinates final result compilation

**System Prompt**:
```
You are an expert at decomposing complex research problems into specific, actionable research questions. Ensure questions generated are non-overlapping and unique. Always return responses in valid JSON format when requested.
```

**Example Flow**:
- **User Input**: "Temporal vital signs can predict hospital readmissions"
- **Lead Researcher Output**:
  - Question A: "What existing research demonstrates vital sign patterns predicting readmissions?"
  - Question B: "Which temporal analysis methods work best for medical time series?"
  - Question C: "What datasets exist for training readmission prediction models?"
  - Question D: "What are the performance metrics of current readmission prediction approaches?"

### 2. Explorer Agents (The Specialists)
**Role**: Each Explorer is assigned ONE specific research question

**Responsibilities**:
- Uses Tavily Search API to search across multiple sources:
  - Academic papers (PubMed, ArXiv)
  - Technical documentation
  - Datasets and repositories
  - News articles
  - General web content
- Analyzes findings with AI evaluation
- Extracts key insights and citations
- Scores relevance to research question (0-100)
- Saves results to database immediately

**System Prompt**:
```
You are a thorough research agent skilled at finding, evaluating, and synthesizing information from multiple sources. Always prioritize accuracy and source credibility. Focus exclusively on your assigned research question: [SPECIFIC_QUESTION]
```

**Search Strategy**:
- Each Explorer performs comprehensive searches optimized for their specific question
- Multiple search iterations with refined keywords
- Source diversity prioritization
- Real-time relevance assessment

## Agent Coordination

### Parallel Execution Model
1. **Simultaneous Launch**: All Explorer agents work simultaneously, not sequentially
2. **Independent Operation**: Each agent focuses solely on their assigned question
3. **Real-time Updates**: Progress and findings are continuously updated in the UI
4. **Dynamic Adaptation**: Can spawn additional explorers if critical gaps are identified
5. **Source Control**: Multiple layers of evidence assessment and source verification

### Communication Protocol
- Agents communicate through database state updates
- Lead Researcher monitors progress through agent status tracking
- No direct agent-to-agent communication to maintain focus
- Results aggregation happens at the database level

## Example in Action

**Hypothesis**: "AI can predict stock market crashes better than traditional models"

**Lead Researcher Decomposition**:
- Explorer 1: "What AI methods have been used for stock market prediction?"
- Explorer 2: "How do traditional crash prediction models work and perform?"
- Explorer 3: "What datasets exist for training crash prediction models?"
- Explorer 4: "What are the performance metrics and benchmarks for existing approaches?"

**Parallel Search Results**:
- Explorer 1: LSTM networks show 72% accuracy in volatility prediction (15 papers found)
- Explorer 2: VIX and technical indicators achieve 65% accuracy (12 papers found)  
- Explorer 3: 20+ years of S&P 500 data available from multiple sources (8 datasets found)
- Explorer 4: Precision-recall trade-offs vary significantly by prediction timeframe (10 studies found)

**Outcome**: Comprehensive literature review completed in minutes rather than weeks, with relevance-scored evidence and clear research gaps identified.