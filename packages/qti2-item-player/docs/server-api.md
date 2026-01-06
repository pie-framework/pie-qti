# Backend Scoring API Contract

This document defines the API contract for implementing secure server-side scoring with the PIE QTI 2.2 Player.

## Overview

The PIE QTI 2.2 Player supports both client-side and server-side scoring. For production environments where security is critical, server-side scoring is recommended to:

1. **Prevent Answer Exposure** - Keep correct answers and scoring logic hidden from the client
2. **Prevent Score Tampering** - Calculate scores on the server where they cannot be manipulated
3. **Filter Sensitive Data** - Control what data is sent to the client based on role and mode
4. **Audit Responses** - Log all submissions for security and analytics

## API Endpoints

### 1. Score Response Endpoint

**Purpose**: Calculate the score for a candidate's response without exposing correct answers or scoring logic to the client.

#### Request

```
POST /api/qti/score
Content-Type: application/json
Authorization: Bearer <token> (optional, recommended)
```

**Request Body:**
```typescript
{
  itemXml: string;           // The QTI 2.2 XML for the item
  responses: {               // The candidate's responses
    [responseIdentifier: string]: any;
  };
  sessionId?: string;        // Optional session identifier for tracking
  candidateId?: string;      // Optional candidate identifier
}
```

**Example:**
```json
{
  "itemXml": "<?xml version=\"1.0\"?><assessmentItem>...</assessmentItem>",
  "responses": {
    "RESPONSE": "ChoiceA"
  },
  "sessionId": "sess_abc123",
  "candidateId": "student_456"
}
```

#### Response

**Success Response (200 OK):**
```typescript
{
  success: true;
  result: {
    score: number;           // Normalized score (0.0 to 1.0 typically)
    maxScore: number;        // Maximum possible score
    completed: boolean;      // Whether the response is complete
    outcomeValues: {         // Outcome variables (filtered for security)
      SCORE: number;
      MAXSCORE: number;
      // Other outcomes based on item definition
    };
  };
  sessionId?: string;        // Echo back session ID if provided
}
```

**Example:**
```json
{
  "success": true,
  "result": {
    "score": 1.0,
    "maxScore": 1.0,
    "completed": true,
    "outcomeValues": {
      "SCORE": 1.0,
      "MAXSCORE": 1.0,
      "completionStatus": "completed"
    }
  },
  "sessionId": "sess_abc123"
}
```

**Error Response (400/500):**
```typescript
{
  error: string;             // Human-readable error message
  code?: string;             // Optional error code for client handling
}
```

### 2. Get Filtered Item Endpoint (Optional)

**Purpose**: Return the QTI item XML with correct answers and sensitive information filtered based on the candidate's QTI 2.2 standard role.

```
POST /api/qti/item/filter
Content-Type: application/json
Authorization: Bearer <token> (optional, recommended)
```

**Request Body:**
```typescript
{
  itemXml: string;           // The full QTI 2.2 XML
  role: QTIRole;             // 'candidate' | 'scorer' | 'author' | 'tutor' | 'proctor' | 'testConstructor'
  sessionId?: string;
}
```

**Response:**
```typescript
{
  success: true;
  filteredXml: string;       // XML with correctResponse elements removed
  rubrics: Array<{           // Rubrics visible to this role
    html: string;
    view: string[];
  }>;
}
```

### 3. Session Management Endpoints (Optional)

#### Save Session
```
POST /api/qti/session/save
```

**Request:**
```typescript
{
  sessionId: string;
  itemId: string;
  candidateId: string;
  responses: Record<string, any>;
  sessionState: Record<string, any>;
  timestamp: string;
}
```

#### Load Session
```
GET /api/qti/session/:sessionId
```

**Response:**
```typescript
{
  sessionId: string;
  itemId: string;
  responses: Record<string, any>;
  sessionState: Record<string, any>;
  lastModified: string;
}
```

## Security Considerations

### 1. Authentication & Authorization

**Recommended: Use JWT-based authentication**

