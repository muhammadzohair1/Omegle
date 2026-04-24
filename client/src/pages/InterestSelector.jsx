import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Gamepad2, Coffee, Check, Save } from 'lucide-react';
import './InterestSelector.css';

const CATEGORIES = {
  Study: { icon: BookOpen, subOptions: ['Math', 'Science', 'History', 'Language', 'Computer Science', 'General Grade School', 'University'] },
  Gaming: { icon: Gamepad2, subOptions: ['FPS', 'MOBA', 'RPG', 'Casual', 'Minecraft', 'Roblox', 'League of Legends'] },
  Casual: { icon: Coffee, subOptions: ['Movies', 'Music', 'Anime', 'Sports', 'Memes', 'Just Chatting', 'Tech'] }
};

const InterestSelector = () => {
  const { currentUser, userInterests, refreshInterests } = useAuth();
  const navigate = useNavigate();
  
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubs, setSelectedSubs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userInterests) {
      setSelectedCategory(userInterests.category || '');
      setSelectedSubs(userInterests.subOptions || []);
    }
  }, [userInterests]);

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setSelectedSubs([]); // Reset subs when changing category
  };

  const toggleSubOption = (option) => {
    if (selectedSubs.includes(option)) {
      setSelectedSubs(selectedSubs.filter(sub => sub !== option));
    } else {
      if (selectedSubs.length < 3) {
        setSelectedSubs([...selectedSubs, option]);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedCategory) return;
    
    setLoading(true);
    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        interests: {
          category: selectedCategory,
          subOptions: selectedSubs
        },
        name: currentUser.displayName,
        email: currentUser.email,
        updatedAt: new Date()
      }, { merge: true });
      
      await refreshInterests();
      navigate('/chat');
    } catch (error) {
      console.error("Error saving interests:", error);
    }
    setLoading(false);
  };

  return (
    <div className="interest-container container animate-fade-in">
      <div className="interest-card glass-panel">
        <div className="interest-header">
          <h2>Select Your Interests</h2>
          <p>This helps us match you with the right people.</p>
        </div>

        <div className="section-title">Step 1: Choose a Category</div>
        <div className="category-grid">
          {Object.entries(CATEGORIES).map(([cat, { icon: Icon }]) => (
            <button
              key={cat}
              className={`category-card ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => handleCategorySelect(cat)}
            >
              <Icon size={32} className="cat-icon" />
              <span>{cat}</span>
              {selectedCategory === cat && <div className="active-glow"></div>}
            </button>
          ))}
        </div>

        {selectedCategory && (
          <div className="sub-options-section animate-fade-in">
            <div className="section-title">Step 2: Select specifics (Max 3)</div>
            <div className="tags-container">
              {CATEGORIES[selectedCategory].subOptions.map((sub) => {
                const isSelected = selectedSubs.includes(sub);
                return (
                  <button
                    key={sub}
                    className={`tag-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSubOption(sub)}
                  >
                    {isSelected && <Check size={14} />}
                    {sub}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="action-row">
          <button 
            className="btn-primary save-btn" 
            onClick={handleSave}
            disabled={!selectedCategory || loading}
          >
            {loading ? 'Saving...' : (
              <>
                <Save size={18} />
                Save & Continue
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterestSelector;
