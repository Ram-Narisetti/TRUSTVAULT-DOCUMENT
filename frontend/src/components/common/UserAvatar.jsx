import React, { useState } from 'react';

export const UserAvatar = ({ user, size = 'md', className = '' }) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base font-semibold',
    xl: 'w-20 h-20 text-xl font-bold',
  };

  const initial = user?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';
  const hasAvatar = user?.avatar_url && !imgError;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full flex-shrink-0 overflow-hidden select-none bg-[#1C1E23] border border-[#282A33] text-[#E8DFD8] ${
        sizeClasses[size] || sizeClasses.md
      } ${className}`}
    >
      {hasAvatar ? (
        <img
          src={user.avatar_url}
          alt={user.full_name || 'Profile'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <span className="font-medium tracking-tight">{initial}</span>
      )}
    </div>
  );
};