```typescript
// Example middleware check
import jwt from 'jsonwebtoken';

async function authenticateRequest(request: Request): Promise<TokenPayload> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);
  const payload = jwt.verify(token, process.env.JWT_SECRET);

  return payload as TokenPayload;
}

// Use in endpoint
export async function POST({ request }: RequestEvent) {
  const user = await authenticateRequest(request);

  // Verify user has permission to submit for this item/session
  if (!canAccessItem(user, itemId)) {
    return json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Continue with scoring...
}
```

### 2. Data Filtering

**Never send correct answers to the client for candidate role:**

```typescript
function filterItemXml(xml: string, role: QTIRole): string {
  // Remove <correctResponse> elements for candidates
  // QTI 2.2 role-based behavior: candidate role should not see correct answers
  if (role === 'candidate') {
    // Use XML parser to remove correctResponse nodes
    return removeCorrectResponses(xml);
  }
  return xml;
}
```

### 3. Rate Limiting

**Prevent abuse with rate limiting:**

```typescript
// Example using express-rate-limit or similar
import rateLimit from '@fastify/rate-limit';

const scoringLimiter = rateLimit({
  max: 100,                    // 100 requests
  timeWindow: '15 minutes',    // per 15 minutes
  cache: 10000,                // keep 10k users in memory
});

// Apply to endpoint
app.post('/api/qti/score', { preHandler: scoringLimiter }, handler);
```

### 4. Input Validation

**Always validate and sanitize inputs:**

```typescript
import { z } from 'zod';

const ScoringRequestSchema = z.object({
  itemXml: z.string().min(1).max(1_000_000), // Limit XML size
  responses: z.record(z.any()),
  sessionId: z.string().uuid().optional(),
  candidateId: z.string().optional(),
});

export async function POST({ request }: RequestEvent) {
  const body = await request.json();

  // Validate request
  const validation = ScoringRequestSchema.safeParse(body);
  if (!validation.success) {
    return json({
      error: 'Invalid request',
      details: validation.error
    }, { status: 400 });
  }

  const { itemXml, responses, sessionId } = validation.data;
  // Continue...
}
```

### 5. Audit Logging

**Log all scoring requests for security and analytics:**

```typescript
interface AuditLog {
  timestamp: string;
  candidateId: string;
  sessionId: string;
  itemId: string;
  responses: Record<string, any>;
  score: number;
  ipAddress: string;
  userAgent: string;
}

async function auditScoring(log: AuditLog): Promise<void> {
  // Write to secure audit log
  await db.auditLogs.insert(log);
}
```

## Example Implementation

Here's a complete example implementation using SvelteKit:

