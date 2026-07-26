CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  role text not null check (role in ('admin', 'gerente'))
);

CREATE TABLE IF NOT EXISTS public.hotel_settings (
  key text primary key,
  value text not null,
  label text,
  updated_at timestamptz default now()
);

-- Insert roles for the newly created users
INSERT INTO public.user_roles (id, role)
VALUES 
  ('9181926d-4349-46d1-8f4c-c9f9e12b0a44', 'admin'),
  ('cf581087-edc5-48e4-88b5-d1a059329b7c', 'gerente')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_roles WHERE id = auth.uid();
$$;

-- Enable RLS on all tables
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_settings ENABLE ROW LEVEL SECURITY;

-- 1. Transactions Policies
-- Admin: All
CREATE POLICY "Admin can do anything on transactions" ON public.transactions
  FOR ALL
  TO authenticated
  USING (public.get_current_role() = 'admin')
  WITH CHECK (public.get_current_role() = 'admin');

-- Gerente: SELECT, INSERT, UPDATE, DELETE (based on user confirmation #1)
CREATE POLICY "Gerente can do anything on transactions" ON public.transactions
  FOR ALL
  TO authenticated
  USING (public.get_current_role() = 'gerente')
  WITH CHECK (public.get_current_role() = 'gerente');


-- 2. Employees Policies
-- Admin: All
CREATE POLICY "Admin can do anything on employees" ON public.employees
  FOR ALL
  TO authenticated
  USING (public.get_current_role() = 'admin')
  WITH CHECK (public.get_current_role() = 'admin');

-- Gerente: SELECT, INSERT, UPDATE, DELETE (based on user confirmation #2)
CREATE POLICY "Gerente can do anything on employees" ON public.employees
  FOR ALL
  TO authenticated
  USING (public.get_current_role() = 'gerente')
  WITH CHECK (public.get_current_role() = 'gerente');


-- 3. Bookings Policies
-- Admin: All
CREATE POLICY "Admin can do anything on bookings" ON public.bookings
  FOR ALL
  TO authenticated
  USING (public.get_current_role() = 'admin')
  WITH CHECK (public.get_current_role() = 'admin');

-- Gerente: SELECT, INSERT, UPDATE (NO DELETE) (based on user confirmation #3)
CREATE POLICY "Gerente can select bookings" ON public.bookings
  FOR SELECT TO authenticated USING (public.get_current_role() = 'gerente');
CREATE POLICY "Gerente can insert bookings" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (public.get_current_role() = 'gerente');
CREATE POLICY "Gerente can update bookings" ON public.bookings
  FOR UPDATE TO authenticated USING (public.get_current_role() = 'gerente') WITH CHECK (public.get_current_role() = 'gerente');

-- Guests can create booking requests from the public app with the anon key.
CREATE POLICY "Public can create booking requests" ON public.bookings
  FOR INSERT TO anon WITH CHECK (true);


-- 4. Comandas Policies
-- Admin: All
CREATE POLICY "Admin can do anything on comandas" ON public.comandas
  FOR ALL
  TO authenticated
  USING (public.get_current_role() = 'admin')
  WITH CHECK (public.get_current_role() = 'admin');

-- Gerente: SELECT, INSERT, UPDATE (NO DELETE)
CREATE POLICY "Gerente can select comandas" ON public.comandas
  FOR SELECT TO authenticated USING (public.get_current_role() = 'gerente');
CREATE POLICY "Gerente can insert comandas" ON public.comandas
  FOR INSERT TO authenticated WITH CHECK (public.get_current_role() = 'gerente');
CREATE POLICY "Gerente can update comandas" ON public.comandas
  FOR UPDATE TO authenticated USING (public.get_current_role() = 'gerente') WITH CHECK (public.get_current_role() = 'gerente');


-- 5. Accommodations Policies
-- Everyone can select (it's public info)
CREATE POLICY "Everyone can read accommodations" ON public.accommodations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can do anything on accommodations" ON public.accommodations
  FOR ALL TO authenticated USING (public.get_current_role() = 'admin');


-- 6. Restaurant Menu & Weekly Menu
-- Everyone can select
CREATE POLICY "Everyone can read restaurant_menu" ON public.restaurant_menu
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can do anything on restaurant_menu" ON public.restaurant_menu
  FOR ALL TO authenticated USING (public.get_current_role() = 'admin');
CREATE POLICY "Gerente can do anything on restaurant_menu" ON public.restaurant_menu
  FOR ALL TO authenticated USING (public.get_current_role() = 'gerente');

CREATE POLICY "Everyone can read weekly_menu" ON public.weekly_menu
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can do anything on weekly_menu" ON public.weekly_menu
  FOR ALL TO authenticated USING (public.get_current_role() = 'admin');
CREATE POLICY "Gerente can do anything on weekly_menu" ON public.weekly_menu
  FOR ALL TO authenticated USING (public.get_current_role() = 'gerente');

-- Fix for unauthenticated access! 
-- We must allow public access to things that guests see before logging in (like available accommodations, restaurant menu, weekly menu)
-- Wait, the App uses Anon Key for frontend visitors without logging in!
-- If we only allow "TO authenticated", visitors will see NOTHING.
-- So we must allow `anon` to SELECT accommodations and menus.
CREATE POLICY "Public can read accommodations" ON public.accommodations
  FOR SELECT TO anon USING (true);
CREATE POLICY "Public can read restaurant_menu" ON public.restaurant_menu
  FOR SELECT TO anon USING (true);
CREATE POLICY "Public can read weekly_menu" ON public.weekly_menu
  FOR SELECT TO anon USING (true);

CREATE POLICY "Public can read hotel_settings" ON public.hotel_settings
  FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can read hotel_settings" ON public.hotel_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage hotel_settings" ON public.hotel_settings
  FOR ALL TO authenticated USING (public.get_current_role() = 'admin') WITH CHECK (public.get_current_role() = 'admin');
CREATE POLICY "Gerente can update hotel_settings" ON public.hotel_settings
  FOR UPDATE TO authenticated USING (public.get_current_role() = 'gerente') WITH CHECK (public.get_current_role() = 'gerente');
-- What about bookings? The frontend doesn't show bookings to visitors. Admin only. So anon doesn't need bookings.
-- BUT wait, the frontend has an "Explorar Todas las Cabañas" button that might create a booking or show availability?
-- The EstanciaHome.tsx shows cabins, but we mock them right now or read from accommodations.

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_bookings_check_out ON public.bookings(check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON public.bookings(check_in);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);
