# Testing Patterns

**Analysis Date:** 2026-03-08

## Test Framework

**Runner:**
- Jest 29.7.0 (both backend and frontend)
- Backend: `ts-jest` for TypeScript transformation
- Frontend: `jest-environment-jsdom` for DOM simulation
- No `jest.config.*` files found — Jest configuration likely embedded in `package.json` or relies on defaults

**Assertion Library:**
- Jest built-in (`expect`, `toBe`, `toEqual`, `toHaveLength`, `toBeGreaterThan`, etc.)
- Frontend additionally: `@testing-library/jest-dom` (matchers like `toBeInTheDocument`)

**Run Commands:**
```bash
# Backend (run from backend/)
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report

# Frontend (run from frontend/)
npm test                   # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

## Test File Organization

**Backend:**
- Location: `backend/tests/` — separate from source, not co-located
- Naming: `{subject}.test.ts` (e.g., `formService.test.ts`, `api.integration.test.ts`)
- Two files total: one service test, one API integration test

**Frontend:**
- Location: `frontend/__tests__/` — separate directory, not co-located
- Subdirectories mirror concern type: `__tests__/components/`, `__tests__/api/`
- Naming: `{Subject}.test.tsx` for components, `{concern}.test.ts` for API

**Structure:**
```
backend/
└── tests/
    ├── formService.test.ts         # Service-level integration tests (uses real DB)
    └── api.integration.test.ts     # HTTP-level integration tests (uses supertest)

frontend/
└── __tests__/
    ├── components/
    │   └── DynamicForm.test.tsx    # React component rendering and interaction tests
    └── api/
        └── integration.test.ts     # API client tests (axios mocked)
```

## Test Structure

**Suite Organization:**
```typescript
describe('FormService - Dynamic Form Generation', () => {
  let db: Client;
  let formService: FormService;

  beforeAll(async () => {
    // Connect to real test database
    db = new Client({ ... });
    await db.connect();
    formService = new FormService(db);
  });

  afterAll(async () => {
    await db.end();
  });

  describe('generateFormForTask', () => {
    it('should generate form for locksmith inspecting door', async () => { ... });
    it('should throw error for non-existent task', async () => { ... });
  });

  describe('validateFormSubmission', () => {
    it('should validate required fields present', async () => { ... });
    it('should reject missing required field', async () => { ... });
  });
});
```

**Patterns:**
- `beforeAll` / `afterAll` for database connections (not `beforeEach` — no test isolation reset)
- `beforeEach(() => jest.clearAllMocks())` in frontend tests that use mocks
- Async tests use `async/await` throughout — no callback-style
- Test descriptions follow pattern: `'should {verb} {outcome}'`

## Mocking

**Backend tests:** No mocking — backend tests hit a real PostgreSQL database (live integration tests). Database credentials sourced from environment variables with fallback to defaults (`doorman_user`, `doorman_pass`, `localhost`, `5432`, `doorman_db`).

**Frontend component tests (`DynamicForm.test.tsx`):**
- Mock data defined inline as `const mockFormSchema = { fields: [...] }` at file top
- `jest.fn()` for callback props (e.g., `const onSubmit = jest.fn()`)
- No module-level mocking — components tested with real implementations

**Frontend API tests (`__tests__/api/integration.test.ts`):**
```typescript
// Module mock at top of file
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Per-test mock setup
mockedAxios.post.mockResolvedValue({ data: { token: 'mock-token', user: { ... } } });
mockedAxios.get.mockRejectedValueOnce(new Error('Network timeout'))
           .mockResolvedValueOnce({ data: { success: true } });
