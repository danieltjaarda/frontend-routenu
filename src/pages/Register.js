import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { sendRegistrationWebhook } from '../services/userData';
import './Auth.css';

const MAPBOX_PUBLIC_TOKEN = process.env.REACT_APP_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhmanp5MDB4ajNncjB1YXJrMDc2cSJ9.5CYl4ZfCROi-pmyaNzETIg';

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    startAddress: '',
    startCoordinates: null
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef(null);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const searchAddresses = async (query) => {
    if (!query || query.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_PUBLIC_TOKEN}&` +
        `country=nl&` +
        `limit=5&` +
        `proximity=5.2913,52.1326`
      );

      if (!response.ok) throw new Error('Geocoding mislukt');

      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        setSuggestions(data.features);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddressSearch = (value) => {
    setFormData(prev => ({ ...prev, startAddress: value }));
    setShowSuggestions(true);
    
    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce de zoekopdracht (300ms vertraging)
    debounceTimerRef.current = setTimeout(() => {
      searchAddresses(value);
    }, 300);
  };

  const handleSelectSuggestion = (feature) => {
    setFormData(prev => ({
      ...prev,
      startAddress: feature.place_name,
      startCoordinates: feature.center
    }));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      return setError('Wachtwoorden komen niet overeen');
    }

    if (formData.password.length < 6) {
      return setError('Wachtwoord moet minimaal 6 tekens lang zijn');
    }

    if (!formData.startAddress.trim() || !formData.startCoordinates) {
      return setError('Vul een geldig startpunt adres in');
    }

    try {
      setError('');
      setLoading(true);
      console.log('Starting registration...', { email: formData.email, name: formData.name });
      const { data: authData, smtpWarning } = await signup(formData.email, formData.password, formData.name);
      
      console.log('Signup completed:', { 
        hasAuthData: !!authData, 
        hasUser: !!(authData && authData.user),
        userId: authData?.user?.id,
        smtpWarning 
      });
      
      // Send registration webhook with all user information
      // Always send webhook if registration was successful, even if user object is not immediately available
      console.log('Preparing to send registration webhook...');
      try {
        // Get user ID from authData if available, otherwise use email as identifier
        const userId = authData?.user?.id || authData?.user?.id || null;
        
        const webhookData = {
          userId: userId,
          id: userId,
          name: formData.name,
          displayName: formData.name,
          email: formData.email,
          phone: formData.phone,
          startAddress: formData.startAddress,
          startCoordinates: formData.startCoordinates,
          registrationDate: new Date().toISOString()
        };
        
        console.log('Calling sendRegistrationWebhook with data:', webhookData);
        // Don't await - send in background so it doesn't block registration
        sendRegistrationWebhook(webhookData).then(() => {
          console.log('Registration webhook call completed');
        }).catch((webhookError) => {
          console.error('Failed to send registration webhook:', webhookError);
        });
      } catch (webhookError) {
        // Log but don't fail registration if webhook fails
        console.error('Error preparing registration webhook:', webhookError);
      }
      
      // Show warning if SMTP issue occurred but user was created
      if (smtpWarning) {
        setError('⚠️ Er is een probleem met de e-mail configuratie. Je account is aangemaakt, maar de bevestigingsmail kan niet worden verzonden. Je kunt proberen in te loggen.');
      }
      
      // Save startpoint if user was created and we have startpoint data
      if (authData?.user?.id && formData.startAddress && formData.startCoordinates) {
        try {
          const { supabase } = await import('../lib/supabase');
          await supabase.from('user_profiles').upsert({
            user_id: authData.user.id,
            start_address: formData.startAddress,
            start_coordinates: formData.startCoordinates,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });
        } catch (profileError) {
          console.error('Error saving startpoint:', profileError);
          // Don't fail registration if profile save fails
        }
      }
      
      // Navigate to onboarding page after successful registration
      navigate('/onboarding');
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        startAddress: '',
        startCoordinates: null
      });
    } catch (err) {
      setError(err.message || 'Registreren mislukt. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="trial-banner">
          <div className="confetti-container">
            <div className="confetti"></div>
            <div className="confetti"></div>
            <div className="confetti"></div>
            <div className="confetti"></div>
            <div className="confetti"></div>
          </div>
          <span className="trial-emoji">🎉</span>
          <span className="trial-text">Eerste 3 dagen gratis, daarna €29/maand</span>
          <span className="trial-emoji">🎉</span>
        </div>

        <div className="auth-header">
          <img src="/logo.png" alt="RouteNu" className="auth-logo" />
          <h1>Account aanmaken</h1>
          <p>Maak een nieuw RouteNu account aan</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Volledige naam</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Jan Jansen"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">E-mailadres</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="jouw@email.nl"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Telefoonnummer</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="0612345678"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Wachtwoord</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              disabled={loading}
              minLength={6}
            />
            <small>Minimaal 6 tekens</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Bevestig wachtwoord</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="startAddress">Startpunt adres *</label>
            <div className="address-input-wrapper">
              <input
                type="text"
                id="startAddress"
                name="startAddress"
                className="address-input"
                value={formData.startAddress}
                onChange={(e) => handleAddressSearch(e.target.value)}
                onFocus={() => {
                  if (formData.startAddress.length >= 1 && suggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Bijv. Dam 1, Amsterdam"
                required
                disabled={loading}
              />
              {isSearching && <div className="search-spinner">...</div>}
              {showSuggestions && suggestions.length > 0 && (
                <div className="autocomplete-suggestions">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="suggestion-item"
                      onClick={() => handleSelectSuggestion(suggestion)}
                    >
                      {suggestion.place_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <small className="form-hint">Dit startpunt wordt standaard gebruikt bij elke route</small>
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Account aanmaken...' : 'Account aanmaken'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Al een account?{' '}
            <Link to="/login" className="auth-link">
              Log hier in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;

