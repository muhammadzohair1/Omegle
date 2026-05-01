import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, auth } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  deleteUser, 
  updateProfile as updateAuthProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier
} from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Calendar, Edit3, Trash2, Save, X, 
  ArrowLeft, Shield, Lock, Smartphone, ShieldCheck, RefreshCw 
} from 'lucide-react';
import './Profile.css';

const Profile = () => {
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  
  // Security States
  const [showSecurity, setShowSecurity] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [mfaPhone, setMfaPhone] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [verificationId, setVerificationId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.bio || '');
    }
  }, [userProfile]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, { displayName, bio });
      await updateAuthProfile(currentUser, { displayName });
      await refreshProfile();
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await updatePassword(currentUser, newPassword);
      setSuccess('Password updated successfully!');
      setNewPassword('');
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const initRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-profile', {
        size: 'invisible'
      });
    }
  };

  const enrollMfa = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      initRecaptcha();
      const session = await multiFactor(currentUser).getSession();
      const phoneInfoOptions = {
        phoneNumber: mfaPhone,
        session: session
      };
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const vId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, window.recaptchaVerifier);
      setVerificationId(vId);
      setSuccess('Verification code sent!');
    } catch (err) {
      setError('MFA Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmMfa = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = PhoneAuthProvider.credential(verificationId, mfaCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      await multiFactor(currentUser).enroll(multiFactorAssertion, 'My Personal Phone');
      setSuccess('MFA Enrolled Successfully!');
      setVerificationId(null);
      setMfaPhone('');
      setMfaCode('');
    } catch (err) {
      setError('Verification Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const unenrollMfa = async (factor) => {
    if (window.confirm('Disable 2-Step Verification?')) {
      setLoading(true);
      try {
        await multiFactor(currentUser).unenroll(factor);
        setSuccess('MFA Disabled.');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteAccount = async () => {
    const confirm = window.confirm("Permanently delete account? This cannot be undone.");
    if (confirm) {
      setLoading(true);
      try {
        await deleteDoc(doc(db, 'users', currentUser.uid));
        await deleteUser(currentUser);
        navigate('/login');
      } catch (err) {
        setError('Error: ' + err.message + '. Please re-login to delete account.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (!userProfile) return <div className="loading-screen"><RefreshCw className="animate-spin text-cyan-neon" /></div>;

  return (
    <div className="profile-page h-[100dvh] overflow-y-auto">
      <div className="profile-container py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="profile-card glass-panel relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-neon to-transparent opacity-30"></div>
          
          <div className="profile-header">
            <button onClick={() => navigate(-1)} className="back-btn"><ArrowLeft size={20} /></button>
            <h2 className="uppercase tracking-[0.2em] text-xs font-black text-cyan-neon">Neural Identity Terminal</h2>
            <button onClick={() => setShowSecurity(!showSecurity)} className={`p-2 rounded-lg transition-all ${showSecurity ? 'bg-cyan-neon text-black' : 'bg-white/5 text-slate-400'}`}>
              <Shield size={20} />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {!showSecurity ? (
              <motion.div key="profile" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="profile-avatar-section">
                  <div className="avatar-wrapper">
                    <img src={userProfile.photoURL} alt="Avatar" className="rounded-2xl border-2 border-cyan-neon/30 shadow-neon-cyan" />
                    <div className="online-indicator"></div>
                  </div>
                  <div className="profile-main-info">
                    {isEditing ? (
                      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="edit-input" placeholder="Display Name" />
                    ) : (
                      <h3 className="text-2xl font-black tracking-tight">{userProfile.displayName}</h3>
                    )}
                    <p className="user-email text-slate-500 font-mono text-xs">{currentUser.email}</p>
                  </div>
                </div>

                <div className="detail-section mt-6">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bio / Identification</label>
                  {isEditing ? (
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="edit-textarea" placeholder="Identify yourself..." />
                  ) : (
                    <p className="bio-text italic text-slate-300">"{userProfile.bio || 'No status signal.'}"</p>
                  )}
                </div>

                <div className="info-grid mt-8">
                  <div className="info-item bg-white/5 border border-white/10 p-4 rounded-xl">
                    <Calendar size={18} className="text-cyan-neon" />
                    <div><span className="text-[10px] text-slate-500 uppercase">Created</span><p className="text-xs font-bold">{userProfile.createdAt?.toDate().toLocaleDateString()}</p></div>
                  </div>
                  <div className="info-item bg-white/5 border border-white/10 p-4 rounded-xl">
                    <ShieldCheck size={18} className="text-green-500" />
                    <div><span className="text-[10px] text-slate-500 uppercase">Status</span><p className="text-xs font-bold text-green-400">Authenticated</p></div>
                  </div>
                </div>

                <div className="mt-10 flex gap-4">
                  {isEditing ? (
                    <button onClick={handleUpdate} className="flex-1 save-btn py-4 rounded-xl font-bold uppercase tracking-widest text-xs" disabled={loading}>
                      <Save size={18} /> {loading ? 'Syncing...' : 'Save Profile'}
                    </button>
                  ) : (
                    <button onClick={() => setIsEditing(true)} className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all">
                      <Edit3 size={18} /> Modify Signal
                    </button>
                  )}
                  <button onClick={handleDeleteAccount} className="p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="space-y-8">
                  {/* Password Section */}
                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <h4 className="flex items-center gap-2 text-sm font-bold mb-4"><Lock size={16} className="text-cyan-neon" /> Change Password</h4>
                    <form onSubmit={handlePasswordChange} className="flex gap-2">
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" className="flex-1 bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:border-cyan-neon outline-none" required />
                      <button type="submit" className="px-4 bg-cyan-neon text-black rounded-lg font-bold text-xs uppercase" disabled={loading}>Update</button>
                    </form>
                  </div>

                  {/* MFA Section */}
                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                    <h4 className="flex items-center gap-2 text-sm font-bold mb-2"><Smartphone size={16} className="text-cyan-neon" /> Multi-Factor Auth</h4>
                    <p className="text-[10px] text-slate-500 mb-4 uppercase tracking-wider">Secure your account with 2FA</p>
                    
                    {multiFactor(currentUser).enrolledFactors.length > 0 ? (
                      <div className="space-y-4">
                        {multiFactor(currentUser).enrolledFactors.map(factor => (
                          <div key={factor.uid} className="flex items-center justify-between p-3 bg-cyan-neon/5 border border-cyan-neon/20 rounded-xl">
                            <div className="flex items-center gap-3">
                              <ShieldCheck className="text-cyan-neon" size={16} />
                              <span className="text-xs font-mono">{factor.phoneNumber}</span>
                            </div>
                            <button onClick={() => unenrollMfa(factor)} className="text-red-500 hover:text-red-400"><X size={16} /></button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <form onSubmit={verificationId ? confirmMfa : enrollMfa} className="space-y-4">
                        <div className="flex gap-2">
                          <input type={verificationId ? "text" : "tel"} value={verificationId ? mfaCode : mfaPhone} onChange={(e) => verificationId ? setMfaCode(e.target.value) : setMfaPhone(e.target.value)} placeholder={verificationId ? "OTP Code" : "+1234567890"} className="flex-1 bg-black/40 border border-white/10 rounded-lg p-3 text-sm focus:border-cyan-neon outline-none" required />
                          <button type="submit" className="px-4 bg-white/10 border border-white/10 rounded-lg font-bold text-xs uppercase" disabled={loading}>
                            {verificationId ? 'Verify' : 'Enroll'}
                          </button>
                        </div>
                        <div id="recaptcha-container-profile"></div>
                      </form>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold text-center">{error}</div>}
          {success && <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl text-xs font-bold text-center">{success}</div>}
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
