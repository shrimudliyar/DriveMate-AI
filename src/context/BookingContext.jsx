import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../api/supabase';
import { api, normalizeBooking } from '../api/client';
import { useAuth } from './AuthContext';

const BookingContext = createContext();

const STORAGE_KEYS = {
  BOOKINGS: 'drivemate_bookings_v2',
  ROLE: 'drivemate_active_role',
  DRIVER_ONLINE: 'drivemate_driver_online',
  DRIVER_EARNINGS: 'drivemate_driver_earnings',
};

function safeGetStorage(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    if (item === null || item === undefined) return fallback;
    return JSON.parse(item);
  } catch (err) {
    console.warn(`Failed reading ${key} from localStorage, using fallback:`, err);
    return fallback;
  }
}

export function BookingProvider({ children }) {
  const { user, role, isVerifiedDriver, profile: authProfile, openAuthModal, isLoading: authLoading } = useAuth();

  // Shared Bookings state with safe localStorage hydration
  const [bookings, setBookings] = useState(() => {
    return safeGetStorage(STORAGE_KEYS.BOOKINGS, []);
  });

  // Current View / Role: 'customer' | 'driver' | 'admin'
  const [activeRole, setActiveRole] = useState(() => {
    if (role === 'admin') return 'admin';
    if (role === 'driver') return 'driver';
    const stored = safeGetStorage(STORAGE_KEYS.ROLE, 'customer');
    // Security: Never trust 'admin' from localStorage; admin requires authenticated role
    if (stored === 'admin') return 'customer';
    return stored;
  });

  // Driver Online Availability
  const [isDriverOnline, setIsDriverOnline] = useState(() => {
    return safeGetStorage(STORAGE_KEYS.DRIVER_ONLINE, true);
  });

  // Today's Earnings for pilot
  const [driverEarnings, setDriverEarnings] = useState(() => {
    return safeGetStorage(STORAGE_KEYS.DRIVER_EARNINGS, 0);
  });

  // Backend Connectivity status
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Notification / Toast state
  const [notification, setNotification] = useState(null);

  const notify = (message, type = 'success') => {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Sync active role with Auth role when authenticated.
  // - Admin role strictly displays Admin Portal.
  // - Driver role displays Driver Portal (verified or pending/rejected).
  // - Customer role displays Customer Portal.
  useEffect(() => {
    if (role === 'admin') {
      setActiveRole('admin');
    } else if (role === 'driver') {
      setActiveRole('driver');
    } else {
      setActiveRole('customer');
    }
  }, [role, isVerifiedDriver]);

  // Sync to localStorage as temporary demo / offline cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    } catch (e) {
      console.error('Failed saving bookings:', e);
    }
  }, [bookings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE, JSON.stringify(activeRole));
    } catch (e) {
      console.error('Failed saving active role:', e);
    }
  }, [activeRole]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DRIVER_ONLINE, JSON.stringify(isDriverOnline));
    } catch (e) {
      console.error('Failed saving driver online status:', e);
    }
  }, [isDriverOnline]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DRIVER_EARNINGS, JSON.stringify(driverEarnings));
    } catch (e) {
      console.error('Failed saving driver earnings:', e);
    }
  }, [driverEarnings]);

  // Synchronize state with FastAPI backend
  const refreshFromBackend = useCallback(async () => {
    setIsSyncing(true);
    try {
      await api.checkHealth();
      setIsBackendConnected(true);

      // Wait for auth session initialization to complete before querying authenticated endpoints
      if (authLoading) {
        setIsSyncing(false);
        return;
      }

      // Only query authenticated bookings endpoint if a user session is active
      if (!user) {
        setBookings([]);
        setIsSyncing(false);
        return;
      }

      const serverBookings = await api.getBookings();
      if (Array.isArray(serverBookings)) {
        setBookings(serverBookings);
      }

      // If driver is active, fetch real-time driver metrics
      if (role === 'driver' && isVerifiedDriver) {
        try {
          const driverId = authProfile?.id || user?.id;
          if (driverId) {
            const metrics = await api.getDriverMetrics(driverId);
            if (metrics) {
              if (typeof metrics.today_payout === 'number') {
                setDriverEarnings(metrics.today_payout);
              }
              if (typeof metrics.is_online === 'boolean') {
                setIsDriverOnline(metrics.is_online);
              }
            }
          }
        } catch (e) {
          // Driver metrics non-fatal
        }
      }
    } catch (err) {
      setIsBackendConnected(false);
      // Graceful offline fallback
    } finally {
      setIsSyncing(false);
    }
  }, [user, role, isVerifiedDriver, authProfile, authLoading]);

  // Realtime subscription: Listen for database changes on bookings table
  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || !user) return;

    const channel = supabase
      .channel('public:bookings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          refreshFromBackend();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshFromBackend]);

  // Initial load probe and on user/authLoading change
  useEffect(() => {
    if (!authLoading) {
      refreshFromBackend();
    }
  }, [authLoading, refreshFromBackend]);

  // CUSTOMER ACTION: Create new booking with status 'pending'
  const createBooking = async (bookingData) => {
    if (!user) {
      openAuthModal('signin', 'Please sign in to confirm and schedule your driver booking.');
      throw new Error('Please sign in to confirm and schedule your driver booking.');
    }

    const customerId = user.id;
    const customerName = authProfile?.name || user.user_metadata?.full_name || '';
    const customerPhone = authProfile?.phone || user.user_metadata?.phone || '';

    try {
      const created = await api.createBooking({
        ...bookingData,
        customerId,
        customerName,
        customerPhone,
      });

      setBookings(prev => [created, ...prev.filter(b => b.id !== created.id)]);
      notify(`Booking ${created.id} confirmed! Broadcast to verified pilots.`);
      return created;
    } catch (err) {
      notify(err.message || 'Failed to create booking. Please verify your connection.', 'danger');
      throw err;
    }
  };

  // DRIVER ACTION: Accept incoming pending booking (atomic conditional update)
  const acceptBooking = async (bookingId) => {
    const driverId = authProfile?.id || user?.id || '';

    try {
      const serverUpdated = await api.acceptBooking(bookingId, driverId);
      setBookings(prev => prev.map(b => (b.id === bookingId ? serverUpdated : b)));
      notify(`Accepted trip ${bookingId}! Customer car: ${serverUpdated.vehicleName}`);
      return serverUpdated;
    } catch (err) {
      if (err.status === 409) {
        notify(`Dispatch ${bookingId} has already been accepted by another driver.`, 'warning');
        setBookings(prev => prev.filter(b => b.id !== bookingId));
      } else {
        notify(err.message || `Failed to accept booking ${bookingId}.`, 'danger');
      }
      throw err;
    }
  };

  // DRIVER ACTION: Reject incoming pending booking
  const rejectBooking = async (bookingId, reason = 'Pilot unavailable') => {
    const driverId = authProfile?.id || user?.id || '';
    try {
      const serverUpdated = await api.rejectBooking(bookingId, reason, driverId);
      // Mark as rejected in driver's local bookings list so it transitions out of Pending into Declined
      const rejectedRecord = serverUpdated || { id: bookingId, status: 'rejected', rejectionReason: reason };
      setBookings(prev => prev.map(b => (b.id === bookingId ? { ...b, ...rejectedRecord, status: 'rejected', rejectionReason: reason } : b)));
      notify(`Trip dispatch ${bookingId} declined.`, 'info');
    } catch (err) {
      notify(err.message || 'Failed to decline booking.', 'danger');
      throw err;
    }
  };

  // DRIVER ACTION: Start accepted trip
  const startTrip = async (bookingId) => {
    try {
      const serverUpdated = await api.startTrip(bookingId);
      setBookings(prev => prev.map(b => (b.id === bookingId ? serverUpdated : b)));
      notify(`Trip ${bookingId} is now IN PROGRESS. Drive safely!`);
      return serverUpdated;
    } catch (err) {
      notify(err.message || 'Failed to start trip.', 'danger');
      throw err;
    }
  };

  // DRIVER ACTION: Complete trip and credit earnings
  const completeTrip = async (bookingId) => {
    try {
      const serverUpdated = await api.completeTrip(bookingId);
      setBookings(prev => prev.map(b => (b.id === bookingId ? serverUpdated : b)));
      const payoutAmount = serverUpdated.driverPayout || Math.round(serverUpdated.estimatedFare * 0.82);
      setDriverEarnings(prev => prev + payoutAmount);
      notify(`Trip ${bookingId} completed! ₹${payoutAmount} added to your pilot payout.`);
      return serverUpdated;
    } catch (err) {
      notify(err.message || 'Failed to complete trip.', 'danger');
      throw err;
    }
  };

  // CUSTOMER / DRIVER ACTION: Cancel booking
  const cancelBooking = async (bookingId, cancelReason = 'Cancelled by user') => {
    try {
      const serverUpdated = await api.cancelBooking(bookingId, cancelReason);
      setBookings(prev => prev.map(b => (b.id === bookingId ? serverUpdated : b)));
      notify(`Booking ${bookingId} has been cancelled.`, 'info');
      return serverUpdated;
    } catch (err) {
      notify(err.message || 'Failed to cancel booking.', 'danger');
      throw err;
    }
  };

  // Toggle driver availability
  const toggleDriverOnline = async () => {
    const next = !isDriverOnline;
    setIsDriverOnline(next);
    const driverId = authProfile?.id || user?.id;
    if (driverId) {
      try {
        await api.setDriverStatus(driverId, next);
      } catch (e) {
        console.warn('Driver status toggle failed:', e);
      }
    }
    notify(next ? 'You are now ONLINE and accepting ride dispatches.' : 'You are now OFFLINE. New requests paused.', next ? 'success' : 'info');
  };

  // Switch role between customer and driver
  const switchRole = (newRole) => {
    if (role === 'admin') return;
    if (newRole === 'customer' || newRole === 'driver') {
      setActiveRole(newRole);
    }
  };

  // Computed counts
  const pendingRequestsCount = bookings.filter(b => b.status === 'pending').length;
  const acceptedTripsCount = bookings.filter(b => b.status === 'accepted' || b.status === 'in_progress').length;
  const completedTripsCount = bookings.filter(b => b.status === 'completed').length;

  // Resolved active role ensuring admin role is never overridden by client state
  const effectiveActiveRole = role === 'admin'
    ? 'admin'
    : (role === 'driver' ? 'driver' : (activeRole === 'admin' ? 'customer' : activeRole));

  // Authoritative live driver profile normalization from database
  const resolvedDriverProfile = (role === 'driver' || activeRole === 'driver')
    ? {
        id: authProfile?.id || user?.id || 'DRV-PILOT',
        name: authProfile?.name || authProfile?.full_name || 'Driver Pilot',
        phone: authProfile?.phone || '',
        email: authProfile?.email || user?.email || '',
        rating: typeof authProfile?.rating === 'number' ? authProfile.rating : 5.0,
        badge: authProfile?.badge || (isVerifiedDriver ? 'Certified Gold Pilot' : 'Applicant Pilot'),
        verificationStatus: authProfile?.verificationStatus || authProfile?.verification_status || (isVerifiedDriver ? 'Police & Background Verified' : 'pending_verification'),
        licenseNumber: authProfile?.licenseNumber || authProfile?.license_number || 'Pending Submission',
        experienceYears: authProfile?.experienceYears ?? authProfile?.experience_years ?? 0,
        languages: Array.isArray(authProfile?.languages) && authProfile.languages.length > 0
          ? authProfile.languages
          : ['English'],
        specializations: Array.isArray(authProfile?.specializations) && authProfile.specializations.length > 0
          ? authProfile.specializations
          : [],
        totalTrips: authProfile?.totalTrips ?? authProfile?.total_trips ?? 0,
        joinedDate: authProfile?.joinedDate || 'Recently',
      }
    : null;

  return (
    <BookingContext.Provider
      value={{
        bookings,
        activeRole: effectiveActiveRole,
        switchRole,
        isDriverOnline,
        toggleDriverOnline,
        driverProfile: resolvedDriverProfile,
        userProfile: role === 'customer' ? (authProfile || null) : null,
        driverEarnings,
        createBooking,
        acceptBooking,
        rejectBooking,
        startTrip,
        completeTrip,
        cancelBooking,
        refreshFromBackend,
        isBackendConnected,
        isSyncing,
        pendingRequestsCount,
        acceptedTripsCount,
        completedTripsCount,
        notification,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBookings() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBookings must be used within a BookingProvider');
  }
  return context;
}
