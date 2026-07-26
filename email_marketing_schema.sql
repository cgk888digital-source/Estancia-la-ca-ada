create table if not exists public.marketing_customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  source text not null default 'manual',
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed', 'prospect', 'vip')),
  tags text[] not null default '{}',
  consent_email boolean not null default true,
  last_stay_date date,
  total_bookings integer not null default 0,
  total_spent numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_customers_contact_required check (email is not null or phone is not null)
);

create unique index if not exists marketing_customers_email_unique_idx
  on public.marketing_customers (lower(email)) where email is not null;
create index if not exists marketing_customers_status_idx on public.marketing_customers(status);
create index if not exists marketing_customers_tags_idx on public.marketing_customers using gin(tags);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preview_text text,
  body text not null,
  category text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preview_text text,
  body text not null,
  segment text not null default 'all' check (segment in ('all', 'subscribed', 'vip', 'prospect', 'recent_guests', 'no_recent_stay')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'paused')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  customer_id uuid references public.marketing_customers(id) on delete set null,
  email text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'opened', 'clicked', 'bounced', 'unsubscribed')),
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, email)
);

alter table public.marketing_customers enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

revoke all privileges on table public.marketing_customers from anon;
revoke all privileges on table public.email_templates from anon;
revoke all privileges on table public.email_campaigns from anon;
revoke all privileges on table public.email_campaign_recipients from anon;

grant select, insert, update, delete on table public.marketing_customers to authenticated;
grant select, insert, update, delete on table public.email_templates to authenticated;
grant select, insert, update, delete on table public.email_campaigns to authenticated;
grant select, insert, update, delete on table public.email_campaign_recipients to authenticated;
