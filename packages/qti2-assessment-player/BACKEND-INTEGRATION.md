## Backend Integration Guide

Complete guide for integrating the QTI 2.2 Assessment Player with secure backend services.

---

## TL;DR

- **By default**: Player runs 100% client-side, no backend required
- **For production**: Optionally integrate backend for security and persistence
- **Easy swap**: Provide a `BackendAdapter` implementation to enable backend mode

---

## Table of Contents

1. [Default Behavior (Client-Only)](#default-behavior-client-only)
2. [Security Model](#security-model)
3. [API Contract](#api-contract)
4. [Quick Start](#quick-start)
5. [Production Implementation](#production-implementation)
6. [Server-Side Requirements](#server-side-requirements)
7. [Example Implementations](#example-implementations)

---

## Default Behavior (Client-Only)

### No Backend Required

**The QTI 2.2 Assessment Player works completely standalone by default.**

Perfect for:
- 🎨 **Demos and prototypes** - Quick integration without infrastructure
- 🧪 **Development and testing** - Fast iteration, no server setup
- 📚 **Educational/training** - Self-contained learning modules
- 🔬 **Research and experimentation** - Offline-capable assessments

### How It Works

Without a backend adapter, the player:
1. Stores QTI XML in browser memory
2. Performs scoring client-side using the QTI engine
3. Persists state to localStorage (optional)
4. Runs completely offline

```typescript
import { AssessmentPlayer } from '@pie-framework/qti2-assessment-player';

// Client-only mode (default) - works immediately
const player = new AssessmentPlayer({
  assessment: myQtiAssessment,  // QTI structure with itemXml
  role: 'candidate'
});

await player.init();
// Ready to use - no server needed!
```

### ⚠️ Client-Only Limitations

Be aware:
- **Security**: Correct answers visible in browser (inspect QTI XML)
- **Persistence**: Uses localStorage (can be cleared, limited storage)
- **Integrity**: Scores can be manipulated via browser devtools
- **Analytics**: No centralized data collection

**Use client-only mode for non-critical assessments where security isn't paramount.**

---

## Security Model

### Core Principle: Never Trust the Client

The assessment player follows a **zero-trust security model** where:

- **Client**: Collects and displays data only
- **Server**: Stores sensitive data, performs scoring, enforces rules

### What Must Stay Server-Side

✅ **MUST be server-side**:
- QTI XML with `<correctResponse>` elements
- `<responseProcessing>` rules and templates
- Scoring algorithms and rubrics
- Answer keys and solution content
- Assessment-level scoring rules

❌ **NEVER send to client** (for `candidate` role):
- Correct answers
- Scoring formulas
- Point values
- Solution explanations

### Role-Based Data Filtering

The server MUST filter data based on QTI 2.2 roles:

| Role | Can See Correct Answers | Can See Scores | Can See Solutions |
|------|------------------------|----------------|-------------------|
| `candidate` | ❌ Never | ⚠️ After submission* | ❌ Never |
| `scorer` | ✅ Yes | ✅ Yes | ✅ Yes |
| `author` | ✅ Yes | ✅ Yes | ✅ Yes |
| `tutor` | ✅ Yes | ✅ Yes | ✅ Yes |
| `proctor` | ❌ No | ⚠️ Limited | ❌ No |
| `testConstructor` | ✅ Yes | ✅ Yes | ✅ Yes |

\* Depends on `submissionMode` and assessment configuration

### Attack Vectors to Prevent

1. **Client-side scoring manipulation**
   - ❌ BAD: Calculate scores in browser JavaScript
   - ✅ GOOD: Send responses to server, return computed scores

2. **XML inspection**
   - ❌ BAD: Send full QTI XML with `<correctResponse>` to candidates
   - ✅ GOOD: Strip sensitive elements server-side before sending

3. **Session hijacking**
   - ❌ BAD: Use predictable session IDs
   - ✅ GOOD: Use cryptographically random session tokens

4. **Replay attacks**
   - ❌ BAD: Allow unlimited re-submissions with same timestamp
   - ✅ GOOD: Validate submission order and enforce attempt limits

---

## API Contract

The backend adapter interface is defined in `src/integration/api-contract.ts`.

### Core Interface

```typescript
interface BackendAdapter {
  // Initialize new assessment session
  initSession(request: InitSessionRequest): Promise<InitSessionResponse>;

  // Submit responses for scoring
  submitResponses(request: SubmitResponsesRequest): Promise<SubmitResponsesResponse>;

  // Save state (auto-save)
  saveState(request: SaveStateRequest): Promise<SaveStateResponse>;

  // Finalize and get results
  finalizeAssessment(request: FinalizeAssessmentRequest): Promise<FinalizeAssessmentResponse>;
}
```

### Key Types

```typescript
// Session initialization
interface InitSessionRequest {
  assessmentId: string;
  candidateId: string;
  resumeSessionId?: SessionId;
}

// Response submission (client → server)
interface SubmitResponsesRequest {
  sessionId: SessionId;
  itemIdentifier: string;
  responses: Record<string, ResponseValue>; // Only responses, no scoring
  submittedAt: number;
  timeSpent?: number;
}

// Scoring result (server → client)
interface ScoringResult {
  itemIdentifier: string;
  score: number;           // Computed SERVER-SIDE
  maxScore: number;
  completed: boolean;
  outcomeValues: Record<string, any>;
  feedback?: FeedbackItem[];
  correctResponse?: Record<string, ResponseValue>; // Only if role allows
}
```

---

## Quick Start

### 1. Reference Implementation (Development Only)

For local development and demos, use the provided reference adapter:

```typescript
import { ReferenceBackendAdapter } from '@pie-framework/qti2-assessment-player/integration';

// ⚠️ WARNING: Insecure for production (client-side scoring)
const adapter = new ReferenceBackendAdapter();

const session = await adapter.initSession({
  assessmentId: 'demo-assessment',
  candidateId: 'student-123'
});

// Submit responses
await adapter.submitResponses({
  sessionId: session.sessionId,
  itemIdentifier: 'item-1',
  responses: { RESPONSE: 'A' },
  submittedAt: Date.now()
});

// Finalize
const results = await adapter.finalizeAssessment({
  sessionId: session.sessionId
});
```

### 2. Use in Assessment Player

```typescript
import { AssessmentPlayer } from '@pie-framework/qti2-assessment-player';
import { ReferenceBackendAdapter } from '@pie-framework/qti2-assessment-player/integration';

const player = new AssessmentPlayer({
  backend: new ReferenceBackendAdapter(),
  assessmentId: 'test-001',
  candidateId: 'student-123'
});

await player.init();
```

---

## Production Implementation

### Server-Side Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ HTTPS only
       │
┌──────▼──────────────────────────────────┐
│         API Gateway / Load Balancer      │
└──────┬──────────────────────────────────┘
       │
┌──────▼──────────────────────────────────┐
│    Application Server (Node/Python/etc) │
│  ┌──────────────────────────────────┐   │
│  │  Authentication & Authorization   │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │    QTI XML Storage & Filtering   │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │    Response Processing Engine    │   │
│  │    (Server-side QTI scoring)     │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │        Session Management        │   │
│  └──────────────────────────────────┘   │
└──────┬──────────────────────────────────┘
       │
┌──────▼──────────────────────────────────┐
│         Database (PostgreSQL/etc)        │
│  - QTI XML (full, with correct answers) │
│  - Session state                         │
│  - Response history                      │
│  - Scoring results                       │
└──────────────────────────────────────────┘
```

### Implement Your Backend Adapter

Create a class implementing `BackendAdapter`:

```typescript
// src/adapters/MyBackendAdapter.ts
import type { BackendAdapter, InitSessionRequest, InitSessionResponse } from '@pie-framework/qti2-assessment-player/integration';

export class MyBackendAdapter implements BackendAdapter {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  async initSession(request: InitSessionRequest): Promise<InitSessionResponse> {
    const response = await fetch(`${this.baseUrl}/api/qti/sessions/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Init session failed: ${response.statusText}`);
    }

    return response.json();
  }

  async submitResponses(request: SubmitResponsesRequest): Promise<SubmitResponsesResponse> {
    const response = await fetch(`${this.baseUrl}/api/qti/responses/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify(request)
    });

    return response.json();
  }

  // ... implement other methods
}
```

---

## Server-Side Requirements

### 1. QTI XML Filtering

**Before sending to candidate**, strip sensitive elements:

```typescript
// Server-side pseudocode
function filterQTIForCandidate(itemXml: string): string {
  const dom = parseXML(itemXml);

  // Remove correct responses
  removeElements(dom, 'correctResponse');

  // Remove response processing
  removeElements(dom, 'responseProcessing');

  // Remove solution feedback
  removeElements(dom, 'modalFeedback[showHide="show"][outcomeIdentifier="SCORE"]');

  return serializeXML(dom);
}
```

### 2. Server-Side Scoring

Use the `Player` class on the server (Node.js):

```typescript
// Server-side Node.js
import { Player } from '@pie-qti/qti2-item-player';

function scoreItem(itemXml: string, responses: Record<string, any>): ScoringResult {
  // Use FULL QTI XML with responseProcessing
  const player = new Player({
    itemXml,
    role: 'scorer' // Server always uses privileged role
  });

  // Set candidate responses
  for (const [responseId, value] of Object.entries(responses)) {
    player.setResponse(responseId, value);
  }

  // Process and score
  const result = player.processResponses();

  return {
    itemIdentifier: player.getIdentifier(),
    score: result.score,
    maxScore: result.maxScore,
    completed: result.completed,
    outcomeValues: result.outcomeValues
  };
}
```

### 3. Session Management

Store session state securely:

```sql
-- Example PostgreSQL schema
CREATE TABLE qti_sessions (
  session_id UUID PRIMARY KEY,
  assessment_id VARCHAR(255) NOT NULL,
  candidate_id VARCHAR(255) NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  finalized_at TIMESTAMP,
  finalized BOOLEAN DEFAULT FALSE
);

CREATE TABLE qti_responses (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES qti_sessions(session_id),
  item_identifier VARCHAR(255) NOT NULL,
  responses JSONB NOT NULL,
  score FLOAT,
  max_score FLOAT,
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_candidate ON qti_sessions(candidate_id);
CREATE INDEX idx_responses_session ON qti_responses(session_id);
```

### 4. API Endpoints

Example Express.js routes:

```typescript
// POST /api/qti/sessions/init
app.post('/api/qti/sessions/init', authenticate, async (req, res) => {
  const { assessmentId, candidateId, resumeSessionId } = req.body;

  // Validate candidate has access to assessment
  await validateAccess(candidateId, assessmentId);

  // Create or resume session
  const session = resumeSessionId
    ? await resumeSession(resumeSessionId)
    : await createSession(assessmentId, candidateId);

  // Load assessment and filter for candidate role
  const assessment = await loadAssessment(assessmentId);
  const filteredAssessment = filterForRole(assessment, 'candidate');

  res.json({
    sessionId: session.id,
    assessment: filteredAssessment
  });
});

// POST /api/qti/responses/submit
app.post('/api/qti/responses/submit', authenticate, async (req, res) => {
  const { sessionId, itemIdentifier, responses } = req.body;

  // Validate session belongs to authenticated user
  await validateSession(sessionId, req.user.id);

  // Load FULL item XML (with correct answers)
  const itemXml = await loadItemXml(itemIdentifier);

  // Score SERVER-SIDE
  const result = scoreItem(itemXml, responses);

  // Store response and result
  await storeResponse(sessionId, itemIdentifier, responses, result);

  res.json({
    success: true,
    result
  });
});
```

---

## Example Implementations

### Example 1: RESTful Backend

```typescript
export class RestBackendAdapter implements BackendAdapter {
  constructor(
    private apiUrl: string,
    private authToken: string
  ) {}

  async initSession(req: InitSessionRequest): Promise<InitSessionResponse> {
    const res = await fetch(`${this.apiUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req)
    });
    return res.json();
  }

  // ... other methods
}
```

### Example 2: GraphQL Backend

```typescript
export class GraphQLBackendAdapter implements BackendAdapter {
  constructor(private client: ApolloClient) {}

  async initSession(req: InitSessionRequest): Promise<InitSessionResponse> {
    const result = await this.client.mutate({
      mutation: gql`
        mutation InitSession($input: InitSessionInput!) {
          initSession(input: $input) {
            sessionId
            assessment { ... }
          }
        }
      `,
      variables: { input: req }
    });
    return result.data.initSession;
  }

  // ... other methods
}
```

### Example 3: WebSocket for Real-Time

```typescript
export class WebSocketBackendAdapter implements BackendAdapter {
  constructor(private ws: WebSocket) {}

  async submitResponses(req: SubmitResponsesRequest): Promise<SubmitResponsesResponse> {
    return new Promise((resolve) => {
      const requestId = crypto.randomUUID();

      const handler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.requestId === requestId) {
          this.ws.removeEventListener('message', handler);
          resolve(data.response);
        }
      };

      this.ws.addEventListener('message', handler);
      this.ws.send(JSON.stringify({
        type: 'submitResponses',
        requestId,
        data: req
      }));
    });
  }

  // ... other methods
}
```

---

## Security Checklist

Before deploying to production, verify:

- [ ] All scoring happens server-side
- [ ] Correct answers never sent to candidate clients
- [ ] QTI XML filtered based on role before sending to client
- [ ] Authentication enforced on all API endpoints
- [ ] Session IDs are cryptographically random
- [ ] HTTPS/TLS enforced for all connections
- [ ] CORS configured properly
- [ ] Rate limiting on submission endpoints
- [ ] Input validation on all requests
- [ ] SQL injection prevention (use parameterized queries)
- [ ] XSS prevention (sanitize HTML in feedback)
- [ ] Audit logging for all score changes

---

## Testing Your Implementation

Test your backend adapter:

```typescript
import { describe, it, expect } from 'bun:test';
import { MyBackendAdapter } from './MyBackendAdapter';

describe('MyBackendAdapter', () => {
  it('should initialize session', async () => {
    const adapter = new MyBackendAdapter('https://api.example.com', 'token');
    const response = await adapter.initSession({
      assessmentId: 'test-001',
      candidateId: 'student-123'
    });

    expect(response.sessionId).toBeDefined();
    expect(response.assessment).toBeDefined();

    // SECURITY: Verify no correct answers in client response
    const itemXml = response.assessment.testParts[0].sections[0].items[0].itemXml;
    expect(itemXml).not.toContain('<correctResponse>');
    expect(itemXml).not.toContain('<responseProcessing>');
  });

  it('should score responses server-side', async () => {
    const adapter = new MyBackendAdapter('https://api.example.com', 'token');

    // Mock incorrect response
    const response = await adapter.submitResponses({
      sessionId: 'test-session',
      itemIdentifier: 'item-1',
      responses: { RESPONSE: 'B' }, // Wrong answer
      submittedAt: Date.now()
    });

    expect(response.success).toBe(true);
    expect(response.result?.score).toBe(0); // Should be scored server-side
  });
});
```

---

## Support

For questions or issues:
- GitHub Issues: https://github.com/pie-framework/qti2-player/issues
- API Contract: `src/integration/api-contract.ts`
- Reference Implementation: `src/integration/ReferenceBackendAdapter.ts`
