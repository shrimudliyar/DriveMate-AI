import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { INITIAL_BOOKINGS, INITIAL_DRIVER, INITIAL_USER } from '../data/mockData';
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
  const { user, role, isVerifiedDriver, profile: authProfile, openAuthModal } = useAuth();

  // Shared Bookings state with safe localStorage hydration
  const [bookings, setBookings] = useState(() => {
    return safeGetStorage(STORAGE_KEYS.BOOKINGS, []);
  });

  // Current View / Role: 'customer' | 'driver'
  const [activeRole, setActiveRole] = useState(() => {
    return safeGetStorage(STORAGE_KEYS.ROLE, 'customer');
  });

  // Driver Online Availability
  const [isDriverOnline, setIsDriverOnline] = useState(() => {
    return safeGetStorage(STORAGE_KEYS.DRIVER_ONLINE, true);
  });

  // Today's Earnings for pilot
  const [driverEarnings, setDriverEarnings] = useState(() => {
    return safeGetStorage(STORAGE_KEYS.DRIVER_EARNINGS, 1220);
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

  // Sync active role with Auth role when authenticated
  useEffect(() => {
    if (role === 'driver' && isVerifiedDriver) {
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
          const driverId = authProfile?.id || user?.id || 'DRV-1042';
          const metrics = await api.getDriverMetrics(driverId);
          if (metrics) {
            if (typeof metrics.today_payout === 'number') {
              setDriverEarnings(metrics.today_payout);
            }
            if (typeof metrics.is_online === 'boolean') {
              setIsDriverOnline(metrics.is_online);
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
  }, [user, role, isVerifiedDriver, authProfile]);

  // Initial load probe and on user change
  useEffect(() => {
    refreshFromBackend();
  }, [refreshFromBackend]);

  // CUSTOMER ACTION: Create new booking with status 'pending'
  const createBooking = async (bookingData) => {
    if (!user) {
      openAuthModal('signin', 'Please sign in to confirm and schedule your driver booking.');
      throw new Error('Please sign in to confirm and schedule your driver booking.');
    }

    const fallbackId = `DM-${Math.floor(10000 + Math.random() * 90000)}`;
    const fallbackPayout = Math.round((bookingData.estimatedFare || 600) * 0.82);

    const customerId = user.id;
    const customerName = authProfile?.name || user.user_metadata?.full_name || 'Customer';
    const customerPhone = authProfile?.phone || user.user_metadata?.phone || '+91 98765 43210';

    const localBooking = {
      ...bookingData,
      id: fallbackId,
      customerId,
      customerName,
      customerPhone,
      driverPayout: fallbackPayout,
      status: 'pending',
      driver: null,
      createdAt: new Date().toISOString(),
    };

    try {
      // Send to FastAPI backend: authoritative pricing is computed on server
      // Server strictly binds to authenticated user identity
      const created = await api.createBooking({
        ...bookingData,
        customerId,
        customerName,
        customerPhone,
      });

      setBookings(prev => [created, ...prev.filter(b => b.id !== created.id)]);
      notify(`Booking ${created.id} confirmed! Broadcast to nearby verified pilots.`);
      return created;
    } catch (err) {
      console.warn('Backend unavailable for createBooking, utilizing local fallback:', err);
      setBookings(prev => [localBooking, ...prev]);
      notify(`Booking ${fallbackId} created! Broadcast to nearby verified pilots.`);
      return localBooking;
    }
  };

  // DRIVER ACTION: Accept incoming pending booking
  const acceptBooking = async (bookingId) => {
    let localAccepted = null;
    const driverId = authProfile?.id || user?.id || 'DRV-1042';

    try {
      const serverUpdated = await api.acceptBooking(bookingId, driverId);
      setBookings(prev => prev.map(b => (b.id === bookingId ? serverUpdated : b)));
      notify(`Accepted trip ${bookingId}! Customer car: ${serverUpdated.vehicleName}`);
      return serverUpdated;
    } catch (err) {
      console.warn(`Backend accept failed (${err.message}), using local fallback:`, err);
      setBookings(prev => {
        return prev.map(b => {
          if (b.id === bookingId) {
            if (b.status !== 'pending') {
              notify(`Booking ${bookingId} is already ${b.status}.`, 'warning');
              return b;
            }
            localAccepted = {
              ...b,
              status: 'accepted',
              driver: {
                id: driverId,
                name: authProfile?.name || INITIAL_DRIVER.name,
                rating: authProfile?.rating || INITIAL_DRIVER.rating,
                trips: INITIAL_DRIVER.totalTrips,
                phone: authProfile?.phone || INITIAL_DRIVER.phone,
                badge: authProfile?.badge || INITIAL_DRIVER.badge,
              },
              acceptedAt: new Date().toISOString(),
            };
            return localAccepted;
          }
          return b;
        });
      });

      if (localAccepted) {
        notify(`Accepted trip ${bookingId}! Customer car: ${localAccepted.vehicleName}`);
      }
      return localAccepted;
    }
  };

  // DRIVER ACTION: Reject incoming pending booking
  const rejectBooking = async (bookingId, reason = 'Slot schedule conflict') => {
    const driverId = authProfile?.id || user?.id || 'DRV-1042';
    try {
      const serverUpdated = await api.rejectBooking(bookingId, reason, driverId);
      setBookings(prev => prev.map(b => (b.id === bookingId ? serverUpdated : b)));
      notify(`Trip request ${bookingId} was declined.`, 'info');
      return serverUpdated;
    } catch (err) {
      console.warn(`Backend reject failed (${err.message}), using local fallback:`, err);
      setBookings(prev => {
        return prev.map(b => {
          if (b.id === bookingId) {
            return {
              ...b,
              status: 'rejected',
              rejectionReason: reason,
              rejectedAt: new Date().toISOString(),
            };
          }
          return b;
        });
      });
      notify(`Trip request ${bookingId} was declined.`, 'info');
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
      console.warn(`Backend start trip failed (${err.message}), using local fallback:`, err);
      setBookings(prev => {
        return prev.map(b => {
          if (b.id === bookingId) {
            return {
              ...b,
              status: 'in_progress',
              startedAt: new Date().toISOString(),
            };
          }
          return b;
        });
      });
      notify(`Trip ${bookingId} is now IN PROGRESS. Drive safely!`);
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
      console.warn(`Backend complete trip failed (${err.message}), using local fallback:`, err);
      let payoutAmount = 0;
      setBookings(prev => {
        return prev.map(b => {
          if (b.id === bookingId) {
            payoutAmount = b.driverPayout || Math.round(b.estimatedFare * 0.82);
            return {
              ...b,
              status: 'completed',
              completedAt: new Date().toISOString(),
            };
          }
          return b;
        });
      });

      if (payoutAmount > 0) {
        setDriverEarnings(prev => prev + payoutAmount);
        notify(`Trip ${bookingId} completed! ₹${payoutAmount} added to your pilot payout.`);
      }
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
      console.warn(`Backend cancel failed (${err.message}), using local fallback:`, err);
      setBookings(prev => {
        return prev.map(b => {
          if (b.id === bookingId) {
            return {
              ...b,
              status: 'cancelled',
              cancelledReason: cancelReason,
              cancelledAt: new Date().toISOString(),
            };
          }
          return b;
        });
      });
      notify(`Booking ${bookingId} has been cancelled.`, 'info');
    }
  };

  // Toggle driver availability
  const toggleDriverOnline = async () => {
    const next = !isDriverOnline;
    setIsDriverOnline(next);
    const driverId = authProfile?.id || user?.id || 'DRV-1042';
    try {
      await api.setDriverStatus(driverId, next);
    } catch (e) {
      // Graceful offline fallback
    }
    notify(next ? 'You are now ONLINE and accepting ride dispatches.' : 'You are now OFFLINE. New requests paused.', next ? 'success' : 'info');
  };

  // Switch role between customer and driver
  const switchRole = (newRole) => {
    if (newRole === 'customer' || newRole === 'driver') {
      setActiveRole(newRole);
    }
  };

  // Reset demo state
  const resetDemoState = () => {
    setBookings(INITIAL_BOOKINGS);
    setDriverEarnings(1220);
    setIsDriverOnline(true);
    notify('Demo state restored to original initial data.');
  };

  // Computed counts
  const pendingRequestsCount = bookings.filter(b => b.status === 'pending').length;
  const acceptedTripsCount = bookings.filter(b => b.status === 'accepted' || b.status === 'in_progress').length;
  const completedTripsCount = bookings.filter(b => b.status === 'completed').length;

  return (
    <BookingContext.Provider
      value={{
        bookings,
        activeRole,
        switchRole,
        isDriverOnline,
        toggleDriverOnline,
        driverProfile: (role === 'driver' && isVerifiedDriver) ? (authProfile || INITIAL_DRIVER) : null,
        userProfile: role === 'customer' ? (authProfile || null) : null,
        driverEarnings,
        createBooking,
        acceptBooking,
        rejectBooking,
        startTrip,
        completeTrip,
        cancelBooking,
        resetDemoState,
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
