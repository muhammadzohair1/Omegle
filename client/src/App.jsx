import React from 'react'; // deploy fix
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import InterestSelector from './pages/InterestSelector';
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

// Require Interests Route Wrapper
const RequireInterestsRoute = ({ children }) => {
  const { currentUser, userInterests } = useAuth();
  
  if (!currentUser) return <Navigate to="/login" />;
  if (!userInterests) return <Navigate to="/interests" />;
  
  return children;
};

function App() {
  return (
    <Router>
      <div className="page-wrapper">
        <Navbar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            
            <Route path="/interests" element={
              <ProtectedRoute>
                <InterestSelector />
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
        </div>
      </div>
    </Router>
  );
}

export default App;
