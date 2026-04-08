alter table public.msp_company_size
  add column if not exists company_size_tier text
    check (company_size_tier in ('micro', 'small', 'mid', 'large'));