```

**What to Mock:**
- Axios HTTP calls in frontend API client tests
- Callback props (`onSubmit`, `onChange`) in component tests using `jest.fn()`

**What NOT to Mock:**
- Database in backend service tests — real DB connection is used
- React component internals — tested through rendered output

## Fixtures and Factories

**Test Data:**
- Backend tests rely on pre-seeded database data (10+ door instances from migration scripts)
- Frontend tests use inline `const mock{Name} = { ... }` objects defined at file scope
- No shared fixture files or factory functions — each test file defines its own data

**Example inline fixture:**
```typescript
const mockFormSchema = {
  fields: [
    { id: 'field-1', name: 'door_id', type: 'text', label: 'Door ID', required: true },
    { id: 'field-2', name: 'fire_class', type: 'enum', label: 'Fire Class',
      required: true, options: ['EI30', 'EI60', 'EI90'] },
  ],
};
```

**Database state restoration:** Backend tests that mutate data restore original values manually:
```typescript
// Save original, mutate, then restore
const originalResult = await db.query('SELECT value FROM attribute_values WHERE ...');
// ... run the test ...
if (originalStatus !== null) {
  await db.query('UPDATE attribute_values SET value = $1 WHERE ...', [originalStatus, doorId]);
}
```

**Location:** No shared fixtures directory — all inline in test files.

## Coverage

**Requirements:** No coverage thresholds configured (no `coverageThreshold` in package.json)

**View Coverage:**
```bash
npm run test:coverage    # Generates coverage report (both backend and frontend)
```

## Test Types

**Unit Tests:**
- Frontend `DynamicForm.test.tsx` is a unit test — renders component in isolation with mock data, tests rendering and user interaction

**Integration Tests (backend service level):**
- `formService.test.ts` tests `FormService` methods against a real PostgreSQL database
- Tests verify permission-filtered form generation, validation logic, and save behavior
- Requires live database to be running (not mocked)

**Integration Tests (HTTP level):**
- `api.integration.test.ts` in backend uses `supertest` — tests Express routes end-to-end
- Note: the `app` variable is declared but never initialized in the current test file — these tests are scaffolded but not fully wired up yet

**Integration Tests (frontend API client):**
- `__tests__/api/integration.test.ts` tests the `ApiClient` class with mocked axios
- Covers auth flow, form API, object CRUD, process API, error handling, and retry logic

**E2E Tests:**
- Not present — no Playwright, Cypress, or similar framework found

## Common Patterns

**Async Testing:**
```typescript
it('should generate form for locksmith', async () => {
  const form = await formService.generateFormForTask('door-unlock_inspect-door', 1, 'locksmiths');
  expect(form.task_id).toBe('door-unlock_inspect-door');
  expect(form.fields.length).toBeGreaterThan(0);
});
```

**Error Testing:**
```typescript
// Service throws
it('should throw error for non-existent task', async () => {
  expect(async () => {
    await formService.generateFormForTask('non_existent_task', 1, 'locksmiths');
  }).rejects.toThrow();
});

// API returns error shape
it('handles authentication errors', async () => {
  mockedAxios.post.mockRejectedValue({ response: { status: 401, ... } });
  await expect(api.authenticate('wrong', 'wrong')).rejects.toThrow('Invalid credentials');
});
```

**React component interaction:**
```typescript
it('submits form with valid data', async () => {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  render(<DynamicForm schema={mockFormSchema} onSubmit={onSubmit} isLoading={false} />);

  await user.type(screen.getByLabelText('Door ID'), 'D-001');
  await user.selectOptions(screen.getByLabelText('Fire Class'), 'EI60');
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ door_id: 'D-001' }));
  });
});
```

**Partial matching:**
```typescript
// Use expect.objectContaining for partial shape matching
expect(result).toEqual({ token: 'mock-token', user: expect.objectContaining({ id: 'user-1' }) });
```

## Known Gaps

- Backend `api.integration.test.ts` has `app` declared but never initialized — HTTP-level tests are scaffolded but non-functional
- No `beforeEach` database cleanup in service tests — tests depend on specific seeded state and manually restore mutations
- No E2E test framework configured
- No coverage thresholds enforced

---

*Testing analysis: 2026-03-08*
