-- ====================================================================
-- DriveMate AI: Supabase PostgreSQL Schema Migration — Phase 4
-- Backward-Compatible Auth & Role-Based Security Migration
-- Version: 4.7 (RPC Caller Lockdown, Strict Privacy, Safe Merge & Zero-Trust)
-- Status: AWAITING APPROVAL — Do NOT execute until explicitly approved.
-- ====================================================================
--
-- PREFLIGHT CHECKLIST (complete manually before running):
--   1. Take a full Supabase database backup:
--      Dashboard → Settings → Database → Backups → Download backup
--   2. Verify migration has NOT been applied yet:
--      SELECT column_name FROM information_schema.columns
--      WHERE table_name = 'customer_profiles' AND column_name = 'user_id';
--      (must return 0 rows — if it returns a row the migration was already applied)
--   3. Confirm demo accounts are intact and unlinked:
--      SELECT id, email, user_id FROM customer_profiles WHERE id = 'cust_alex_morgan_01';
--      SELECT id, email, user_id FROM driver_profiles WHERE id = 'DRV-1042';
--      (both user_id values must be NULL)
--   4. Review existing RLS policies that this migration will replace:
--      SELECT policyname, tablename, cmd FROM pg_policies
--      WHERE tablename IN ('customer_profiles','driver_profiles','bookings');
--   5. Decide email confirmation for development:
--      Dashboard → Authentication → Email → "Confirm email" → toggle OFF for dev
--   6. Note count of pre-existing Auth users (for backfill verification):
--      SELECT COUNT(*) FROM auth.users;
--   7. Verify local backend tests pass: python -m pytest backend/tests (expect: 57 passed)
--   8. Verify frontend build passes: npm run build (expect: ✓ 1662 modules)
--
-- ARCHITECTURE NOTES:
--   - Backend (FastAPI) always uses SUPABASE_SERVICE_ROLE_KEY → bypasses RLS entirely.
--     All booking mutations, driver dispatching, profile reads happen via service_role.
--   - Frontend uses VITE_SUPABASE_ANON_KEY only for Auth (signIn/signUp) and
--     profile SELECTs via authenticated JWT. It never uses service_role.
--   - Demo accounts (cust_alex_morgan_01, DRV-1042) have user_id = NULL and must
--     remain permanently unlinked. They are protected at multiple layers.
--   - bookings.customer_id is TEXT REFERENCES customer_profiles(id) — every new
--     auth user MUST get a customer_profiles row before booking creation is possible.
-- ====================================================================

-- ====================================================================
-- SECTION 1: UUID Extension
-- ====================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- SECTION 2: User Roles Enum (idempotent — safe to re-run)
-- ====================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM (
            'customer',
            'driver',
            'admin'
        );
    END IF;
END;
$$;

-- ====================================================================
-- SECTION 3: Backward-Compatible Column Additions
--
-- Preserves existing TEXT primary keys ('cust_alex_morgan_01', 'DRV-1042')
-- while adding a nullable UUID foreign key to auth.users.
-- ON DELETE SET NULL ensures demo and legacy rows survive auth user deletion.
-- ====================================================================

