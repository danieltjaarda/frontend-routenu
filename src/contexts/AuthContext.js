import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          display_name: displayName
        },
        emailRedirectTo: `${window.location.origin}/routes`
      }
    });

    // Handle SMTP/email configuration errors (500 errors) - user might still be created
    if (error && (error.status === 500 || error.message.includes('500') || error.message.includes('Internal Server Error'))) {
      // Check if user was actually created despite the error
      if (data && data.user) {
        // User was created, just SMTP issue - return success with a warning flag
        console.warn('User created but SMTP error occurred:', error);
        return { ...data, smtpWarning: true, smtpError: error };
      }
      // User not created, throw error
      throw new Error('Er is een probleem met de e-mail configuratie. Controleer je SMTP instellingen in Supabase. De registratie is mislukt.');
    }

    if (error) {
      // Better error messages for other errors
      let errorMessage = error.message;
      
      if (error.message.includes('already registered')) {
        errorMessage = 'Dit e-mailadres is al geregistreerd. Log in of gebruik een ander e-mailadres.';
      } else if (error.message.includes('invalid')) {
        errorMessage = 'Ongeldig e-mailadres. Controleer of het e-mailadres correct is.';
      } else if (error.message.includes('password')) {
        errorMessage = 'Wachtwoord moet minimaal 6 tekens lang zijn.';
      }
      
      console.error('Signup error:', error);
      throw new Error(errorMessage);
    }
    
    // Even if there's no error, check if user was created
    // Sometimes Supabase returns success but user might not be fully created yet
    if (!data || !data.user) {
      console.warn('Signup succeeded but no user data returned');
    }
    
    return data;
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error) {
      let errorMessage = error.message;
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Ongeldig e-mailadres of wachtwoord. Controleer je gegevens.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Je e-mailadres is nog niet bevestigd. Check je inbox.';
      }
      throw new Error(errorMessage);
    }
    return data;
  };

  const logout = async () => {
    try {
      // Check if there's an active session before signing out
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      // If no session, just clear the local state
      setCurrentUser(null);
    } catch (error) {
      // If signOut fails, still clear local state
      console.warn('Logout error (non-critical):', error);
      setCurrentUser(null);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    currentUser,
    signup,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
