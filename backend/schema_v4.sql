-- ====================================================================
-- DriveMate AI: Supabase PostgreSQL Schema Migration — Phase 4
-- Backward-compatible Auth & Role-Based Security Migration
-- Version: 4.1 (Hardened Privilege Control & Conflict Safety)
-- ====================================================================

-- 1. Ensure UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Roles Enum (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM (
            'customer',
            'driver',
            'admin'
        );
    END IF;
END$$;

-- 3. Backward-compatible column additions to customer_profiles
-- Preserves existing string IDs ('cust_alex_morgan_01') while linking to auth.users(id)
ALTER TABLE public.customer_profiles 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_user_id 
ON public.customer_profiles(user_id);

-- 4. Backward-compatible column additions to driver_profiles
-- Preserves existing string IDs ('DRV-1042') while linking to auth.users(id)
ALTER TABLE public.driver_profiles 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Default driver verification status must be 'pending_verification' for new registrations
-- Only trusted administrative verification processes may elevate to 'Police & Background Verified' or 'verified'
ALTER TABLE public.driver_profiles 
ALTER COLUMN verification_status SET DEFAULT 'pending_verification';

CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id 
ON public.driver_profiles(user_id);

-- 5. Helper function: Get user role and verification status securely
CREATE OR REPLACE FUNCTION public.get_auth_user_role(lookup_uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Check driver profiles first
    SELECT jsonb_build_object(
        'role', 'driver',
        'is_verified', (verification_status IN ('Police & Background Verified', 'verified')),
        'profile_id', id,
        'full_name', full_name,
        'phone', phone
    ) INTO result
    FROM public.driver_profiles
    WHERE user_id = lookup_uid OR id = lookup_uid::text
    LIMIT 1;

    IF result IS NOT NULL THEN
        RETURN result;
    END IF;

    -- Check customer profiles
    SELECT jsonb_build_object(
        'role', 'customer',
        'is_verified', true,
        'profile_id', id,
        'full_name', full_name,
        'phone', phone
    ) INTO result
    FROM public.customer_profiles
    WHERE user_id = lookup_uid OR id = lookup_uid::text
    LIMIT 1;

    IF result IS NOT NULL THEN
        RETURN result;
    END IF;

    -- Default fallback if user registered but profile not yet completed
    RETURN jsonb_build_object(
        'role', 'customer',
        'is_verified', false,
        'profile_id', lookup_uid::text,
        'full_name', '',
        'phone', ''
    );
END;
$$;

-- 6. Trigger: Automatically provision profile on new auth user signup
-- SAFE CONFLICT HANDLING:
-- Never automatically reassign user_id or link an existing profile solely based on an email match.
-- Doing so would allow an unverified new signup to claim an existing profile's trips, address, or verified driver status.
-- If an email or ID already exists, insertion is safely bypassed without raising unhandled unique violations.
-- Account linking for existing profiles (e.g. demo accounts or migrations) must be performed via authenticated/admin workflows.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    chosen_role TEXT;
    raw_name TEXT;
    raw_phone TEXT;
BEGIN
    chosen_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
    raw_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    raw_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

    IF chosen_role = 'driver' THEN
        -- Check if profile with this email or id already exists
        IF EXISTS (SELECT 1 FROM public.driver_profiles WHERE email = NEW.email OR id = NEW.id::text) THEN
            -- Profile already registered or seeded; do not overwrite or auto-link unverified
            RETURN NEW;
        END IF;

        BEGIN
            INSERT INTO public.driver_profiles (
                id,
                user_id,
                full_name,
                email,
                phone,
                rating,
                total_trips,
                verification_status,
                badge,
                license_number,
                experience_years,
                is_online,
                total_earnings
            ) VALUES (
                NEW.id::text,
                NEW.id,
                raw_name,
                NEW.email,
                raw_phone,
                5.0,
                0,
                'pending_verification', -- strictly unverified until trusted approval
                'Applicant Pilot',
                COALESCE(NEW.raw_user_meta_data->>'license_number', 'PENDING-SUBMISSION'),
                0,
                false,
                0.00
            );
        EXCEPTION WHEN unique_violation THEN
            -- Safeguard against concurrent inserts
            RETURN NEW;
        END;
    ELSE
        -- Default: customer profile
        IF EXISTS (SELECT 1 FROM public.customer_profiles WHERE email = NEW.email OR id = NEW.id::text) THEN
            -- Profile already registered or seeded; do not overwrite or auto-link unverified
            RETURN NEW;
        END IF;

        BEGIN
            INSERT INTO public.customer_profiles (
                id,
                user_id,
                full_name,
                email,
                phone,
                rating,
                total_trips,
                saved_vehicles
            ) VALUES (
                NEW.id::text,
                NEW.id,
                raw_name,
                NEW.email,
                raw_phone,
                5.0,
                0,
                '[]'::jsonb
            );
        EXCEPTION WHEN unique_violation THEN
            -- Safeguard against concurrent inserts
            RETURN NEW;
        END;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 7. Hardened Column-Level Privileges (Defense Against Privilege Escalation)
-- In PostgreSQL, RLS operates at the row level. Column-level GRANT/REVOKE is mandatory
-- to prevent authenticated users from updating sensitive columns (verification_status, rating, earnings, user_id).

-- A. Revoke all privileges from public and anon roles to eliminate inherited permissions
REVOKE ALL ON public.customer_profiles FROM public, anon;
REVOKE ALL ON public.driver_profiles FROM public, anon;
REVOKE ALL ON public.bookings FROM public, anon;

-- B. Revoke write permissions from authenticated role
REVOKE INSERT, UPDATE, DELETE ON public.customer_profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.driver_profiles FROM authenticated;
REVOKE UPDATE, DELETE ON public.bookings FROM authenticated;

-- C. Grant column-specific UPDATE privileges on non-sensitive operational fields only
-- Customers can only update contact and vehicle preference fields
GRANT UPDATE (full_name, phone, saved_vehicles) 
ON public.customer_profiles TO authenticated;

-- Drivers can only update phone, availability, and non-privileged qualifications
-- NOTE: verification_status, rating, total_earnings, badge, total_trips, user_id, and id CANNOT be modified by authenticated
GRANT UPDATE (phone, is_online, languages, specializations) 
ON public.driver_profiles TO authenticated;

-- Customers can insert new booking requests
GRANT INSERT ON public.bookings TO authenticated;
-- Authenticated users can read tables subject to RLS
GRANT SELECT ON public.customer_profiles TO authenticated;
GRANT SELECT ON public.driver_profiles TO authenticated;
GRANT SELECT ON public.bookings TO authenticated;

-- 8. Row Level Security Policies (Enforce Ownership & Read Access Boundaries)
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Drop prior policies to ensure clean, repeatable application
DROP POLICY IF EXISTS "Customers view own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Customers update own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Drivers view own profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Public authenticated view of driver profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "View driver profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "Drivers update own profile" ON public.driver_profiles;
DROP POLICY IF EXISTS "Drivers view accessible bookings" ON public.bookings;
DROP POLICY IF EXISTS "Verified drivers view accessible bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers insert own bookings" ON public.bookings;

-- Customer Profile Policies:
CREATE POLICY "Customers view own profile" 
ON public.customer_profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id OR auth.uid()::text = id);

CREATE POLICY "Customers update own profile" 
ON public.customer_profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id OR auth.uid()::text = id)
WITH CHECK (auth.uid() = user_id OR auth.uid()::text = id);

