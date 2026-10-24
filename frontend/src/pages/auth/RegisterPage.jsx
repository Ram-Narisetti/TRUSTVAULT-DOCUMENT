import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Lock,
  Mail,
  User,
  AtSign,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const RegisterPage = () => {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password Strength Indicators
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not fulfill security requirements (min. 8 characters, uppercase, lowercase, number, and special symbol).');
      return;
    }

    setLoading(true);

    try {
      const user = await register({
        full_name: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
      });

      toast.success(`Account created. Welcome, ${user.full_name}`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please check your details.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] flex flex-col justify-center items-center p-4 sm:p-6 text-[#F4F4F6]">
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#E8DFD8] mb-3">
            <Lock className="w-5 h-5 text-[#E8DFD8]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#FFFFFF]">
            Create Account
          </h1>
          <p className="text-xs text-[#8E95A5] mt-1">
            Get started with secure document sharing
          </p>
        </div>

        {/* Register Card */}
        <div className="bg-[#15161A] border border-[#282A33] rounded-2xl p-6 sm:p-8 shadow-xl">
          {error && (
            <div className="flex items-center gap-2.5 p-3.5 mb-5 rounded-xl bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
                Full name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#F4F4F6] placeholder-[#8E95A5]/40 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
                />
                <User className="w-4 h-4 text-[#8E95A5] absolute left-3 top-3" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="janedoe"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#F4F4F6] placeholder-[#8E95A5]/40 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
                  />
                  <AtSign className="w-4 h-4 text-[#8E95A5] absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#F4F4F6] placeholder-[#8E95A5]/40 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
                  />
                  <Mail className="w-4 h-4 text-[#8E95A5] absolute left-3 top-3" />
                </div>
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
                  placeholder="Min. 8 characters"
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

            <div>
              <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#F4F4F6] placeholder-[#8E95A5]/40 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
                />
                <Lock className="w-4 h-4 text-[#8E95A5] absolute left-3 top-3" />
              </div>
            </div>

            {/* Checklist */}
            <div className="p-3.5 rounded-xl bg-[#101114] border border-[#282A33] space-y-1.5 text-xs">
              <p className="text-[#8E95A5] text-[11px] font-medium mb-1">Password requirements:</p>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-[#E8DFD8]' : 'text-[#8E95A5]/60'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>8+ characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-[#E8DFD8]' : 'text-[#8E95A5]/60'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Uppercase</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLower ? 'text-[#E8DFD8]' : 'text-[#8E95A5]/60'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Lowercase</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber && hasSpecial ? 'text-[#E8DFD8]' : 'text-[#8E95A5]/60'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Number & symbol</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl vault-beige-btn text-xs font-semibold shadow-md transition-all disabled:opacity-50 mt-1 cursor-pointer"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-xs text-[#8E95A5] mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-[#E8DFD8] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
