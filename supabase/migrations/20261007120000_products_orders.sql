-- Products Bjorn sells, and what each appointment ended up costing (service price after discount, plus products).

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null default 0,
  stock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Only the edge functions (service role) read or write products.
alter table products enable row level security;

-- The service price actually charged, after a discount. Null means the list price stored in `price`.
alter table bookings add column if not exists charged numeric(10, 2);

create table if not exists booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  name text not null,
  list_price numeric(10, 2) not null,
  price numeric(10, 2) not null,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists booking_items_booking_idx on booking_items (booking_id);

alter table booking_items enable row level security;