```typescript
// src/routes/api/qti/score/+server.ts
import { json, type RequestEvent } from '@sveltejs/kit';
import { Player } from '@pie-qti/qti2-item-player';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

// Request validation schema
const ScoringRequestSchema = z.object({
  itemXml: z.string().min(1).max(1_000_000),
  responses: z.record(z.any()),
  sessionId: z.string().optional(),
  candidateId: z.string().optional(),
});

// Authenticate JWT token
async function authenticate(request: Request) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const token = authHeader.substring(7);
  const payload = jwt.verify(token, process.env.JWT_SECRET!);

  return payload as { candidateId: string; role: string };
}

export async function POST({ request, getClientAddress }: RequestEvent) {
  try {
    // 1. Authenticate (optional, but recommended)
    let user;
    try {
      user = await authenticate(request);
    } catch (err) {
      // If JWT is not configured, allow anonymous for demo purposes
      if (process.env.REQUIRE_AUTH === 'true') {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }
      user = { candidateId: 'anonymous', role: 'candidate' };
    }

    // 2. Parse and validate request
    const body = await request.json();
    const validation = ScoringRequestSchema.safeParse(body);

    if (!validation.success) {
      return json(
        { error: 'Invalid request', details: validation.error },
        { status: 400 }
      );
    }

    const { itemXml, responses, sessionId, candidateId } = validation.data;

    // 3. Verify authorization (optional)
    if (candidateId && candidateId !== user.candidateId && user.role !== 'instructor') {
      return json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Create player and score response
    const player = new Player({
      itemXml,
      role: 'scorer', // Use scorer role to get accurate scoring
    });

    // Set responses
    for (const [identifier, value] of Object.entries(responses)) {
      player.setResponse(identifier, value);
    }

    const scoringResult = player.processResponses();

    // 5. Audit log (recommended)
    await auditScoring({
      timestamp: new Date().toISOString(),
      candidateId: candidateId || user.candidateId,
      sessionId: sessionId || '',
      itemId: extractItemId(itemXml),
      responses,
      score: scoringResult.score,
      ipAddress: getClientAddress(),
      userAgent: request.headers.get('user-agent') || '',
    });

    // 6. Return filtered result (remove sensitive outcome values if needed)
    return json({
      success: true,
      result: {
        score: scoringResult.score,
        maxScore: scoringResult.maxScore,
        completed: scoringResult.completed,
        outcomeValues: filterOutcomes(scoringResult.outcomeValues, user.role),
      },
      sessionId,
    });

  } catch (error: any) {
    console.error('Scoring error:', error);

    // Don't expose internal errors to client
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper: Filter outcome values based on role
function filterOutcomes(
  outcomes: Record<string, any>,
  role: string
): Record<string, any> {
  // Always include SCORE and MAXSCORE
  const filtered: Record<string, any> = {
    SCORE: outcomes.SCORE,
    MAXSCORE: outcomes.MAXSCORE,
  };

  // Include completionStatus for all roles
  if (outcomes.completionStatus) {
    filtered.completionStatus = outcomes.completionStatus;
  }

  // Privileged roles can see all outcomes (QTI 2.2 standard roles)
  if (role === 'scorer' || role === 'author' || role === 'tutor' || role === 'testConstructor') {
    return outcomes;
  }

  return filtered;
}

// Helper: Extract item identifier from XML
function extractItemId(xml: string): string {
  const match = xml.match(/identifier="([^"]+)"/);
  return match ? match[1] : 'unknown';
}

// Helper: Audit logging
async function auditScoring(log: AuditLog): Promise<void> {
  // Implement your audit logging here
  // Examples: Write to database, send to logging service, etc.
  console.log('Audit log:', log);
}

interface AuditLog {
  timestamp: string;
  candidateId: string;
  sessionId: string;
  itemId: string;
  responses: Record<string, any>;
  score: number;
  ipAddress: string;
  userAgent: string;
}
```

## Configuration Options

### Client Configuration

The player can be configured to use backend scoring:

```typescript
// Configure player to use backend scoring
const config = {
  useBackendScoring: true,
  scoringEndpoint: '/api/qti/score', // Customizable endpoint
  authToken: 'Bearer <your-jwt-token>', // Optional
};
```

### Environment Variables

```bash
# .env file
JWT_SECRET=your-secret-key-here
REQUIRE_AUTH=true
SCORING_RATE_LIMIT=100
AUDIT_LOG_ENABLED=true
```

## Client Integration

### Example: Using Backend Scoring in the Demo

```typescript
// In your Svelte component
async function submitAnswer() {
  const response = await fetch('/api/qti/score', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`, // If using JWT
    },
    body: JSON.stringify({
      itemXml: currentItemXml,
      responses: currentResponses,
      sessionId: currentSessionId,
      candidateId: currentUserId,
    }),
  });

  if (!response.ok) {
    throw new Error('Scoring failed');
  }

  const result = await response.json();

  if (result.success) {
    scoringResult = result.result;
  }
}
```

## Customization Guide

### Custom Endpoint Paths

You can customize the endpoint paths in your implementation:

```typescript
// Default: /api/qti/score
// Custom: /your-custom-path/score

