import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const LoginPage = () => {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await login(email.trim(), password);
      toast.success(`Welcome back, ${user.full_name}`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid email or password.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] flex flex-col justify-center items-center p-4 sm:p-6 text-[#F4F4F6]">
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#E8DFD8] mb-3">
            <Lock className="w-5 h-5 text-[#E8DFD8]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#FFFFFF]">
            TrustVault
          </h1>
          <p className="text-xs text-[#8E95A5] mt-1">
            Sign in to access your secure documents
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#15161A] border border-[#282A33] rounded-2xl p-6 sm:p-8 shadow-xl">
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 mb-5 rounded-xl bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
                Email address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#F4F4F6] placeholder-[#8E95A5]/40 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
                />
                <Mail className="w-4 h-4 text-[#8E95A5] absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#F4F4F6] placeholder-[#8E95A5]/40 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
                />
                <Lock className="w-4 h-4 text-[#8E95A5] absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#8E95A5] hover:text-[#FFFFFF]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl vault-beige-btn text-xs font-semibold shadow-md transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-6 pt-5 border-t border-[#282A33]">
            <p className="text-[11px] text-[#8E95A5] text-center mb-2.5">
              Click to fill demo account credentials:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount('admin@trustvault.local', 'AdminVault2026!')}
                className="py-1.5 px-2 rounded-xl bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] text-[11px] font-medium text-[#FFFFFF] transition-all hover:border-[#E8DFD8]/40 text-center"
                title="Fill Admin credentials (AdminVault2026!)"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('owner@trustvault.local', 'OwnerVault2026!')}
                className="py-1.5 px-2 rounded-xl bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] text-[11px] font-medium text-[#FFFFFF] transition-all hover:border-[#E8DFD8]/40 text-center"
                title="Fill Owner credentials (OwnerVault2026!)"
              >
                Owner
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('viewer@trustvault.local', 'ViewerVault2026!')}
                className="py-1.5 px-2 rounded-xl bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] text-[11px] font-medium text-[#FFFFFF] transition-all hover:border-[#E8DFD8]/40 text-center"
                title="Fill Viewer credentials (ViewerVault2026!)"
              >
                Viewer
              </button>
            </div>
            <p className="text-[10px] text-[#8E95A5]/60 text-center mt-2 font-mono">
              Demo passwords: RoleNameVault2026! (e.g. AdminVault2026!)
            </p>
          </div>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-[#8E95A5] mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#E8DFD8] hover:underline font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
