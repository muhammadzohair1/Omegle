import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import {
  Send, Loader, UserX, AlertCircle, RefreshCw, Flag, X, MessageSquare,
  Video, VideoOff, Mic, MicOff, MessageCircle, SwitchCamera, Flashlight, FlashlightOff
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
    isFlashlightOn
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

    // Load NSFW model
    const loadModel = async () => {
      setIsModelLoading(true);
      
      // Emergency timeout to ensure UI renders even on slow connections
      const forceShowUI = setTimeout(() => {
        setIsModelLoading(false);
        console.warn('Model loading timeout: Forcing UI display');
      }, 5000);

      try {
        console.log('Loading NSFW model...');
        // Try local path first with absolute URL to prevent 404 on sub-routes
        const localPath = `${window.location.origin}/model/`;
        let model;
        // Temporarily force CDN version due to local file corruption
        // try {
        //   model = await nsfwjs.load(localPath);
        //   console.log('NSFW model loaded from local path.');
        // } catch (localErr) {
        //   console.warn('Local NSFW model failed (possibly corrupted files), falling back to CDN...', localErr);
          model = await nsfwjs.load(); // Default CDN fallback
          console.log('NSFW model loaded from CDN.');
        // }
        
        setNsfwModel(model);
        addSystemMessage('🛡️ Safety Shield Active');
      } catch (err) {
        console.error('Failed to load NSFW model:', err);
        addSystemMessage('❌ Safety Shield Failed to Load. Basic chat active.');
      } finally {
        clearTimeout(forceShowUI);
        setIsModelLoading(false);
      }
    };
    loadModel();
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

  // NSFW Classification Loop
  useEffect(() => {
    let interval;
    if (chatState === 'connected' && remoteStream && nsfwModel && remoteVideoRef.current) {
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
    } else {
      console.log('NSFW Loop conditions not met:', {
        chatState,
        hasRemoteStream: !!remoteStream,
        hasModel: !!nsfwModel,
        hasRef: !!remoteVideoRef.current
      });
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
    try {
      newSocket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      newSocket.on('connect_error', (error) => {
        console.warn('Socket connect_error:', error);
        addSystemMessage('Reconnecting to server...');
      });

      newSocket.on('disconnect', (reason) => {
        console.warn('Socket disconnected:', reason);
        addSystemMessage('Connection lost. Reconnecting...');
        if (reason === 'io server disconnect') {
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
    };
  }, [chatState]);

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
    if (!socket || !userInterests) return;
    setMessages([]);
    setPartnerLeft(false);
    socket.emit('join_queue', {
      uid: currentUser.uid,
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

    if (newState) {
      // Start processing
      if (!canvasRef.current) return;
      const stream = canvasRef.current.captureStream(30);
      blurStreamRef.current = stream;

      // We don't replace the actual WebRTC track here because it's complex, 
      // but we update the UI local video.
      // In a real app, we'd use replaceTrack in useWebRTC.
    }
  };

  const submitReport = async (reason, isAuto = false) => {
    if (!currentUser || !partnerUid) return;
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
    <div className="chat-container h-[100dvh] select-none touch-none">
      <div className="chat-layout">
        {/* Left Sidebar: Info & Interests */}
        <div className="chat-sidebar glass-panel">
          <div className="sidebar-section">
            <h3 className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(0,255,255,0.5)]"></div> 
              Your Profile
            </h3>
            <div className="user-profile-mini">
              <p className="text-sm font-black">{currentUser?.displayName}</p>
              <p className="text-[10px] text-gray-500 truncate">{currentUser?.email}</p>
            </div>

            <h3 className="mt-8">Your Interests</h3>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full text-[10px] font-black uppercase">
                {userInterests?.category}
              </span>
              {userInterests?.subOptions?.map(sub => (
                <span key={sub} className="px-3 py-1 bg-white/5 border border-white/10 text-gray-400 rounded-full text-[10px]">
                  {sub}
                </span>
              ))}
            </div>
            {partnerMuted && (
              <div className="mt-4 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-[10px] flex items-center gap-1">
                <MicOff size={12} /> Stranger is muted
              </div>
            )}
          </div>

          <div className="sidebar-section">
            <h3 className="mt-8">Stranger Status</h3>
            {chatState === 'connected' ? (
              <div className="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl animate-pulse-glow">
                <div className="flex items-center gap-2 text-cyan-400">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#00FFFF]"></div>
                  <span className="font-black text-xs uppercase">Encrypted Match</span>
                </div>
                {partnerInterests && (
                  <div className="mt-2 text-[10px] text-gray-500">
                    Category: <span className="text-white">{partnerInterests.category}</span>
                  </div>
                )}
              </div>
            ) : chatState === 'looking' ? (
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl animate-pulse">
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader className="animate-spin" size={14} />
                  <span className="text-xs font-bold uppercase">Scanning...</span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl opacity-30">
                <div className="flex items-center gap-2 text-gray-600">
                  <UserX size={14} />
                  <span className="text-xs font-bold uppercase">Standby</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Video Main Area */}
        <div className="video-main glass-panel overflow-hidden">
          <div className="video-display bg-gray-950 relative">
            {remoteStream ? (
              <div className="remote-video-container">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  onLoadedMetadata={(e) => e.target.play().catch(err => console.error("Remote play blocked", err))}
                  className="w-full h-full object-cover transition-all duration-500"
                  style={{ filter: isRemoteBlurred ? 'blur(20px)' : 'none' }}
                />
                {!remoteStream && chatState === 'connected' && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl flex flex-col items-center justify-center text-white z-20">
                    <Loader className="animate-spin mb-4 text-cyan-400" size={32} />
                    <p className="text-xs font-black tracking-[0.2em] uppercase">Syncing Stream...</p>
                  </div>
                )}
                <AnimatePresence>
                  {isRemoteBlurred && !partnerVideoOff && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/60 backdrop-blur-2xl flex flex-col items-center justify-center z-10"
                    >
                      <AlertCircle size={64} className="text-red-500 mb-4 animate-pulse" />
                      <p className="text-white font-black text-xl tracking-tight uppercase px-8 py-3 bg-red-600/20 border border-red-500/30 rounded-2xl">
                        Shield Active
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-slate-950">
                <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 animate-pulse-glow">
                  <VideoOff size={32} className="opacity-30" />
                </div>
                <p className="text-sm font-bold tracking-widest uppercase opacity-40">Finding a connection...</p>
              </div>
            )}

            {/* Local Video Overlay */}
            <div className="local-video-overlay absolute bottom-4 right-4 w-32 h-44 sm:w-40 sm:h-56 bg-slate-900 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-20 transition-all hover:scale-105">
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
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-slate-900">
                  <VideoOff size={24} className="mb-2" />
                  {webrtcError?.includes('Locked') || webrtcError?.includes('Unavailable') ? (
                    <span className="text-[9px] text-center px-1 text-red-400">Locked by other app</span>
                  ) : (
                    <span className="text-[10px]">No Camera</span>
                  )}
                </div>
              )}
              {isVideoOff && localStream && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center">
                  <VideoOff size={24} className="text-red-500" />
                </div>
              )}
              {/* In-Video Controls */}
              <div className="video-actions glass-panel shadow-2xl">
                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`action-btn ${isVideoOff ? 'danger' : ''}`}
                  title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
                >
                  {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`action-btn ${isMuted ? 'danger' : ''}`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                <button
                  type="button"
                  onClick={toggleBlur}
                  className={`action-btn ${isBlurActive ? 'active-purple' : ''}`}
                  title={isBlurActive ? "Disable Blur" : "Blur Background"}
                >
                  <UserX size={20} />
                </button>

                <button
                  type="button"
                  onClick={toggleCamera}
                  className="action-btn active-blue md:hidden"
                  title="Switch Camera"
                >
                  <SwitchCamera size={20} />
                </button>

                <button
                  type="button"
                  onClick={toggleFlashlight}
                  className={`action-btn ${isFlashlightOn ? 'active-purple' : ''} md:hidden`}
                  title="Toggle Flashlight"
                >
                  {isFlashlightOn ? <FlashlightOff size={20} /> : <Flashlight size={20} />}
                </button>

                <div className="w-px h-8 bg-white/10 mx-2 hidden sm:block"></div>

                {chatState === 'connected' ? (
                  <button
                    onClick={handleSkip}
                    className="h-12 px-8 bg-white text-black font-black rounded-full hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                  >
                    <RefreshCw size={18} className={isSkipping ? 'animate-spin' : ''} />
                    SKIP
                  </button>
                ) : (
                  <button
                    onClick={startLooking}
                    disabled={chatState === 'looking'}
                    className="h-12 px-8 bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-full shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {chatState === 'looking' ? <Loader className="animate-spin" size={18} /> : <Video size={18} />}
                    {chatState === 'looking' ? 'LINKING...' : 'START'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Chat Box */}
        <div className="chat-panel glass-panel overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/2">
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-cyan-400" />
              <h3 className="font-black text-xs uppercase tracking-[0.2em]">Live Feed</h3>
            </div>
            {chatState === 'connected' && (
              <button
                onClick={() => setShowReportModal(true)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-500"
                title="Report User"
              >
                <Flag size={14} />
              </button>
            )}
          </div>

          <div className="message-list-panel flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
            {messages.length === 0 && !partnerLeft && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                <MessageCircle size={40} className="mb-2" />
                <p className="text-xs">No messages yet</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`msg-row ${msg.type}`}>
                {msg.type === 'system' ? (
                  <div className="msg-system text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded text-center w-full">{msg.text}</div>
                ) : (
                  <div className={`msg-bubble shadow-sm ${msg.type}`}>
                    <span className="msg-sender-label">{msg.type === 'me' ? 'You' : 'Stranger'}:</span>
                    <p className="msg-text">{msg.text}</p>
                  </div>
                )}
              </div>
            ))}

            {partnerTyping && (
              <div className="msg-row stranger">
                <div className="typing-blob px-3 py-2 bg-white/5 rounded-xl flex gap-1">
                  <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="chat-input-panel p-3 bg-white/5 border-t border-white/10 flex gap-2">
            <input
              type="text"
              className="chat-input-field flex-1 text-sm bg-transparent border-none outline-none text-white p-1"
              placeholder={chatState === 'connected' ? 'Type message...' : 'Waiting...'}
              value={inputValue}
              onChange={handleInputChange}
              disabled={chatState !== 'connected'}
              autoComplete="off"
            />
            <button
              type="submit"
              className="chat-send-btn p-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-all disabled:opacity-20"
              disabled={!inputValue.trim() || chatState !== 'connected'}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowReportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="report-modal glass-panel bg-slate-900 border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Report User</h3>
                <button onClick={() => setShowReportModal(false)}><X size={20} /></button>
              </div>
              <div className="space-y-2 mb-6">
                {REPORT_REASONS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setReportReason(r.id)}
                    className={`w-full text-left p-3 rounded-xl border ${reportReason === r.id ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/10 bg-white/5'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                <button className="flex-1 btn-secondary" onClick={() => setShowReportModal(false)}>Cancel</button>
                <button className="flex-1 btn-primary" onClick={handleReport} disabled={!reportReason}>Submit</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chat;