-- Core Supabase/PostgreSQL schema for the storefront. This creates structure
-- only; it does not configure Storage buckets or add application-specific RLS
-- policies.
--
-- Import notes:
--   * Storefront document IDs are preserved where practical (products use bigint;
--     other document IDs use text).
--   * Storefront timestamps / ISO strings / epoch milliseconds map to timestamptz.
--   * Order items keep a product_snapshot so historical orders remain readable
--     after catalog edits.
--   * Storefront settings and provider configuration stay JSONB because their
--     shape is deeply nested and evolves frequently.
--   * Do not import provider credentials or secrets into JSONB settings; use a
--     server-side secrets manager. The profiles.admin flag is server-managed only.
--   * This script intentionally enables RLS without permissive policies. Add
--     reviewed policies or use trusted Edge Functions before exposing the data.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  phone text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  city text not null default '',
  province text not null default '',
  postal_code text not null default '',
  birthday date,
  marketing_consent boolean not null default false,
  admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  name text not null,
  image text not null default '',
  sub text not null default '',
  color text not null default '',
  parent_id text references public.categories(id) on update cascade on delete set null,
  seo jsonb not null default '{}'::jsonb,
  extra jsonb not null default '{}'::jsonb
);

create table if not exists public.products (
  id bigint primary key,
  name text not null,
  category_id text references public.categories(id) on update cascade on delete set null,
  category_label text not null default '',
  brand text,
  status text not null default 'active'
    check (status in ('active', 'draft', 'archived')),
  price numeric(12,2) not null check (price >= 0),
  old_price numeric(12,2) check (old_price is null or old_price >= 0),
  badge text,
  image text not null default '',
  images jsonb not null default '[]'::jsonb,
  shade text not null default '',
  from_price boolean not null default false,
  variants jsonb not null default '[]'::jsonb,
  variation_types jsonb not null default '[]'::jsonb,
  variant_matrix jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  additional_info text,
  description text,
  usage text,
  shipping_info text,
  in_stock boolean not null default true,
  stock integer not null default 0 check (stock >= 0),
  rating numeric(3,2) check (rating is null or rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  free_delivery_eligible boolean not null default false,
  cash_on_delivery_enabled boolean not null default false,
  quantity_discounts jsonb,
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz,
  updated_at timestamptz not null default now(),
  extra jsonb not null default '{}'::jsonb
);

create index if not exists products_status_category_idx
  on public.products(status, category_id);
create index if not exists products_created_at_idx
  on public.products(created_at desc);

create table if not exists public.deals (
  id text primary key,
  name text not null default '',
  buy_x integer not null check (buy_x > 0),
  get_y integer not null check (get_y > 0),
  product_ids bigint[] not null default '{}',
  active boolean not null default false,
  extra jsonb not null default '{}'::jsonb
);

create table if not exists public.coupons (
  id text primary key,
  code text not null,
  percent_off numeric(5,2) not null check (percent_off between 0 and 100),
  minimum_subtotal numeric(12,2) not null default 0 check (minimum_subtotal >= 0),
  active boolean not null default false,
  expires_at date,
  extra jsonb not null default '{}'::jsonb
);
create unique index if not exists coupons_code_upper_idx on public.coupons (upper(code));

create table if not exists public.reviews (
  id text primary key,
  customer text not null default '',
  city text not null default '',
  body text not null default '',
  rating numeric(3,2) not null check (rating between 0 and 5),
  published boolean not null default false,
  video_url text not null default '',
  thumbnail_url text not null default '',
  avatar_url text,
  created_at timestamptz,
  extra jsonb not null default '{}'::jsonb
);
create index if not exists reviews_published_created_idx
  on public.reviews(published, created_at desc);

-- Shared storefront content, settings, policies, and future fields.
create table if not exists public.store_config (
  id text primary key default 'global' check (id = 'global'),
  content jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  policies jsonb not null default '{}'::jsonb,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Per-user cart and wishlist state.
create table if not exists public.storefront_state (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  state_type text not null check (state_type in ('cart', 'wishlist')),
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (profile_id, state_type)
);

create table if not exists public.orders (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  address_line2 text,
  city text not null,
  province text not null,
  postal_code text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  quantity_tier_discount numeric(12,2) not null default 0,
  buy_x_get_y_discount numeric(12,2) not null default 0,
  coupon_code text not null default '',
  coupon_discount numeric(12,2) not null default 0,
  delivery_charge numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null check (grand_total >= 0),
  status text not null default 'Pending'
    check (status in ('Pending', 'Processing', 'Confirmed by Call', 'Shipped',
                      'Out for Delivery', 'Delivered', 'Cancelled')),
  courier text not null default '',
  tracking_number text not null default '',
  tracking_url text,
  payment_method text not null
    check (payment_method in ('BANK_TRANSFER', 'EASYPAISA', 'JAZZCASH', 'COD')),
  transaction_reference text,
  payment_verified boolean not null default false,
  payment_verified_at timestamptz,
  payment_verified_by text,
  payment_verified_by_label text,
  customer_note text,
  whatsapp_opt_in boolean not null default false,
  whatsapp_updates_opt_in boolean not null default false,
  whatsapp_marketing_opt_in boolean not null default false,
  whatsapp_confirmation jsonb,
  voice_call jsonb,
  created_at timestamptz not null default now(),
  extra jsonb not null default '{}'::jsonb
);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_created_idx on public.orders(status, created_at desc);

create table if not exists public.order_items (
  id bigint generated by default as identity primary key,
  order_id text not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  variant text not null default 'Standard',
  variant_id text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  product_snapshot jsonb not null default '{}'::jsonb,
  extra jsonb not null default '{}'::jsonb
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.admin_allowlist (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- Singleton used for administrator allowlist revision tracking.
create table if not exists public.admin_access_state (
  id text primary key default 'state' check (id = 'state'),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  extra jsonb not null default '{}'::jsonb
);

create table if not exists public.admin_audit_log (
  id text primary key,
  actor_uid text,
  actor_email text,
  target_uid text,
  target_email text,
  action text not null,
  created_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_created_idx
  on public.admin_audit_log(created_at desc);

create table if not exists public.inbox (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  phone text not null default '',
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'read', 'replied', 'archived')),
  submitted_at timestamptz not null default now(),
  replied_at timestamptz,
  replies jsonb not null default '[]'::jsonb,
  extra jsonb not null default '{}'::jsonb
);
create index if not exists inbox_status_submitted_idx
  on public.inbox(status, submitted_at desc);

create table if not exists public.newsletter_subscribers (
  id text primary key,
  email text not null unique,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  extra jsonb not null default '{}'::jsonb
);

-- Metadata only: migrate file bytes separately into a Supabase Storage bucket.
create table if not exists public.media_assets (
  id text primary key,
  name text not null default '',
  path text not null default '',
  url text not null default '',
  folder text,
  uploaded_at timestamptz not null default now(),
  extra jsonb not null default '{}'::jsonb
);

create table if not exists public.email_settings (
  id text primary key default 'config' check (id = 'config'),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.voice_settings (
  id text primary key default 'config' check (id = 'config'),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_campaign_drafts (
  id text primary key,
  name text not null default '',
  audience text,
  subject text not null default '',
  status text not null default 'draft',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_campaign_drafts_updated_idx
  on public.email_campaign_drafts(updated_at desc);

create table if not exists public.email_campaigns (
  id text primary key,
  name text not null default '',
  subject text not null default '',
  audience text,
  status text not null default 'pending',
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists email_campaigns_created_idx
  on public.email_campaigns(created_at desc);

create table if not exists public.email_logs (
  id text primary key,
  provider text not null default 'none',
  message_type text not null default '',
  recipient text not null default '',
  sender text not null default '',
  subject text not null default '',
  status text not null default 'failed',
  reason text not null default '',
  created_at timestamptz not null default now(),
  extra jsonb not null default '{}'::jsonb
);
create index if not exists email_logs_created_idx on public.email_logs(created_at desc);

create table if not exists public.checkout_sessions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null default '',
  phone text not null default '',
  email_consent boolean not null default false,
  whatsapp_recovery_consent boolean not null default false,
  items jsonb not null default '[]'::jsonb,
  order_total numeric(12,2) not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recovery_state jsonb not null default '{}'::jsonb,
  extra jsonb not null default '{}'::jsonb
);
create index if not exists checkout_sessions_status_updated_idx
  on public.checkout_sessions(status, updated_at);

create table if not exists public.rate_limits (
  key text primary key,
  window_started_at timestamptz,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  extra jsonb not null default '{}'::jsonb
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.deals enable row level security;
alter table public.coupons enable row level security;
alter table public.reviews enable row level security;
alter table public.store_config enable row level security;
alter table public.storefront_state enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_allowlist enable row level security;
alter table public.admin_access_state enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.inbox enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.media_assets enable row level security;
alter table public.email_settings enable row level security;
alter table public.voice_settings enable row level security;
alter table public.email_campaign_drafts enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_logs enable row level security;
alter table public.checkout_sessions enable row level security;
alter table public.rate_limits enable row level security;

comment on table public.store_config is
  'Storefront content/settings/policies are retained as JSONB.';
comment on table public.profiles is
  'Supabase Auth profile; this row must not be used as an authentication credential.';
comment on table public.order_items is
  'Normalized from each order items array; product_snapshot preserves the purchased listing.';
comment on table public.media_assets is
  'Storefront metadata only. Upload file objects separately to Supabase Storage.';

commit;
