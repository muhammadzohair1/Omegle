import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, provider, db } from '../firebase';
import { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  MessageSquare, Mail, Lock, User, LogIn, UserPlus, 
  Phone, Smartphone, ShieldCheck, Key, RefreshCw, ChevronLeft 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AuthError from '../components/AuthError';
import { mapAuthCodeToMessage } from '../utils/authUtils';
import './Login.css';

const Login = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Auth Modes: 'login', 'signup', 'forgot', 'phone', 'mfa'
  const [mode, setMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState(null);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // MFA State
  const [mfaResolver, setMfaResolver] = useState(null);
  const [mfaInfo, setMfaInfo] = useState(null);

  const recaptchaRef = useRef(null);
  const recaptchaVerifier = useRef(null);

  if (currentUser) {
    return <Navigate to="/interests" />;
  }

  const handleAuthError = (err) => {
    console.error('Auth Error:', err);
    if (err.code === 'auth/multi-factor-auth-required') {
      const resolver = getMultiFactorResolver(auth, err);
      setMfaResolver(resolver);
      setMfaInfo(resolver.hints[0]);
      setMode('mfa');
      sendMfaCode(resolver);
      return;
    }
    setError(mapAuthCodeToMessage(err.code));
  };

  const createUserProfile = async (user, additionalData = {}) => {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const { email, displayName, photoURL, uid } = user;
      try {
        await setDoc(userRef, {
          uid,
          displayName: additionalData.displayName || displayName || 'Anonymous Stranger',
          email: email || '',
          photoURL: photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
          bio: 'Hey there! I am using SmartChat.',
          createdAt: serverTimestamp(),
          interests: { category: 'Casual', subOptions: [] },
          ...additionalData
        });
      } catch (err) {
        console.error('Error creating user profile', err);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        await createUserProfile(result.user);
        navigate('/interests');
      }
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        await createUserProfile(result.user, { displayName });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/interests');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg('Password reset link sent to your email!');
      setTimeout(() => setMode('login'), 3000);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const initRecaptcha = () => {
    if (!recaptchaVerifier.current) {
      recaptchaVerifier.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => console.log('Recaptcha resolved')
      });
    }
  };

  const handlePhoneSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      initRecaptcha();
      const verifier = recaptchaVerifier.current;
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setVerificationId(confirmationResult);
      setSuccessMsg('OTP sent to your phone!');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await verificationId.confirm(otp);
      await createUserProfile(result.user);
      navigate('/interests');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const sendMfaCode = async (resolver) => {
    try {
      initRecaptcha();
      const phoneInfoOptions = {
        multiFactorHint: resolver.hints[0],
        session: resolver.session
      };
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const mfaVerificationId = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, recaptchaVerifier.current);
      setVerificationId(mfaVerificationId);
    } catch (err) {
      handleAuthError(err);
    }
  };

  const verifyMfa = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = PhoneAuthProvider.credential(verificationId, otp);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      await mfaResolver.resolveSignIn(multiFactorAssertion);
      navigate('/interests');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    switch (mode) {
      case 'signup':
        return (
          <form onSubmit={handleEmailAuth} className="auth-form">
            <div className={`input-group ${error && !displayName ? 'error-border' : ''}`}>
              <User size={20} />
              <input type="text" placeholder="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className={`input-group ${error && !email ? 'error-border' : ''}`}>
              <Mail size={20} />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className={`input-group ${error ? 'error-border' : ''}`}>
              <Lock size={20} />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              type="submit" 
              className="primary-btn" 
              disabled={loading}
            >
              {loading ? <RefreshCw className="animate-spin" /> : 'Create Account'}
              <UserPlus size={20} />
            </motion.button>
          </form>
        );
      case 'forgot':
        return (
          <form onSubmit={handleForgotPassword} className="auth-form">
            <p className="text-slate-400 text-sm mb-4">Enter your email and we'll send you a link to reset your password.</p>
            <div className="input-group">
              <Mail size={20} />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              type="submit" 
              className="primary-btn" 
              disabled={loading}
            >
              {loading ? <RefreshCw className="animate-spin" /> : 'Send Reset Link'}
              <Key size={20} />
            </motion.button>
          </form>
        );
      case 'phone':
        return (
          <form onSubmit={verificationId ? verifyOtp : handlePhoneSignIn} className="auth-form">
            <div className="input-group">
              {verificationId ? <Key size={20} /> : <Phone size={20} />}
              <input 
                type={verificationId ? "text" : "tel"} 
                placeholder={verificationId ? "Enter OTP" : "+1234567890"} 
                value={verificationId ? otp : phoneNumber} 
                onChange={(e) => verificationId ? setOtp(e.target.value) : setPhoneNumber(e.target.value)} 
                required 
              />
            </div>
            <div id="recaptcha-container"></div>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              type="submit" 
              className="primary-btn" 
              disabled={loading}
            >
              {loading ? <RefreshCw className="animate-spin" /> : (verificationId ? 'Verify OTP' : 'Send OTP')}
              <Smartphone size={20} />
            </motion.button>
          </form>
        );
      case 'mfa':
        return (
          <form onSubmit={verifyMfa} className="auth-form">
            <p className="text-cyan-neon text-sm font-bold mb-4">Two-Step Verification Required</p>
            <p className="text-slate-400 text-xs mb-4">We've sent a code to your registered device ending in {mfaInfo?.phoneNumber?.slice(-4)}</p>
            <div className="input-group">
              <ShieldCheck size={20} />
              <input type="text" placeholder="Verification Code" value={otp} onChange={(e) => setOtp(e.target.value)} required />
            </div>
            <div id="recaptcha-container"></div>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              type="submit" 
              className="primary-btn" 
              disabled={loading}
            >
              {loading ? <RefreshCw className="animate-spin" /> : 'Confirm Identity'}
              <Lock size={20} />
            </motion.button>
          </form>
        );
      default: // login
        return (
          <form onSubmit={handleEmailAuth} className="auth-form">
            <div className={`input-group ${error ? 'error-border' : ''}`}>
              <Mail size={20} />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className={`input-group ${error ? 'error-border' : ''}`}>
              <Lock size={20} />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex justify-end mb-2">
              <button type="button" onClick={() => setMode('forgot')} className="text-xs text-slate-500 hover:text-cyan-neon transition-colors">Forgot Password?</button>
            </div>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              type="submit" 
              className="primary-btn" 
              disabled={loading}
            >
              {loading ? <RefreshCw className="animate-spin" /> : 'Sign In'}
              <LogIn size={20} />
            </motion.button>
          </form>
        );
    }
  };

  return (
    <div className="login-container relative">
      {/* High-tech grid background overlay */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="login-card glass-panel relative z-10 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-neon to-transparent opacity-50"></div>
        
        {mode !== 'login' && mode !== 'signup' && (
          <button onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); setVerificationId(null); }} className="absolute top-6 left-6 text-slate-500 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
        )}

        <div className="brand">
          <motion.div animate={{ rotateY: [0, 180, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
            <MessageSquare size={48} className="brand-icon mx-auto" />
          </motion.div>
          <h1 className="tracking-tighter">SmartChat</h1>
          <p className="uppercase tracking-widest text-[10px] text-cyan-neon font-bold">Secure Neural Link</p>
        </div>

        <AuthError message={error} clearError={() => setError('')} />
        {successMsg && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-green-400 text-sm mb-4 font-medium">{successMsg}</motion.p>}

        <AnimatePresence mode="wait">
          <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
            {renderForm()}
          </motion.div>
        </AnimatePresence>

        {mode === 'login' && (
          <>
            <div className="divider"><span>OR</span></div>
            <div className="flex gap-4 mb-8">
              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                className="social-btn" 
                onClick={handleGoogleSignIn}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                <span>Google</span>
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                className="social-btn" 
                onClick={() => setMode('phone')}
              >
                <Smartphone size={18} className="text-cyan-neon" />
                <span>Phone</span>
              </motion.button>
            </div>
          </>
        )}

        <p className="toggle-auth">
          {mode === 'signup' ? 'Registered already?' : "New identity required?"}{' '}
          <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }} className="toggle-btn">
            {mode === 'signup' ? 'Access Portal' : 'Initialize Account'}
          </button>
        </p>
      </motion.div>

    </div>
  );
};

export default Login;