-- Driver Profile Policies:
-- Authenticated users can view verified driver profiles (for chauffeur verification, ratings, badges),
-- or view their own driver profile even if pending verification. Unverified applicant profiles are protected.
CREATE POLICY "View driver profiles" 
ON public.driver_profiles FOR SELECT 
TO authenticated 
USING (
    (auth.uid() = user_id OR auth.uid()::text = id)
    OR verification_status IN ('Police & Background Verified', 'verified')
);

-- Drivers can only update rows that belong to them (and only granted columns: phone, is_online, languages, specializations)
CREATE POLICY "Drivers update own profile" 
ON public.driver_profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id OR auth.uid()::text = id)
WITH CHECK (auth.uid() = user_id OR auth.uid()::text = id);

-- Booking Policies:
-- 1. Customers can view their own bookings (supports both UUID and linked legacy profile IDs)
CREATE POLICY "Customers view own bookings" 
ON public.bookings FOR SELECT 
TO authenticated 
USING (
    customer_id = auth.uid()::text 
    OR customer_id IN (SELECT id FROM public.customer_profiles WHERE user_id = auth.uid())
);

-- 2. Verified drivers can view pending dispatches OR trips assigned to them
CREATE POLICY "Verified drivers view accessible bookings" 
ON public.bookings FOR SELECT 
TO authenticated 
USING (
    (
        status = 'pending' 
        AND EXISTS (
            SELECT 1 FROM public.driver_profiles 
            WHERE (user_id = auth.uid() OR id = auth.uid()::text) 
            AND verification_status IN ('Police & Background Verified', 'verified')
        )
    )
    OR (
        driver_id = auth.uid()::text 
        OR driver_id IN (SELECT id FROM public.driver_profiles WHERE user_id = auth.uid())
    )
);

-- 3. Customers can insert bookings only for themselves
CREATE POLICY "Customers insert own bookings" 
ON public.bookings FOR INSERT 
TO authenticated 
WITH CHECK (
    customer_id = auth.uid()::text 
    OR customer_id IN (SELECT id FROM public.customer_profiles WHERE user_id = auth.uid())
);

-- NOTE ON BOOKING UPDATES / CANCELLATIONS:
-- No direct client UPDATE or DELETE policy is granted on public.bookings.
-- All booking state transitions (accept, start, complete, reject, cancel) and fare calculations
-- are handled authoritatively by the FastAPI backend using service_role execution.
-- This guarantees atomic acceptance, prevents double-booking, and strictly validates state transitions.
