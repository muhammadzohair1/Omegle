import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userInterests, setUserInterests] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if user is banned
        const banRef = doc(db, "banned", user.uid);
        const banSnap = await getDoc(banRef);
        if (banSnap.exists()) {
          alert("Your account has been banned for violating safety policies.");
          auth.signOut();
          setCurrentUser(null);
          setLoading(false);
          return;
        }

        setCurrentUser(user);
        // Fetch user interests
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserInterests(docSnap.data().interests);
        } else {
          setUserInterests(null);
        }
      } else {
        setCurrentUser(null);
        setUserInterests(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshInterests = async () => {
    if (currentUser) {
      const docRef = doc(db, "users", currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserInterests(docSnap.data().interests);
      }
    }
  };

  const value = {
    currentUser,
    userInterests,
    refreshInterests
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
