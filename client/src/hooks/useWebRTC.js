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
      console.log('Requesting camera access with mode:', currentFacingMode);

      // Stop existing tracks BEFORE getting the new stream (Crucial for many mobile browsers)
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }

      const constraints = {
        video: { facingMode: { ideal: currentFacingMode } },
        audio: true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      setLocalStream(stream);
      localStreamRef.current = stream;
      setFacingMode(currentFacingMode);
      setIsFlashlightOn(false);

      // If PC exists, replace the track dynamically
      if (peerConnectionRef.current) {
        const pc = peerConnectionRef.current;
        stream.getTracks().forEach(track => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track).catch(err => console.error('Error replacing track:', err));
          } else {
            // Find an empty sender to replace, or add a new track
            const emptySender = pc.getSenders().find(s => !s.track);
            if (emptySender) {
               emptySender.replaceTrack(track).catch(e => console.error(e));
            } else {
               try { pc.addTrack(track, stream); } catch(e) {}
            }
          }
        });
      }

      return stream;
    } catch (err) {
      console.warn('Camera busy or access denied. Continuing without local video:', err.name);
      // Don't throw, just set error and return null so connection can still start
      setError(`Camera Unavailable: ${err.name}`);
      return null;
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    try {
      const newMode = facingMode === 'user' ? 'environment' : 'user';
      console.log('Switching camera from', facingMode, 'to', newMode);
      await initializeMedia(newMode);
    } catch (err) {
      console.error('Toggle camera error:', err);
      alert('Error switching camera: ' + err.message);
    }
  }, [facingMode, initializeMedia]);

  const toggleFlashlight = useCallback(async () => {
    if (!localStreamRef.current) {
      console.warn('No local stream to toggle flashlight');
      return;
    }
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) {
      console.warn('No video track found for flashlight');
      return;
    }
    
    try {
      // Some browsers don't support getCapabilities, so we check if it exists
      const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
      console.log('Track capabilities:', capabilities);

      if (capabilities.torch !== undefined) {
        const newFlashlightState = !isFlashlightOn;
        await videoTrack.applyConstraints({
          advanced: [{ torch: newFlashlightState }]
        });
        setIsFlashlightOn(newFlashlightState);
        console.log('Flashlight toggled to:', newFlashlightState);
      } else {
        alert('Flashlight (Torch) is not supported on this camera/device.');
        console.warn('Flashlight not supported on this device/camera.');
      }
    } catch (err) {
      console.error('Error toggling flashlight:', err);
      alert('Could not toggle flashlight: ' + err.message);
    }
  }, [isFlashlightOn]);

  const createPeerConnection = useCallback(() => {
    console.log('Creating RTCPeerConnection...');
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      // Only send if candidate is not null
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
        // Use the first stream to avoid assignment issues
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state change:', pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.warn('WebRTC Connection failed or disconnected. Attempting to notify UI...');
        setConnectionState('failed');
      }
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
      // Wait for local stream to be ready if it's still initializing
      let retryCount = 0;
      while (!localStreamRef.current && retryCount < 10) {
        console.log('Waiting for local stream before offer...');
        await new Promise(r => setTimeout(r, 200));
        retryCount++;
      }

      console.log('Starting WebRTC handshake...');
      const pc = peerConnectionRef.current || createPeerConnection();

      // Small delay (200ms) to allow tracks to attach and ICE to start
      await new Promise(r => setTimeout(r, 200));

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

  const replaceTrack = useCallback(async (newTrack) => {
    if (peerConnectionRef.current) {
      const pc = peerConnectionRef.current;
      const senders = pc.getSenders();
      const sender = senders.find(s => s.track && s.track.kind === newTrack.kind);
      if (sender) {
        console.log('Replacing track in PeerConnection:', newTrack.kind);
        try {
          await sender.replaceTrack(newTrack);
        } catch (err) {
          console.error('Track replacement failed:', err);
        }
      } else {
        console.warn('No sender found for track kind:', newTrack.kind);
      }
    }
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
    isFlashlightOn,
    replaceTrack
  };
};

export default useWebRTC;