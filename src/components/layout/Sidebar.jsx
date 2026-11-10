import React from 'react';
import {
  Car,
  CalendarDays,
  ShieldCheck,
  Calculator,
  PhoneCall,
  Gauge,
  Power,
  LogOut,
  LogIn,
  LayoutDashboard,
  FileCheck,
  CarFront
} from 'lucide-react';
import BrandLogo from '../common/BrandLogo';
import ThemeToggle from '../common/ThemeToggle';
// RoleSwitcher removed for driver mode — drivers see only driver navigation
import { useBookings } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar({ currentTab, onSelectTab, bookingsCount = 0 }) {
  const {
    activeRole,
    isDriverOnline,
    toggleDriverOnline,
    pendingRequestsCount,
    acceptedTripsCount,
  } = useBookings();
  const { user, profile, role, isVerifiedDriver, signOut, openAuthModal } = useAuth();

  const customerNavItems = [
    { id: 'dashboard', label: 'Book a Driver', icon: Car, badge: 'Voice AI' },
    { id: 'trips', label: 'My Bookings', icon: CalendarDays, count: bookingsCount },
    { id: 'safety', label: 'Safety & Trust', icon: ShieldCheck },
    { id: 'pricing', label: 'Fare Calculator', icon: Calculator },
  ];

  const driverNavItems = [
    {
      id: 'driver-dashboard',
      label: 'Driver Dashboard',
      icon: Gauge,
      count: pendingRequestsCount,
      badgeLabel: 'Pending',
      badgeClass: 'bg-amber-500 text-white',
    },
    {
      id: 'driver-trips',
      label: 'My Trips',
      icon: CarFront,
      count: acceptedTripsCount,
      badgeLabel: 'Active',
      badgeClass: 'bg-brand-navy text-white dark:bg-brand-sky dark:text-brand-navy',
    },
    {
      id: 'safety',
      label: 'Safety Protocols',
      icon: ShieldCheck
    },
  ];

  const adminNavItems = [
    { id: 'admin-overview', label: 'Admin Overview', icon: LayoutDashboard },
    { id: 'admin-applications', label: 'Driver Applications', icon: FileCheck },
    { id: 'admin-verified', label: 'Verified Pilots', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 shrink-0 hidden lg:flex flex-col h-screen sticky top-0 bg-white dark:bg-brand-navy-dark border-r border-slate-200 dark:border-brand-navy-border p-5 z-20 transition-colors duration-200">
      {/* Brand logo & tagline */}
      <div className="pb-5 border-b border-slate-200 dark:border-brand-navy-border flex items-center justify-between">
        <BrandLogo size="default" showTagline={true} />
      </div>

      {/* Main navigation */}
      <nav className="flex-1 py-4 space-y-1.5 overflow-y-auto" aria-label="Sidebar Navigation">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted dark:text-slate-400 px-3 mb-2">
          {activeRole === 'admin' ? 'Admin Portal' : (activeRole === 'driver' ? 'Driver Portal' : 'Customer Portal')}
        </div>

        {activeRole === 'admin' ? (
          adminNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-sky-light text-brand-navy border border-brand-sky dark:bg-brand-navy-surface dark:text-brand-sky dark:border-brand-navy-border shadow-xs'
                    : 'text-brand-muted hover:text-brand-dark hover:bg-brand-grey-subtle dark:text-slate-400 dark:hover:text-white dark:hover:bg-brand-navy-subtle'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-navy dark:text-brand-sky' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })
        ) : activeRole === 'customer' ? (
          customerNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-sky-light text-brand-navy border border-brand-sky dark:bg-brand-navy-surface dark:text-brand-sky dark:border-brand-navy-border shadow-xs'
                    : 'text-brand-muted hover:text-brand-dark hover:bg-brand-grey-subtle dark:text-slate-400 dark:hover:text-white dark:hover:bg-brand-navy-subtle'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-navy dark:text-brand-sky' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-sky text-brand-navy">
                    {item.badge}
                  </span>
                )}

                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-brand-navy-dark text-brand-dark dark:text-slate-200">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })
        ) : (
          driverNavItems.map(item => {
            const Icon = item.icon;
            const isActive = item.id === 'driver-dashboard'
              ? (currentTab === 'driver-dashboard' || currentTab === 'driver-console' || currentTab === 'dashboard')
              : currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-brand-sky-light text-brand-navy border border-brand-sky dark:bg-brand-navy-surface dark:text-brand-sky dark:border-brand-navy-border shadow-xs'
                    : 'text-brand-muted hover:text-brand-dark hover:bg-brand-grey-subtle dark:text-slate-400 dark:hover:text-white dark:hover:bg-brand-navy-subtle'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-navy dark:text-brand-sky' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {typeof item.count === 'number' && item.count > 0 && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.badgeClass || 'bg-amber-500 text-white'}`}>
                    {item.count} {item.badgeLabel || ''}
                  </span>
                )}
              </button>
            );
          })
        )}

        {/* Quick Driver Online switch in driver mode */}
        {activeRole === 'driver' && (
          <div className="pt-3 px-1">
            <button
              type="button"
              onClick={toggleDriverOnline}
              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isDriverOnline
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Power className="w-3.5 h-3.5" />
                <span>Duty: {isDriverOnline ? 'Online' : 'Offline'}</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${isDriverOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
            </button>
          </div>
        )}

        <div className="pt-5">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted dark:text-slate-400 px-3 mb-2">
            Preferences & Support
          </div>
          <div className="space-y-2 px-1">
            <div className="flex items-center justify-between p-2 rounded-xl bg-brand-grey-subtle/80 dark:bg-brand-navy-dark/70 border border-slate-200 dark:border-brand-navy-border">
              <span className="text-xs font-semibold text-brand-dark dark:text-slate-300">Theme</span>
              <ThemeToggle variant="segmented" />
            </div>

            <button
              type="button"
              onClick={() => onSelectTab('safety')}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-brand-grey-subtle dark:hover:bg-brand-navy-subtle transition-colors cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
              <span>24/7 Operations Support</span>
            </button>
          </div>
        </div>
      </nav>

      {/* User / Driver Profile card at bottom */}
      <div className="pt-4 border-t border-slate-200 dark:border-brand-navy-border">
        {user ? (
          /* Authenticated user card */
          <div className="p-3 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-surface border border-slate-200 dark:border-brand-navy-border shadow-xs space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-navy dark:bg-brand-sky flex items-center justify-center text-white dark:text-brand-navy font-bold text-sm shrink-0">
                {(profile?.name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-brand-dark dark:text-white truncate block">
                  {profile?.name || 'DriveMate User'}
                </span>
                <span className="text-[10px] text-brand-muted dark:text-slate-400 truncate block capitalize">
                  {role} {role === 'driver' && isVerifiedDriver && '· Verified'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        ) : (
          /* Guest / unauthenticated card */
          <div className="p-3 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-surface border border-slate-200 dark:border-brand-navy-border shadow-xs space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center shrink-0">
                <LogIn className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-brand-dark dark:text-white block">Demo Mode</span>
                <span className="text-[10px] text-brand-muted dark:text-slate-400 block">Not signed in</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold text-brand-navy dark:text-brand-sky hover:bg-brand-sky-light dark:hover:bg-brand-navy-subtle rounded-lg transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
