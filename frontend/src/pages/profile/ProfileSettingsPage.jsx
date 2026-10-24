import React, { useState, useRef } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Camera,
  Trash2,
  Upload,
  User,
  Check,
} from 'lucide-react';
import api from '../../api/client';
import { Badge } from '../../components/common/Badge';
import { UserAvatar } from '../../components/common/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatISTDate } from '../../utils/date';

// Clean curated preset avatars (data URIs with humanized SVGs)
const PRESET_AVATARS = [
  {
    name: 'Vault Obsidian',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="%2315161A"/><circle cx="40" cy="30" r="14" fill="%23E8DFD8"/><path d="M20 66c0-11 9-20 20-20s20 9 20 20" fill="%23282A33"/></svg>',
  },
  {
    name: 'Slate Minimal',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="%231C1E23"/><circle cx="40" cy="30" r="14" fill="%23A0A5B5"/><path d="M22 66c0-10 8-18 18-18s18 8 18 18" fill="%23E8DFD8"/></svg>',
  },
  {
    name: 'Beige Classic',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="%23E8DFD8"/><circle cx="40" cy="30" r="14" fill="%230A0B0D"/><path d="M20 66c0-11 9-20 20-20s20 9 20 20" fill="%2315161A"/></svg>',
  },
  {
    name: 'Executive Grey',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="%23101114"/><circle cx="40" cy="30" r="14" fill="%23E8DFD8"/><path d="M24 66c0-9 7-16 16-16s16 7 16 16" fill="%233A3D4A"/></svg>',
  },
];

