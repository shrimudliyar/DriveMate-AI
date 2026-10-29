import React, { useState } from 'react';
import { X, User, Car, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../common/BrandLogo';

/**
 * GetStartedModal — two-step authentication entry.
 *
 * Step 1: "Get started with DriveMate" – choose Sign In or Create an Account.
 * Step 2: Choose role (Customer / Driver).
 *         After selecting a role, the AuthModal opens with the correct tab.
 *         Role selection is purely a UI navigation hint; it never grants or
 *         modifies the user's actual backend role.
 *
 * Props:
 *   isOpen  – boolean, controls visibility
 *   onClose – function, called when the modal should close
 */
export default function GetStartedModal({ isOpen, onClose }) {
  const { openAuthModal } = useAuth();

  const [step, setStep] = useState('action'); // 'action' | 'role'
  const [pendingAction, setPendingAction] = useState(null); // 'signin' | 'signup'

  if (!isOpen) return null;

  const handleActionSelect = (action) => {
    setPendingAction(action);
    setStep('role');
  };

  const handleRoleSelect = (role) => {
    // Pass the role as a cosmetic hint — AuthModal uses it to filter demo cards.
    // The actual backend role is always determined by Supabase metadata.
    openAuthModal(pendingAction, null, role);
    handleClose();
  };

  const handleBack = () => {
    setStep('action');
    setPendingAction(null);
  };

  const handleClose = () => {
    setStep('action');
    setPendingAction(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-brand-navy-surface text-brand-dark dark:text-white p-7 shadow-elevated border border-slate-200 dark:border-brand-navy-border animate-in zoom-in-95 duration-200">

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-brand-dark dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-navy transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── STEP 1: Action selection ── */}
        {step === 'action' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <BrandLogo size="default" showTagline={false} />

            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-brand-navy dark:text-white">
                Get started with DriveMate
              </h1>
              <p className="text-sm text-brand-muted dark:text-slate-400 mt-1.5">
                Choose how you'd like to use our platform.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              {/* Primary: Sign In */}
              <button
                type="button"
                onClick={() => handleActionSelect('signin')}
                className="w-full py-3 rounded-full bg-brand-navy text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                Sign In
              </button>

              {/* Secondary: Create an Account */}
              <button
                type="button"
                onClick={() => handleActionSelect('signup')}
                className="w-full py-3 rounded-full border border-brand-navy/30 dark:border-brand-navy-border text-brand-navy dark:text-slate-200 font-bold text-sm hover:bg-brand-sky-light dark:hover:bg-brand-navy/40 transition-colors"
              >
                Create an Account
              </button>
            </div>

            <p className="text-xs text-brand-muted dark:text-slate-500">
              Booking a driver · Driving with DriveMate
            </p>
          </div>
        )}

        {/* ── STEP 2: Role selection ── */}
        {step === 'role' && (
          <div className="flex flex-col items-center gap-6 text-center">
            {/* Back */}
            <button
              type="button"
              onClick={handleBack}
              className="absolute top-4 left-4 p-1.5 rounded-lg text-slate-400 hover:text-brand-dark dark:hover:text-white hover:bg-slate-100 dark:hover:bg-brand-navy transition-colors flex items-center gap-1 text-xs"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-brand-navy dark:text-white">
                {pendingAction === 'signin' ? 'Sign in as…' : 'Register as…'}
              </h1>
              <p className="text-sm text-brand-muted dark:text-slate-400 mt-1.5">
                How are you using DriveMate?
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              {/* Customer */}
              <button
                type="button"
                onClick={() => handleRoleSelect('customer')}
                className="w-full py-4 rounded-2xl border border-slate-200 dark:border-brand-navy-border bg-brand-grey-subtle/60 dark:bg-brand-navy/40 hover:border-brand-navy dark:hover:border-brand-sky hover:bg-brand-sky-light/40 dark:hover:bg-brand-navy/70 transition-all flex items-center gap-4 px-5 text-left"
              >
                <span className="p-2.5 rounded-xl bg-brand-sky text-brand-navy dark:bg-brand-navy dark:text-brand-sky">
                  <User className="w-5 h-5" />
                </span>
                <span>
                  <span className="block font-bold text-sm text-brand-navy dark:text-white">Customer</span>
                  <span className="block text-xs text-brand-muted dark:text-slate-400 mt-0.5">Booking a driver</span>
                </span>
              </button>

              {/* Driver */}
              <button
                type="button"
                onClick={() => handleRoleSelect('driver')}
                className="w-full py-4 rounded-2xl border border-slate-200 dark:border-brand-navy-border bg-brand-grey-subtle/60 dark:bg-brand-navy/40 hover:border-brand-navy dark:hover:border-brand-sky hover:bg-brand-sky-light/40 dark:hover:bg-brand-navy/70 transition-all flex items-center gap-4 px-5 text-left"
              >
                <span className="p-2.5 rounded-xl bg-brand-sky text-brand-navy dark:bg-brand-navy dark:text-brand-sky">
                  <Car className="w-5 h-5" />
                </span>
                <span>
                  <span className="block font-bold text-sm text-brand-navy dark:text-white">Driver</span>
                  <span className="block text-xs text-brand-muted dark:text-slate-400 mt-0.5">Driving and accepting trips</span>
                </span>
              </button>
            </div>

            <p className="text-[11px] text-brand-muted dark:text-slate-500 leading-relaxed">
              Your account role is verified by DriveMate after sign-in.
              This selection does not grant or change any permissions.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
