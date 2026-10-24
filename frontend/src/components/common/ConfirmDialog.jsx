import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this action? This operation cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  loading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex items-start gap-4 mb-6">
        <div
          className={`p-3 rounded-xl flex-shrink-0 ${
            isDestructive
              ? 'bg-[#F87171]/10 text-[#F87171] border border-[#F87171]/20'
              : 'bg-[#E8DFD8]/10 text-[#E8DFD8] border border-[#E8DFD8]/20'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-[#9396A1] leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-[#282A33]">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-xs font-medium rounded-xl text-[#9396A1] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            isDestructive
              ? 'bg-[#F87171] text-black hover:bg-[#ef4444] shadow-md shadow-[#F87171]/20'
              : 'vault-beige-btn'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? 'Processing...' : confirmText}
        </button>
      </div>
    </Modal>
  );
};