export const ProfileSettingsPage = () => {
  const { user, logout, updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Password checks
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  // Handle custom image file upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image file size must be less than 2 MB.');
      return;
    }

    setAvatarUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.user) {
        updateUser(res.data.user);
        toast.success('Profile photo updated.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload photo.');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle preset avatar selection
  const handleSelectPreset = async (presetUrl) => {
    setAvatarUploading(true);
    try {
      const res = await api.post('/auth/avatar', { avatar: presetUrl });
      if (res.data?.user) {
        updateUser(res.data.user);
        toast.success('Profile avatar updated.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to set avatar.');
    } finally {
      setAvatarUploading(false);
    }
  };

  // Handle remove avatar
  const handleRemoveAvatar = async () => {
    setAvatarUploading(true);
    try {
      const res = await api.delete('/auth/avatar');
      if (res.data?.user) {
        updateUser(res.data.user);
        toast.success('Profile photo removed.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  // Handle full name update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Full name cannot be empty.');
      return;
    }
    setProfileLoading(true);
    try {
      const res = await api.put('/auth/profile', { full_name: fullName.trim() });
      if (res.data?.user) {
        updateUser(res.data.user);
        toast.success('Profile updated.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (!isPasswordValid) {
      setPasswordError('Password does not meet complexity requirements.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await api.put('/auth/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success(res.data.message || 'Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update password.';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-[#15161A] border border-[#282A33]">
        <h2 className="text-xl font-semibold text-[#FFFFFF] tracking-tight">Account Settings</h2>
        <p className="text-sm text-[#8E95A5] mt-1 leading-relaxed">
          Manage your profile image, personal info, and password.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card & Avatar Management */}
        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-4">
          <div className="flex flex-col items-center text-center p-5 rounded-xl bg-[#101114] border border-[#282A33]">
            {/* User Avatar with Upload Trigger */}
            <div className="relative group mb-3">
              <UserAvatar user={user} size="xl" className="ring-2 ring-[#282A33]" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-[#E8DFD8] text-[#0A0B0D] hover:bg-[#FFFFFF] shadow-md transition-transform hover:scale-105"
                title="Upload profile picture"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <h3 className="text-sm font-semibold text-[#FFFFFF]">{user?.full_name}</h3>
            <p className="text-xs text-[#8E95A5] mt-0.5">@{user?.username}</p>
            <div className="mt-2.5">
              <Badge variant={user?.role}>{user?.role?.toUpperCase()}</Badge>
            </div>

            {/* Photo Actions */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#282A33] w-full justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] text-[11px] font-medium text-[#E8DFD8] transition-all"
              >
                <Upload className="w-3 h-3" />
                <span>{avatarUploading ? 'Uploading...' : 'Upload'}</span>
              </button>

              {user?.avatar_url && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  className="p-1.5 rounded-xl bg-[#1C1E23] hover:bg-[#F87171]/15 border border-[#282A33] text-[11px] font-medium text-[#8E95A5] hover:text-[#F87171] transition-all"
                  title="Remove photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Preset Avatars */}
            <div className="w-full mt-3 pt-3 border-t border-[#282A33]/50">
              <p className="text-[11px] text-[#8E95A5] mb-2 font-medium">Or choose a preset:</p>
              <div className="flex items-center justify-center gap-2">
                {PRESET_AVATARS.map((preset, idx) => {
                  const isSelected = user?.avatar_url === preset.url;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(preset.url)}
                      disabled={avatarUploading}
                      title={preset.name}
                      className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition-all hover:scale-105 ${
                        isSelected ? 'border-[#E8DFD8] ring-2 ring-[#E8DFD8]/30' : 'border-[#282A33] hover:border-[#8E95A5]'
                      }`}
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#0A0B0D]/40 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-[#E8DFD8]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-[#1C1E23] border border-[#282A33]">
              <span className="text-[#8E95A5] block">Email</span>
              <span className="text-[#FFFFFF] mt-0.5 block truncate font-medium">{user?.email}</span>
            </div>

            <div className="p-3 rounded-xl bg-[#1C1E23] border border-[#282A33]">
              <span className="text-[#8E95A5] block">Status</span>
              <span className="text-[#E8DFD8] mt-0.5 block font-medium">Active</span>
            </div>

            <div className="p-3 rounded-xl bg-[#1C1E23] border border-[#282A33]">
              <span className="text-[#8E95A5] block">Joined</span>
              <span className="text-[#FFFFFF] mt-0.5 block font-medium">
                {formatISTDate(user?.created_at)}
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1C1E23] hover:bg-[#F87171]/15 text-[#F87171] border border-[#282A33] hover:border-[#F87171]/30 text-xs font-medium flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>

        {/* Profile Info & Password Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Details Form */}
          <div className="p-6 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-4">
            <h3 className="text-base font-semibold text-[#FFFFFF]">Personal Information</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/40 text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
                  />
                  <User className="w-4 h-4 text-[#8E95A5] absolute left-3 top-3" />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={profileLoading || fullName.trim() === user?.full_name}
                  className="vault-beige-btn px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {profileLoading ? 'Saving...' : 'Update name'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="p-6 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-5">
            <h3 className="text-base font-semibold text-[#FFFFFF]">Change Password</h3>

            {passwordError && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/40 text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
                  />
                  <Lock className="w-4 h-4 text-[#8E95A5] absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-3 text-[#8E95A5] hover:text-[#FFFFFF]"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/40 text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
                    />
                    <Lock className="w-4 h-4 text-[#8E95A5] absolute left-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-3 text-[#8E95A5] hover:text-[#FFFFFF]"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/40 text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
                    />
                    <Lock className="w-4 h-4 text-[#8E95A5] absolute left-3 top-3" />
                  </div>
                </div>
              </div>

              {/* Checklist */}
              <div className="p-3.5 rounded-xl bg-[#101114] border border-[#282A33] space-y-1.5 text-xs">
                <p className="text-[#8E95A5] text-[11px] font-medium mb-1">Password requirements:</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-[#E8DFD8]' : 'text-[#8E95A5]/60'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>8+ characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasUpper ? 'text-[#E8DFD8]' : 'text-[#8E95A5]/60'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Uppercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasLower ? 'text-[#E8DFD8]' : 'text-[#8E95A5]/60'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Lowercase letter</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${hasNumber && hasSpecial ? 'text-[#E8DFD8]' : 'text-[#8E95A5]/60'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Number & symbol</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={passwordLoading || !currentPassword || !isPasswordValid}
                  className="vault-beige-btn px-5 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {passwordLoading ? 'Saving...' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
