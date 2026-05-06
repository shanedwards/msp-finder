# Managed Service Provider Finder (MVP)

Internal sales tool built on the existing Next.js + Supabase starter.

## What It Does
- Runs a bounded AI research pipeline to find MSPs.
- Persists companies, capabilities, size evidence, sources, reviews, and scores in Supabase.
- Supports human verification (`approved` / `needs_review` / `rejected`).
- Keeps **internal confidence** separate from **user score (0-10)**.
- Exports table results to `.xlsx` with required formatting.

## Required Output Table Columns
- `Company Name`
- `Website`
- `Evidence`
- `Geography`
- `Employee Count`
- `Score (0-10)`

`GET /api/companies` returns:

```ts
type CompanyRow = {
  id: string;
  companyName: string;
  website: string | null;
  evidence: string;
  geography: string | null;
  employeeCount: string;
  score: number | null;
};
```

## Setup
1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY accepted as alias
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
ENABLE_MOCK_MODE=false
```

3. Run migrations:

```bash
npm run db:migrate:run
```

4. Start development server:

```bash
npm run dev
```

## MVP Workflow (LangGraph)
Pipeline node order:
1. `intake_node`
2. `search_plan_node`
3. `web_research_node`
4. `seed_research_node`
5. `candidate_extraction_node`
6. `entity_resolution_node`
7. `verification_node`
8. `confidence_scoring_node`
9. `persistence_node`
10. `export_ready_node`

## Deterministic Verification Rules
Final verification is enforced in code (not model-only):
- Reject if not a real MSP or classified as recruiter/directory/software vendor.
- Reject if website is missing/invalid.
- Reject if selected state/city/employee/capability filters are not satisfied.
- Reject if required AWS/Azure partner/reseller evidence is missing.

Possible outputs:
- `verified`
- `needs_review`
- `rejected`

## API Routes
- `POST /api/search`
- `GET /api/companies`
- `GET /api/companies/[id]`
- `POST /api/companies/[id]/verify`
- `POST /api/companies/[id]/score`
- `POST /api/companies/[id]/notes`
- `POST /api/exports`

## Search Bounds
- `MAX_SEARCH_QUERIES = 8`
- `MAX_SOURCES_FETCHED = 24`
- `MAX_CANDIDATES = 50`
- `MAX_FINAL_RESULTS = 50`
- `RESEARCH_ROUNDS = 3`
- `DEFAULT_RESULT_LIMIT = 50`

## Mock Mode
Set:

```dotenv
ENABLE_MOCK_MODE=true
```

When enabled, search uses deterministic fake MSP candidates so UI, scoring, and export can be tested without live web research.

## Notes
- `Evidence` in table rows is generated from saved source evidence (1-3 short sentences).
- Employee count is shown as `"Unknown"` when source evidence is insufficient.
- State filtering applies to `headquarters_state`.
