import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export const useWebRTC = (socket) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [error, setError] = useState(null);

  const [facingMode, setFacingMode] = useState('user');
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidates = useRef([]);

  const initializeMedia = useCallback(async (currentFacingMode = 'user') => {
    try {
      console.log('Requesting camera access...');
      // Stop existing tracks if any
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: true,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      setFacingMode(currentFacingMode);
      setIsFlashlightOn(false);

      // If PC exists, replace the track dynamically
      if (peerConnectionRef.current) {
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        const senders = peerConnectionRef.current.getSenders();
        
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender && videoTrack) videoSender.replaceTrack(videoTrack);

        const audioSender = senders.find(s => s.track && s.track.kind === 'audio');
        if (audioSender && audioTrack) audioSender.replaceTrack(audioTrack);
      }

      return stream;
    } catch (err) {
      console.warn('Camera busy or access denied. Continuing without local video:', err.name);
      // Don't throw, just set error and return null so connection can still start
      setError(`Camera Unavailable: ${err.name}`);
      return null;
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    initializeMedia(newMode);
  }, [facingMode, initializeMedia]);

  const toggleFlashlight = useCallback(async () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;
    
    try {
      // Check if getCapabilities is available and torch is supported
      if (videoTrack.getCapabilities && videoTrack.getCapabilities().torch) {
        const newFlashlightState = !isFlashlightOn;
        await videoTrack.applyConstraints({
          advanced: [{ torch: newFlashlightState }]
        });
        setIsFlashlightOn(newFlashlightState);
      } else {
        console.warn('Flashlight not supported on this device/camera.');
      }
    } catch (err) {
      console.error('Error toggling flashlight:', err);
    }
  }, [isFlashlightOn]);

  const createPeerConnection = useCallback(() => {
    console.log('Creating RTCPeerConnection...');
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log('Sending ICE candidate');
        socket.emit('webrtc_ice_candidate', {
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Remote tracks received:', event.streams[0]);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state change:', pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    // Pre-load tracks before offer/answer if stream is available
    if (localStreamRef.current) {
      console.log('Pre-loading local tracks to PC');
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    console.log('Local tracks added (Senders):', pc.getSenders());
    peerConnectionRef.current = pc;
    return pc;
  }, [socket]);

  // Sync local stream tracks if available after PC creation (e.g. late camera start)
  useEffect(() => {
    if (localStream && peerConnectionRef.current) {
      const pc = peerConnectionRef.current;
      const senders = pc.getSenders();
      
      localStream.getTracks().forEach(track => {
        const alreadyAdded = senders.find(s => s.track === track);
        if (!alreadyAdded) {
          console.log('Syncing late track to PC:', track.kind);
          pc.addTrack(track, localStream);
        }
      });
    }
  }, [localStream]);

  useEffect(() => {
    if (!socket) return;

    const handleOffer = async (data) => {
      console.log('Processing webrtc_offer');
      try {
        const pc = peerConnectionRef.current || createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', { answer });

        // Apply any candidates received before the offer was processed
        while (pendingCandidates.current.length > 0) {
          const candidate = pendingCandidates.current.shift();
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    };

    const handleAnswer = async (data) => {
      console.log('Processing webrtc_answer');
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
        }
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    };

    const handleIceCandidate = async (data) => {
      try {
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } else {
          console.log('Queuing ICE candidate (No remote description yet)');
          pendingCandidates.current.push(data.candidate);
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    };

    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleIceCandidate);

    return () => {
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleIceCandidate);
    };
  }, [socket, createPeerConnection]);

  const startCall = useCallback(async () => {
    try {
      console.log('Starting WebRTC handshake...');
      const pc = peerConnectionRef.current || createPeerConnection();

      // Ensure tracks are added before creating offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);
      socket.emit('webrtc_offer', { offer });

      setConnectionState('connecting');
    } catch (err) {
      console.error('Error starting call:', err);
      setError(err.message);
    }
  }, [createPeerConnection, socket]);

  const endCall = useCallback(() => {
    console.log('Cleaning up WebRTC connection...');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    setConnectionState('disconnected');
    pendingCandidates.current = [];
  }, []);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      endCall();
    };
  }, [endCall]);

  return {
    localStream,
    remoteStream,
    connectionState,
    error,
    startCall,
    endCall,
    initializeMedia,
    toggleCamera,
    toggleFlashlight,
    facingMode,
    isFlashlightOn
  };
};

export default useWebRTC;