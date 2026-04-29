import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import {
  Send, Loader, UserX, AlertCircle, RefreshCw, Flag, X, MessageSquare,
  Video, VideoOff, Mic, MicOff, MessageCircle, SwitchCamera, Flashlight, FlashlightOff, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { useWebRTC } from '../hooks/useWebRTC';
import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import './Chat.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or advertising' },
  { id: 'harassment', label: 'Harassment or abuse' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Other' },
];

const Chat = () => {
  const { currentUser, userInterests } = useAuth();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);

  const {
    localStream,
    remoteStream,
    initializeMedia,
    startCall,
    endCall,
    connectionState,
    error: webrtcError,
    toggleCamera,
    toggleFlashlight,
    isFlashlightOn,
    replaceTrack
  } = useWebRTC(socket);

  const [chatState, setChatState] = useState('idle');
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerInterests, setPartnerInterests] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSkipping, setIsSkipping] = useState(false);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [partnerVideoOff, setPartnerVideoOff] = useState(false);
  const [partnerMuted, setPartnerMuted] = useState(false);

  const [nsfwModel, setNsfwModel] = useState(null);
  const [nsfwWarnings, setNsfwWarnings] = useState(0);
  const [isRemoteBlurred, setIsRemoteBlurred] = useState(false);
  const [showNsfwPopup, setShowNsfwPopup] = useState(false);
  const [partnerUid, setPartnerUid] = useState(null);
  const [isBlurActive, setIsBlurActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);

  const nsfwConsecutiveCountRef = useRef(0);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const selfieSegmentationRef = useRef(null);
  const animationFrameRef = useRef(null);
  const blurStreamRef = useRef(null);

  // Initialize Camera on mount
  useEffect(() => {
    initializeMedia().catch(err => console.error("Camera access denied:", err));

    // NSFW Model Loading is deferred to optimize initial load.
  }, [initializeMedia]);

  // Initialize Selfie Segmentation — load MediaPipe via CDN dynamically
  // (The npm package has no ESM exports; CDN is the official recommended approach)
  useEffect(() => {
    let cancelled = false;

    const loadSegmentation = () => {
      try {
        // window.SelfieSegmentation is injected by the CDN script below
        if (!window.SelfieSegmentation) {
          console.warn('SelfieSegmentation not available on window yet.');
          return;
        }
        const segmentation = new window.SelfieSegmentation({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
        });

        segmentation.setOptions({ modelSelection: 1, selfieMode: true });

        segmentation.onResults((results) => {
          if (cancelled || !canvasRef.current || !localVideoRef.current) return;
          const ctx = canvasRef.current.getContext('2d');
          ctx.save();
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(results.segmentationMask, 0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.globalCompositeOperation = 'source-in';
          ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.globalCompositeOperation = 'destination-over';
          ctx.filter = 'blur(15px)';
          ctx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.restore();
        });

        selfieSegmentationRef.current = segmentation;
      } catch (err) {
        console.error('SelfieSegmentation init failed (non-fatal):', err);
      }
    };

    // Inject CDN script if not already present
    const CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
    if (!document.querySelector(`script[src="${CDN_URL}"]`)) {
      const script = document.createElement('script');
      script.src = CDN_URL;
      script.crossOrigin = 'anonymous';
      script.onload = () => { if (!cancelled) loadSegmentation(); };
      script.onerror = () => console.warn('MediaPipe CDN failed to load — background blur disabled.');
      document.head.appendChild(script);
    } else {
      // Script already in DOM (hot-reload case)
      loadSegmentation();
    }

    return () => {
      cancelled = true;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (selfieSegmentationRef.current) {
        try { selfieSegmentationRef.current.close(); } catch (_) {}
        selfieSegmentationRef.current = null;
      }
    };
  }, []);
  
  // Online/Offline Listeners
  useEffect(() => {
    const handleOnline = () => addSystemMessage('🌐 Back online! Connection restored.');
    const handleOffline = () => addSystemMessage('📶 You are offline. Please check your internet connection.');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Privacy & Anti-Leak Shield
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurActive(true);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p')) {
        alert('Privacy Protection: Screenshots and printing are disabled on this platform.');
        // Briefly show black overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'black';
        overlay.style.zIndex = '9999';
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 2000);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const processFrame = async () => {
    if (isBlurActive && localVideoRef.current && selfieSegmentationRef.current) {
      await selfieSegmentationRef.current.send({ image: localVideoRef.current });
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  };

  useEffect(() => {
    if (isBlurActive) {
      if (localVideoRef.current && canvasRef.current) {
        canvasRef.current.width = localVideoRef.current.videoWidth || 640;
        canvasRef.current.height = localVideoRef.current.videoHeight || 480;
        processFrame();
      }
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isBlurActive]);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log("Local playback: ", e));
    }
  }, [localStream]);

  // Attach remote stream with force-play
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log('Attaching remote stream object');
      remoteVideoRef.current.srcObject = remoteStream;
      // Force play to overcome browser autoplay blocks
      remoteVideoRef.current.play().catch(err => {
        console.warn('Autoplay blocked. User interaction may be required.', err);
      });
    }
  }, [remoteStream]);

  // NSFW Classification Loop (Loads model lazily when connected)
  useEffect(() => {
    let interval;
    if (chatState === 'connected' && remoteStream && remoteVideoRef.current) {
      // Lazy load model if not already loaded
      if (!nsfwModel && !isModelLoading) {
        setIsModelLoading(true);
        console.log('Lazy loading NSFW model...');
        nsfwjs.load().then(model => {
          setNsfwModel(model);
          addSystemMessage('🛡️ Safety Shield Active');
        }).catch(err => {
          console.error('Failed to load NSFW model:', err);
          addSystemMessage('❌ Safety Shield Failed to Load.');
        }).finally(() => {
          setIsModelLoading(false);
        });
      }

      if (nsfwModel) {
        console.log('NSFW classification loop started');
      interval = setInterval(async () => {
        if (remoteVideoRef.current && remoteVideoRef.current.readyState === 4) {
          try {
            const predictions = await nsfwModel.classify(remoteVideoRef.current);
            console.log('AI Predictions:', predictions.map(p => `${p.className}: ${Math.round(p.probability * 100)}%`).join(', '));

            // Only trigger for Porn or Hentai with 90%+ certainty
            const highestNsfw = predictions.find(p =>
              ['Porn', 'Hentai'].includes(p.className) && p.probability > 0.90
            );

            if (highestNsfw) {
              nsfwConsecutiveCountRef.current += 1;
              console.log(`NSFW Consecutive Count: ${nsfwConsecutiveCountRef.current}/2`);

              // Only blur if detected 2 times in a row
              if (nsfwConsecutiveCountRef.current >= 2) {
                console.log('NSFW THRESHOLD REACHED:', highestNsfw);
                setIsRemoteBlurred(true);
                setShowNsfwPopup(true);
                setNsfwWarnings(prev => {
                  const newCount = prev + 1;
                  addSystemMessage(`⚠️ WARNING: Inappropriate content detected (${newCount}/3).`);
                  if (newCount >= 3) {
                    addSystemMessage('Safety Shield: Auto-reporting violation...');
                    setTimeout(() => {
                      submitReport('inappropriate', true);
                    }, 1500);
                  }
                  return newCount;
                });

                // Hide popup quickly (2 seconds)
                setTimeout(() => setShowNsfwPopup(false), 2000);
              }
            } else {
              // Reset consecutive count if a clean frame is detected
              nsfwConsecutiveCountRef.current = 0;
            }
          } catch (e) {
            console.log('NSFW Classification error:', e);
          }
        } else {
          console.log('Waiting for remote video to be ready for classification...');
        }
      }, 3000);
      }
    } else {
      // Only log if conditions are partially met to reduce console noise
      if (chatState === 'connected' && remoteStream && !nsfwModel) {
        console.log('🤖 AI Moderation: Waiting for NSFW model load...');
      }
      return;
    }

    // Cleanup on disconnect or unmount to save CPU
    return () => {
      if (interval) {
        console.log('NSFW classification loop stopped');
        clearInterval(interval);
      }
    };
  }, [chatState, remoteStream, nsfwModel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, partnerTyping]);

  useEffect(() => {
    let newSocket;
    let connectionTimeout;
    try {
      console.log('🔌 Initializing socket connection to:', SOCKET_URL);
      newSocket = io(SOCKET_URL, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        withCredentials: true,
        timeout: 20000,
        closeOnBeforeunload: false,
      });

      // Manual Heartbeat to keep Railway proxy alive
      const heartbeat = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit('heartbeat');
        }
      }, 25000);

      connectionTimeout = setTimeout(() => {
        if (!newSocket.connected) {
          console.error('❌ Socket connection timed out after 20s');
          addSystemMessage('⚠️ Connection Timeout. The server might be sleeping or blocked by your network.');
          setChatState('server_offline');
        }
      }, 20000);

      newSocket.on('connect', () => {
        console.log('✅ Socket Connected! ID:', newSocket.id);
        clearTimeout(connectionTimeout);
        setChatState('idle');
      });

      newSocket.on('connect_error', (error) => {
        console.warn('❌ Socket Connection Error:', error.message);
        console.dir(error);
        addSystemMessage(`📶 Link Error: ${error.message}`);
      });

      newSocket.on('disconnect', (reason) => {
        console.warn('🔌 Socket Disconnected:', reason);
        if (reason === 'io server disconnect' || reason === 'transport close') {
          addSystemMessage('📡 Connection unstable. Re-linking...');
          newSocket.connect();
        }
      });

      setSocket(newSocket);
    } catch (error) {
      console.error('Socket initialization error:', error);
    }

    // Auto-redirect disabled for debugging
    const timeout = setTimeout(() => {
      if (chatState === 'idle' && newSocket && !newSocket.connected) {
        console.warn("REDIRECTING TO HOME. Reason: [Session lost on refresh or socket failed to connect - DISABLED FOR DEBUGGING]");
        // navigate('/');
      }
    }, 2000);

    return () => {
      if (newSocket) newSocket.disconnect();
      clearTimeout(timeout);
      clearInterval(heartbeat);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && chatState === 'connected' && !isSkipping) {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [socket, chatState, isSkipping]);

  useEffect(() => {
    if (!socket) return;

    socket.on('queue_joined', () => {
      setChatState('looking');
      setPartnerLeft(false);
      setPartnerVideoOff(false);
      setPartnerMuted(false);
      addSystemMessage('Looking for a smart match...');
    });

    socket.on('match_found', (data) => {
      setChatState('connected');
      setPartnerInterests(data.partnerInterests);
      setPartnerUid(data.partnerUid);
      setMessages([]);
      setIsSkipping(false);
      setNsfwWarnings(0);
      setIsRemoteBlurred(false);
      setShowNsfwPopup(false);
      nsfwConsecutiveCountRef.current = 0;
      addSystemMessage("You're connected with a random stranger!");
      if (data.partnerInterests) {
        addSystemMessage(`They also selected: ${data.partnerInterests.category}`);
      }

      if (data.isInitiator) {
        console.log('Initiating WebRTC call...');
        startCall();
      }
    });

    socket.on('receive_message', (data) => {
      setMessages(prev => [...prev, { type: 'stranger', text: data.text }]);
    });

    socket.on('partner_typing', () => setPartnerTyping(true));
    socket.on('partner_stop_typing', () => setPartnerTyping(false));

    socket.on('partner_disconnected', () => {
      setChatState('idle');
      setPartnerLeft(true);
      addSystemMessage('Stranger has disconnected.');
      endCall();
    });

    socket.on('partner_left', () => {
      setChatState('idle');
      setPartnerLeft(true);
      setPartnerVideoOff(false);
      setPartnerMuted(false);
      addSystemMessage('Stranger has left the chat.');
      endCall();
    });

    socket.on('partner_video_toggle', (data) => {
      setPartnerVideoOff(data.videoOff);
    });

    socket.on('partner_audio_toggle', (data) => {
      setPartnerMuted(data.muted);
    });

    return () => {
      socket.off('queue_joined');
      socket.off('match_found');
      socket.off('receive_message');
      socket.off('partner_typing');
      socket.off('partner_stop_typing');
      socket.off('partner_disconnected');
      socket.off('partner_left');
    };
  }, [socket, startCall, endCall]);

  // Handle connection failure/timeout
  useEffect(() => {
    if (connectionState === 'failed') {
      addSystemMessage('⚠️ Connection lost or failed. Finding new partner...');
      handleSkip();
    }
  }, [connectionState]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addSystemMessage = (text) => {
    setMessages(prev => [...prev, { type: 'system', text }]);
  };

  const startLooking = () => {
    if (!socket || !userInterests || !currentUser) return;
    setMessages([]);
    setPartnerLeft(false);
    socket.emit('join_queue', {
      uid: currentUser?.uid,
      interests: userInterests,
    });
  };

  const handleSkip = async () => {
    if (!socket || isSkipping) return;
    setIsSkipping(true);
    socket.emit('leave_chat');
    endCall();
    setChatState('idle');
    setTimeout(() => {
      startLooking();
    }, 500);
  };

  const handleStop = () => {
    if (!socket) return;
    socket.emit('leave_chat');
    endCall();
    setChatState('idle');
    setMessages([]);
  };

  const toggleMute = () => {
    if (localStream) {
      const newState = !isMuted;
      localStream.getAudioTracks().forEach(track => track.enabled = !newState);
      setIsMuted(newState);
      socket?.emit('toggle_audio', { muted: newState });
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const newState = !isVideoOff;
      localStream.getVideoTracks().forEach(track => track.enabled = !newState);
      setIsVideoOff(newState);
      socket?.emit('toggle_video', { videoOff: newState });
    }
  };

  const toggleBlur = async () => {
    if (!localStream) return;
    const newState = !isBlurActive;
    setIsBlurActive(newState);

    try {
      if (newState) {
        // Start processing
        if (!canvasRef.current) return;
        const stream = canvasRef.current.captureStream(30);
        blurStreamRef.current = stream;
        
        const blurTrack = stream.getVideoTracks()[0];
        if (blurTrack) {
          console.log('Switching to BLURRED track for remote peer');
          await replaceTrack(blurTrack);
        }
      } else {
        // Switch back to original clear track
        const originalTrack = localStream.getVideoTracks()[0];
        if (originalTrack) {
          console.log('Switching to CLEAR track for remote peer');
          await replaceTrack(originalTrack);
        }
        if (blurStreamRef.current) {
          blurStreamRef.current.getTracks().forEach(t => t.stop());
          blurStreamRef.current = null;
        }
      }
    } catch (err) {
      console.error('Toggle blur track replacement failed:', err);
    }
  };

  const submitReport = async (reason, isAuto = false) => {
    if (!currentUser || !partnerUid) return;
    
    if (!navigator.onLine) {
      addSystemMessage('⚠️ Cannot submit report while offline.');
      handleSkip();
      return;
    }

    try {
      // 1. Log the individual report
      await addDoc(collection(db, 'reports'), {
        reporterUid: currentUser.uid,
        reportedUid: partnerUid,
        reportedAt: serverTimestamp(),
        reason: reason,
        partnerInterests: partnerInterests,
        chatStateAtReport: chatState,
        autoReport: isAuto
      });

      // 2. Increment report count and check for auto-ban
      const userStatsRef = doc(db, 'userStats', partnerUid);
      const reportSnap = await getDoc(userStatsRef);
      
      let count = 1;
      if (reportSnap.exists()) {
        count = (reportSnap.data().reportCount || 0) + 1;
      }

      await setDoc(userStatsRef, { 
        reportCount: count,
        lastReportedAt: serverTimestamp() 
      }, { merge: true });

      if (count >= 3) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await setDoc(doc(db, 'banned', partnerUid), {
          bannedAt: serverTimestamp(),
          expiresAt: expiresAt,
          reason: 'Automated Ban: Received 3 or more safety reports.',
          reportCount: count
        });
        
        // Reset count after ban
        await setDoc(userStatsRef, { reportCount: 0 }, { merge: true });
        addSystemMessage('🛡️ User automatically banned for 24 hours.');
      } else {
        addSystemMessage(isAuto ? 'User automatically reported.' : 'Report submitted.');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
    }
    handleSkip();
  };

  const handleReport = async () => {
    if (!reportReason) return;
    await submitReport(reportReason);
    setShowReportModal(false);
    setReportReason('');
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (chatState === 'connected') {
      socket.emit('typing');
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing');
      }, 1500);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || chatState !== 'connected') return;
    socket.emit('send_message', { text: inputValue });
    setMessages(prev => [...prev, { type: 'me', text: inputValue }]);
    setInputValue('');
    socket.emit('stop_typing');
    clearTimeout(typingTimeoutRef.current);
  };

  return (
    <div className="chat-container h-[100dvh] w-full bg-obsidian text-slate-100 select-none touch-none overflow-hidden font-inter p-1 sm:p-2 md:p-4">

      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-obsidian to-obsidian pointer-events-none"></div>

      <div className="flex flex-col md:grid md:grid-cols-12 gap-1.5 md:gap-4 h-full max-w-[1600px] mx-auto relative z-10 pb-safe md:pb-0">

        
        {/* Left Sidebar: Info & Bento Modules (Hidden on mobile) */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="hidden lg:flex md:col-span-3 flex-col gap-4 h-full"
        >
          {/* Profile Module */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-glass-inset flex flex-col gap-4 h-1/3">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-300">
              <div className="w-2 h-2 rounded-full bg-cyan-neon shadow-[0_0_8px_rgba(0,240,255,0.6)] animate-pulse-slow"></div> 
              User Identity
            </h3>
            <div className="user-profile-mini">
              <p className="text-xl font-bold tracking-tight">{currentUser?.displayName}</p>
              <p className="text-xs text-slate-500 font-mono tracking-tighter truncate">{currentUser?.email}</p>
            </div>
            
            <h3 className="mt-auto text-xs font-semibold uppercase tracking-widest text-slate-500">Active Node</h3>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-3 py-1 bg-cyan-neon/10 border border-cyan-neon/20 text-cyan-neon rounded-full text-[10px] font-black uppercase tracking-wider">
                {userInterests?.category}
              </span>
            </div>
          </div>

          {/* Connection Status Module */}
          <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-glass-inset flex flex-col h-2/3">
            <h3 className="text-sm font-semibold tracking-tight text-slate-300 mb-6">Link Status</h3>
            {chatState === 'connected' ? (
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-5 bg-cyan-neon/5 border border-cyan-neon/20 rounded-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-neon/0 via-cyan-neon/10 to-cyan-neon/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                <div className="flex items-center gap-3 text-cyan-neon mb-2">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-full h-full bg-cyan-neon rounded-full blur-md opacity-50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-neon relative z-10"></div>
                  </div>
                  <span className="font-bold text-xs uppercase tracking-widest">Encrypted Match</span>
                </div>
                {partnerInterests && (
                  <div className="mt-4 text-[10px] font-mono tracking-tight text-slate-400">
                    Routing: <span className="text-white">{partnerInterests.category}</span>
                  </div>
                )}
                {/* Live Signal Waveform */}
                <div className="flex items-end gap-1 h-6 mt-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="w-1.5 bg-cyan-neon rounded-t-sm animate-live-signal" style={{ animationDelay: `${i * 0.15}s`, height: `${Math.max(40, Math.random() * 100)}%` }}></div>
                  ))}
                </div>
              </motion.div>
            ) : chatState === 'looking' ? (
              <div className="p-5 bg-white/5 border border-white/10 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-cyan-neon/40 animate-pulse"></div>
                <div className="flex items-center gap-3 text-slate-400">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-6 h-6 bg-cyan-neon/30 rounded-full animate-ping"></div>
                    <Loader className="animate-spin text-cyan-neon relative z-10" size={16} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Scanning Network...</span>
                </div>
              </div>
            ) : chatState === 'server_offline' ? (
              <div className="p-5 bg-red-500/10 border border-red-500/20 rounded-xl relative overflow-hidden">
                <div className="flex items-center gap-3 text-red-400">
                  <AlertCircle size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">Server Offline</span>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-obsidian/40 border border-white/5 rounded-xl opacity-60">
                <div className="flex items-center gap-3 text-slate-600">
                  <UserX size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">Standby Mode</span>
                </div>
              </div>
            )}
            
            {partnerMuted && chatState === 'connected' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium flex items-center gap-2">
                <MicOff size={14} /> Remote Audio Offline
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Center: Video Main Area (Bento Hero) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
          className={`lg:col-span-6 md:col-span-8 h-[50%] md:h-full bg-obsidian rounded-2xl overflow-hidden border ${chatState === 'connected' ? 'border-cyan-neon/30 shadow-neon-cyan' : 'border-white/10 shadow-glass-inset'} relative group transition-all duration-500`}
        >
          {/* Radiant light overlay removed as per user request to clear video feed */}

          
          <div className="absolute inset-[1px] rounded-[calc(1.5rem-1px)] overflow-hidden bg-obsidian z-0">
            {remoteStream ? (
              <motion.div 
                initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 25 }}
                className="w-full h-full relative"
              >
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  onLoadedMetadata={(e) => e.target.play().catch(err => console.error("Remote play blocked", err))}
                  className="w-full h-full object-cover"
                  style={{ filter: isRemoteBlurred ? 'blur(20px)' : 'none' }}
                />
                
                {/* Connection syncing overlay */}
                {!remoteStream.active && chatState === 'connected' && (
                  <div className="absolute inset-0 bg-obsidian/80 backdrop-blur-xl flex flex-col items-center justify-center text-white z-20">
                    <Loader className="animate-spin mb-4 text-cyan-neon" size={32} />
                    <p className="text-[10px] font-black tracking-[0.3em] uppercase">Syncing Handshake...</p>
                  </div>
                )}
                
                {/* Shield Overlay */}
                <AnimatePresence>
                  {isRemoteBlurred && !partnerVideoOff && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/70 backdrop-blur-xl flex flex-col items-center justify-center z-10"
                    >
                      <AlertCircle size={48} className="text-red-500 mb-4 animate-pulse" />
                      <p className="text-white font-black text-sm tracking-widest uppercase px-6 py-2 bg-red-600/20 border border-red-500/30 rounded-xl">
                        Shield Intervention
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-obsidian">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 md:mb-6 shadow-glass-inset">
                  <VideoOff size={32} className="opacity-30" />
                </div>
                <p className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40">Awaiting Signal</p>
              </div>
            )}
          </div>

          {/* Local Video Overlay (Bento Sub-module) */}
          <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 w-20 h-28 sm:w-24 sm:h-32 md:w-32 md:h-48 lg:w-44 lg:h-64 bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-20 group/local">
            <div className="absolute inset-0 border border-white/10 rounded-2xl z-30 pointer-events-none"></div>
            {localStream ? (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => e.target.play().catch(err => console.error("Local play blocked", err))}
                  className={`w-full h-full object-cover mirror ${isBlurActive ? 'hidden' : 'block'}`}
                />
                <canvas
                  ref={canvasRef}
                  className={`w-full h-full object-cover mirror ${isBlurActive ? 'block' : 'hidden'}`}
                />
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-obsidian">
                <VideoOff size={16} className="mb-2 opacity-50 md:w-6 md:h-6" />
                {webrtcError?.includes('Locked') || webrtcError?.includes('Unavailable') ? (
                  <span className="text-[8px] md:text-[9px] text-center px-2 text-red-400 font-mono">Hardware Locked</span>
                ) : (
                  <span className="text-[8px] md:text-[9px] font-mono uppercase tracking-wider">No Feed</span>
                )}
              </div>
            )}
            
            {isVideoOff && localStream && (
              <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-10">
                <VideoOff size={24} className="text-red-500" />
              </div>
            )}
          </div>

          {/* Floating Action Controls Dock */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 md:gap-3 p-1.5 sm:p-2 md:p-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl z-20 transition-transform duration-300 hover:scale-105 max-w-[95%] overflow-x-auto no-scrollbar">
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleVideo} className={`min-w-[36px] w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}`}>
              {isVideoOff ? <VideoOff size={16} /> : <Video size={16} />}
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleMute} className={`min-w-[36px] w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}`}>
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleBlur} className={`min-w-[36px] w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors ${isBlurActive ? 'bg-purple-plasma/20 text-purple-plasma border border-purple-plasma/30' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}`}>
              <UserX size={16} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleCamera} className="min-w-[36px] w-9 h-9 sm:w-10 sm:h-10 md:hidden rounded-full flex items-center justify-center bg-white/10 text-white border border-white/10 hover:bg-white/20">
              <SwitchCamera size={16} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleFlashlight} className={`min-w-[36px] w-9 h-9 sm:w-10 sm:h-10 md:hidden rounded-full flex items-center justify-center transition-colors ${isFlashlightOn ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}`}>
              {isFlashlightOn ? <Flashlight size={16} /> : <FlashlightOff size={16} />}
            </motion.button>

            <div className="w-px h-6 bg-white/10 mx-0.5 hidden sm:block"></div>

            {chatState === 'connected' ? (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleSkip} className="h-9 sm:h-10 md:h-12 px-3 sm:px-4 md:px-6 bg-red-500 hover:bg-red-400 text-white font-bold rounded-full shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all flex items-center gap-1.5 text-[10px] sm:text-xs md:text-sm tracking-wide">
                <RefreshCw size={12} className={isSkipping ? 'animate-spin' : ''} /> SKIP
              </motion.button>
            ) : (
              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} 
                onClick={chatState === 'server_offline' ? () => socket?.connect() : startLooking} 
                disabled={chatState === 'looking'} 
                className="h-9 sm:h-10 md:h-12 px-3 sm:px-4 md:px-6 bg-cyan-neon hover:bg-cyan-400 text-obsidian font-bold rounded-full shadow-neon-cyan transition-all flex items-center gap-1.5 disabled:opacity-50 text-[10px] sm:text-xs md:text-sm tracking-wide"
              >
                {chatState === 'looking' ? <Loader className="animate-spin" size={12} /> : chatState === 'server_offline' ? <RefreshCw size={12} /> : <Activity size={12} />}
                <span className="hidden xxs:inline">{chatState === 'looking' ? 'LINKING' : chatState === 'server_offline' ? 'RETRY' : 'START'}</span>
                <span className="xxs:hidden">{chatState === 'looking' ? '...' : chatState === 'server_offline' ? 'RETRY' : 'GO'}</span>
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Right Panel: Chat Box (Bento Module) */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
          className="lg:col-span-3 md:col-span-4 h-[50%] md:h-full bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-glass-inset flex flex-col overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-purple-plasma" />
              <h3 className="font-semibold text-xs uppercase tracking-[0.15em] text-slate-300">Telemetry Feed</h3>
            </div>
            {chatState === 'connected' && (
              <button onClick={() => setShowReportModal(true)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white" title="Report User">
                <Flag size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
            {messages.length === 0 && !partnerLeft && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <MessageCircle size={32} className="mb-3 text-slate-500" />
                <p className="text-[10px] font-mono tracking-widest uppercase text-slate-400">Log Empty</p>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  key={idx} className={`flex flex-col w-full ${msg.type === 'me' ? 'items-end' : msg.type === 'stranger' ? 'items-start' : 'items-center'}`}
                >
                  {msg.type === 'system' ? (
                    <div className="text-[10px] font-mono text-slate-500 bg-white/5 border border-white/5 px-3 py-1.5 rounded-full text-center tracking-wide">{msg.text}</div>
                  ) : (
                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm backdrop-blur-md border ${
                      msg.type === 'me' 
                        ? 'bg-purple-plasma/20 border-purple-plasma/30 text-white rounded-tr-sm' 
                        : 'bg-white/10 border-white/10 text-slate-200 rounded-tl-sm'
                    }`}>
                      <p>{msg.text}</p>
                    </div>
                  )}
                </motion.div>
              ))}
              
              {partnerTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-start w-full">
                  <div className="px-4 py-3 bg-white/5 border border-white/5 rounded-2xl rounded-tl-sm flex gap-1.5">
                    <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full"></motion.span>
                    <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full"></motion.span>
                    <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full"></motion.span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-3 bg-obsidian/40 border-t border-white/5 flex gap-2">
            <input
              type="text"
              className="flex-1 text-sm bg-slate-900/50 border border-white/10 rounded-xl outline-none text-white px-4 py-3 focus:border-cyan-neon/50 focus:shadow-[inset_0_0_10px_rgba(0,240,255,0.1)] transition-all font-inter placeholder:text-slate-600 placeholder:text-xs"
              placeholder={chatState === 'connected' ? 'Transmit data...' : 'Awaiting connection...'}
              value={inputValue}
              onChange={handleInputChange}
              disabled={chatState !== 'connected'}
              autoComplete="off"
            />
            <motion.button
              whileHover={{ scale: chatState === 'connected' && inputValue.trim() ? 1.05 : 1 }}
              whileTap={{ scale: chatState === 'connected' && inputValue.trim() ? 0.95 : 1 }}
              type="submit"
              className={`p-3 rounded-xl flex items-center justify-center transition-all ${
                inputValue.trim() && chatState === 'connected' 
                  ? 'bg-cyan-neon text-obsidian shadow-neon-cyan' 
                  : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
              }`}
              disabled={!inputValue.trim() || chatState !== 'connected'}
            >
              <Send size={18} />
            </motion.button>
          </form>
        </motion.div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-obsidian/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setShowReportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-purple-plasma"></div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold tracking-tight text-white">System Report</h3>
                <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="space-y-2 mb-8">
                {REPORT_REASONS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setReportReason(r.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all text-sm font-medium ${
                      reportReason === r.id 
                        ? 'border-purple-plasma bg-purple-plasma/10 text-white' 
                        : 'border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-white/5 text-slate-300 hover:bg-white/10 transition-colors" onClick={() => setShowReportModal(false)}>Cancel</button>
                <button className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-red-500 text-white hover:bg-red-400 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)] disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleReport} disabled={!reportReason}>Transmit</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chat;