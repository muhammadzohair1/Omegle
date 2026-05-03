import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Profile from './pages/Profile';
import InterestSelector from './pages/InterestSelector';
import SetupProfile from './pages/SetupProfile';
import Landing from './pages/Landing';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" />;
  return children;
};

// Require Profile Setup Wrapper
const RequireProfileSetupRoute = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  
  if (!currentUser) return <Navigate to="/login" />;
  
  // If profile is already set up, redirect to interests
  if (userProfile?.profileSetupComplete || userProfile?.username) {
    return <Navigate to="/interests" />;
  }
  
  return children;
};

// Require Interests Route Wrapper
const RequireInterestsRoute = ({ children }) => {
  const { currentUser, userProfile, userInterests } = useAuth();
  
  if (!currentUser) return <Navigate to="/login" />;
  
  // Enforce profile setup first
  if (!userProfile?.profileSetupComplete && !userProfile?.username) {
    return <Navigate to="/setup-profile" />;
  }
  
  if (!userInterests) return <Navigate to="/interests" />;
  
  return children;
};

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        
        <Route path="/setup-profile" element={
          <RequireProfileSetupRoute>
            <SetupProfile />
          </RequireProfileSetupRoute>
        } />

        <Route path="/interests" element={
          <ProtectedRoute>
            {/* If profile not setup, we should probably redirect here too, 
                but RequireInterestsRoute handles it for /chat. 
                Let's make sure /interests also requires profile. */}
            <InterestSelectorWrapper />
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        
        <Route path="/chat" element={
          <RequireInterestsRoute>
            <ErrorBoundary>
              <Chat />
            </ErrorBoundary>
          </RequireInterestsRoute>
        } />

        <Route path="/admin" element={<Admin />} />
        

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  );
}

// Extra wrapper for InterestSelector to ensure profile is setup
const InterestSelectorWrapper = () => {
  const { userProfile } = useAuth();
  if (!userProfile?.profileSetupComplete && !userProfile?.username) {
    return <Navigate to="/setup-profile" />;
  }
  return <InterestSelector />;
};

function App() {
  return (
    <Router>
      <div className="page-wrapper">
        <Navbar />
        <div className="main-content">
          <AnimatedRoutes />
        </div>
      </div>
    </Router>
  );
}

export default App;
