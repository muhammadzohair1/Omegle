import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage, auth } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Camera, Check, RefreshCw, UploadCloud, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './SetupProfile.css';

const SetupProfile = () => {
  const { currentUser, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  // Redirect if not logged in
  if (!currentUser) return <Navigate to="/login" />;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize to max 500px width
          const MAX_WIDTH = 500;
          if (width > MAX_WIDTH) {
            height = (MAX_WIDTH / width) * height;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          }, 'image/jpeg', 0.7); // Quality 0.7
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let photoURL = currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`;

      if (image) {
        const compressedBlob = await compressImage(image);
        const storageRef = ref(storage, `profiles/${currentUser.uid}`);
        await uploadBytes(storageRef, compressedBlob);
        photoURL = await getDownloadURL(storageRef);
      }

      await setDoc(doc(db, 'users', currentUser.uid), {
        uid: currentUser.uid,
        username: username.trim(),
        displayName: username.trim(),
        photoURL,
        bio: 'Hey there! I am using SmartChat.',
        createdAt: serverTimestamp(),
        interests: { category: 'Casual', subOptions: [] },
        profileSetupComplete: true
      });

      await refreshProfile();
      setSuccess(true);
      setTimeout(() => {
        navigate('/interests');
      }, 2000);
    } catch (err) {
      console.error('Error setting up profile:', err);
      setError('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="setup-container"
    >
      <div className="setup-glass-card">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="setup-header"
        >
          <div className="setup-icon-wrapper">
            <User size={32} className="setup-icon" />
          </div>
          <h1>Initialize Identity</h1>
          <p>Configure your neural profile for the network.</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="avatar-upload-section">
            <div 
              className="avatar-preview-container"
              onClick={() => fileInputRef.current.click()}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="avatar-preview" />
              ) : (
                <div className="avatar-placeholder">
                  <Camera size={40} className="text-slate-500" />
                </div>
              )}
              <div className="avatar-overlay">
                <UploadCloud size={20} />
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageChange} 
              accept="image/*" 
              className="hidden" 
            />
            <p className="text-xs text-slate-500 mt-2">Tap to upload profile picture</p>
          </div>

          <div className="setup-input-group">
            <label htmlFor="username">Network Name</label>
            <div className="input-wrapper">
              <User size={18} className="input-icon" />
              <input 
                id="username"
                type="text" 
                placeholder="Enter username..." 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="setup-error"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button 
            type="submit" 
            className={`setup-submit-btn ${success ? 'success' : ''}`}
            disabled={loading || success}
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={20} />
            ) : success ? (
              <span className="flex items-center gap-2">Success <Check size={20} /></span>
            ) : (
              <span className="flex items-center gap-2">Initialize Profile <ChevronRight size={20} /></span>
            )}
          </button>
        </form>
      </div>

      {/* Decorative background elements */}
      <div className="setup-bg-glow top-right"></div>
      <div className="setup-bg-glow bottom-left"></div>
    </motion.div>
  );
};

export default SetupProfile;
