-- ====================================================================
-- DriveMate AI: Supabase PostgreSQL Schema & Migrations
-- Phase 3: Backend + Supabase Database Integration
-- ====================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------
-- 1. CUSTOMER PROFILES TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_profiles (
    id TEXT PRIMARY KEY, -- e.g., 'cust_alex_morgan_01' (or auth.uid() when Supabase Auth is enabled)
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    rating NUMERIC(3, 2) DEFAULT 4.95 CHECK (rating >= 1.0 AND rating <= 5.0),
    total_trips INTEGER DEFAULT 0 CHECK (total_trips >= 0),
    saved_vehicles JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- --------------------------------------------------------------------
-- 2. DRIVER PROFILES TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_profiles (
    id TEXT PRIMARY KEY, -- e.g., 'DRV-1042'
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    rating NUMERIC(3, 2) DEFAULT 4.96 CHECK (rating >= 1.0 AND rating <= 5.0),
    total_trips INTEGER DEFAULT 0 CHECK (total_trips >= 0),
    verification_status TEXT DEFAULT 'Police & Background Verified',
    badge TEXT DEFAULT 'Certified Gold Pilot',
    license_number TEXT NOT NULL,
    experience_years INTEGER DEFAULT 5 CHECK (experience_years >= 0),
    specializations JSONB DEFAULT '["Luxury Sedans & SUVs", "Automatic & EV Transmissions", "Defensive Driving Certified"]'::jsonb,
    languages JSONB DEFAULT '["English", "Kannada", "Hindi"]'::jsonb,
    is_online BOOLEAN DEFAULT true,
    total_earnings NUMERIC(10, 2) DEFAULT 0.00 CHECK (total_earnings >= 0),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- --------------------------------------------------------------------
-- 3. BOOKINGS TABLE
-- --------------------------------------------------------------------
-- Define allowed booking statuses explicitly
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE public.booking_status AS ENUM (
            'pending',
            'accepted',
            'in_progress',
            'completed',
            'rejected',
            'cancelled'
        );
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY, -- e.g., 'DM-98214'
    customer_id TEXT NOT NULL REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    pickup TEXT NOT NULL,
    destination TEXT NOT NULL,
    booking_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    duration INTEGER NOT NULL CHECK (duration >= 1 AND duration <= 24),
    vehicle_tier TEXT NOT NULL DEFAULT 'standard' CHECK (vehicle_tier IN ('standard', 'premium', 'outstation')),
    vehicle_name TEXT NOT NULL,
    estimated_fare NUMERIC(10, 2) NOT NULL CHECK (estimated_fare >= 0),
    driver_payout NUMERIC(10, 2) NOT NULL CHECK (driver_payout >= 0),
    status public.booking_status NOT NULL DEFAULT 'pending',
    driver_id TEXT REFERENCES public.driver_profiles(id) ON DELETE SET NULL,
    trip_notes TEXT DEFAULT '',
    rejection_reason TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    accepted_at TIMESTAMPTZ DEFAULT NULL,
    started_at TIMESTAMPTZ DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    cancelled_at TIMESTAMPTZ DEFAULT NULL
);

-- Indexing for high-throughput query filters
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_driver_id ON public.bookings(driver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

-- --------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------------
-- Enable RLS on all operational tables
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Service Role Key has full bypass access for backend server execution
-- For client direct access when Supabase Auth is enabled:

-- Customers can view their own profile and edit their personal car list
CREATE POLICY "Customers view own profile" 
ON public.customer_profiles FOR SELECT 
TO authenticated 
USING (auth.uid()::text = id);

-- Drivers can view their own driver profile
CREATE POLICY "Drivers view own profile" 
ON public.driver_profiles FOR SELECT 
TO authenticated 
USING (auth.uid()::text = id);

-- Customers can view their own bookings
CREATE POLICY "Customers view own bookings" 
ON public.bookings FOR SELECT 
TO authenticated 
USING (auth.uid()::text = customer_id);

-- Drivers can view pending dispatches AND their assigned trips
CREATE POLICY "Drivers view accessible bookings" 
ON public.bookings FOR SELECT 
TO authenticated 
USING (status = 'pending' OR driver_id = auth.uid()::text);

-- --------------------------------------------------------------------
-- 5. DEMO SEED DATA (for instant demonstration & testing)
-- --------------------------------------------------------------------
INSERT INTO public.customer_profiles (id, full_name, email, phone, rating, total_trips, saved_vehicles)
VALUES (
    'cust_alex_morgan_01',
    'Alex Morgan',
    'alex.morgan@drivemate.ai',
    '+91 98765 43210',
    4.95,
    18,
    '[
        {"id": "v1", "make": "Honda", "model": "City ZX (Automatic)", "regNumber": "KA 03 MM 4821", "type": "Sedan"},
        {"id": "v2", "make": "Tata", "model": "Nexon EV Empowered", "regNumber": "KA 05 NB 9012", "type": "Electric SUV"}
    ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    saved_vehicles = EXCLUDED.saved_vehicles;

INSERT INTO public.driver_profiles (id, full_name, email, phone, rating, total_trips, verification_status, badge, license_number, experience_years, specializations, languages, is_online, total_earnings)
VALUES (
    'DRV-1042',
    'Vikramaditya S.',
    'vikram.s@pilot.drivemate.ai',
    '+91 99000 88221',
    4.96,
    1424,
    'Police & Background Verified',
    'Certified Gold Pilot',
    'KA-05-2016-008921',
    8,
    '["Luxury Sedans & SUVs", "Automatic & EV Transmissions", "Highway & Outstation Qualified", "Defensive Driving Certified"]'::jsonb,
    '["English", "Kannada", "Hindi"]'::jsonb,
    true,
    1220.00
)
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_online = EXCLUDED.is_online;

-- Seed initial bookings matching Phase 2 baseline
INSERT INTO public.bookings (
    id, customer_id, customer_name, customer_phone, pickup, destination, 
    booking_date, start_time, duration, vehicle_tier, vehicle_name, 
    estimated_fare, driver_payout, status, driver_id, trip_notes, created_at
)
VALUES 
(
    'DM-98214',
    'cust_alex_morgan_01',
    'Alex Morgan',
    '+91 98765 43210',
    'Indiranagar 100ft Road, Bengaluru',
    'Kempegowda International Airport (Terminal 2)',
    CURRENT_DATE + INTERVAL '1 day',
    '06:30 AM',
    3,
    'standard',
    'Honda City ZX (KA 03 MM 4821)',
    625.00,
    510.00,
    'pending',
    NULL,
    'Airport drop. Driver will park customer car in premium parking if needed.',
    NOW() - INTERVAL '2 hours'
),
(
    'DM-94108',
    'cust_alex_morgan_01',
    'Priya Sharma',
    '+91 98450 12345',
    'Koramangala 4th Block, Bengaluru',
    'UB City & Lavelle Road (Multiple client meetings)',
    CURRENT_DATE + INTERVAL '1 day',
    '11:00 AM',
    4,
    'standard',
    'Hyundai Creta SX (KA 01 MJ 3399)',
    840.00,
    690.00,
    'accepted',
    'DRV-1042',
    'Executive city transit. Wait at UB City parking between client sessions.',
    NOW() - INTERVAL '4 hours'
),
(
    'DM-89102',
    'cust_alex_morgan_01',
    'Alex Morgan',
    '+91 98765 43210',
    'Lavelle Road, Bengaluru',
    'Whitefield IT Park (Multiple client stops)',
    CURRENT_DATE - INTERVAL '1 day',
    '09:00 AM',
    8,
    'standard',
    'Honda City ZX (KA 03 MM 4821)',
    1480.00,
    1220.00,
    'completed',
    'DRV-1042',
    'Full-day corporate meetings round-trip.',
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;
