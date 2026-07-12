"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  confirm: (message: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

// ─── Confirm Modal ───

interface ConfirmModalState {
  message: string;
  resolve: (value: boolean) => void;
}

function ConfirmModal({ state, onClose }: { state: ConfirmModalState; onClose: () => void }) {
  const [animatingOut, setAnimatingOut] = useState(false);

  const handleClose = (result: boolean) => {
    setAnimatingOut(true);
    setTimeout(() => {
      state.resolve(result);
      onClose();
    }, 200);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      style={{ animation: animatingOut ? "fadeOut 0.2s ease-out forwards" : "fadeIn 0.15s ease-out" }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        style={{
          animation: animatingOut
            ? "scaleOut 0.2s ease-out forwards"
            : "scaleIn 0.2s ease-out",
        }}
      >
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/20">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Confirmar acción</h3>
        </div>

        <p className="mb-6 mt-3 text-sm leading-relaxed text-slate-300">
          {state.message}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleClose(false)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => handleClose(true)}
            className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-500"
          >
            Confirmar
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes scaleOut {
          from { transform: scale(1); opacity: 1; }
          to { transform: scale(0.95); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmModalState | null>(null);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const iconMap: Record<ToastType, ReactNode> = {
    success: <CheckCircle2 className="h-5 w-5 text-green-400" />,
    error: <XCircle className="h-5 w-5 text-red-400" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
  };

  const borderMap: Record<ToastType, string> = {
    success: "border-green-500/30",
    error: "border-red-500/30",
    warning: "border-yellow-500/30",
  };

  return (
    <ToastContext.Provider value={{ toast: addToast, confirm }}>
      {children}

      {/* Custom Confirm Modal */}
      {confirmState && (
        <ConfirmModal
          state={confirmState}
          onClose={() => setConfirmState(null)}
        />
      )}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-lg border ${borderMap[t.type]} bg-slate-900 px-4 py-3 shadow-xl animate-in slide-in-from-right`}
            style={{ animation: "slideIn 0.3s ease-out" }}
          >
            {iconMap[t.type]}
            <span className="text-sm text-white">{t.message}</span>
            <button type="button" onClick={() => removeToast(t.id)} className="ml-2 text-slate-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
