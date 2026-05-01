import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

const AuthError = ({ message, clearError }) => {
  if (!message) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"
      >
        <AlertCircle size={18} className="shrink-0" />
        <p className="text-sm font-medium flex-1">{message}</p>
        {clearError && (
          <button 
            onClick={clearError}
            className="p-1 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AuthError;
