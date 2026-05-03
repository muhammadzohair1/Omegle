import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate, Navigate } from 'react-router-dom';
import { User, Camera, Check, RefreshCw, UploadCloud, ChevronRight, AlertCircle } from 'lucide-react';
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
      reader.onloadend = () => setPreview(reader.result);
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
          const MAX_WIDTH = 500;
          if (width > MAX_WIDTH) {
            height = (MAX_WIDTH / width) * height;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas to Blob conversion failed')), 'image/jpeg', 0.7);
        };
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Neural ID (Username) is required');
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

      const profileData = {
        uid: currentUser.uid,
        username: username.trim(),
        displayName: username.trim(),
        photoURL,
        bio: 'Hey there! I am using SmartChat.',
        createdAt: serverTimestamp(),
        interests: { category: 'Casual', subOptions: [] },
        profileSetupComplete: true
      };

      await setDoc(doc(db, 'users', currentUser.uid), profileData);
      console.log("Profile Saved!");
      
      await refreshProfile();
      setSuccess(true);
      
      setTimeout(() => {
        window.location.href = '/chat';
      }, 1000);
    } catch (err) {
      console.error('Error setting up profile:', err);
      setError('Neural Link Failed: Could not save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="setup-container">
      <div className="setup-glass-card">
        <div className="setup-header">
          <div className="setup-icon-wrapper"><User size={32} /></div>
          <h1>Initialize Identity</h1>
          <p>Configure your neural profile for the network.</p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="avatar-section">
            <div className="avatar-picker" onClick={() => fileInputRef.current.click()}>
              {preview ? <img src={preview} alt="Preview" /> : <Camera size={40} />}
              <div className="overlay"><UploadCloud size={20} /></div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
            <p>Upload Neural Signature</p>
          </div>

          <div className={`input-container ${error ? 'invalid' : ''}`}>
            <label>Network Name</label>
            <div className="input-box">
              <User size={18} className="icon" />
              <input 
                type="text" 
                placeholder="Enter unique ID..." 
                value={username} 
                onChange={(e) => { setUsername(e.target.value); if (error) setError(''); }}
                maxLength={20}
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: [0, -5, 5, 0] }} exit={{ opacity: 0 }} className="error-bubble">
                <AlertCircle size={16} /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" className={`submit-btn ${success ? 'success' : ''}`} disabled={loading || success}>
            {loading ? <RefreshCw className="animate-spin" size={20} /> : success ? <Check size={20} /> : "Initialize Profile"}
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default SetupProfile;