// Update client configuration
const player = new Player({
  // ... other config
  scoringEndpoint: '/your-custom-path/score',
});
```

### Adding Custom Security Headers

```typescript
// Add CSRF protection
export async function POST({ request, cookies }: RequestEvent) {
  const csrfToken = request.headers.get('X-CSRF-Token');
  const storedToken = cookies.get('csrf-token');

  if (csrfToken !== storedToken) {
    return json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // Continue with scoring...
}
```

### Database Integration

```typescript
// Save responses to database before scoring
async function saveResponse(data: {
  candidateId: string;
  itemId: string;
  responses: Record<string, any>;
  sessionId: string;
}) {
  await db.responses.create({
    data: {
      ...data,
      timestamp: new Date(),
    },
  });
}
```

## Testing

### Example Test Cases

```typescript
import { describe, it, expect } from 'vitest';

describe('Scoring API', () => {
  it('should score correct response', async () => {
    const response = await fetch('/api/qti/score', {
      method: 'POST',
      body: JSON.stringify({
        itemXml: SAMPLE_ITEM_XML,
        responses: { RESPONSE: 'ChoiceA' },
      }),
    });

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.result.score).toBe(1.0);
  });

  it('should require authentication when enabled', async () => {
    const response = await fetch('/api/qti/score', {
      method: 'POST',
      body: JSON.stringify({
        itemXml: SAMPLE_ITEM_XML,
        responses: { RESPONSE: 'ChoiceA' },
      }),
    });

    expect(response.status).toBe(401);
  });

  it('should validate request schema', async () => {
    const response = await fetch('/api/qti/score', {
      method: 'POST',
      body: JSON.stringify({
        // Missing itemXml
        responses: { RESPONSE: 'ChoiceA' },
      }),
    });

    expect(response.status).toBe(400);
  });
});
```

## Performance Considerations

### Caching

For items that don't change frequently:

```typescript
import { LRUCache } from 'lru-cache';

const playerCache = new LRUCache<string, Player>({
  max: 500, // Cache up to 500 parsed items
  ttl: 1000 * 60 * 60, // 1 hour
});

// Use cached player instance
const cacheKey = hashItemXml(itemXml);
let player = playerCache.get(cacheKey);

if (!player) {
  player = new Player({ itemXml, role: 'scorer' });
  playerCache.set(cacheKey, player);
}

// Set responses and score
for (const [identifier, value] of Object.entries(responses)) {
  player.setResponse(identifier, value);
}
const result = player.processResponses();
```

### Connection Pooling

For database operations, use connection pooling to improve performance.

## Compliance & Privacy

### GDPR Considerations

When implementing scoring APIs in production:

1. **Data Minimization** - Only store necessary response data
2. **Right to Erasure** - Implement endpoints to delete candidate data
3. **Data Portability** - Allow candidates to export their response data
4. **Audit Trail** - Log all data access for compliance

### Example: Data Deletion Endpoint

```typescript
export async function DELETE({ request, params }: RequestEvent) {
  const { candidateId } = params;
  const user = await authenticate(request);

  // Verify authorization
  if (user.candidateId !== candidateId && user.role !== 'admin') {
    return json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete all candidate data
  await db.responses.deleteMany({ where: { candidateId } });
  await db.sessions.deleteMany({ where: { candidateId } });
  await db.auditLogs.deleteMany({ where: { candidateId } });

  return json({ success: true });
}
```

## Support & Documentation

For questions or issues with backend scoring integration:

- **Documentation**: See the main PIE QTI 2.2 Player README
- **GitHub Issues**: https://github.com/pie-framework/pie-transform/issues
- **Examples**: See the `qti2-example` package for working implementations

## Summary

This API contract provides a secure foundation for server-side scoring with the PIE QTI 2.2 Player. Key features:

- ✅ **Security**: JWT authentication, input validation, rate limiting
- ✅ **Flexibility**: Customizable endpoints, middleware, and security policies
- ✅ **Privacy**: Data filtering, audit logging, GDPR compliance
- ✅ **Performance**: Caching strategies, connection pooling
- ✅ **Testing**: Example test cases and validation

You have full control over authentication, authorization, and data handling, allowing you to integrate the player into your existing security infrastructure.
