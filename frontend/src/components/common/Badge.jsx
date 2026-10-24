import React from 'react';

export const Badge = ({ variant = 'default', children, className = '' }) => {
  const getStyle = () => {
    switch (variant.toUpperCase()) {
      case 'ADMIN':
        return 'bg-[#E8DFD8]/15 text-[#E8DFD8] border-[#E8DFD8]/30 font-medium';
      case 'OWNER':
        return 'bg-[#1C1E23] text-[#FFFFFF] border-[#282A33] font-medium';
      case 'VIEWER':
        return 'bg-[#15161A] text-[#8E95A5] border-[#282A33]';
      case 'EDIT':
        return 'bg-[#F3E5AB]/10 text-[#F3E5AB] border-[#F3E5AB]/25 font-medium';
      case 'VIEW':
        return 'bg-[#1C1E23] text-[#8E95A5] border-[#282A33]';
      case 'SUCCESS':
      case 'ACTIVE':
        return 'bg-[#E8DFD8]/10 text-[#E8DFD8] border-[#E8DFD8]/20 font-medium';
      case 'DENIED':
      case 'FAILURE':
      case 'DEACTIVATED':
        return 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/25 font-medium';
      case 'CATEGORY':
        return 'bg-[#1C1E23] text-[#A0A5B5] border-[#282A33] text-xs font-normal';
      default:
        return 'bg-[#1C1E23] text-[#8E95A5] border-[#282A33]';
    }
  };

  const isDotStatus = ['ACTIVE', 'SUCCESS', 'DEACTIVATED', 'FAILURE', 'DENIED'].includes(variant.toUpperCase());
  const isPositive = ['ACTIVE', 'SUCCESS'].includes(variant.toUpperCase());

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border transition-colors ${getStyle()} ${className}`}
    >
      {isDotStatus && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isPositive ? 'bg-[#E8DFD8]' : 'bg-[#F87171]'
          }`}
        />
      )}
      {children}
    </span>
  );
};
