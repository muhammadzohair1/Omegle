import React, { useState, useRef } from 'react';
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
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import AuthError from '../components/AuthError';
import { mapAuthCodeToMessage } from '../utils/authUtils';
import './Login.css';

// STABLE SUB-COMPONENTS (DEFINED OUTSIDE)
const MagneticButton = ({ children, className, onClick, disabled, type = "button", whileTap = { scale: 0.96 } }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseX = useSpring(x, { stiffness: 150, damping: 15 });
  const mouseY = useSpring(y, { stiffness: 150, damping: 15 });

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.2);
    y.set((e.clientY - centerY) * 0.4);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: mouseX, y: mouseY }}
      whileHover={{ scale: 1.02 }}
      whileTap={whileTap}
    >
      {children}
    </motion.button>
  );
};

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
  
  const [mfaResolver, setMfaResolver] = useState(null);
  const [mfaInfo, setMfaInfo] = useState(null);

  const recaptchaVerifier = useRef(null);

  if (currentUser) return <Navigate to="/interests" />;

  const springConfig = { type: "spring", stiffness: 300, damping: 30 };

  const containerVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { 
        staggerChildren: 0.1, 
        delayChildren: 0.2,
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    },
    exit: { 
      opacity: 0, 
      y: -20, 
      scale: 0.98,
      transition: { duration: 0.3, ease: "easeInOut" } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: springConfig }
  };

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
        // We will update redirect logic later to /setup-profile
        navigate('/setup-profile');
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
      // We will update redirect logic later to /setup-profile
      navigate('/setup-profile');
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
      setSuccessMsg('Reset link sent! Check your inbox.');
      setTimeout(() => {
        setSuccessMsg('');
        setMode('login');
      }, 3000);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const initRecaptcha = () => {
    if (!recaptchaVerifier.current) {
      recaptchaVerifier.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
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
      navigate('/setup-profile');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const sendMfaCode = async (resolver) => {
    try {
      initRecaptcha();
      const phoneInfoOptions = { multiFactorHint: resolver.hints[0], session: resolver.session };
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
      navigate('/setup-profile');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={containerVariants}
      className="login-container relative"
    >
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none"></div>
      
      <motion.div 
        layout
        className="login-card"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ffff] to-transparent opacity-20"></div>
        
        {/* Navigation / Back Button */}
        {(mode !== 'login' && mode !== 'signup') && (
          <motion.button 
            variants={itemVariants} 
            onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); setVerificationId(null); }} 
            className="absolute top-8 left-8 text-slate-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </motion.button>
        )}

        <motion.div variants={itemVariants} className="brand">
          <motion.div animate={{ rotateY: [0, 180, 360] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>
            <MessageSquare size={54} className="brand-icon mx-auto" />
          </motion.div>
          <h1>SmartChat</h1>
          <p>Secure Neural Link</p>
        </motion.div>

        <motion.div layout>
          <AuthError message={error} clearError={() => setError('')} />
        </motion.div>
        
        {successMsg && (
          <motion.p layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-green-400 text-sm mb-6 font-medium">
            {successMsg}
          </motion.p>
        )}

        {/* STABLE CONDITIONAL RENDERING BLOCK */}
        <AnimatePresence mode="wait">
          {mode === 'login' && (
            <motion.form 
              key="login-form"
              onSubmit={handleEmailAuth}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={springConfig}
              className="auth-form"
            >
              <div className="input-group">
                <Mail size={20} />
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="input-group">
                <Lock size={20} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => setMode('forgot')} className="text-xs text-slate-500 hover:text-[#00ffff] transition-colors mb-2">Forgot Password?</button>
              </div>
              <MagneticButton type="submit" className="primary-btn" disabled={loading}>
                {loading ? <RefreshCw className="loading-spinner" /> : <span className="flex items-center gap-2">Sign In <LogIn size={20} /></span>}
              </MagneticButton>
            </motion.form>
          )}

          {mode === 'signup' && (
            <motion.form 
              key="signup-form"
              onSubmit={handleEmailAuth}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={springConfig}
              className="auth-form"
            >
              <div className="input-group">
                <User size={20} />
                <input type="text" placeholder="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
              <div className="input-group">
                <Mail size={20} />
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="input-group">
                <Lock size={20} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <MagneticButton type="submit" className="primary-btn" disabled={loading}>
                {loading ? <RefreshCw className="loading-spinner" /> : <span className="flex items-center gap-2">Create Account <UserPlus size={20} /></span>}
              </MagneticButton>
            </motion.form>
          )}

          {mode === 'forgot' && (
            <motion.form 
              key="forgot-form"
              onSubmit={handleForgotPassword}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={springConfig}
              className="auth-form"
            >
              <p className="text-slate-400 text-sm mb-4">Enter your email for a reset link.</p>
              <div className="input-group">
                <Mail size={20} />
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <MagneticButton type="submit" className="primary-btn" disabled={loading}>
                {loading ? <RefreshCw className="loading-spinner" /> : <span className="flex items-center gap-2">Send Reset Link <Key size={20} /></span>}
              </MagneticButton>
            </motion.form>
          )}

          {mode === 'phone' && (
            <motion.form 
              key="phone-form"
              onSubmit={verificationId ? verifyOtp : handlePhoneSignIn}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={springConfig}
              className="auth-form"
            >
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
              <MagneticButton type="submit" className="primary-btn" disabled={loading}>
                {loading ? <RefreshCw className="loading-spinner" /> : <span className="flex items-center gap-2">{verificationId ? 'Verify OTP' : 'Send OTP'} <Smartphone size={20} /></span>}
              </MagneticButton>
            </motion.form>
          )}

          {mode === 'mfa' && (
            <motion.form 
              key="mfa-form"
              onSubmit={verifyMfa}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={springConfig}
              className="auth-form"
            >
              <p className="text-cyan-neon text-sm font-bold mb-4">Two-Step Verification Required</p>
              <p className="text-slate-400 text-xs mb-4">Code sent to device ending in {mfaInfo?.phoneNumber?.slice(-4)}</p>
              <div className="input-group">
                <ShieldCheck size={20} />
                <input type="text" placeholder="Verification Code" value={otp} onChange={(e) => setOtp(e.target.value)} required />
              </div>
              <div id="recaptcha-container"></div>
              <MagneticButton type="submit" className="primary-btn" disabled={loading}>
                {loading ? <RefreshCw className="loading-spinner" /> : <span className="flex items-center gap-2">Confirm Identity <Lock size={20} /></span>}
              </MagneticButton>
            </motion.form>
          )}
        </AnimatePresence>

        {/* SOCIAL BUTTONS / FOOTER */}
        {mode === 'login' && (
          <motion.div variants={itemVariants} layout>
            <div className="divider"><span>OR</span></div>
            <div className="flex gap-4 mb-2">
              <MagneticButton className="social-btn" onClick={handleGoogleSignIn}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                <span>Google</span>
              </MagneticButton>
              <MagneticButton className="social-btn" onClick={() => setMode('phone')}>
                <Smartphone size={20} className="text-[#00ffff]" />
                <span>Phone</span>
              </MagneticButton>
            </div>
          </motion.div>
        )}

        <motion.p variants={itemVariants} layout className="toggle-auth">
          {mode === 'signup' ? 'Registered already?' : "New identity required?"}{' '}
          <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setSuccessMsg(''); }} className="toggle-btn">
            {mode === 'signup' ? 'Access Portal' : 'Initialize Account'}
          </button>
        </motion.p>
      </motion.div>
    </motion.div>
  );
};

export default Login;
