import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../common/BrandLogo';

export default function ResetPasswordModal() {
  const { user, updatePassword, cancelPasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters in length.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      await updatePassword(newPassword);
      setSuccess(true);
    } catch (err) {
      console.error('Password reset failed:', err);
      setError(err.message || 'Failed to update password. Your reset link may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-brand-navy-dark border border-slate-200 dark:border-brand-navy-border rounded-2xl shadow-elevated p-6 sm:p-8 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <BrandLogo size="default" showTagline={false} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-sky-light dark:bg-brand-navy border border-brand-sky/60 dark:border-brand-sky/30 text-[11px] font-bold text-brand-navy dark:text-brand-sky">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Secure Password Recovery</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-brand-navy dark:text-white">
            Set New Password
          </h2>
          <p className="text-xs text-brand-muted dark:text-slate-400">
            {user?.email ? (
              <>Updating credentials for <strong className="text-brand-dark dark:text-white">{user.email}</strong></>
            ) : (
              'Enter and confirm your new account password.'
            )}
          </p>
        </div>

        {/* Success Message */}
        {success ? (
          <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-center space-y-4 animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                Password Successfully Updated
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                Your credentials have been refreshed in Supabase Auth. You can now access your account.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelPasswordRecovery}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to DriveMate AI</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 mb-1">
                New Password (minimum 6 characters)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-navy dark:text-brand-sky">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl dm-input bg-slate-50 dark:bg-brand-navy border border-slate-300 dark:border-brand-navy-border text-brand-dark dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-dark dark:text-slate-300 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-brand-navy dark:text-brand-sky">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl dm-input bg-slate-50 dark:bg-brand-navy border border-slate-300 dark:border-brand-navy-border text-brand-dark dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-muted hover:text-brand-dark dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white dark:border-brand-navy border-t-transparent rounded-full animate-spin"></div>
                  <span>Updating Password in Supabase...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Update Password &amp; Continue</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

