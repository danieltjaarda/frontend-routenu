import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import MonthlyCostsManager from '../components/MonthlyCostsManager';
import './Profile.css';

const MAPBOX_PUBLIC_TOKEN = process.env.REACT_APP_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhmanp5MDB4ajNncjB1YXJrMDc2cSJ9.5CYl4ZfCROi-pmyaNzETIg';

function Profile() {
  const { currentUser, logout } = useAuth();
  const [startAddress, setStartAddress] = useState('');
  const [startCoordinates, setStartCoordinates] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const debounceTimerRef = useRef(null);
  const addressInputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    loadProfile();
  }, [currentUser]);

  const loadProfile = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading profile:', error);
      } else if (data) {
        setStartAddress(data.start_address || '');
        setStartCoordinates(data.start_coordinates || null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
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
        setSelectedSuggestionIndex(-1);
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
    setStartAddress(value);
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
    setStartAddress(feature.place_name);
    setStartCoordinates(feature.center);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);


  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!startAddress.trim() || !startCoordinates) {
      setMessage('Vul een geldig startpunt in');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();

      const profileData = {
        user_id: currentUser.id,
        start_address: startAddress,
        start_coordinates: startCoordinates,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        // Update existing profile
        const { error } = await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('user_id', currentUser.id);

        if (error) throw error;
      } else {
        // Insert new profile
        const { error } = await supabase
          .from('user_profiles')
          .insert({
            ...profileData,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      setMessage('Startpunt opgeslagen!');
      setTimeout(() => setMessage(''), 3000);
      
      // After saving startpoint, redirect to routes page
      setTimeout(() => {
        window.location.href = '/routes';
      }, 1500);
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage('Fout bij opslaan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="profile-page">Laden...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Instellingen</h1>
        <button className="logout-btn" onClick={logout}>
          Uitloggen
        </button>
      </div>

      <div className="profile-content">
        <div className="settings-section">
          <h2>Startpunt</h2>
          <p className="settings-description">
            Dit startpunt wordt standaard gebruikt bij elke route.
          </p>

          <form onSubmit={handleSave} className="startpoint-form">
            <div className="form-group">
              <label htmlFor="startAddress">Startpunt adres *</label>
              <div className="address-input-wrapper">
                <input
                  ref={addressInputRef}
                  id="startAddress"
                  type="text"
                  className="address-input"
                  placeholder="Bijv. Dam 1, Amsterdam"
                  value={startAddress}
                  onChange={(e) => handleAddressSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (startAddress.length >= 1 && suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  required
                  autoComplete="off"
                />
                {isSearching && <div className="search-spinner">...</div>}
                {showSuggestions && suggestions.length > 0 && (
                  <div ref={suggestionsRef} className="autocomplete-suggestions">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.id || index}
                        className={`suggestion-item ${selectedSuggestionIndex === index ? 'selected' : ''}`}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      >
                        {suggestion.place_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {message && (
              <div className={`message ${message.includes('Fout') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              className="btn-save"
              disabled={saving || !startAddress.trim() || !startCoordinates}
            >
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </form>
        </div>

        <div className="settings-section">
          <MonthlyCostsManager userId={currentUser?.id} />
        </div>
      </div>
    </div>
  );
}

export default Profile;

