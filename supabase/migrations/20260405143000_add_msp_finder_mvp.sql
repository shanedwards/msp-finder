create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  filters_json jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  mock_mode boolean not null default false,
  started_at timestamp with time zone not null default timezone('utc', now()),
  completed_at timestamp with time zone,
  error_message text,
  total_candidates integer not null default 0,
  total_verified integer not null default 0,
  total_needs_review integer not null default 0,
  total_rejected integer not null default 0
);

create table if not exists public.msp_companies (
  id uuid primary key default gen_random_uuid(),
  latest_research_run_id uuid references public.research_runs(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  company_name text not null,
  normalized_name text not null,
  website text,
  website_domain text,
  headquarters_city text,
  headquarters_state text,
  evidence_summary text not null,
  verification_status text not null default 'needs_review' check (verification_status in ('verified', 'needs_review', 'rejected')),
  verification_reason text,
  internal_confidence_score integer not null default 0 check (internal_confidence_score >= 0 and internal_confidence_score <= 100),
  user_score numeric(4, 1) check (user_score >= 0 and user_score <= 10),
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  last_verified_at timestamp with time zone
);

create table if not exists public.msp_company_size (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.msp_companies(id) on delete cascade,
  employee_count_exact integer check (employee_count_exact is null or employee_count_exact >= 0),
  employee_count_min integer check (employee_count_min is null or employee_count_min >= 0),
  employee_count_max integer check (employee_count_max is null or employee_count_max >= 0),
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now())
);

create table if not exists public.msp_capabilities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.msp_companies(id) on delete cascade,
  aws_support boolean not null default false,
  azure_support boolean not null default false,
  aws_partner_claimed boolean not null default false,
  azure_partner_claimed boolean not null default false,
  aws_reseller_confirmed boolean not null default false,
  azure_reseller_confirmed boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now())
);

create table if not exists public.msp_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.msp_companies(id) on delete cascade,
  research_run_id uuid references public.research_runs(id) on delete set null,
  source_url text not null,
  source_title text,
  source_type text not null default 'other',
  extracted_claim text not null,
  supports_msp boolean not null default false,
  supports_aws boolean not null default false,
  supports_azure boolean not null default false,
  supports_employee_count boolean not null default false,
  supports_headquarters boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc', now())
);

create table if not exists public.company_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.msp_companies(id) on delete cascade,
  research_run_id uuid references public.research_runs(id) on delete set null,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'needs_review')),
  notes text,
  created_at timestamp with time zone not null default timezone('utc', now())
);

create table if not exists public.company_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.msp_companies(id) on delete cascade,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  score numeric(4, 1) not null check (score >= 0 and score <= 10),
  note text,
  created_at timestamp with time zone not null default timezone('utc', now())
);

create table if not exists public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users(id) on delete set null,
  filters_json jsonb not null,
  row_count integer not null default 0,
  status text not null default 'started' check (status in ('started', 'completed', 'failed')),
  file_name text,
  error_message text,
  created_at timestamp with time zone not null default timezone('utc', now()),
  completed_at timestamp with time zone
);

create index if not exists idx_msp_companies_headquarters_state on public.msp_companies(headquarters_state);
create index if not exists idx_msp_companies_website_domain on public.msp_companies(website_domain);
create index if not exists idx_msp_companies_user_score on public.msp_companies(user_score);
create index if not exists idx_msp_companies_internal_confidence on public.msp_companies(internal_confidence_score);
create index if not exists idx_msp_companies_verification_status on public.msp_companies(verification_status);

create index if not exists idx_msp_capabilities_aws_support on public.msp_capabilities(aws_support);
create index if not exists idx_msp_capabilities_azure_support on public.msp_capabilities(azure_support);
create index if not exists idx_msp_capabilities_aws_reseller_confirmed on public.msp_capabilities(aws_reseller_confirmed);
create index if not exists idx_msp_capabilities_azure_partner_claimed on public.msp_capabilities(azure_partner_claimed);
create index if not exists idx_msp_capabilities_azure_reseller_confirmed on public.msp_capabilities(azure_reseller_confirmed);

create index if not exists idx_msp_sources_company_id on public.msp_sources(company_id);
create index if not exists idx_company_scores_company_id_created_at on public.company_scores(company_id, created_at desc);

create trigger update_msp_companies_updated_at
before update on public.msp_companies
for each row
execute function public.update_updated_at_column();

create trigger update_msp_company_size_updated_at
before update on public.msp_company_size
for each row
execute function public.update_updated_at_column();

create trigger update_msp_capabilities_updated_at
before update on public.msp_capabilities
for each row
execute function public.update_updated_at_column();