-- 3A. customer_profiles: add user_id UUID link
ALTER TABLE public.customer_profiles
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profiles_user_id_unique
ON public.customer_profiles(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_profiles_user_id
ON public.customer_profiles(user_id);

-- 3B. driver_profiles: add user_id UUID link
ALTER TABLE public.driver_profiles
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Default for NEW registrations is strictly 'pending_verification'.
-- Existing demo record ('DRV-1042') retains its current 'Police & Background Verified' value
-- because ALTER COLUMN SET DEFAULT only affects new inserts, not existing rows.
ALTER TABLE public.driver_profiles
ALTER COLUMN verification_status SET DEFAULT 'pending_verification';

CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_profiles_user_id_unique
ON public.driver_profiles(user_id)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id
ON public.driver_profiles(user_id);

-- ====================================================================
-- SECTION 4: Helper Functions (SECURITY DEFINER with Caller Lockdown)
--
-- These functions break the RLS recursion cycle that would occur if
-- driver_profiles policies queried bookings and vice versa.
--
-- SECURITY DESIGN:
--   - authenticated callers: target_uid is ALWAYS forced to auth.uid().
--     Even if the function signature accepts a UUID parameter, non-service_role
--     callers cannot probe another user's data.
--   - service_role: may pass an explicit UUID for trusted backend operations.
--   - anon and public: revoked entirely.
--   - SET search_path = public: prevents search_path injection attacks.
-- ====================================================================

-- 4A. is_verified_driver: Checks if a UID belongs to a verified driver
--     Used in bookings RLS policy to allow pending dispatch visibility.
CREATE OR REPLACE FUNCTION public.is_verified_driver(check_uid UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    target_uid UUID;
BEGIN
    -- Caller lockdown: authenticated users can ONLY check their own UID.
    -- service_role may check any UID for trusted backend operations.
    IF current_setting('role', true) = 'service_role' THEN
        target_uid := COALESCE(check_uid, auth.uid());
    ELSE
        -- Ignore the parameter entirely for non-service_role callers.
        target_uid := auth.uid();
    END IF;

    IF target_uid IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.driver_profiles
        WHERE user_id = target_uid
          AND verification_status IN ('Police & Background Verified', 'verified')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_verified_driver(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_verified_driver(UUID) TO authenticated, service_role;

-- 4B. get_caller_driver_profile_id: Resolves caller's driver profile TEXT id
--     Used in bookings RLS policy for driver_id ownership check.
CREATE OR REPLACE FUNCTION public.get_caller_driver_profile_id(check_uid UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    target_uid UUID;
    prof_id TEXT;
BEGIN
    IF current_setting('role', true) = 'service_role' THEN
        target_uid := COALESCE(check_uid, auth.uid());
    ELSE
        target_uid := auth.uid();
    END IF;

    IF target_uid IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT id INTO prof_id
    FROM public.driver_profiles
    WHERE user_id = target_uid
    LIMIT 1;

    RETURN prof_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_caller_driver_profile_id(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_caller_driver_profile_id(UUID) TO authenticated, service_role;

-- 4C. get_caller_customer_profile_id: Resolves caller's customer profile TEXT id
--     Used in bookings RLS policy for customer_id ownership check.
CREATE OR REPLACE FUNCTION public.get_caller_customer_profile_id(check_uid UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    target_uid UUID;
    prof_id TEXT;
BEGIN
    IF current_setting('role', true) = 'service_role' THEN
        target_uid := COALESCE(check_uid, auth.uid());
    ELSE
        target_uid := auth.uid();
    END IF;

    IF target_uid IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT id INTO prof_id
    FROM public.customer_profiles
    WHERE user_id = target_uid
    LIMIT 1;

    RETURN prof_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_caller_customer_profile_id(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_caller_customer_profile_id(UUID) TO authenticated, service_role;

-- 4D. get_auth_user_role: Returns caller's role and profile metadata.
--     Authenticated callers see only their own data.
--     service_role may query any UID for trusted server-side operations.
--
-- SECURITY: Does NOT expose phone or any PII of OTHER users.
-- Returns only the caller's own verified profile data.
CREATE OR REPLACE FUNCTION public.get_auth_user_role(lookup_uid UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_uid UUID;
    result JSONB;
BEGIN
    IF current_setting('role', true) = 'service_role' THEN
        target_uid := COALESCE(lookup_uid, auth.uid());
    ELSE
        -- Non-service_role callers can only look up themselves.
        -- The parameter is silently ignored.
        target_uid := auth.uid();
    END IF;

    IF target_uid IS NULL THEN
        RAISE EXCEPTION 'Access denied. Caller identity cannot be established.';
    END IF;

    -- Check driver profiles first (verified user_id ownership only)
    SELECT jsonb_build_object(
        'role', 'driver',
        'is_verified', (verification_status IN ('Police & Background Verified', 'verified')),
        'profile_id', id,
        'full_name', full_name
    ) INTO result
    FROM public.driver_profiles
    WHERE user_id = target_uid
    LIMIT 1;

    IF result IS NOT NULL THEN
        RETURN result;
    END IF;

    -- Check customer profiles (verified user_id ownership only)
    SELECT jsonb_build_object(
        'role', 'customer',
        'is_verified', true,
        'profile_id', id,
        'full_name', full_name
    ) INTO result
    FROM public.customer_profiles
    WHERE user_id = target_uid
    LIMIT 1;

    IF result IS NOT NULL THEN
        RETURN result;
    END IF;

    -- Fallback: user registered but trigger has not yet created their profile row.
    -- This can happen in the brief window between auth.users INSERT and trigger completion.
    RETURN jsonb_build_object(
        'role', 'customer',
        'is_verified', false,
        'profile_id', target_uid::text,
        'full_name', ''
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_role(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_user_role(UUID) TO authenticated, service_role;

-- ====================================================================
-- SECTION 5: Signup Trigger — Profile Provisioning on Auth User Creation
--
-- ZERO-TRUST IDENTITY RULES:
--   1. BASE CUSTOMER GUARANTEE: Every new auth user always gets a customer_profiles row.
--      This is required because bookings.customer_id FK references customer_profiles.id.
--      A user without this row cannot create bookings.
--
--   2. DRIVER APPLICATION IS NOT AUTHORIZATION: raw_user_meta_data.role = 'driver'
--      only creates an UNVERIFIED applicant record (verification_status = 'pending_verification').
--      It NEVER grants dispatch access. Verification requires a trusted admin operation.
--
--   3. UNIVERSAL COLLISION PROTECTION: If any existing customer_profiles or driver_profiles
--      row already has the same email (demo record, legacy unlinked profile, or any other),
--      the new provisioned row uses a globally unique UID-scoped email address to satisfy
--      UNIQUE constraints without overwriting, hijacking, or skipping profile creation.
--      Format: original_email+personal_<uid_no_hyphens>@domain
--
--   4. IDEMPOTENT RETRY SAFETY: ON CONFLICT (id) DO UPDATE only updates user_id if
--      user_id IS NULL, preventing accidental re-linking or overwriting.
--
--   5. DEMO ACCOUNT IMMUNITY: Demo records ('cust_alex_morgan_01', 'DRV-1042') have
--      user_id = NULL and non-UUID TEXT ids — they are never matched by user_id lookup
--      and never overwritten by the trigger.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    raw_role     TEXT;
    raw_name     TEXT;
    raw_phone    TEXT;
    cust_email   TEXT;
    driver_email TEXT;
BEGIN
    -- Extract metadata safely; never trust for privilege assignment
    raw_role  := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'customer'));
    raw_name  := COALESCE(
                     NEW.raw_user_meta_data->>'full_name',
                     NEW.raw_user_meta_data->>'name',
                     split_part(NEW.email, '@', 1)
                 );
    raw_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');

    -- ----------------------------------------------------------------
    -- STEP 1: Customer Profile (GUARANTEED for every new auth account)
    -- ----------------------------------------------------------------
    -- Determine safe email: scope it if ANY existing profile has same email.
    -- This protects ALL existing records (demo and unlinked legacy) equally.
    IF EXISTS (SELECT 1 FROM public.customer_profiles WHERE email = NEW.email) THEN
        cust_email := NEW.email || '+personal_' || replace(NEW.id::text, '-', '');
    ELSE
        cust_email := NEW.email;
    END IF;

    -- Only insert if this user doesn't already have a customer profile.
    -- ON CONFLICT handles the edge case of a duplicate trigger invocation.
    IF NOT EXISTS (SELECT 1 FROM public.customer_profiles WHERE user_id = NEW.id) THEN
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
            NEW.id::text,        -- Profile ID = auth UUID as text
            NEW.id,              -- user_id link to auth.users
            raw_name,
            cust_email,
            raw_phone,
            5.0,
            0,
            '[]'::jsonb
        )
        ON CONFLICT (id) DO UPDATE
        SET user_id    = EXCLUDED.user_id,
            updated_at = TIMEZONE('utc', NOW())
        WHERE customer_profiles.user_id IS NULL; -- Never re-link an already-linked profile
    END IF;

    -- ----------------------------------------------------------------
    -- STEP 2: Driver Applicant Record (only if role hint = 'driver')
    -- This is NOT an authorization grant. It is an unverified application record.
    -- Verification status is hardcoded to 'pending_verification' — never from metadata.
    -- ----------------------------------------------------------------
    IF raw_role = 'driver' THEN
        IF NOT EXISTS (SELECT 1 FROM public.driver_profiles WHERE user_id = NEW.id) THEN
            -- Apply same collision protection for driver_profiles email uniqueness
            IF EXISTS (SELECT 1 FROM public.driver_profiles WHERE email = NEW.email) THEN
                driver_email := NEW.email || '+applicant_' || replace(NEW.id::text, '-', '');
            ELSE
                driver_email := NEW.email;
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
                    verification_status,   -- HARDCODED: never from metadata
                    badge,
                    license_number,
                    experience_years,
                    is_online,
                    total_earnings
                ) VALUES (
                    NEW.id::text,          -- Profile ID = auth UUID as text
                    NEW.id,
                    raw_name,
                    driver_email,
                    raw_phone,
                    5.0,
                    0,
                    'pending_verification', -- Strictly unverified applicant
                    'Applicant Pilot',
                    COALESCE(NEW.raw_user_meta_data->>'license_number', 'PENDING-SUBMISSION'),
                    0,
                    false,                  -- offline by default until verified
                    0.00
                )
                ON CONFLICT (id) DO UPDATE
                SET user_id    = EXCLUDED.user_id,
                    updated_at = TIMEZONE('utc', NOW())
                WHERE driver_profiles.user_id IS NULL;
            EXCEPTION
                WHEN OTHERS THEN
                    -- Log but do not fail the customer profile creation.
                    -- The user still has a valid customer profile from STEP 1.
                    RAISE WARNING 'handle_new_auth_user: driver_profiles insert failed for uid=%. Error: %',
                        NEW.id, SQLERRM;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ====================================================================
-- SECTION 6: Safe Profile Linking & Merge Function
--
-- PURPOSE: Allows a user with a verified email to opt-in to merging their
-- newly provisioned profile (created at signup, id = auth.uid()::text) with
-- a pre-existing unlinked legacy profile (same verified email, user_id IS NULL).
--
-- SECURITY DESIGN:
--   - Caller must be authenticated (auth.uid() non-null)
--   - Email must be confirmed (email_confirmed_at non-null)
--   - Advisory lock prevents concurrent merge races for same user
--   - Demo account emails are permanently blocked from linking
--   - profile_type must be strictly 'customer' or 'driver'
--   - target legacy profile must have user_id IS NULL (never re-link)
--   - Demo IDs ('cust_alex_morgan_01', 'DRV-1042') are excluded by id check
--   - Provisional row (created at signup with id = auth.uid()::text) is deleted
--     after bookings are reassigned to the legacy profile id
--
-- EXECUTION PERMISSIONS:
--   - Only authenticated users (GRANT EXECUTE TO authenticated)
--   - service_role is excluded because the backend never needs to call this
--     (it uses its own service_role queries instead)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.link_verified_legacy_profile(profile_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_uid      UUID;
    caller_email    TEXT;
    email_confirmed TIMESTAMPTZ;
    target_id       TEXT;
    clean_type      TEXT;
BEGIN
    caller_uid := auth.uid();
    IF caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to link profiles.';
    END IF;

    -- Serialize concurrent calls for the same user to prevent double-merge
    PERFORM pg_advisory_xact_lock(hashtext(caller_uid::text));

    -- Validate profile_type strictly — no SQL injection, no unexpected values
    clean_type := LOWER(TRIM(profile_type));
    IF clean_type NOT IN ('customer', 'driver') THEN
        RAISE EXCEPTION 'Invalid profile_type. Must be ''customer'' or ''driver''.';
    END IF;

    -- Require confirmed email — never link an unverified email claim
    SELECT email, email_confirmed_at
    INTO caller_email, email_confirmed
    FROM auth.users
    WHERE id = caller_uid;

    IF caller_email IS NULL THEN
        RAISE EXCEPTION 'Caller auth record not found.';
    END IF;

    IF email_confirmed IS NULL THEN
        RAISE EXCEPTION 'Email confirmation required before profile linking. Check your inbox.';
    END IF;

    -- Permanently block demo account emails from any linking
    IF caller_email IN (
        'customer@drivemate.ai',
        'demo.customer@drivemate.ai',
        'alex.morgan@drivemate.ai',
        'pilot.vikram@drivemate.ai',
        'vikram.s@pilot.drivemate.ai',
        'demo.driver@drivemate.ai',
        'applicant.driver@drivemate.ai'
    ) THEN
        RAISE EXCEPTION 'Demo accounts cannot be linked to personal auth accounts.';
    END IF;

    IF clean_type = 'driver' THEN
        -- Find a legacy driver profile matching this verified email
        -- Exclude demo record and any profile already linked to an auth user
        SELECT id INTO target_id
        FROM public.driver_profiles
        WHERE email = caller_email
          AND user_id IS NULL
          AND id != 'DRV-1042'
          AND id != caller_uid::text   -- Should not be the provisional row itself
        FOR UPDATE;                    -- Row-level lock for the merge

        IF target_id IS NOT NULL THEN
            -- Reassign any bookings that reference the provisional driver profile
            UPDATE public.bookings
            SET driver_id = target_id
            WHERE driver_id = caller_uid::text;

            -- Remove the provisional driver row created at signup
            -- (its bookings have been reassigned to target_id above)
            DELETE FROM public.driver_profiles
            WHERE id = caller_uid::text
              AND user_id = caller_uid;

            -- Link the legacy driver profile to this auth user
            UPDATE public.driver_profiles
            SET user_id    = caller_uid,
                updated_at = TIMEZONE('utc', NOW())
            WHERE id = target_id
              AND user_id IS NULL;  -- Final guard: only link if still unlinked

            RETURN jsonb_build_object(
                'success', true,
                'linked_id', target_id,
                'type', 'driver'
            );
        END IF;

    ELSE -- clean_type = 'customer'
        -- Find a legacy customer profile matching this verified email
        SELECT id INTO target_id
        FROM public.customer_profiles
        WHERE email = caller_email
          AND user_id IS NULL
          AND id != 'cust_alex_morgan_01'
          AND id != caller_uid::text   -- Should not be the provisional row itself
        FOR UPDATE;

        IF target_id IS NOT NULL THEN
            -- Reassign any bookings created under the provisional customer profile
            UPDATE public.bookings
            SET customer_id = target_id
            WHERE customer_id = caller_uid::text;

            -- Remove the provisional customer row created at signup
            DELETE FROM public.customer_profiles
            WHERE id = caller_uid::text
              AND user_id = caller_uid;

            -- Link the legacy customer profile to this auth user
            UPDATE public.customer_profiles
            SET user_id    = caller_uid,
                updated_at = TIMEZONE('utc', NOW())
            WHERE id = target_id
              AND user_id IS NULL;

            RETURN jsonb_build_object(
                'success', true,
                'linked_id', target_id,
                'type', 'customer'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', false,
        'message', 'No matching unlinked legacy profile found for this verified email.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.link_verified_legacy_profile(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_verified_legacy_profile(TEXT) TO authenticated;
-- service_role intentionally excluded: backend uses direct queries, not this RPC.

-- ====================================================================
-- SECTION 7: Column-Level Privileges (Hardened)
--
-- Principle of Least Privilege:
--   - anon and public: no access to any table
--   - authenticated: SELECT on all three tables (scoped by RLS below)
--   - authenticated: only UPDATE specific safe columns
--   - authenticated: only INSERT on bookings (new booking creation)
--   - service_role: full access (bypasses RLS — backend only)
-- ====================================================================

REVOKE ALL ON public.customer_profiles FROM public, anon;
REVOKE ALL ON public.driver_profiles   FROM public, anon;
REVOKE ALL ON public.bookings          FROM public, anon;

-- Remove blanket write access from authenticated users
REVOKE INSERT, UPDATE, DELETE ON public.customer_profiles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.driver_profiles   FROM authenticated;
REVOKE UPDATE, DELETE         ON public.bookings          FROM authenticated;

-- Customers may update only their own non-sensitive fields
GRANT UPDATE (full_name, phone, saved_vehicles)
    ON public.customer_profiles TO authenticated;

-- Drivers may update only availability and non-privileged profile fields
-- verification_status, badge, license_number, rating, total_earnings are NOT grantable
GRANT UPDATE (phone, is_online, languages, specializations)
    ON public.driver_profiles TO authenticated;

-- Customers may insert new booking requests
-- (RLS INSERT policy below enforces ownership)
GRANT INSERT ON public.bookings TO authenticated;

-- SELECT for authenticated (scoped by RLS policies below)
GRANT SELECT ON public.customer_profiles TO authenticated;
GRANT SELECT ON public.driver_profiles   TO authenticated;
GRANT SELECT ON public.bookings          TO authenticated;

-- Full access for backend service_role (bypasses RLS entirely)
GRANT ALL ON public.customer_profiles TO service_role;
GRANT ALL ON public.driver_profiles   TO service_role;
GRANT ALL ON public.bookings          TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ====================================================================
-- SECTION 8: Row Level Security Policies
--
-- DESIGN:
--   - RLS is enabled on all three tables.
--   - This migration replaces ONLY the named policies it manages.
--     Unrelated policies are preserved.
--   - Policies use SECURITY DEFINER helper functions (Section 4) to avoid
--     RLS recursion: driver_profiles policies do NOT query bookings, and
--     bookings policies do NOT directly query driver_profiles.
--   - No policy uses auth.uid()::text = id (legacy pattern that only works
--     when the profile was created with id = auth UUID, not for demo records).
--   - service_role bypasses RLS at the Postgres level — no policy needed.
-- ====================================================================
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings          ENABLE ROW LEVEL SECURITY;

-- Drop only the policies this migration manages (preserves unrelated policies)
DROP POLICY IF EXISTS "Customers view own profile"                ON public.customer_profiles;
DROP POLICY IF EXISTS "Customers update own profile"              ON public.customer_profiles;

DROP POLICY IF EXISTS "Drivers view own profile"                  ON public.driver_profiles;
DROP POLICY IF EXISTS "Public authenticated view of driver profiles" ON public.driver_profiles;
DROP POLICY IF EXISTS "View driver profiles"                      ON public.driver_profiles;
DROP POLICY IF EXISTS "Drivers update own profile"                ON public.driver_profiles;

DROP POLICY IF EXISTS "Drivers view accessible bookings"          ON public.bookings;
DROP POLICY IF EXISTS "Verified drivers view accessible bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers view own bookings"               ON public.bookings;
DROP POLICY IF EXISTS "Customers insert own bookings"             ON public.bookings;

-- ----------------------------------------------------------------
-- 8A. Customer Profile Policies
-- ----------------------------------------------------------------
-- Customers see only their own profile row (matched by user_id).
-- Demo accounts (user_id IS NULL) are invisible to auth users — correct.
CREATE POLICY "Customers view own profile"
    ON public.customer_profiles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Customers may only update their own profile row.
CREATE POLICY "Customers update own profile"
    ON public.customer_profiles FOR UPDATE
    TO authenticated
    USING   (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------
-- 8B. Driver Profile Policies
--
-- Drivers see only their own profile.
-- No broad "all verified drivers" exposure — driver info for customers
-- is returned by the FastAPI backend via service_role JOIN on bookings.
-- ----------------------------------------------------------------
CREATE POLICY "Drivers view own profile"
    ON public.driver_profiles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Drivers may only update their own profile (availability, phone, languages).
CREATE POLICY "Drivers update own profile"
    ON public.driver_profiles FOR UPDATE
    TO authenticated
    USING   (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------
-- 8C. Booking Policies
--
-- Uses SECURITY DEFINER helper functions to resolve profile IDs
-- without triggering RLS recursion between bookings and driver_profiles.
--
-- Customers can see their own bookings (matched by customer_id = auth.uid()::text
-- for new users whose profile id = auth.uid()::text, OR matched via helper
-- function for users who have a legacy profile after linking).
--
-- Verified drivers can see:
--   a. All 'pending' bookings (dispatch visibility)
--   b. Bookings assigned to their own driver_id
-- Unverified drivers see nothing.
-- ----------------------------------------------------------------
CREATE POLICY "Customers view own bookings"
    ON public.bookings FOR SELECT
    TO authenticated
    USING (
        customer_id = auth.uid()::text
        OR customer_id = public.get_caller_customer_profile_id()
    );

CREATE POLICY "Verified drivers view accessible bookings"
    ON public.bookings FOR SELECT
    TO authenticated
    USING (
        (status = 'pending' AND public.is_verified_driver())
        OR driver_id = public.get_caller_driver_profile_id()
    );

-- Customers may insert new bookings only for their own profile.
CREATE POLICY "Customers insert own bookings"
    ON public.bookings FOR INSERT
    TO authenticated
    WITH CHECK (
        customer_id = auth.uid()::text
        OR customer_id = public.get_caller_customer_profile_id()
    );

-- ====================================================================
-- SECTION 9: Idempotent Backfill for Pre-Migration Auth Users
--
-- Provisions profile rows for any auth.users created BEFORE this migration.
-- This migration may be re-run safely — ON CONFLICT handles re-execution.
--
-- DESIGN:
--   9A. Customer Backfill: Every unprovisioned auth user gets a customer profile.
--       Email collision → UID-scoped email (same logic as the signup trigger).
--       Demo accounts are excluded by email filter.
--       Already-provisioned users are excluded by NOT EXISTS check.
--
--   9B. Driver Applicant Backfill: Auth users who signed up with role='driver'
--       before this migration get an UNVERIFIED driver_profiles applicant row.
--       verification_status is HARDCODED to 'pending_verification'.
--       Demo driver email excluded by filter.
--       Already-provisioned drivers excluded by NOT EXISTS check.
-- ====================================================================

-- 9A. Customer profile backfill
INSERT INTO public.customer_profiles (
    id, user_id, full_name, email, phone, rating, total_trips, saved_vehicles
)
SELECT
    u.id::text,
    u.id,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
    ),
    -- Collision-safe email: scope if any existing profile already uses this email
    CASE
        WHEN EXISTS (
            SELECT 1 FROM public.customer_profiles cp WHERE cp.email = u.email
        )
        THEN u.email || '+personal_' || replace(u.id::text, '-', '')
        ELSE u.email
    END,
    COALESCE(u.raw_user_meta_data->>'phone', ''),
    5.0,
    0,
    '[]'::jsonb
FROM auth.users u
WHERE
    -- Exclude demo account emails
    u.email NOT IN (
        'customer@drivemate.ai',
        'demo.customer@drivemate.ai',
        'alex.morgan@drivemate.ai'
    )
    -- Exclude users who already have a customer profile (by user_id OR by id match)
    AND NOT EXISTS (
        SELECT 1 FROM public.customer_profiles cp
        WHERE cp.user_id = u.id
           OR cp.id = u.id::text
    );

-- 9B. Driver applicant backfill (unverified)
INSERT INTO public.driver_profiles (
    id, user_id, full_name, email, phone, rating, total_trips,
    verification_status, badge, license_number, experience_years, is_online, total_earnings
)
SELECT
    u.id::text,
    u.id,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        split_part(u.email, '@', 1)
    ),
    CASE
        WHEN EXISTS (
            SELECT 1 FROM public.driver_profiles dp WHERE dp.email = u.email
        )
        THEN u.email || '+applicant_' || replace(u.id::text, '-', '')
        ELSE u.email
    END,
    COALESCE(u.raw_user_meta_data->>'phone', ''),
    5.0,
    0,
    'pending_verification',  -- HARDCODED: backfill never grants verification
    'Applicant Pilot',
    COALESCE(u.raw_user_meta_data->>'license_number', 'PENDING-SUBMISSION'),
    0,
    false,
    0.00
FROM auth.users u
WHERE
    -- Only users who registered with role='driver'
    LOWER(COALESCE(u.raw_user_meta_data->>'role', '')) = 'driver'
    -- Exclude demo driver emails
    AND u.email NOT IN (
        'pilot.vikram@drivemate.ai',
        'vikram.s@pilot.drivemate.ai',
        'demo.driver@drivemate.ai',
        'applicant.driver@drivemate.ai'
    )
    -- Exclude users who already have a driver profile
    AND NOT EXISTS (
        SELECT 1 FROM public.driver_profiles dp
        WHERE dp.user_id = u.id
           OR dp.id = u.id::text
    );


-- ====================================================================
-- ====================================================================
-- ROLLBACK SCRIPT
-- ====================================================================
-- ====================================================================
--
-- IMPORTANT: This rollback section is NOT meant to be executed as part
-- of the migration. Copy it separately and run it ONLY if needed.
--
-- ROLLBACK SCOPE LEVELS:
--
-- PARTIAL ROLLBACK (Safe — removes functions and policies, preserves data)
-- -----------------------------------------------------------------------
-- This is the recommended first response to any migration issue.
-- It removes all new RLS policies, helper functions, and the trigger,
-- but preserves the user_id columns, indexes, and all data rows.
-- The original Phase 3 policies (auth.uid()::text = id pattern) are
-- reinstated so demo accounts and auth-linked profiles continue to work.
--
-- BEGIN;
--
-- -- Remove migration-managed RLS policies
-- DROP POLICY IF EXISTS "Customers view own profile"                ON public.customer_profiles;
-- DROP POLICY IF EXISTS "Customers update own profile"              ON public.customer_profiles;
-- DROP POLICY IF EXISTS "Drivers view own profile"                  ON public.driver_profiles;
-- DROP POLICY IF EXISTS "Drivers update own profile"                ON public.driver_profiles;
-- DROP POLICY IF EXISTS "Customers view own bookings"               ON public.bookings;
-- DROP POLICY IF EXISTS "Verified drivers view accessible bookings" ON public.bookings;
-- DROP POLICY IF EXISTS "Customers insert own bookings"             ON public.bookings;
--
-- -- Reinstate Phase 3 RLS policies (legacy pattern)
-- CREATE POLICY "Customers view own profile"
--     ON public.customer_profiles FOR SELECT TO authenticated
--     USING (auth.uid()::text = id);
-- CREATE POLICY "Drivers view own profile"
--     ON public.driver_profiles FOR SELECT TO authenticated
--     USING (auth.uid()::text = id);
-- CREATE POLICY "Customers view own bookings"
--     ON public.bookings FOR SELECT TO authenticated
--     USING (auth.uid()::text = customer_id);
-- CREATE POLICY "Drivers view accessible bookings"
--     ON public.bookings FOR SELECT TO authenticated
--     USING (status = 'pending' OR driver_id = auth.uid()::text);
--
-- -- Remove trigger
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_auth_user();
--
-- -- Remove helper functions
-- DROP FUNCTION IF EXISTS public.is_verified_driver(UUID);
-- DROP FUNCTION IF EXISTS public.get_caller_driver_profile_id(UUID);
-- DROP FUNCTION IF EXISTS public.get_caller_customer_profile_id(UUID);
-- DROP FUNCTION IF EXISTS public.get_auth_user_role(UUID);
-- DROP FUNCTION IF EXISTS public.link_verified_legacy_profile(TEXT);
--
-- COMMIT;
--
-- -----------------------------------------------------------------------
-- FULL ROLLBACK (Destructive — removes columns and indexes)
-- -----------------------------------------------------------------------
-- Run this ONLY after the partial rollback if you need to fully revert
-- to the pre-migration state. This removes the user_id columns and
-- indexes but CANNOT recover data deleted during the migration itself.
-- All profile rows created by the backfill (Section 9) must be removed
-- manually if they should not exist.
--
-- WARNING: Never run DROP COLUMN in production without a verified backup.
-- WARNING: Never grant unrestricted anon or public access in rollback.
--
-- BEGIN;
--
-- -- Remove indexes first (required before dropping columns)
-- DROP INDEX IF EXISTS idx_customer_profiles_user_id_unique;
-- DROP INDEX IF EXISTS idx_customer_profiles_user_id;
-- DROP INDEX IF EXISTS idx_driver_profiles_user_id_unique;
-- DROP INDEX IF EXISTS idx_driver_profiles_user_id;
--
-- -- Remove user_id columns
-- ALTER TABLE public.customer_profiles DROP COLUMN IF EXISTS user_id;
-- ALTER TABLE public.driver_profiles   DROP COLUMN IF EXISTS user_id;
--
-- -- Revert driver_profiles verification_status default
-- ALTER TABLE public.driver_profiles
--     ALTER COLUMN verification_status SET DEFAULT 'Police & Background Verified';
--
-- -- Remove user_role enum (only if nothing references it)
-- DROP TYPE IF EXISTS public.user_role;
--
-- COMMIT;
-- ====================================================================


-- ====================================================================
-- ====================================================================
-- PROPOSED SQL VALIDATION TESTS
-- ====================================================================
-- ====================================================================
--
-- STATUS: PROPOSED — not executed against the live database.
-- Run these in Supabase Dashboard → SQL Editor AFTER the migration
-- and AFTER creating test users (or impersonating via SET LOCAL).
--
-- NOTE: Tests marked [service_role] should be run with the service_role key.
-- Tests marked [authenticated] require a valid JWT from an auth user.
-- Tests marked [anon] require the anon key or no credentials.
-- ====================================================================

-- ----------------------------------------------------------------
-- TEST 1: RLS Recursion — must complete without error or infinite loop
-- ----------------------------------------------------------------
-- EXPLAIN ANALYZE SELECT * FROM public.bookings LIMIT 5;
-- EXPLAIN ANALYZE SELECT * FROM public.driver_profiles LIMIT 5;
-- EXPLAIN ANALYZE SELECT * FROM public.customer_profiles LIMIT 5;
-- Expected: Plans show sequential scans with RLS filter — no ERROR, no timeout.

-- ----------------------------------------------------------------
-- TEST 2: RPC Caller Lockdown
-- Run as an authenticated non-service_role user (JWT in Authorization header)
-- ----------------------------------------------------------------
-- SELECT public.is_verified_driver('00000000-0000-0000-0000-000000000001');
-- Expected: Returns verification status of the CALLER (auth.uid()), NOT the passed UUID.
-- The parameter is silently ignored for non-service_role callers.

-- SELECT public.get_caller_customer_profile_id('00000000-0000-0000-0000-000000000001');
-- Expected: Returns the caller's own customer profile id (or NULL if none), NOT the passed UUID's profile.

-- SELECT public.get_caller_driver_profile_id('00000000-0000-0000-0000-000000000001');
-- Expected: Returns the caller's own driver profile id, NOT the passed UUID's profile.

-- ----------------------------------------------------------------
-- TEST 3: Demo Account Immunity
-- ----------------------------------------------------------------
-- [service_role] SELECT id, email, user_id FROM customer_profiles WHERE id = 'cust_alex_morgan_01';
-- Expected: user_id IS NULL — demo account untouched.

-- [service_role] SELECT id, email, user_id FROM driver_profiles WHERE id = 'DRV-1042';
-- Expected: user_id IS NULL — demo driver untouched.

-- ----------------------------------------------------------------
-- TEST 4: Customer Profile Isolation (RLS SELECT)
-- Set up: Create two separate auth users (user_a, user_b). Both have profiles.
-- Run as user_a:
-- ----------------------------------------------------------------
-- SELECT * FROM public.customer_profiles;
-- Expected: Returns ONLY user_a's own row. user_b's row is invisible.

-- ----------------------------------------------------------------
-- TEST 5: Driver Privacy — Customers cannot see driver_profiles
-- Run as a customer (authenticated, no driver profile):
-- ----------------------------------------------------------------
-- SELECT * FROM public.driver_profiles;
-- Expected: Returns 0 rows (customer has no driver profile; demo DRV-1042 has user_id=NULL so policy doesn't match).

-- ----------------------------------------------------------------
-- TEST 6: Unverified Driver Cannot See Pending Dispatches
-- Run as an unverified driver (verification_status = 'pending_verification'):
-- ----------------------------------------------------------------
-- SELECT * FROM public.bookings WHERE status = 'pending';
-- Expected: Returns 0 rows (is_verified_driver() returns false → policy denies).

-- ----------------------------------------------------------------
-- TEST 7: Verified Driver Can See Pending Dispatches
-- Run as a verified driver (verification_status = 'Police & Background Verified' or 'verified'):
-- ----------------------------------------------------------------
-- SELECT * FROM public.bookings WHERE status = 'pending';
-- Expected: Returns all pending bookings (dispatch visibility).

-- ----------------------------------------------------------------
-- TEST 8: Email Collision on Signup
-- Set up: Register a new auth user with email = 'alex.morgan@drivemate.ai'
-- ----------------------------------------------------------------
-- [service_role] SELECT id, email, user_id FROM customer_profiles
-- WHERE email LIKE 'alex.morgan@drivemate.ai%'
-- ORDER BY created_at;
-- Expected:
--   Row 1: id='cust_alex_morgan_01', email='alex.morgan@drivemate.ai', user_id=NULL  (demo, untouched)
--   Row 2: id=<new_uuid>, email='alex.morgan@drivemate.ai+personal_<uid_no_dashes>', user_id=<new_uuid>

-- ----------------------------------------------------------------
-- TEST 9: Duplicate Profile Prevention (Idempotency)
-- Run the migration SQL a second time.
-- ----------------------------------------------------------------
-- Expected: No errors. No duplicate rows. The IF NOT EXISTS guards and ON CONFLICT clauses prevent duplicates.
-- [service_role] SELECT COUNT(*) FROM customer_profiles WHERE user_id = '<test_user_uuid>';
-- Expected: COUNT = 1

-- ----------------------------------------------------------------
-- TEST 10: Legacy Profile Linking via link_verified_legacy_profile()
-- Set up:
--   a. Insert a legacy customer_profiles row with user_id=NULL and a known email.
--   b. Create an auth user with the same verified email.
--   c. The signup trigger should have created a provisional row (id = auth.uid()::text).
-- Run as the auth user:
-- ----------------------------------------------------------------
-- SELECT public.link_verified_legacy_profile('customer');
-- Expected: Returns { "success": true, "linked_id": "<legacy_id>", "type": "customer" }
-- [service_role] SELECT id, user_id FROM customer_profiles WHERE email = '<test_email>';
-- Expected: Only ONE row exists with user_id = <auth_uid>. The provisional row is deleted.

-- ----------------------------------------------------------------
-- TEST 11: Historical Booking Ownership after Linking
-- Set up: After TEST 10, check that bookings referencing the provisional id were reassigned.
-- ----------------------------------------------------------------
-- [service_role] SELECT customer_id FROM bookings WHERE customer_id = '<provisional_uuid_text>';
-- Expected: 0 rows — all bookings have been reassigned to <legacy_id>.
-- [service_role] SELECT customer_id FROM bookings WHERE customer_id = '<legacy_id>';
-- Expected: All previously created bookings are now owned by the legacy profile.

-- ----------------------------------------------------------------
-- TEST 12: Driver Backfill Integrity
-- ----------------------------------------------------------------
-- [service_role] SELECT id, verification_status, user_id FROM driver_profiles
-- WHERE verification_status = 'pending_verification' AND id != 'DRV-UNVERIFIED-99';
-- Expected: All backfilled driver applicant rows have verification_status = 'pending_verification'.
-- None should have 'Police & Background Verified' or 'verified'.

-- ----------------------------------------------------------------
-- TEST 13: link_verified_legacy_profile() — Demo Account Blocked
-- Run as an auth user whose verified email is a demo email:
-- ----------------------------------------------------------------
-- SELECT public.link_verified_legacy_profile('customer');
-- Expected: EXCEPTION 'Demo accounts cannot be linked to personal auth accounts.'

-- ----------------------------------------------------------------
-- TEST 14: link_verified_legacy_profile() — Unconfirmed Email Blocked
-- Run as an auth user who has NOT confirmed their email:
-- ----------------------------------------------------------------
-- SELECT public.link_verified_legacy_profile('customer');
-- Expected: EXCEPTION 'Email confirmation required before profile linking.'

-- ----------------------------------------------------------------
-- TEST 15: Repeated Migration (Full Idempotency Test)
-- Re-run the entire migration SQL from the beginning.
-- ----------------------------------------------------------------
-- Expected: All statements complete without error. Row counts unchanged.
-- [service_role] SELECT COUNT(*) FROM customer_profiles WHERE id = 'cust_alex_morgan_01';
-- Expected: 1 (demo row not duplicated)
-- [service_role] SELECT COUNT(*) FROM driver_profiles WHERE id = 'DRV-1042';
-- Expected: 1 (demo driver row not duplicated)
