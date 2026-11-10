import React, { useState } from 'react';
import { Menu, X, Car, CalendarDays, ShieldCheck, Calculator, User, LogIn, LogOut, LayoutDashboard, FileCheck, Gauge, CarFront } from 'lucide-react';
import BrandLogo from '../common/BrandLogo';
import ThemeToggle from '../common/ThemeToggle';
// RoleSwitcher removed for production UI
import { useBookings } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';

export default function Navbar({ currentTab, onSelectTab, bookingsCount = 0 }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { activeRole, isDriverOnline, pendingRequestsCount, acceptedTripsCount } = useBookings();
  const { user, profile, role, isVerifiedDriver, signOut, openAuthModal } = useAuth();

  const customerNavItems = [
    { id: 'dashboard', label: 'Book a Driver', icon: Car },
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

  const handleSelect = (id) => {
    onSelectTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 dark:bg-brand-navy-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-brand-navy-border px-4 py-3 lg:hidden transition-colors duration-200">
      <div className="flex items-center justify-between">
        <BrandLogo size="default" showTagline={false} />

        <div className="flex items-center gap-2">
          {user ? (
            <button
              type="button"
              onClick={signOut}
              title="Sign Out"
              className="p-2 rounded-xl bg-slate-100 dark:bg-brand-navy text-brand-muted hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="px-2.5 py-1.5 rounded-xl bg-brand-navy dark:bg-brand-sky text-white dark:text-brand-navy text-xs font-bold flex items-center gap-1"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl bg-white dark:bg-brand-navy border border-slate-200 dark:border-brand-navy-border text-brand-dark dark:text-slate-200 hover:bg-brand-grey-subtle dark:hover:bg-brand-navy-subtle cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>



      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="pt-4 pb-3 border-t border-slate-200 dark:border-brand-navy-border mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted dark:text-slate-400 px-2">
            {activeRole === 'admin' ? 'Admin Portal Navigation' : (activeRole === 'driver' ? 'Driver Portal Navigation' : 'Customer Navigation')}
          </div>

          {activeRole === 'admin' ? (
            adminNavItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand-sky-light text-brand-navy border border-brand-sky dark:bg-brand-navy-surface dark:text-brand-sky dark:border-brand-navy-border'
                      : 'text-brand-dark dark:text-slate-300 hover:bg-brand-grey-subtle dark:hover:bg-brand-navy-subtle'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })
          ) : activeRole === 'driver' ? (
            <>
              {driverNavItems.map(item => {
                const Icon = item.icon;
                const isActive = item.id === 'driver-dashboard'
                  ? (currentTab === 'driver-dashboard' || currentTab === 'driver-console' || currentTab === 'dashboard')
                  : currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand-sky-light text-brand-navy border border-brand-sky dark:bg-brand-navy-surface dark:text-brand-sky dark:border-brand-navy-border'
                        : 'text-brand-dark dark:text-slate-300 hover:bg-brand-grey-subtle dark:hover:bg-brand-navy-subtle'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
                      <span>{item.label}</span>
                    </div>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${item.badgeClass || 'bg-amber-500 text-white'}`}>
                        {item.count} {item.badgeLabel || ''}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="p-3 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/70 text-xs space-y-2 mt-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-dark dark:text-white">Pilot Duty Status</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDriverOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                    {isDriverOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-[11px] text-brand-muted dark:text-slate-400">
                  Manage incoming customer dispatches and assigned trips in real time.
                </p>
              </div>
            </>
          ) : (
            customerNavItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand-sky-light text-brand-navy border border-brand-sky dark:bg-brand-navy-surface dark:text-brand-sky dark:border-brand-navy-border'
                      : 'text-brand-dark dark:text-slate-300 hover:bg-brand-grey-subtle dark:hover:bg-brand-navy-subtle'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-brand-navy dark:text-brand-sky" />
                    <span>{item.label}</span>
                  </div>
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-brand-navy-dark text-brand-dark dark:text-slate-300">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })
          )}

          {/* Profile on mobile */}
          <div className="pt-3 border-t border-slate-200 dark:border-brand-navy-border flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-navy dark:bg-brand-sky flex items-center justify-center text-xs font-bold text-white dark:text-brand-navy">
                {user ? (profile?.name ? profile.name.slice(0, 2).toUpperCase() : (role === 'admin' ? 'AD' : (role === 'driver' ? 'DR' : 'CU'))) : 'GU'}
              </div>
              <div>
                <span className="text-xs font-bold text-brand-dark dark:text-white block">
                  {user ? (profile?.name || (role === 'admin' ? 'Administrator' : (role === 'driver' ? 'Driver Pilot' : 'Customer'))) : 'Guest Visitor'}
                </span>
                <span className="text-[10px] text-brand-muted dark:text-slate-400">
                  {user ? (role === 'admin' ? 'Platform Administrator' : (role === 'driver' ? (isVerifiedDriver ? 'Verified Driver Pilot' : 'Driver Pilot (Pending)') : 'Personal Car Owner')) : 'Not signed in'}
                </span>
              </div>
            </div>

            {user ? (
              <button
                type="button"
                onClick={signOut}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="text-xs font-bold text-brand-navy dark:text-brand-sky hover:underline"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
