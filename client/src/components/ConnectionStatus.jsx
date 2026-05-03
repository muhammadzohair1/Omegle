import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Activity } from 'lucide-react';

const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(!!auth.currentUser);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });

    // Note: To properly track Firebase connection, we could use the .info/connected listener if using Realtime Database.
    // For Firestore, we can assume connection if online and authenticated, 
    // but navigator.onLine is the most direct indicator requested.

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeAuth();
    };
  }, []);

  const connected = isOnline && isAuthenticated;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
      <div className="relative flex items-center justify-center">
        <motion.div 
          animate={{ 
            scale: connected ? [1, 1.5, 1] : 1,
            opacity: connected ? [0.4, 0, 0.4] : 0.4
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className={`absolute w-3 h-3 rounded-full ${connected ? 'bg-[#00ffff]' : 'bg-red-500'}`}
        />
        <div className={`w-1.5 h-1.5 rounded-full relative z-10 ${connected ? 'bg-[#00ffff]' : 'bg-red-500'} shadow-[0_0_8px_rgba(0,255,255,0.5)]`} />
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${connected ? 'text-[#00ffff]' : 'text-red-400'}`}>
        {connected ? 'Linked' : 'Offline'}
      </span>
    </div>
  );
};

export default ConnectionStatus;
