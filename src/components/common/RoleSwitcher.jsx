import React from 'react';
import { User, Car, Lock } from 'lucide-react';
import { useBookings } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';

export default function RoleSwitcher({ className = '' }) {
  const { activeRole, switchRole, pendingRequestsCount, isDriverOnline } = useBookings();
  const { role, isVerifiedDriver, openAuthModal } = useAuth();

  const handleSelectRole = (targetRole) => {
    if (targetRole === 'driver') {
      // Security Guard: Prevent regular customers from accessing Driver Portal
      if (role !== 'driver' || !isVerifiedDriver) {
        openAuthModal(
          'signin',
          'Verified driver credentials required. Please sign in as a verified pilot to access trip dispatches.'
        );
        return;
      }
    }
    switchRole(targetRole);
  };

  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl bg-slate-200/90 dark:bg-brand-navy-subtle border border-slate-300 dark:border-brand-navy-border shadow-xs ${className}`}
      role="group"
      aria-label="Role Switcher"
    >
      <button
        type="button"
        onClick={() => handleSelectRole('customer')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          activeRole === 'customer'
            ? 'bg-white text-brand-navy shadow-sm dark:bg-brand-navy dark:text-white dark:border dark:border-brand-navy-border'
            : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
        }`}
      >
        <User className="w-3.5 h-3.5 text-brand-navy dark:text-brand-sky" />
        <span>Customer Portal</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelectRole('driver')}
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          activeRole === 'driver'
            ? 'bg-brand-navy text-white shadow-sm dark:bg-brand-sky dark:text-brand-navy'
            : 'text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white'
        }`}
      >
        <Car className="w-3.5 h-3.5" />
        <span>Driver Portal</span>

        {/* Lock icon indicator if user doesn't have verified driver credentials */}
        {(!isVerifiedDriver || role !== 'driver') && (
          <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500 ml-0.5" />
        )}

        {/* Live indicator if driver is verified and online */}
        {isVerifiedDriver && role === 'driver' && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isDriverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
            }`}
            title={isDriverOnline ? 'Driver Online' : 'Driver Offline'}
          />
        )}

        {/* Badge counter if there are pending booking requests */}
        {isVerifiedDriver && role === 'driver' && pendingRequestsCount > 0 && (
          <span className="flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-bounce">
            {pendingRequestsCount}
          </span>
        )}
      </button>
    </div>
  );
}
