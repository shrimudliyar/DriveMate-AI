import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../api/supabase';
import { setApiAuthToken, onApiAuthError } from '../api/client';
import { INITIAL_USER, INITIAL_DRIVER } from '../data/mockData';

const AuthContext = createContext();

const AUTH_STORAGE_KEY = 'drivemate_demo_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState('customer'); // 'customer' | 'driver'
  const [isVerifiedDriver, setIsVerifiedDriver] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auth modal control
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [authModalNotice, setAuthModalNotice] = useState(null);
  // Role hint from GetStartedModal — purely cosmetic, used to pre-select demo card visibility.
  // Never used to grant or change backend role.
  const [authModalRoleHint, setAuthModalRoleHint] = useState(null); // 'customer' | 'driver' | null

  const openAuthModal = useCallback((tab = 'signin', notice = null, roleHint = null) => {
    setAuthModalTab(tab);
    setAuthModalNotice(notice);
    setAuthModalRoleHint(roleHint);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthModalNotice(null);
    setAuthModalRoleHint(null);
  }, []);

  // Update profile & role based on user metadata and database record
  const updateProfileFromUser = useCallback(async (authUser, activeSession) => {
    if (!authUser) {
      setUser(null);
      setSession(null);
      setRole('customer');
      setIsVerifiedDriver(false);
      setProfile(null);
      setApiAuthToken(null);
      return;
    }

    const token = activeSession?.access_token || null;
    setApiAuthToken(token);
    setUser(authUser);
    setSession(activeSession);

    const userMetadata = authUser.user_metadata || {};
    const declaredRole = userMetadata.role || 'customer';

    // Check if user is the demo verified driver or customer
    if (authUser.email === 'pilot.vikram@drivemate.ai' || userMetadata.is_verified_driver) {
      setRole('driver');
      setIsVerifiedDriver(true);
      setProfile({
        ...INITIAL_DRIVER,
        id: authUser.id || 'DRV-1042',
        email: authUser.email,
        name: userMetadata.full_name || INITIAL_DRIVER.name,
      });
      return;
    }

    // If Supabase is connected, query profile table for verified status
    if (supabase && isSupabaseConfigured) {
      try {
        const { data: driverData } = await supabase
          .table('driver_profiles')
          .select('*')
          .or(`user_id.eq.${authUser.id},id.eq.${authUser.id}`)
          .maybeSingle();

        if (driverData) {
          const isVerified = driverData.verification_status === 'Police & Background Verified' ||
            driverData.verification_status === 'verified';
          setRole('driver');
          setIsVerifiedDriver(isVerified);
          setProfile({
            id: driverData.id,
            name: driverData.full_name,
            phone: driverData.phone,
            email: driverData.email,
            rating: driverData.rating || 5.0,
            badge: driverData.badge || 'Pilot',
            verificationStatus: driverData.verification_status,
          });
          return;
        }

        const { data: customerData } = await supabase
          .table('customer_profiles')
          .select('*')
          .or(`user_id.eq.${authUser.id},id.eq.${authUser.id}`)
          .maybeSingle();

        if (customerData) {
          setRole('customer');
          setIsVerifiedDriver(false);
          setProfile({
            id: customerData.id,
            name: customerData.full_name,
            phone: customerData.phone,
            email: customerData.email,
            rating: customerData.rating || 4.95,
            savedVehicles: customerData.saved_vehicles || INITIAL_USER.savedVehicles,
          });
          return;
        }
      } catch (err) {
        console.warn('Profile fetch error from Supabase:', err);
      }
    }

    // Default customer profile fallback
    setRole(declaredRole);
    setIsVerifiedDriver(false);
    setProfile({
      id: authUser.id,
      name: userMetadata.full_name || authUser.email?.split('@')[0] || 'Customer',
      phone: userMetadata.phone || '+91 98765 43210',
      email: authUser.email,
      rating: 4.95,
      savedVehicles: INITIAL_USER.savedVehicles,
    });
  }, []);

  // Listen for 401/403 API errors
  useEffect(() => {
    onApiAuthError((err) => {
      if (err.status === 401) {
        openAuthModal('signin', 'Your session has expired. Please sign in to continue.');
      } else if (err.status === 403) {
        openAuthModal('signin', 'Driver credentials required to access this resource.');
      }
    });
  }, [openAuthModal]);

  // Session Hydration: Check active Supabase session or cached demo session
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      setIsLoading(true);

      // 1. Supabase Auth session if configured
      if (supabase && isSupabaseConfigured) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (isMounted && currentSession) {
            await updateProfileFromUser(currentSession.user, currentSession);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Supabase getSession failed:', e);
        }
      }

      // 2. Check session cached demo session (explicit demo sign-in within this browser session)
      try {
        // Clean up any stale localStorage demo persistence from previous revisions
        localStorage.removeItem(AUTH_STORAGE_KEY);
        const cached = sessionStorage.getItem(AUTH_STORAGE_KEY);
        if (cached && isMounted) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.user) {
            await updateProfileFromUser(parsed.user, parsed.session);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Cached session read failed:', e);
      }

      // No automatic demo login. Fresh visitor starts unauthenticated.
      if (isMounted) {
        setUser(null);
        setSession(null);
        setApiAuthToken(null);
        setRole('customer');
        setIsVerifiedDriver(false);
        setProfile(null);
        setIsLoading(false);
      }
    }

    initSession();

    // Subscribe to auth state changes if Supabase is connected
    let subscription = null;
    if (supabase && isSupabaseConfigured) {
      const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!isMounted) return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await updateProfileFromUser(newSession?.user, newSession);
        } else if (event === 'SIGNED_OUT') {
          await updateProfileFromUser(null, null);
        }
      });
      subscription = data?.subscription;
    }

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [updateProfileFromUser]);

  // 1. Sign In with Email & Password
  const signInWithPassword = async ({ email, password }) => {
    const isCustomerDemo = email === 'customer@drivemate.ai' || email === 'demo.customer@drivemate.ai';
    const isDriverDemo = email === 'pilot.vikram@drivemate.ai' || email === 'demo.driver@drivemate.ai';

    if (!supabase || !isSupabaseConfigured) {
      // Local demo mode credentials check
      if (isCustomerDemo) {
        return signInDemoUser('customer', email);
      } else if (isDriverDemo) {
        return signInDemoUser('driver', email);
      } else {
        throw new Error('Supabase is not configured yet. Use the demo accounts to test.');
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      await updateProfileFromUser(data.user, data.session);
      closeAuthModal();
      return data;
    } catch (err) {
      if (!import.meta.env.PROD && (isCustomerDemo || isDriverDemo)) {
        const demoRole = isDriverDemo ? 'driver' : 'customer';
        const configuredPwd = isDriverDemo
          ? (import.meta.env.VITE_DEMO_DRIVER_PASSWORD || '')
          : (import.meta.env.VITE_DEMO_CUSTOMER_PASSWORD || '');

        if (!configuredPwd) {
          console.info(`Supabase Auth signInWithPassword rejected unprovisioned demo account (${err.message}). Using dev demo token in local development.`);
          return signInDemoUser(demoRole, email);
        }
      }
      throw err;
    }
  };

  // 2. Sign Up with Email, Password & Role Choice
  const signUp = async ({ email, password, fullName, phone, chosenRole = 'customer' }) => {
    if (!supabase || !isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured yet with valid credentials. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable new signups.'
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role: chosenRole,
          // Newly registered drivers are strictly unverified until approved
          is_verified_driver: false,
        },
      },
    });

    if (error) throw error;
    if (data.session) {
      await updateProfileFromUser(data.user, data.session);
      closeAuthModal();
    }
    return data;
  };

  // 3. Google OAuth Initiation
  const signInWithOAuth = async (provider = 'google') => {
    if (!supabase || !isSupabaseConfigured) {
      throw new Error(
        'Google OAuth requires configured Supabase credentials. Configure Google in the Supabase Dashboard -> Authentication -> Providers.'
      );
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) throw error;
    return data;
  };

  // 4. Password Recovery
  const resetPassword = async (email) => {
    if (!supabase || !isSupabaseConfigured) {
      throw new Error('Password recovery requires configured Supabase credentials.');
    }

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
    return data;
  };

  // 5. Sign Out
  const signOut = async () => {
    if (supabase && isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }

    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    await updateProfileFromUser(null, null);
    openAuthModal('signin');
  };

  // 6. Real Demo User Sign-In (Requirement 5)
  // Uses actual Supabase Auth if configured and credentials provided, or dev token in non-prod
  const signInDemoUser = async (demoRole = 'customer', preferredEmail = null) => {
    if (import.meta.env.PROD) {
      throw new Error('Demo sign-in is disabled in production.');
    }

    const isDriver = demoRole === 'driver';
    const email = preferredEmail || (isDriver ? 'demo.driver@drivemate.ai' : 'demo.customer@drivemate.ai');
    const password = isDriver
      ? (import.meta.env.VITE_DEMO_DRIVER_PASSWORD || '')
      : (import.meta.env.VITE_DEMO_CUSTOMER_PASSWORD || '');
    const token = isDriver ? 'demo-driver-token' : 'demo-customer-token';

    if (supabase && isSupabaseConfigured && password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!error && data?.session) {
          await updateProfileFromUser(data.user, data.session);
          closeAuthModal();
          return data;
        }
      } catch (e) {
        console.info('Live Supabase Auth signInWithPassword failed, using dev demo token:', e);
      }
    }

    // Verified demo token session (Development only)
    const demoUser = {
      id: isDriver ? 'DRV-1042' : 'cust_alex_morgan_01',
      email,
      user_metadata: {
        role: demoRole,
        full_name: isDriver ? 'Vikramaditya S.' : 'Alex Morgan',
        phone: isDriver ? '+91 99000 88221' : '+91 98765 43210',
        is_verified_driver: isDriver,
      },
    };
    const demoSession = {
      access_token: token,
      user: demoUser,
    };

    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: demoUser, session: demoSession }));
    await updateProfileFromUser(demoUser, demoSession);
    closeAuthModal();
    return { user: demoUser, session: demoSession };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isVerifiedDriver,
        profile,
        isLoading,
        isSupabaseConfigured,
        authModalOpen,
        authModalTab,
        authModalNotice,
        authModalRoleHint,
        openAuthModal,
        closeAuthModal,
        signInWithPassword,
        signUp,
        signInWithOAuth,
        resetPassword,
        signOut,
        signInDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
