-- Create admins table
create table if not exists admins (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table admins enable row level security;

-- Create updated_at trigger
create trigger update_admins_updated_at before update
  on admins for each row execute procedure update_updated_at_column();