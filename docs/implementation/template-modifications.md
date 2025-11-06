# Template Modifications: What to Keep vs Remove

## Components to REMOVE (Not Relevant for Research Platform)

### 1. Chat System Components
**Files to Remove**:
- `/components/chat.tsx` - Main chat interface
- `/components/messages.tsx` - Chat message display
- `/components/message.tsx` - Individual message component
- `/components/message-actions.tsx` - Message voting/actions
- `/components/message-editor.tsx` - Edit chat messages
- `/components/message-reasoning.tsx` - Chat reasoning display
- `/components/multimodal-input.tsx` - Chat input with attachments
- `/components/suggested-actions.tsx` - Chat suggestions
- `/components/suggestion.tsx` - Individual suggestion component

### 2. Artifact System Components
**Files to Remove**:
- `/components/artifact.tsx` - Artifact display system
- `/components/artifact-actions.tsx` - Artifact management
- `/components/artifact-close-button.tsx`
- `/components/artifact-messages.tsx`
- `/components/create-artifact.tsx`
- `/artifacts/` (entire directory) - Code/text/image/sheet artifacts
- `/lib/artifacts/` - Artifact server logic

### 3. Document/Content Creation Components
**Files to Remove**:
- `/components/code-block.tsx` - Code display
- `/components/code-editor.tsx` - Code editing
- `/components/console.tsx` - Code console
- `/components/diffview.tsx` - Code diff viewer
- `/components/document.tsx` - Document viewer
- `/components/document-preview.tsx`
- `/components/document-skeleton.tsx`
- `/components/image-editor.tsx`
- `/components/sheet-editor.tsx`
- `/components/text-editor.tsx`

### 4. Chat-Specific API Routes
**Routes to Remove**:
- `/app/(chat)/api/chat/` - Chat streaming API
- `/app/(chat)/api/document/` - Document creation API
- `/app/(chat)/api/suggestions/` - Chat suggestions
- `/app/(chat)/api/vote/` - Message voting
- `/app/(chat)/actions.ts` - Chat-specific actions

### 5. Chat-Related Hooks
**Files to Remove**:
- `/hooks/use-messages.tsx` - Chat message management
- `/hooks/use-artifact.ts` - Artifact state management
- `/hooks/use-chat-visibility.ts` - Chat visibility controls
- `/hooks/use-auto-resume.ts` - Chat resume functionality

### 6. AI Tools (Replace with Research Tools)
**Files to Remove/Replace**:
- `/lib/ai/tools/create-document.ts` - Replace with research tools
- `/lib/ai/tools/update-document.ts` - Not needed
- `/lib/ai/tools/request-suggestions.ts` - Different suggestion system
- `/lib/ai/tools/get-weather.ts` - Not relevant

## Components to KEEP (Core Infrastructure)

### 1. Authentication System
**Keep All**:
- `/app/(auth)/` - Complete auth system
- `/middleware.ts` - Route protection
- User management and session handling

### 2. Database Infrastructure
**Keep Core**:
- `/lib/db/` - Database connection and utilities
- Drizzle ORM setup
- Migration system

**Modify Schema**:
- Keep `user` table
- Remove chat/message/artifact tables
- Add research-specific tables

### 3. UI Foundation Components
**Keep All**:
- `/components/ui/` - Radix UI components (buttons, tables, etc.)
- `/components/theme-provider.tsx`
- `/components/icons.tsx`
- Layout and styling infrastructure

### 4. Core Next.js Infrastructure
**Keep All**:
- `/app/layout.tsx` - Root layout
- `/app/globals.css` - Global styles
- Configuration files (next.config.ts, tailwind.config.ts, etc.)

### 5. Useful Utilities
**Keep All**:
- `/lib/utils.ts` - Utility functions
- `/lib/types.ts` - Type definitions (modify as needed)
- `/lib/constants.ts` - App constants

## Components to MODIFY

### 1. Main Application Routes
**Modify**:
- `/app/(chat)/page.tsx` → `/app/research/page.tsx`
  - Remove chat interface
  - Add research query input
- `/app/(chat)/layout.tsx` → `/app/research/layout.tsx`
  - Remove chat-specific layout elements
  - Add research-specific navigation

### 2. Navigation Components
**Modify**:
- `/components/app-sidebar.tsx`
  - Remove chat history
  - Add research session history
  - Remove artifact navigation

### 3. Database Schema
**Completely Replace**:
- `/lib/db/schema.ts`
  - Keep only `user` table
  - Add research_sessions, search_results, etc.

### 4. API Integration
**Replace AI SDK Usage**:
- Remove chat streaming
- Add Tavily API integration
- Replace with research agent orchestration

## New Components to CREATE

### 1. Research Interface Components
```
/components/research/
├── query-input.tsx          # Research question input
├── agent-dashboard.tsx      # Real-time agent progress
├── results-table.tsx        # Search results table
├── paper-details.tsx        # Paper detail panel
├── research-progress.tsx    # Progress indicators
└── session-history.tsx     # Past research sessions
```

### 2. Research API Routes
```
/app/api/research/
├── start/route.ts           # Start new research session
├── [sessionId]/
│   ├── status/route.ts      # Get agent progress
│   ├── results/route.ts     # Get search results
│   └── extract/route.ts     # Extract paper content
└── agents/
    ├── search/route.ts      # Internal agent search
    └── extract/route.ts     # Internal content extraction
```

### 3. Research Logic
```
/lib/research/
├── agents/
│   ├── lead-researcher.ts   # Question decomposition
│   └── explorer-agent.ts    # Paper searching
├── tavily-client.ts         # Tavily API wrapper
├── paper-analysis.ts        # AI paper analysis
└── session-management.ts    # Research session logic
```

## Migration Strategy

### Phase 1: Remove Unused Components
1. Delete all chat-related components and routes
2. Remove artifact system completely
3. Clean up unused dependencies

### Phase 2: Modify Core Infrastructure
1. Update database schema
2. Modify authentication flows for research sessions
3. Update main layout and navigation

### Phase 3: Build Research Components
1. Create research interface components
2. Implement Tavily API integration
3. Build agent orchestration system
4. Add real-time progress tracking

### Phase 4: Testing and Optimization
1. Test multi-agent coordination
2. Optimize database queries
3. Implement rate limiting and error handling
4. Performance testing with parallel searches