import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../api/supabase';
import { setApiAuthToken, onApiAuthError } from '../api/client';

const AuthContext = createContext();

const AUTH_STORAGE_KEY = 'drivemate_demo_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState('customer'); // 'customer' | 'driver'
  const [isVerifiedDriver, setIsVerifiedDriver] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Password recovery state is set ONLY via the onAuthStateChange PASSWORD_RECOVERY event
  // (the only reliable signal — the URL hash is cleared by detectSessionInUrl before initSession runs).
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  // Ref mirrors the state so the onAuthStateChange closure can read it without stale closure issues.
  const isPasswordRecoveryRef = useRef(false);

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
    const appMetadata = authUser.app_metadata || {};
    const declaredRole = userMetadata.role || 'customer';

    // 1. ADMIN ROLE HYDRATION (Security: Strictly requires server-side app_metadata or verified demo token)
    const isAdmin = (appMetadata.role === 'admin') ||
                    (appMetadata.is_admin === true) ||
                    (activeSession?.access_token === 'demo-admin-token');

    if (isAdmin) {
      setRole('admin');
      setIsVerifiedDriver(false);
      setProfile({
        id: authUser.id || 'admin_super_01',
        name: userMetadata.full_name || 'System Administrator',
        email: authUser.email,
        phone: userMetadata.phone || '',
        role: 'admin',
        badge: 'Platform Administrator',
      });
      return;
    }

    // If Supabase is connected, query role-appropriate profile table for verified status
    if (supabase && isSupabaseConfigured) {
      try {
        if (declaredRole === 'driver') {
          const { data: driverData, error: driverError } = await supabase
            .from('driver_profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          if (driverError) {
            console.warn('Driver profile fetch error from Supabase:', driverError);
          }

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
              licenseNumber: driverData.license_number || 'Pending Submission',
              experienceYears: driverData.experience_years ?? 3,
              specializations: Array.isArray(driverData.specializations) ? driverData.specializations : ['Standard Transmission', 'Automatic'],
              languages: Array.isArray(driverData.languages) ? driverData.languages : ['English', 'Hindi', 'Kannada'],
              totalTrips: driverData.total_trips ?? 0,
              joinedDate: driverData.created_at ? new Date(driverData.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'March 2024',
              rejectionReason: driverData.rejection_reason || null,
              reviewedBy: driverData.reviewed_by || null,
              reviewedAt: driverData.reviewed_at || null,
              documents: driverData.documents || {},
            });
            return;
          }

          // Driver record not in database yet (e.g. newly registered applicant).
          // Server-set app_metadata is checked for verified status.
          const isVerified = (appMetadata.is_verified_driver === true) ||
                             (appMetadata.verification_status === 'Police & Background Verified');
          const vStatus = appMetadata.verification_status || (isVerified ? 'Police & Background Verified' : 'pending_verification');
          const vBadge = appMetadata.badge || (isVerified ? 'Certified Gold Pilot' : 'Applicant Pilot');
          setRole('driver');
          setIsVerifiedDriver(isVerified);
          setProfile({
            id: authUser.id,
            name: userMetadata.full_name || authUser.email?.split('@')[0] || 'Driver Pilot',
            phone: userMetadata.phone || '',
            email: authUser.email,
            rating: 5.0,
            badge: vBadge,
            verificationStatus: vStatus,
            licenseNumber: userMetadata.license_number || 'PENDING-VERIFICATION',
            experienceYears: Number(userMetadata.experience_years) || 0,
            specializations: Array.isArray(userMetadata.specializations) ? userMetadata.specializations : ['Standard Transmission', 'Automatic'],
            languages: Array.isArray(userMetadata.languages) ? userMetadata.languages : ['English', 'Hindi', 'Kannada'],
            totalTrips: 0,
            joinedDate: authUser.created_at ? new Date(authUser.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently',
            rejectionReason: appMetadata.rejection_reason || null,
            reviewedBy: appMetadata.reviewed_by || null,
            reviewedAt: appMetadata.reviewed_at || null,
          });
          return;
        }

        // Customer account: query customer_profiles table
        const { data: customerData, error: customerError } = await supabase
          .from('customer_profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (customerError) {
          console.warn('Customer profile fetch error from Supabase:', customerError);
        }

        if (customerData) {
          setRole('customer');
          setIsVerifiedDriver(false);
          setProfile({
            id: customerData.id,
            name: customerData.full_name,
            phone: customerData.phone,
            email: customerData.email,
            rating: customerData.rating || 5.0,
            savedVehicles: customerData.saved_vehicles || [],
          });
          return;
        }
      } catch (err) {
        console.warn('Profile fetch error from Supabase:', err);
      }
    }

    // Fallback when Supabase is offline or unconfigured
    if (declaredRole === 'driver') {
      setRole('driver');
      setIsVerifiedDriver(false);
      setProfile({
        id: authUser.id,
        name: userMetadata.full_name || authUser.email?.split('@')[0] || 'Driver Pilot',
        phone: userMetadata.phone || '',
        email: authUser.email,
        rating: 5.0,
        badge: 'Applicant Pilot',
        verificationStatus: 'pending_verification',
      });
      return;
    }

    // Default customer profile fallback
    setRole('customer');
    setIsVerifiedDriver(false);
    setProfile({
      id: authUser.id,
      name: userMetadata.full_name || authUser.email?.split('@')[0] || 'Customer',
      phone: userMetadata.phone || '',
      email: authUser.email,
      rating: 5.0,
      savedVehicles: [],
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

      // NOTE: We do NOT check the URL for type=recovery here. The reason:
      // With detectSessionInUrl: true, Supabase JS client exchanges the recovery
      // token and clears the URL hash BEFORE initSession() reads window.location.
      // The PASSWORD_RECOVERY event in onAuthStateChange is the only reliable signal.

      // 1. Supabase Auth session if configured
      if (supabase && isSupabaseConfigured) {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (isMounted && currentSession) {
            let activeUser = currentSession.user;
            let activeSession = currentSession;

            // Fetch fresh server-side user data to capture server-side role updates (e.g. admin promotion)
            try {
              const { data: freshUserData, error: userError } = await supabase.auth.getUser();
              if (!userError && freshUserData?.user) {
                activeUser = freshUserData.user;
                const appMeta = activeUser.app_metadata || {};
                // If user has admin claims, ensure the session token contains updated claims
                if (appMeta.role === 'admin' || appMeta.is_admin === true) {
                  const { data: refreshData } = await supabase.auth.refreshSession();
                  if (refreshData?.session) {
                    activeSession = refreshData.session;
                    activeUser = refreshData.session.user || activeUser;
                  }
                }
              }
            } catch (freshErr) {
              console.warn('Could not fetch fresh user metadata:', freshErr);
            }

            await updateProfileFromUser(activeUser, activeSession);
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
        if (event === 'PASSWORD_RECOVERY') {
          isPasswordRecoveryRef.current = true;
          setIsPasswordRecovery(true);
          setUser(newSession?.user || null);
          setSession(newSession || null);
          setApiAuthToken(newSession?.access_token || null);
          setIsLoading(false);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Guard: if we're in password recovery mode (set by PASSWORD_RECOVERY event above),
          // do NOT overwrite the recovery flow with a normal session hydration.
          // We use a ref here because the closure captures the initial value of the state.
          if (isPasswordRecoveryRef.current) {
            setUser(newSession?.user || null);
            setSession(newSession || null);
            setApiAuthToken(newSession?.access_token || null);
            setIsLoading(false);
            return;
          }
          await updateProfileFromUser(newSession?.user, newSession);
        } else if (event === 'SIGNED_OUT') {
          isPasswordRecoveryRef.current = false;
          setIsPasswordRecovery(false);
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
  const signInWithPassword = async ({ email: rawEmail, password }) => {
    const email = (rawEmail || '').trim();
    const isCustomerDemo = email === 'customer@drivemate.ai' || email === 'demo.customer@drivemate.ai';
    const isDriverDemo = email === 'pilot.vikram@drivemate.ai' || email === 'demo.driver@drivemate.ai';
    const isAdminDemo = email === 'admin@drivemate.ai' || email === 'demo.admin@drivemate.ai';

    if (!supabase || !isSupabaseConfigured) {
      // Local demo mode credentials check
      if (isCustomerDemo) {
        return signInDemoUser('customer', email);
      } else if (isDriverDemo) {
        return signInDemoUser('driver', email);
      } else if (isAdminDemo) {
        return signInDemoUser('admin', email);
      } else {
        throw new Error('Supabase is not configured yet. Use the demo accounts to test.');
      }
    }

    // In local development, if an offline demo email is used without a live Supabase password,
    // avoid firing an unprovisioned request that produces a 400 in the browser console.
    if (!import.meta.env.PROD) {
      if (isAdminDemo) {
        return signInDemoUser('admin', email);
      }
      if (isDriverDemo && !import.meta.env.VITE_DEMO_DRIVER_PASSWORD) {
        return signInDemoUser('driver', email);
      }
      if (isCustomerDemo && !import.meta.env.VITE_DEMO_CUSTOMER_PASSWORD) {
        return signInDemoUser('customer', email);
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
      if (!import.meta.env.PROD && (isCustomerDemo || isDriverDemo || isAdminDemo)) {
        const demoRole = isAdminDemo ? 'admin' : (isDriverDemo ? 'driver' : 'customer');
        console.info(`Supabase Auth signInWithPassword rejected unprovisioned demo account (${err.message}). Using dev demo token in local development.`);
        return signInDemoUser(demoRole, email);
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
      // mailer_autoconfirm is ON — session is immediately available
      await updateProfileFromUser(data.user, data.session);
      closeAuthModal();
    }
    // If data.session is null, email confirmation is required.
    // The modal stays open so AuthModal can show the "check your email" message.
    // Return data so AuthModal can detect the pending-confirmation state.
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

  // 4b. Update Password after Recovery Link Submission
  const updatePassword = async (newPassword) => {
    if (!supabase || !isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters in length.');
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;

    isPasswordRecoveryRef.current = false;
    setIsPasswordRecovery(false);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', '/');
    }

    if (data?.user) {
      await updateProfileFromUser(data.user, data.session || session);
    }

    return data;
  };

  const cancelPasswordRecovery = () => {
    isPasswordRecoveryRef.current = false;
    setIsPasswordRecovery(false);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', '/');
    }
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
    localStorage.removeItem('drivemate_active_role');
    await updateProfileFromUser(null, null);
    openAuthModal('signin');
  };

  // 6. Real Demo User Sign-In (Requirement 5)
  // Uses actual Supabase Auth if configured and credentials provided, or dev token in non-prod
  const signInDemoUser = async (demoRole = 'customer', preferredEmail = null) => {
    if (import.meta.env.PROD) {
      throw new Error('Demo sign-in is disabled in production.');
    }

    const isAdmin = demoRole === 'admin';
    const isDriver = demoRole === 'driver';
    const email = preferredEmail || (isAdmin
      ? 'admin@drivemate.ai'
      : (isDriver ? 'demo.driver@drivemate.ai' : 'demo.customer@drivemate.ai'));
    const password = isDriver
      ? (import.meta.env.VITE_DEMO_DRIVER_PASSWORD || '')
      : (import.meta.env.VITE_DEMO_CUSTOMER_PASSWORD || '');
    const token = isAdmin
      ? 'demo-admin-token'
      : (isDriver ? 'demo-driver-token' : 'demo-customer-token');

    if (supabase && isSupabaseConfigured && password && !isAdmin) {
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
      id: isAdmin ? 'admin_super_01' : (isDriver ? 'DRV-1042' : 'cust_alex_morgan_01'),
      email,
      app_metadata: isAdmin ? { role: 'admin', is_admin: true } : {},
      user_metadata: {
        role: demoRole,
        full_name: isAdmin ? 'System Administrator' : (isDriver ? 'Vikramaditya S.' : 'Alex Morgan'),
        phone: isAdmin ? '+91 80000 00000' : (isDriver ? '+91 99000 88221' : '+91 98765 43210'),
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

  const refreshProfile = useCallback(async () => {
    if (user && session) {
      await updateProfileFromUser(user, session);
    }
  }, [user, session, updateProfileFromUser]);

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
        updatePassword,
        cancelPasswordRecovery,
        isPasswordRecovery,
        signOut,
        signInDemoUser,
        refreshProfile,
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
