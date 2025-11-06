# Tavily Relevance Scoring Implementation

## Overview
DiscoverFlow AI uses Tavily's built-in relevance scoring rather than implementing custom quality ratings. This approach provides several advantages:

## Tavily Relevance Score Details

### What Tavily Provides
- **Score Range**: 0.0 to 1.0 (decimal)
- **Calculation**: Based on content similarity to search query
- **Real-time**: Calculated during search execution
- **Consistent**: Same scoring methodology across all sources

### How Tavily Calculates Relevance
Tavily's relevance score considers:
1. **Query Match**: How well the content matches the search terms
2. **Semantic Similarity**: Contextual understanding of the research question
3. **Content Quality**: Authority and credibility of the source
4. **Recency**: Publication date and timeliness

## Implementation in DiscoverFlow

### Database Storage
```sql
-- Store Tavily's raw score (0.0-1.0)
tavily_score DECIMAL(5,4)

-- Convert to user-friendly 0-100 scale for display
relevance_score INTEGER NOT NULL CHECK (relevance_score BETWEEN 0 AND 100)
```

### Score Conversion
```typescript
// Convert Tavily score (0.0-1.0) to display score (0-100)
const relevanceScore = Math.round(tavilyScore * 100);

// Save both for reference
await saveSearchResult({
  tavilyScore: 0.8542,      // Raw Tavily score
  relevanceScore: 85,       // Display score (0-100)
  // ... other fields
});
```

### UI Display
- **Table Column**: "Relevance Score" (0-100)
- **Color Coding**: 
  - Green: 80-100 (High relevance)
  - Yellow: 50-79 (Medium relevance) 
  - Red: 0-49 (Low relevance)
- **Sorting**: Default sort by relevance score (highest first)

## Benefits of Using Tavily Scores

### 1. **Simplicity**
- No additional AI processing required
- Immediate availability with search results
- Consistent scoring methodology

### 2. **Performance**
- No extra API calls for scoring
- Real-time score generation
- Reduced computational overhead

### 3. **Accuracy**
- Professional scoring algorithm
- Trained on academic content
- Regular updates and improvements

### 4. **Cost Efficiency**
- No additional AI costs for quality assessment
- Single API call provides both results and scores
- Reduced processing time

## User Experience

### Filtering Options
```typescript
// Filter results by relevance threshold
const filteredResults = results.filter(r => r.relevanceScore >= minRelevance);

// Common relevance thresholds
const relevanceFilters = {
  high: 80,      // High relevance (80-100)
  medium: 50,    // Medium relevance (50-79)
  all: 0         // All results (0-100)
};
```

### Display Strategy
- **Primary Sort**: Relevance score (descending)
- **Secondary Sort**: Publication year (descending)
- **Visual Indicators**: Color-coded relevance badges
- **Threshold Control**: User-adjustable minimum relevance slider

## Alternative Approaches Considered

### Custom AI Quality Rating (Rejected)
**Why rejected**:
- Adds complexity and processing time
- Requires additional AI API calls
- Subjective quality assessment
- Potential bias in AI evaluation

### Source-Based Quality Tiers (Rejected)
**Why rejected**:
- Oversimplifies academic source hierarchy
- Doesn't account for content relevance
- May bias against newer or niche sources
- Less informative than relevance scoring

## Implementation Notes

### Score Validation
```typescript
// Validate Tavily scores before storage
function validateTavilyScore(score: number): boolean {
  return score >= 0 && score <= 1 && !isNaN(score);
}

// Convert with error handling
function convertToRelevanceScore(tavilyScore: number): number {
  if (!validateTavilyScore(tavilyScore)) {
    console.warn('Invalid Tavily score:', tavilyScore);
    return 0; // Default to lowest relevance
  }
  return Math.round(tavilyScore * 100);
}
```

### Error Handling
- **Missing Scores**: Default to 0 if Tavily doesn't provide score
- **Invalid Scores**: Log warning and use 0 as fallback
- **API Errors**: Continue without scores, allow manual review

## Future Enhancements

### Potential Improvements
1. **Weighted Scoring**: Combine Tavily score with source credibility
2. **User Feedback**: Allow users to rate result relevance for training
3. **Custom Weights**: Let users adjust relevance vs. recency preferences
4. **Score Explanations**: Show why a paper received its relevance score

### Monitoring
- Track correlation between Tavily scores and user satisfaction
- Monitor score distribution across different research domains
- Analyze score accuracy for different types of queries