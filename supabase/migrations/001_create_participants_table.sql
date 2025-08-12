-- Create participants table
create table if not exists participants (
  id uuid default gen_random_uuid() primary key,
  staff_id text not null unique,
  title text,
  first_name text not null,
  last_name text not null,
  email text,
  post text,
  department text,
  attended boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes
create index if not exists participants_staff_id_idx on participants (staff_id);
create index if not exists participants_attended_idx on participants (attended);

-- Enable RLS
alter table participants enable row level security;

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
   NEW.updated_at = now();
   return NEW;
end;
$$ language 'plpgsql';

create trigger update_participants_updated_at before update
  on participants for each row execute procedure update_updated_at_column();