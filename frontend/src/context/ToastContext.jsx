import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 5000),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-3 ${
              t.type === 'success'
                ? 'bg-[#15161A]/95 border-[#E8DFD8]/40 text-[#F4F4F6]'
                : t.type === 'error'
                ? 'bg-[#1A1214]/95 border-[#F87171]/40 text-[#F4F4F6]'
                : t.type === 'warning'
                ? 'bg-[#181611]/95 border-[#FBBF24]/40 text-[#F4F4F6]'
                : 'bg-[#15161A]/95 border-[#282A33] text-[#F4F4F6]'
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#E8DFD8]" />}
              {t.type === 'error' && <AlertCircle className="w-4 h-4 text-[#F87171]" />}
              {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-[#FBBF24]" />}
              {t.type === 'info' && <Info className="w-4 h-4 text-[#E8DFD8]" />}
            </div>
            <div className="flex-1 text-xs leading-relaxed text-[#F4F4F6] font-medium">{t.message}</div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-[#9396A1] hover:text-[#FFFFFF] p-1 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
