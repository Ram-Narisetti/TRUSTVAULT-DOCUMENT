import React from 'react';
import { FolderLock } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = FolderLock,
  title = 'No documents found',
  description = 'No records match your current criteria.',
  action = null,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-[#282A33] rounded-2xl bg-[#101114]/50 my-6 transition-all">
      <div className="w-14 h-14 rounded-2xl bg-[#1C1E23] border border-[#282A33] flex items-center justify-center text-[#E8DFD8] mb-4 vault-glow">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-semibold text-[#FFFFFF] mb-1">{title}</h3>
      <p className="text-xs text-[#9396A1] max-w-sm mb-6 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};
