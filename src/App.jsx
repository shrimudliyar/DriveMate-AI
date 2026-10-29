import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { BookingProvider, useBookings } from './context/BookingContext';
import AuthModal from './components/auth/AuthModal';
import { useAuth } from './context/AuthContext';

import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import VoiceAssistantCard from './components/voice/VoiceAssistantCard';
import BookingForm from './components/booking/BookingForm';
import BookingsList from './components/trips/BookingsList';
import SafetySection from './components/safety/SafetySection';
import PricingView from './components/pricing/PricingView';
import BookingStatusScreen from './components/booking/BookingStatusScreen';
import DriverPortal from './components/driver/DriverPortal';

import PublicHome from './components/pages/PublicHome';
import { Car, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';

function MainAppShell() {
  const { 
    bookings, 
    activeRole, 
    userProfile, 
    cancelBooking, 
    notification 
  } = useBookings();

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [activeMatchingBooking, setActiveMatchingBooking] = useState(null);
  const [prefilledBookingValues, setPrefilledBookingValues] = useState(null);

  // Triggered when clicking a suggested voice prompt
  const handleSelectExamplePrompt = (prompt) => {
    setPrefilledBookingValues({
      pickup: prompt.pickup,
      destination: prompt.destination,
      duration: prompt.duration,
      time: prompt.time,
      date: new Date().toISOString().split('T')[0],
    });

    if (currentTab !== 'dashboard') {
      setCurrentTab('dashboard');
    }

    const formElement = document.getElementById('manual-booking-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Called when customer submits booking form
  const handleBookingSuccess = (newBooking) => {
    setActiveMatchingBooking(newBooking);
    setCurrentTab('dashboard');
  };

  const handleBookWithDuration = (duration) => {
    setPrefilledBookingValues(prev => ({
      ...prev,
      duration,
    }));
    setCurrentTab('dashboard');
    const formElement = document.getElementById('manual-booking-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const activeCustomerTripsCount = bookings.filter(
    b => b.status === 'pending' || b.status === 'accepted' || b.status === 'in_progress'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-brand-grey dark:bg-brand-navy-dark text-brand-dark dark:text-white transition-colors duration-200">
      {/* Dynamic Toast / Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold shadow-elevated ${
            notification.type === 'danger'
              ? 'bg-rose-600 text-white border-rose-700'
              : notification.type === 'warning'
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-brand-navy dark:bg-brand-navy-surface border-brand-sky/40 text-white dark:text-brand-sky'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-sky" />
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Mobile top bar with integrated role switcher */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        bookingsCount={activeCustomerTripsCount}
      />

      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar Navigation */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          bookingsCount={activeCustomerTripsCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 max-w-6xl mx-auto space-y-8">
          
          {/* ======================================================== */}
          {/* WORKSPACE MODE 1: DRIVER PORTAL                          */}
          {/* ======================================================== */}
          {activeRole === 'driver' ? (
            <DriverPortal />
          ) : (
            /* ======================================================== */
            /* WORKSPACE MODE 2: CUSTOMER PORTAL                        */
            /* ======================================================== */
            <>
              {/* TAB 1: DASHBOARD / BOOKING */}
              {currentTab === 'dashboard' && (
                activeMatchingBooking ? (
                  <section className="dm-card p-6 sm:p-8">
                    <BookingStatusScreen
                      booking={activeMatchingBooking}
                      onDismiss={() => setActiveMatchingBooking(null)}
                      onRetry={(retryValues) => {
                        setPrefilledBookingValues(retryValues);
                        setActiveMatchingBooking(null);
                        setCurrentTab('dashboard');
                      }}
                      onViewTrips={() => {
                        setActiveMatchingBooking(null);
                        setCurrentTab('trips');
                      }}
                    />
                  </section>
                ) : (
                  <>
                    {/* Prominent Welcome Section */}
                    <section className="dm-card p-6 sm:p-8 relative overflow-hidden">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-sky text-brand-navy text-xs font-bold uppercase tracking-wider mb-2">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>DriveMate AI Concierge</span>
                          </div>
                          <h1 className="text-2xl sm:text-4xl font-extrabold text-brand-navy dark:text-white tracking-tight">
                            {userProfile?.name ? (
                              <>Welcome back, {userProfile.name.split(' ')[0]} 👋</>
                            ) : (
                              <>Hire a Verified Chauffeur for Your Car 🚗</>
                            )}
                          </h1>
                          <p className="text-sm text-brand-muted dark:text-slate-300 mt-1 max-w-xl">
                            {userProfile?.name ? (
                              <>Hire a vetted professional driver to drive your personal car. Speak your destination or customize your schedule below.</>
                            ) : (
                              <>On-demand professional, background-verified drivers in Bengaluru. Speak your destination or schedule your personal chauffeur below.</>
                            )}
                          </p>
                        </div>

                        {/* Customer Quick Stats Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
                          <div className="p-3.5 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/70 border border-slate-200 dark:border-brand-navy-border text-center">
                            <span className="text-[11px] font-bold text-brand-muted dark:text-slate-400 block">Active / Pending</span>
                            <span className="text-lg font-extrabold text-brand-navy dark:text-brand-sky">{activeCustomerTripsCount} Rides</span>
                          </div>

                          <div className="p-3.5 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/70 border border-slate-200 dark:border-brand-navy-border text-center">
                            <span className="text-[11px] font-bold text-brand-muted dark:text-slate-400 block">{userProfile ? 'Trips Done' : 'Safety Vetting'}</span>
                            <span className="text-lg font-extrabold text-brand-dark dark:text-white">{userProfile ? (userProfile.totalTrips || 0) : '100%'}</span>
                          </div>

                          <div className="p-3.5 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/70 border border-slate-200 dark:border-brand-navy-border text-center col-span-2 sm:col-span-1">
                            <span className="text-[11px] font-bold text-brand-muted dark:text-slate-400 block">{userProfile ? 'Rating' : 'Pilot Rating'}</span>
                            <span className="text-lg font-extrabold text-amber-500 flex items-center justify-center gap-1">
                              ★ {userProfile?.rating || '4.96'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Central AI Voice Assistant Card */}
                    <section aria-labelledby="voice-assistant-heading">
                      <VoiceAssistantCard
                        onSelectExamplePrompt={handleSelectExamplePrompt}
                        onBookingCreated={(newBooking) => {
                          setActiveMatchingBooking(newBooking);
                          setCurrentTab('dashboard');
                        }}
                      />
                    </section>

                    {/* Manual Driver Booking Section */}
                    <section
                      id="manual-booking-form"
                      className="dm-card p-6 sm:p-8"
                    >
                      <div className="mb-6">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-sky-light dark:bg-brand-navy border border-brand-sky dark:border-brand-navy-border text-brand-navy dark:text-brand-sky text-xs font-bold mb-2">
                          <Car className="w-3.5 h-3.5" />
                          <span>Personal Vehicle Driver Dispatch</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-brand-navy dark:text-white tracking-tight">
                          Schedule Your Personal Driver
                        </h2>
                        <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-400 mt-1">
                          Enter your pickup, route details, and required duration. Your ride will be broadcast to our verified chauffeur pilots immediately.
                        </p>
                      </div>

                      <BookingForm
                        initialValues={prefilledBookingValues}
                        onBookingSuccess={handleBookingSuccess}
                        savedVehicles={userProfile?.savedVehicles || []}
                      />
                    </section>

                    {/* Upcoming / Recent Bookings preview on dashboard */}
                    <section>
                      <BookingsList
                        bookings={bookings}
                        onCancelBooking={cancelBooking}
                        onTrackBooking={(b) => {
                          setActiveMatchingBooking(b);
                          setCurrentTab('dashboard');
                        }}
                        onSwitchToBook={() => {
                          const formElement = document.getElementById('manual-booking-form');
                          if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
                        }}
                      />
                    </section>

                    {/* Safety & Trust Section */}
                    <SafetySection />
                  </>
                )
              )}

              {/* TAB 2: MY TRIPS / BOOKINGS */}
              {currentTab === 'trips' && (
                <div className="space-y-6">
                  <BookingsList
                    bookings={bookings}
                    onCancelBooking={cancelBooking}
                    onTrackBooking={(b) => {
                      setActiveMatchingBooking(b);
                      setCurrentTab('dashboard');
                    }}
                    onSwitchToBook={() => setCurrentTab('dashboard')}
                  />
                </div>
              )}

              {/* TAB 3: SAFETY & STANDARDS */}
              {currentTab === 'safety' && (
                <div className="space-y-6">
                  <SafetySection />
                </div>
              )}

              {/* TAB 4: PRICING & FARE CALCULATOR */}
              {currentTab === 'pricing' && (
                <div className="space-y-6">
                  <PricingView onBookWithDuration={handleBookWithDuration} />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

// App component now only sets up providers
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

// Separate component that consumes Auth context
function AppContent() {
  const { user } = useAuth();
  return (
    <BookingProvider>
      <AuthModal />
      {user ? <MainAppShell /> : <PublicHome />}
    </BookingProvider>
  );
}
