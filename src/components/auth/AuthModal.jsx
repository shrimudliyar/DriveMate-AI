import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  Car, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../common/BrandLogo';

export default function AuthModal() {
  const { 
    authModalOpen, 
    authModalTab, 
    authModalNotice,
    authModalRoleHint,
    closeAuthModal, 
    signInWithPassword, 
    signUp, 
    signInWithOAuth, 
    resetPassword, 
    signInDemoUser,
    isSupabaseConfigured 
  } = useAuth();

  const [activeTab, setActiveTab] = useState(authModalTab || 'signin');
  // chosenRole is pre-seeded from GetStartedModal's role hint (cosmetic only).
  // Backend role is always determined by Supabase metadata, never by this value.
  const [chosenRole, setChosenRole] = useState(authModalRoleHint || 'customer');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loadingDemoRole, setLoadingDemoRole] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync tab and role when the modal is opened (authModalTab / authModalRoleHint may change).
  useEffect(() => {
    if (authModalOpen) {
      setActiveTab(authModalTab || 'signin');
      setChosenRole(authModalRoleHint || 'customer');
      setError(null);
      setSuccessMsg(null);
    }
  }, [authModalOpen, authModalTab, authModalRoleHint]);

  const effectiveRole = authModalRoleHint || chosenRole || 'customer';

  if (!authModalOpen) return null;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (activeTab === 'signin') {
        await signInWithPassword({ email, password });
      } else if (activeTab === 'signup') {
        if (!fullName.trim()) throw new Error('Please enter your full name');
        const signUpData = await signUp({
          email,
          password,
          fullName,
          phone,
          chosenRole: effectiveRole,
        });
        if (signUpData?.session) {
          // mailer_autoconfirm is ON — user is signed in immediately, modal closed by signUp()
          // No need to set a message; the dashboard will render
        } else {
          // Email confirmation required — modal stays open, show friendly pending message
          setSuccessMsg(
            effectiveRole === 'driver'
              ? '✅ Application submitted! Check your email to confirm your address, then sign in to track your verification status.'
              : '✅ Account created! Check your email to confirm your address, then sign in to start booking drivers.'
          );
        }
      } else if (activeTab === 'forgot') {
        if (!email.trim()) throw new Error('Please enter your registered email address');
        await resetPassword(email);
        setSuccessMsg('Password recovery link has been dispatched to your email.');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          'Google OAuth requires configured Supabase credentials. Configure Google in the Supabase Dashboard -> Authentication -> Providers.'
        );
      }
      await signInWithOAuth('google');
    } catch (err) {
      setError(err.message || 'Google sign-in could not be initiated.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (role) => {
    setError(null);
    setLoadingDemoRole(role);
    try {
      await signInDemoUser(role);
    } catch (err) {
      setError(err.message || 'Demo sign-in failed.');
    } finally {
      setLoadingDemoRole(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-brand-navy-surface p-6 sm:p-7 border border-slate-200 dark:border-brand-navy-border shadow-elevated overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-brand-dark dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-navy transition-colors cursor-pointer"
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand header — clear title and role subtitle */}
        <div className="flex flex-col items-center text-center mb-5">
          <BrandLogo size="default" showTagline={false} />
          <h2 className="text-lg font-extrabold text-brand-navy dark:text-white mt-2">
            {activeTab === 'signin' && (
              authModalRoleHint === 'driver' ? 'Driver Sign In' :
              authModalRoleHint === 'customer' ? 'Customer Sign In' :
              'Sign In to DriveMate'
            )}
            {activeTab === 'signup' && (effectiveRole === 'driver' ? 'Driver Pilot Registration' : 'Create Customer Account')}
            {activeTab === 'forgot' && 'Reset Password'}
          </h2>
          <p className="text-xs text-brand-muted dark:text-slate-400 mt-1">
            {activeTab === 'signin' && (
              authModalRoleHint === 'driver'
                ? 'Sign in to accept trip dispatches and manage earnings'
                : authModalRoleHint === 'customer'
                ? 'Sign in to schedule drivers and manage your trips'
                : 'Sign in to access your Customer, Driver, or Admin portal'
            )}
            {activeTab === 'signup' && (effectiveRole === 'driver'
              ? 'Register as a certified professional driver pilot'
              : 'Sign up to schedule verified drivers for your personal car')}
            {activeTab === 'forgot' && 'Enter your email address to receive a password reset link'}
          </p>
        </div>

        {/* Security / Permission notice banner if triggered by role guard */}
        {authModalNotice && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2 animate-in fade-in">
            <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <span className="font-bold block">Access Restricted</span>
              <span>{authModalNotice}</span>
            </div>
          </div>
        )}

        {/* Error / Success feedback */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Sign Up: Driver Verification Requirement Notice */}
          {activeTab === 'signup' && effectiveRole === 'driver' && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>Driver accounts undergo background &amp; license verification before rides can be accepted.</span>
            </div>
          )}

          {/* Sign Up Fallback: Only shown if no role hint was selected in GetStartedModal */}
          {activeTab === 'signup' && !authModalRoleHint && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300">
                I am registering as:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChosenRole('customer')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    chosenRole === 'customer'
                      ? 'bg-brand-sky-light text-brand-navy border-brand-navy dark:bg-brand-navy dark:text-brand-sky dark:border-brand-sky'
                      : 'bg-white dark:bg-brand-navy-dark border-slate-200 dark:border-brand-navy-border text-brand-muted'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Car Owner</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChosenRole('driver')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    chosenRole === 'driver'
                      ? 'bg-brand-sky-light text-brand-navy border-brand-navy dark:bg-brand-navy dark:text-brand-sky dark:border-brand-sky'
                      : 'bg-white dark:bg-brand-navy-dark border-slate-200 dark:border-brand-navy-border text-brand-muted'
                  }`}
                >
                  <Car className="w-4 h-4" />
                  <span>Pilot Driver</span>
                </button>
              </div>
            </div>
          )}

          {/* Sign Up Specific: Full Name */}
          {activeTab === 'signup' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-navy dark:text-brand-sky">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl dm-input"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-navy dark:text-brand-sky">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl dm-input"
              />
            </div>
          </div>

          {/* Sign Up Specific: Phone */}
          {activeTab === 'signup' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-navy dark:text-brand-sky">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl dm-input"
                />
              </div>
            </div>
          )}

          {/* Password Field (for signin & signup) */}
          {activeTab !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300">
                  Password
                </label>
                {activeTab === 'signin' && (
                  <button
                    type="button"
                    onClick={() => handleTabChange('forgot')}
                    className="text-[11px] text-brand-navy dark:text-brand-sky hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-navy dark:text-brand-sky">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl dm-input"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>
                  {activeTab === 'signin' && (effectiveRole === 'driver' ? 'Sign In as Driver' : 'Sign In as Customer')}
                  {activeTab === 'signup' && (effectiveRole === 'driver' ? 'Apply as Driver Pilot' : 'Create Customer Account')}
                  {activeTab === 'forgot' && 'Send Password Reset Link'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Forgot Password back button */}
        {activeTab === 'forgot' && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => handleTabChange('signin')}
              className="text-xs text-brand-navy dark:text-brand-sky hover:underline cursor-pointer"
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* Sign In Only: Google OAuth & Role-Filtered Demo */}
        {activeTab === 'signin' && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-brand-navy-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-brand-muted dark:text-slate-400">
                <span className="bg-white dark:bg-brand-navy-surface px-2">Or continue with</span>
              </div>
            </div>

            {/* Google OAuth (Gracefully disabled until OAuth provider credentials are configured) */}
            <button
              type="button"
              disabled
              title="Google authentication is coming soon. Please use email & password or demo credentials."
              className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-brand-navy-border/60 text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-50/60 dark:bg-brand-navy/30 flex items-center justify-center gap-2 transition-all cursor-not-allowed opacity-80"
            >
              <svg className="w-4 h-4 grayscale opacity-60" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-brand-navy text-slate-500 dark:text-slate-400">
                Coming Soon
              </span>
            </button>
          </>
        )}

        {/* Footer switch links (clean, unobtrusive alternative to tabs) */}
        {activeTab === 'signin' && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-brand-navy-border/50 text-center text-xs text-brand-muted dark:text-slate-400">
            <span>Need an account? </span>
            <button
              type="button"
              onClick={() => handleTabChange('signup')}
              className="font-bold text-brand-navy dark:text-brand-sky hover:underline cursor-pointer"
            >
              Create an account
            </button>
          </div>
        )}

        {activeTab === 'signup' && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-brand-navy-border/50 text-center text-xs text-brand-muted dark:text-slate-400">
            <span>Already have an account? </span>
            <button
              type="button"
              onClick={() => handleTabChange('signin')}
              className="font-bold text-brand-navy dark:text-brand-sky hover:underline cursor-pointer"
            >
              Sign in
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
