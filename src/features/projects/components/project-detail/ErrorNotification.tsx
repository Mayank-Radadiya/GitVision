"use client";

import { memo } from "react";

interface ErrorNotificationProps {
  message: string | null;
  onDismiss: () => void;
}

const ErrorNotification = ({ message, onDismiss }: ErrorNotificationProps) => {
  if (!message) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-start gap-2">
        <span className="p-1">⚠️</span>
        <div>
          <p className="font-medium text-sm">{message}</p>
          <button
            onClick={onDismiss}
            className="text-xs text-white/80 hover:text-white mt-1 underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ErrorNotification);
