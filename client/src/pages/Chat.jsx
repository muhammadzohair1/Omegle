import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { 
  Send, Loader, UserX, AlertCircle, RefreshCw, Flag, X, 
  Video, VideoOff, Mic, MicOff, MessageCircle, SwitchCamera, Flashlight, FlashlightOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
  const [socket, setSocket] = useState(null);
  
  const { 
    localStream, 
    remoteStream, 
    initializeMedia, 
    startCall, 
    endCall,
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
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Initialize Camera on mount
  useEffect(() => {
    initializeMedia().catch(err => console.error("Camera access denied:", err));
    
    // Load NSFW model locally
    const loadModel = async () => {
      try {
        const model = await nsfwjs.load('/model/', { size: 224 });
        setNsfwModel(model);
        console.log('NSFW model loaded locally.');
      } catch (err) {
        console.error('Failed to load NSFW model:', err);
      }
    };
    loadModel();
  }, [initializeMedia]);

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
      interval = setInterval(async () => {
        if (remoteVideoRef.current && remoteVideoRef.current.readyState === 4) {
          try {
            const predictions = await nsfwModel.classify(remoteVideoRef.current);
            const isNsfw = predictions.some(p => 
              ['Porn', 'Hentai', 'Sexy'].includes(p.className) && p.probability > 0.6
            );
            if (isNsfw) {
              setIsRemoteBlurred(true);
              setNsfwWarnings(prev => {
                const newCount = prev + 1;
                addSystemMessage(`⚠️ Inappropriate content detected (${newCount}/3 warnings). Video blurred.`);
                if (newCount >= 3) {
                  addSystemMessage('Maximum warnings reached. Auto-reporting and disconnecting...');
                  setTimeout(() => {
                    submitReport('inappropriate', true);
                  }, 1500);
                }
                return newCount;
              });
            }
          } catch (e) {
            console.log('NSFW Classification error:', e);
          }
        }
      }, 3000);
    }
    
    // Cleanup on disconnect or unmount to save CPU
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [chatState, remoteStream, nsfwModel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, partnerTyping]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    return () => newSocket.disconnect();
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
      setMessages([]);
      setIsSkipping(false);
      setNsfwWarnings(0);
      setIsRemoteBlurred(false);
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

  const submitReport = async (reason, isAuto = false) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reporterUid: currentUser.uid,
        reportedAt: serverTimestamp(),
        reason: reason,
        partnerInterests: partnerInterests,
        chatStateAtReport: chatState,
        autoReport: isAuto
      });
      addSystemMessage(isAuto ? 'User automatically reported.' : 'Report submitted.');
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
    <div className="chat-container">
      <div className="chat-layout">
        {/* Left Sidebar: Info & Interests */}
        <div className="chat-sidebar glass-panel">
          <div className="sidebar-section">
            <h3 className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Your Profile</h3>
            <div className="user-profile-mini p-3 bg-white/5 rounded-xl border border-white/10 mb-4">
               <p className="text-sm font-semibold">{currentUser?.displayName}</p>
               <p className="text-[10px] opacity-50 truncate">{currentUser?.email}</p>
            </div>
            
            <h3>Your Interests</h3>
                <div className="interest-tag-display">
                  <span className="cat-badge">{userInterests?.category}</span>
                  {userInterests?.subOptions?.map(sub => (
                    <span key={sub} className="sub-badge">{sub}</span>
                  ))}
                </div>
                {partnerMuted && (
                  <div className="mt-4 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-[10px] flex items-center gap-1">
                    <MicOff size={12} /> Stranger is muted
                  </div>
                )}
              </div>
          
          <div className="sidebar-section">
            <h3>Stranger Info</h3>
            {chatState === 'connected' ? (
              <div className="stranger-info connected animate-fade-in">
                <div className="flex items-center gap-2">
                  <div className="status-dot connected"></div>
                  <span className="font-bold text-green-400">Connected</span>
                </div>
                {partnerInterests && (
                  <div className="partner-interests-box mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-xs">Also likes: <span className="text-green-300 font-bold">{partnerInterests.category}</span></p>
                  </div>
                )}
              </div>
            ) : chatState === 'looking' ? (
              <div className="stranger-info looking">
                <div className="flex items-center gap-2">
                  <Loader className="spinner text-blue-400" size={16} />
                  <span>Searching...</span>
                </div>
              </div>
            ) : (
              <div className="stranger-info idle">
                <div className="flex items-center gap-2 text-gray-500">
                  <UserX size={16} />
                  <span>Not Connected</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Video Main Area */}
        <div className="video-main glass-panel overflow-hidden">
          <div className="video-display bg-gray-950 relative">
              {/* Remote Video */}
              {remoteStream ? (
                <div className="w-full h-full relative">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover transition-all duration-500"
                    style={{ filter: isRemoteBlurred ? 'blur(20px)' : 'none' }}
                  />
                  {isRemoteBlurred && !partnerVideoOff && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                      <AlertCircle size={40} className="text-red-500 mb-2 opacity-80" />
                      <p className="text-white font-bold bg-black/50 px-3 py-1 rounded-full text-sm">Content Blurred</p>
                    </div>
                  )}
                  {partnerVideoOff && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-gray-500 z-10 animate-fade-in">
                      <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                        <VideoOff size={32} className="opacity-50" />
                      </div>
                      <p className="text-sm font-bold text-gray-400">Stranger has turned off camera</p>
                      <p className="text-xs opacity-50">Audio may still be active</p>
                    </div>
                  )}
                </div>
              ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-slate-900/50">
                <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4 animate-pulse">
                  <VideoOff size={32} className="opacity-50" />
                </div>
                <p className="text-sm font-medium">Waiting for partner...</p>
                {chatState === 'looking' && <p className="text-xs opacity-50 mt-1">Expanding search net...</p>}
              </div>
            )}

            {/* Local Video Overlay */}
            <div className="local-video-overlay absolute bottom-4 right-4 w-32 h-44 sm:w-40 sm:h-56 bg-slate-900 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-20 transition-all hover:scale-105">
              {localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                />
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
            </div>

            {/* In-Video Controls */}
            <div className="video-actions absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30">
               <button 
                onClick={toggleVideo} 
                className={`w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'}`}
              >
                {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
              <button 
                onClick={toggleMute} 
                className={`w-12 h-12 flex items-center justify-center rounded-full backdrop-blur-md transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'}`}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {/* Mobile Only: Switch Camera */}
              <button 
                onClick={toggleCamera} 
                className="w-12 h-12 flex md:hidden items-center justify-center rounded-full backdrop-blur-md transition-all bg-white/10 hover:bg-white/20 text-white border border-white/20"
                title="Switch Camera"
              >
                <SwitchCamera size={20} />
              </button>

              {/* Mobile Only: Flashlight */}
              <button 
                onClick={toggleFlashlight} 
                className={`w-12 h-12 flex md:hidden items-center justify-center rounded-full backdrop-blur-md transition-all ${isFlashlightOn ? 'bg-yellow-500 text-black' : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'}`}
                title="Toggle Flashlight"
              >
                {isFlashlightOn ? <FlashlightOff size={20} /> : <Flashlight size={20} />}
              </button>
              
              <div className="w-px h-8 bg-white/20 mx-2 hidden sm:block"></div>

              {chatState === 'connected' ? (
                <button 
                  onClick={handleSkip}
                  className="h-12 px-8 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all flex items-center gap-2"
                >
                  <RefreshCw size={20} className={isSkipping ? "animate-spin" : ""} />
                  STOP
                </button>
              ) : (
                <button 
                  onClick={startLooking}
                  disabled={chatState === 'looking'}
                  className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-full shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-all"
                >
                  {chatState === 'looking' ? 'FINDING...' : 'START'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Chat Box */}
        <div className="chat-panel glass-panel overflow-hidden flex flex-col">
          <div className="chat-panel-header p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
             <div className="flex items-center gap-2 font-bold text-sm">
                <MessageCircle size={18} className="text-indigo-400" />
                Chatbox
             </div>
             {chatState === 'connected' && (
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400"
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
                <button onClick={() => setShowReportModal(false)}><X size={20}/></button>
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