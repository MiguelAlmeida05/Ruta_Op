import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store/useStore';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colors = {
  success: 'bg-green-500/10 border-green-500/20 text-green-500',
  error: 'bg-red-500/10 border-red-500/20 text-red-500',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-500',
  warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
};

export default function Toast() {
  const { notifications, removeNotification } = useStore();

  return (
    <div className="fixed top-4 right-4 z-[2000] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {notifications.map((notification) => (
        <ToastItem 
          key={notification.id} 
          {...notification} 
          onClose={() => removeNotification(notification.id)} 
        />
      ))}
    </div>
  );
}

const ToastItem: React.FC<{ 
  message: string; 
  type: 'success' | 'error' | 'info' | 'warning'; 
  onClose: () => void;
}> = ({ message, type, onClose }) => {
  const Icon = icons[type];
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={clsx(
      "pointer-events-auto flex items-center gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-md animate-in slide-in-from-right-full fade-in duration-300",
      colors[type]
    )}>
      <Icon size={20} className="shrink-0" />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button 
        onClick={onClose}
        className="p-1 hover:bg-black/5 rounded-full transition-colors shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
};
