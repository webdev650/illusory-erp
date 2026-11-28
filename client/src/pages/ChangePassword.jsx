import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, ShieldAlert, CheckCircle2, ArrowLeft, Eye, EyeOff, Check } from 'lucide-react';

export const ChangePassword = () => {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Real-time criteria checks
  const criteria = {
    length: newPassword.length >= 10,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    symbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword),
    notCurrent: currentPassword.length > 0 && newPassword !== currentPassword,
    match: newPassword.length > 0 && newPassword === confirmPassword,
  };

  // Password strength calculation
  const getStrength = () => {
    let score = 0;
    if (criteria.length) score += 20;
    if (criteria.upper) score += 20;
    if (criteria.lower) score += 20;
    if (criteria.number) score += 20;
    if (criteria.symbol) score += 20;
    if (score <= 40) return { label: 'Weak', percent: score, color: 'bg-red-500', text: 'text-red-500' };
    if (score <= 80) return { label: 'Moderate', percent: score, color: 'bg-amber-500', text: 'text-amber-500' };
    return { label: 'Strong', percent: score, color: 'bg-emerald-500', text: 'text-emerald-500' };
  };

  const strength = getStrength();

  const handleBackToLogin = () => {
    try {
      if (logout) logout();
    } catch {
      // Ignore
    }
    navigate('/login', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!criteria.length) {
      setError('New password must be at least 10 characters long');
      return;
    }
    if (!criteria.upper) {
      setError('New password must contain at least one uppercase letter (A-Z)');
      return;
    }
    if (!criteria.lower) {
      setError('New password must contain at least one lowercase letter (a-z)');
      return;
    }
    if (!criteria.number) {
      setError('New password must contain at least one number (0-9)');
      return;
    }
    if (!criteria.symbol) {
      setError('New password must contain at least one special symbol (!@#$%^&*...)');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password cannot be the same as your temporary password');
      return;
    }
    if (user?.email && (newPassword.toLowerCase() === user.email.toLowerCase() || newPassword.toLowerCase() === user.email.split('@')[0].toLowerCase())) {
      setError('New password cannot contain your official email');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 px-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700">
        {/* Top Back to Login navigation with arrow icon */}
        <button
          type="button"
          onClick={handleBackToLogin}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-colors mb-5 group"
          title="Back to login"
        >
          <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center group-hover:bg-brand-50 group-hover:text-brand-600 dark:group-hover:bg-slate-700 transition-colors shadow-2xs">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          </span>
          <span>Back to Login</span>
        </button>

        <div className="w-12 h-12 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {user?.mustChangePassword ? 'Mandatory Password Setup' : 'Change Password'}
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-6 leading-relaxed">
          {user?.mustChangePassword
            ? 'For security compliance, you must set a new permanent password on your first sign-in.'
            : 'Update your account login password.'}
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Password updated successfully! Redirecting to dashboard...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Current Temporary Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password (e.g. ChangeMe@123)"
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                tabIndex="-1"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Password (min 10 characters)
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new strong password"
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                tabIndex="-1"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength / criteria helper chips */}
            {newPassword.length > 0 && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px] uppercase tracking-wider">
                    Password Strength:
                  </span>
                  <span className={`text-[11px] font-bold ${strength.text}`}>
                    {strength.label} ({strength.percent}%)
                  </span>
                </div>
                {/* Visual strength bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${strength.percent}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-1 text-[11px] pt-1">
                  <span className={`flex items-center gap-1 ${criteria.length ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className={`w-3.5 h-3.5 ${criteria.length ? 'opacity-100' : 'opacity-30'}`} />
                    Min 10 characters
                  </span>
                  <span className={`flex items-center gap-1 ${criteria.upper ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className={`w-3.5 h-3.5 ${criteria.upper ? 'opacity-100' : 'opacity-30'}`} />
                    1 uppercase (A-Z)
                  </span>
                  <span className={`flex items-center gap-1 ${criteria.lower ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className={`w-3.5 h-3.5 ${criteria.lower ? 'opacity-100' : 'opacity-30'}`} />
                    1 lowercase (a-z)
                  </span>
                  <span className={`flex items-center gap-1 ${criteria.number ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400'}`}>
                    <Check className={`w-3.5 h-3.5 ${criteria.number ? 'opacity-100' : 'opacity-30'}`} />
                    1 number (0-9)
                  </span>
                  <span className={`flex items-center gap-1 ${criteria.symbol ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400'} col-span-2`}>
                    <Check className={`w-3.5 h-3.5 ${criteria.symbol ? 'opacity-100' : 'opacity-30'}`} />
                    1 special symbol (!@#$%^&*...)
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                tabIndex="-1"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !criteria.match && (
              <p className="text-[11px] text-red-500 mt-1">Passwords do not match yet</p>
            )}
            {criteria.match && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Passwords match
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full mt-4 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-sm hover:shadow"
          >
            {loading ? 'Updating Password...' : 'Save & Continue'}
          </button>

          {/* Bottom Back to Login link with arrow */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Login</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

