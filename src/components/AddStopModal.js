import React, { useState, useEffect, useRef } from 'react';
import './AddStopModal.css';

const MAPBOX_PUBLIC_TOKEN = process.env.REACT_APP_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhmanp5MDB4ajNncjB1YXJrMDc2cSJ9.5CYl4ZfCROi-pmyaNzETIg';

function AddStopModal({ isOpen, onClose, onAddStop, editingStop = null, onUpdateStop }) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    orderType: 'Bezorgen' // default
  });
  const [isSearching, setIsSearching] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const addressInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Debounced geocoding search
  const searchAddresses = async (query) => {
    if (!query || query.trim().length < 1) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

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
        setAddressSuggestions(data.features);
        setShowSuggestions(true);
        setSelectedSuggestionIndex(-1);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'address') {
      setAddressError('');
      setShowSuggestions(true);
      
      // Debounce de zoekopdracht
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        searchAddresses(value);
      }, 300);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setFormData(prev => ({
      ...prev,
      address: suggestion.place_name
    }));
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || addressSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < addressSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(addressSuggestions[selectedSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
          addressInputRef.current && !addressInputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSuggestions]);

  const handleAddressSearch = async () => {
    if (!formData.address.trim()) {
      setAddressError('Adres is verplicht');
      return;
    }

    setIsSearching(true);
    setAddressError('');
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(formData.address)}.json?` +
        `access_token=${MAPBOX_PUBLIC_TOKEN}&` +
        `country=nl&` +
        `limit=1&` +
        `proximity=5.2913,52.1326`
      );

      if (!response.ok) throw new Error('Geocoding mislukt');

      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        // Update address with found address
        setFormData(prev => ({
          ...prev,
          address: feature.place_name
        }));
        setAddressError('');
      } else {
        setAddressError('Geen adres gevonden. Controleer het adres en probeer opnieuw.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setAddressError('Er is een fout opgetreden bij het zoeken van het adres');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validatie
    if (!formData.fullName.trim()) {
      alert('Volledige naam is verplicht');
      return;
    }

    if (!formData.address.trim()) {
      setAddressError('Adres is verplicht');
      return;
    }

    // Zoek coördinaten voor het adres
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(formData.address)}.json?` +
        `access_token=${MAPBOX_PUBLIC_TOKEN}&` +
        `country=nl&` +
        `limit=1&` +
        `proximity=5.2913,52.1326`
      );

      if (!response.ok) throw new Error('Geocoding mislukt');

      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        
        const stopData = {
          name: formData.fullName,
          coordinates: feature.center,
          address: feature.place_name,
          email: formData.email,
          phone: formData.phone,
          orderType: formData.orderType,
          customerInfo: {
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone
          }
        };

        if (editingStop && onUpdateStop) {
          // Update existing stop
          onUpdateStop(editingStop.id, stopData);
        } else {
          // Add new stop
          onAddStop(stopData);
        }

        // Reset formulier
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          address: '',
          orderType: 'Bezorgen'
        });
        setAddressError('');
        onClose();
      } else {
        setAddressError('Geen adres gevonden. Controleer het adres en probeer opnieuw.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setAddressError('Er is een fout opgetreden bij het zoeken van het adres');
    } finally {
      setIsSearching(false);
    }
  };

  // Initialize form data when editingStop changes
  useEffect(() => {
    if (editingStop && isOpen) {
      setFormData({
        fullName: editingStop.name || '',
        email: editingStop.email || editingStop.customerInfo?.email || '',
        phone: editingStop.phone || editingStop.customerInfo?.phone || '',
        address: editingStop.address || '',
        orderType: editingStop.orderType || 'Bezorgen'
      });
    } else if (isOpen && !editingStop) {
      // Reset form when opening for new stop
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        address: '',
        orderType: 'Bezorgen'
      });
    }
  }, [editingStop, isOpen]);

  const handleClose = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      address: '',
      orderType: 'Bezorgen'
    });
    setAddressError('');
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{editingStop ? 'Stop bewerken' : 'Stop toevoegen'}</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="stop-form">
          <div className="form-section">
            <h3>Klant informatie</h3>
            
            <div className="form-group">
              <label htmlFor="fullName">
                Volledige naam <span className="required">*</span>
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                required
                placeholder="Bijv. Jan Jansen"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">E-mailadres</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="bijv. jan@voorbeeld.nl"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Telefoonnummer</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Bijv. 0612345678"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Adres</h3>
            
            <div className="form-group">
              <label htmlFor="address">
                Adres <span className="required">*</span>
              </label>
              <div className="address-input-wrapper">
                <div className="address-input-group">
                  <input
                    ref={addressInputRef}
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      if (addressSuggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    required
                    placeholder="Bijv. Dam 1, Amsterdam"
                    className={addressError ? 'error' : ''}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="search-address-btn"
                    onClick={handleAddressSearch}
                    disabled={!formData.address.trim() || isSearching}
                  >
                    {isSearching ? '...' : '🔍'}
                  </button>
                </div>
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div ref={suggestionsRef} className="address-suggestions">
                    {addressSuggestions.map((suggestion, index) => (
                      <div
                        key={suggestion.id}
                        className={`suggestion-item ${selectedSuggestionIndex === index ? 'selected' : ''}`}
                        onClick={() => handleSuggestionClick(suggestion)}
                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      >
                        <div className="suggestion-text">{suggestion.place_name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {addressError && (
                <span className="error-message">{addressError}</span>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3>Soort opdracht</h3>
            
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="orderType"
                  value="Bezorgen"
                  checked={formData.orderType === 'Bezorgen'}
                  onChange={handleInputChange}
                />
                <span>Bezorgen</span>
              </label>
              
              <label className="radio-label">
                <input
                  type="radio"
                  name="orderType"
                  value="Ophalen"
                  checked={formData.orderType === 'Ophalen'}
                  onChange={handleInputChange}
                />
                <span>Ophalen</span>
              </label>
              
              <label className="radio-label">
                <input
                  type="radio"
                  name="orderType"
                  value="Zending"
                  checked={formData.orderType === 'Zending'}
                  onChange={handleInputChange}
                />
                <span>Zending</span>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-cancel" onClick={handleClose}>
              Annuleren
            </button>
            <button type="submit" className="btn btn-submit" disabled={isSearching}>
              {isSearching ? (editingStop ? 'Bijwerken...' : 'Toevoegen...') : (editingStop ? 'Stop bijwerken' : 'Stop toevoegen')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddStopModal;

