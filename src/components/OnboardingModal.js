import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { saveDriver, saveVehicle } from '../services/userData';
import './OnboardingModal.css';

const MAPBOX_PUBLIC_TOKEN = process.env.REACT_APP_MAPBOX_PUBLIC_TOKEN || 'pk.eyJ1IjoiZmF0YmlrZWh1bHAiLCJhIjoiY21qNnhmanp5MDB4ajNncjB1YXJrMDc2cSJ9.5CYl4ZfCROi-pmyaNzETIg';

function OnboardingModal({ onComplete }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1); // 1 = startpunt, 2 = chauffeur, 3 = voertuig
  const [isVisible, setIsVisible] = useState(true);

  // Step 1: Startpoint
  const [startAddress, setStartAddress] = useState('');
  const [startCoordinates, setStartCoordinates] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [savingStartpoint, setSavingStartpoint] = useState(false);
  const debounceTimerRef = useRef(null);

  // Step 2: Driver
  const [driverFormData, setDriverFormData] = useState({
    name: '',
    email: '',
    phone: '',
    license_number: '',
    password: '',
    withoutAccount: false
  });
  const [savingDriver, setSavingDriver] = useState(false);
  const [driverError, setDriverError] = useState('');

  // Step 3: Vehicle
  const [drivers, setDrivers] = useState([]);
  const [vehicleFormData, setVehicleFormData] = useState({
    kenteken: '',
    omschrijving: '',
    chauffeur: '',
    starttijd: '08:00',
    eindtijd: '20:00'
  });
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehicleError, setVehicleError] = useState('');

  // Load drivers for vehicle step
  useEffect(() => {
    const loadDrivers = async () => {
      if (!currentUser || currentStep !== 3) return;
      try {
        const { getUserDrivers } = await import('../services/userData');
        const userDrivers = await getUserDrivers(currentUser.id);
        setDrivers(userDrivers || []);
      } catch (error) {
        console.error('Error loading drivers:', error);
      }
    };
    loadDrivers();
  }, [currentUser, currentStep]);

  // Check which step to show
  useEffect(() => {
    const checkSteps = async () => {
      if (!currentUser) return;

      try {
        // Check startpoint
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('start_address, start_coordinates')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (profile && profile.start_address && profile.start_coordinates) {
          // Startpoint exists, check driver
          // Check for drivers with admin_user_id (drivers with accounts created by this admin)
          const { data: driversData } = await supabase
            .from('drivers')
            .select('id')
            .eq('admin_user_id', currentUser.id)
            .limit(1);

          if (driversData && driversData.length > 0) {
            // Driver exists, check vehicle
            const { data: vehiclesData } = await supabase
              .from('vehicles')
              .select('id')
              .eq('user_id', currentUser.id)
              .limit(1);

            if (vehiclesData && vehiclesData.length > 0) {
              // All done
              handleComplete();
            } else {
              setCurrentStep(3);
            }
          } else {
            setCurrentStep(2);
          }
        } else {
          setCurrentStep(1);
        }
      } catch (error) {
        console.error('Error checking steps:', error);
      }
    };

    checkSteps();
  }, [currentUser]);

  // Address search for startpoint
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
    setStartAddress(value);
    setShowSuggestions(true);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      searchAddresses(value);
    }, 300);
  };

  const handleSelectSuggestion = (feature) => {
    setStartAddress(feature.place_name);
    setStartCoordinates(feature.center);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Save startpoint
  const handleSaveStartpoint = async (e) => {
    e.preventDefault();
    
    if (!startAddress.trim() || !startCoordinates) {
      return;
    }

    setSavingStartpoint(true);

    try {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      const profileData = {
        user_id: currentUser.id,
        start_address: startAddress,
        start_coordinates: startCoordinates,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        await supabase
          .from('user_profiles')
          .update(profileData)
          .eq('user_id', currentUser.id);
      } else {
        await supabase
          .from('user_profiles')
          .insert({
            ...profileData,
            created_at: new Date().toISOString()
          });
      }

      setCurrentStep(2);
    } catch (error) {
      console.error('Error saving startpoint:', error);
    } finally {
      setSavingStartpoint(false);
    }
  };

  // Save driver
  const handleSaveDriver = async (e) => {
    e.preventDefault();
    setDriverError('');
    setSavingDriver(true);

    try {
      let driverUserId = null;
      
      // Store admin session info before creating driver account
      const adminEmail = currentUser?.email;
      const { data: adminSession } = await supabase.auth.getSession();
      const adminRefreshToken = adminSession?.session?.refresh_token;

      if (driverFormData.withoutAccount) {
        // Create driver without auth account - link to current admin user
        driverUserId = currentUser.id;
      } else {
        // Create auth user for the driver using signUp
        if (!driverFormData.email || !driverFormData.password) {
          setDriverError('E-mailadres en wachtwoord zijn verplicht wanneer je een account aanmaakt.');
          setSavingDriver(false);
          return;
        }
        
        // First, check if this email is already a driver for this admin
        const { data: existingDriver } = await supabase
          .from('drivers')
          .select('id, user_id, admin_user_id')
          .eq('email', driverFormData.email.trim().toLowerCase())
          .maybeSingle();
        
        if (existingDriver && existingDriver.admin_user_id === currentUser.id) {
          // Driver already exists for this admin, use it
          driverUserId = existingDriver.user_id;
          console.log('Driver already exists for this admin, using existing driver user_id:', driverUserId);
        } else if (existingDriver && existingDriver.admin_user_id !== currentUser.id) {
          // Driver exists but belongs to another admin
          throw new Error('Dit e-mailadres is al geregistreerd door een andere admin. Gebruik een ander e-mailadres.');
        } else {
          // Try to create new account
          const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email: driverFormData.email.trim().toLowerCase(),
            password: driverFormData.password,
            options: {
              data: {
                role: 'driver'
              }
            }
          });

          // Supabase automatically logs in after signUp, so we need to check and restore admin session
          if (signupData && signupData.user) {
            driverUserId = signupData.user.id;
            
            // Check if we're now logged in as the driver (instead of admin)
            const { data: currentSession } = await supabase.auth.getSession();
            if (currentSession?.session?.user?.email === driverFormData.email.trim().toLowerCase()) {
              // We're logged in as the driver, restore admin session using refresh token
              if (adminRefreshToken) {
                try {
                // First, we need to get a new access token using the refresh token
                // We can do this by calling the Supabase auth API directly
                const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
                const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
                const supabaseHost = supabaseUrl.replace('https://', '').replace('http://', '');
                
                const response = await fetch(`https://${supabaseHost}/auth/v1/token?grant_type=refresh_token`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseAnonKey
                  },
                  body: JSON.stringify({
                    refresh_token: adminRefreshToken
                  })
                });
                
                const tokenData = await response.json();
                
                if (tokenData.access_token && tokenData.refresh_token) {
                  // Use setSession to restore the admin session
                  const { data: restoreData, error: restoreError } = await supabase.auth.setSession({
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token
                  });
                  
                  if (restoreError || !restoreData?.session) {
                    console.warn('Could not restore admin session using refresh token:', restoreError);
                    // Fallback: try to sign out and let user log back in
                    await supabase.auth.signOut();
                    throw new Error('Chauffeur account aangemaakt, maar je bent automatisch ingelogd als chauffeur. Log uit en log opnieuw in als admin om door te gaan met de onboarding.');
                  } else {
                    console.log('Admin session restored successfully using refresh token');
                    // Wait for auth state to update (onAuthStateChange event)
                    // This ensures currentUser in context is updated
                    await new Promise((resolve) => {
                      const timeout = setTimeout(() => {
                        resolve();
                      }, 1000);
                      
                      // Listen for auth state change
                      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                        if (session?.user?.email === adminEmail) {
                          clearTimeout(timeout);
                          subscription.unsubscribe();
                          resolve();
                        }
                      });
                    });
                  }
                } else {
                  throw new Error('Could not get new access token from refresh token');
                }
              } catch (restoreErr) {
                console.error('Error restoring admin session:', restoreErr);
                // Sign out as fallback
                await supabase.auth.signOut();
                throw new Error('Chauffeur account aangemaakt, maar je bent automatisch ingelogd als chauffeur. Log uit en log opnieuw in als admin om door te gaan met de onboarding.');
              }
              } else {
                // No refresh token available, sign out
                console.warn('No admin refresh token available, signing out');
                await supabase.auth.signOut();
                throw new Error('Chauffeur account aangemaakt, maar je bent automatisch ingelogd als chauffeur. Log uit en log opnieuw in als admin om door te gaan met de onboarding.');
              }
            }
          }

          // Handle SMTP/email configuration errors (500 errors) - user might still be created
          if (signupError && (signupError.status === 500 || signupError.message.includes('500') || signupError.message.includes('Internal Server Error'))) {
            // Check if user was actually created despite the error
            if (signupData && signupData.user) {
              // User was created, just SMTP issue - continue with warning
              driverUserId = signupData.user.id;
              console.warn('Driver user created but SMTP error occurred:', signupError);
              // Sign out driver
              await supabase.auth.signOut();
            } else {
              // User not created, try to verify by attempting to sign in
              console.warn('SMTP error occurred, checking if user was created by attempting login...');
              try {
              // Try to sign in to verify user exists
              const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email: driverFormData.email.trim().toLowerCase(),
                password: driverFormData.password
              });
              
              if (loginData && loginData.user) {
                // User exists! Use that user ID
                driverUserId = loginData.user.id;
                // Sign out immediately since we don't want to stay logged in as the driver
                await supabase.auth.signOut();
              } else {
                // User doesn't exist, wait a bit and try again
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const { data: retryLoginData, error: retryLoginError } = await supabase.auth.signInWithPassword({
                  email: driverFormData.email.trim().toLowerCase(),
                  password: driverFormData.password
                });
                
                if (retryLoginData && retryLoginData.user) {
                  driverUserId = retryLoginData.user.id;
                  await supabase.auth.signOut();
                } else {
                  throw new Error('Probeer een ander e-mail adres');
                }
              }
              } catch (checkError) {
                console.error('Error checking if user exists:', checkError);
                throw new Error('Probeer een ander e-mail adres');
              }
            }
          } else if (signupError) {
            // Handle other errors
            if (signupError.message.includes('already registered') || signupError.message.includes('already been registered') || signupError.message.includes('already exists')) {
              // Email already exists - check if it's a driver account for this admin
            // First, restore admin session if we were logged in as driver
            const { data: checkSession } = await supabase.auth.getSession();
            if (checkSession?.session?.user?.email === driverFormData.email.trim().toLowerCase()) {
              // We're logged in as the driver, restore admin session
              if (adminRefreshToken) {
                try {
                  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
                  const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
                  const supabaseHost = supabaseUrl.replace('https://', '').replace('http://', '');
                  
                  const response = await fetch(`https://${supabaseHost}/auth/v1/token?grant_type=refresh_token`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'apikey': supabaseAnonKey
                    },
                    body: JSON.stringify({
                      refresh_token: adminRefreshToken
                    })
                  });
                  
                  const tokenData = await response.json();
                  
                  if (tokenData.access_token && tokenData.refresh_token) {
                    await supabase.auth.setSession({
                      access_token: tokenData.access_token,
                      refresh_token: tokenData.refresh_token
                    });
                    
                    // Wait for auth state to update
                    await new Promise((resolve) => {
                      const timeout = setTimeout(resolve, 1000);
                      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                        if (session?.user?.email === adminEmail) {
                          clearTimeout(timeout);
                          subscription.unsubscribe();
                          resolve();
                        }
                      });
                    });
                  }
                } catch (restoreErr) {
                  console.error('Error restoring admin session after email exists error:', restoreErr);
                  await supabase.auth.signOut();
                }
              }
            }
            
            // Check if this email is already a driver for this admin
            const { data: existingDriver } = await supabase
              .from('drivers')
              .select('id, user_id, admin_user_id')
              .eq('email', driverFormData.email.trim().toLowerCase())
              .maybeSingle();
            
            if (existingDriver && existingDriver.admin_user_id === currentUser.id) {
              // Driver already exists for this admin, use the user_id
              driverUserId = existingDriver.user_id;
              console.log('Driver already exists for this admin, using existing driver user_id:', driverUserId);
              } else {
                throw new Error('Dit e-mailadres is al geregistreerd. Gebruik een ander e-mailadres.');
              }
            } else if (signupError.message.includes('invalid') || signupError.message.includes('Invalid')) {
              throw new Error('Ongeldig e-mailadres. Controleer of het e-mailadres correct is.');
            } else {
              throw new Error('Fout bij aanmaken van chauffeur account: ' + signupError.message);
            }
          } else if (!signupData || !signupData.user) {
            throw new Error('Chauffeur account kon niet worden aangemaakt.');
          }
        }
      }

      // Save driver profile
      if (driverUserId) {
        const { error: driverSaveError } = await supabase
          .from('drivers')
          .upsert({
            user_id: driverUserId,
            admin_user_id: currentUser.id, // Link driver to admin who created them
            name: driverFormData.name,
            email: driverFormData.withoutAccount ? null : driverFormData.email.trim().toLowerCase(),
            phone: driverFormData.phone || null,
            license_number: driverFormData.license_number || null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          });

        if (driverSaveError) {
          throw new Error('Fout bij opslaan van chauffeur: ' + driverSaveError.message);
        }
      }

      setCurrentStep(3);
      // Reload drivers for vehicle step
      const { getUserDrivers } = await import('../services/userData');
      const userDrivers = await getUserDrivers(currentUser.id);
      setDrivers(userDrivers || []);
    } catch (error) {
      setDriverError(error.message || 'Fout bij opslaan van chauffeur');
    } finally {
      setSavingDriver(false);
    }
  };

  // Save vehicle
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    setVehicleError('');

    if (!vehicleFormData.chauffeur) {
      setVehicleError('Selecteer een chauffeur');
      return;
    }

    setSavingVehicle(true);

    try {
      // Find the driver ID from the selected driver name
      const selectedDriver = drivers.find(d => d.name === vehicleFormData.chauffeur || d.id === vehicleFormData.chauffeur);
      
      if (!selectedDriver) {
        setVehicleError('Selecteer een geldige chauffeur');
        setSavingVehicle(false);
        return;
      }

      // Map form data to database format
      const vehicleData = {
        license_plate: vehicleFormData.kenteken || '',
        description: vehicleFormData.omschrijving || '',
        driver: selectedDriver.id, // Use driver ID, not name
        start_time: vehicleFormData.starttijd || '08:00',
        end_time: vehicleFormData.eindtijd || '20:00'
      };
      
      await saveVehicle(currentUser.id, vehicleData);
      handleComplete();
    } catch (error) {
      setVehicleError(error.message || 'Fout bij opslaan van voertuig');
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleComplete = async () => {
    setIsVisible(false);
    
    // Wait a moment to ensure vehicle is saved
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (onComplete) {
      onComplete();
    }
    
    // Navigate to dashboard - App.js will reload data automatically
    navigate('/vandaag');
    
    // Force a page reload to ensure all data is fresh
    window.location.reload();
  };

  if (!isVisible || !currentUser) return null;

  return (
    <div className="onboarding-modal-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-modal-header">
          <h2>Welkom bij RouteNu! 🎉</h2>
          <p>Laten we je account instellen in 3 eenvoudige stappen</p>
        </div>

        <div className="onboarding-steps-indicator">
          <div className={`step-indicator ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
            <div className="step-indicator-number">1</div>
            <span>Startpunt</span>
          </div>
          <div className={`step-indicator ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
            <div className="step-indicator-number">2</div>
            <span>Chauffeur</span>
          </div>
          <div className={`step-indicator ${currentStep >= 3 ? 'active' : ''}`}>
            <div className="step-indicator-number">3</div>
            <span>Voertuig</span>
          </div>
        </div>

        <div className="onboarding-content">
          {/* Step 1: Startpoint */}
          {currentStep === 1 && (
            <form onSubmit={handleSaveStartpoint} className="onboarding-form">
              <h3>Stap 1: Startpunt instellen</h3>
              <p className="step-description">Stel eerst je startpunt in. Dit is het adres waar je routes beginnen.</p>
              
              <div className="form-group">
                <label htmlFor="startAddress">Startpunt adres *</label>
                <div className="address-input-wrapper">
                  <input
                    type="text"
                    id="startAddress"
                    className="address-input"
                    placeholder="Bijv. Dam 1, Amsterdam"
                    value={startAddress}
                    onChange={(e) => handleAddressSearch(e.target.value)}
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
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="onboarding-button primary"
                  disabled={savingStartpoint || !startAddress.trim() || !startCoordinates}
                >
                  {savingStartpoint ? 'Opslaan...' : 'Volgende'}
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Driver */}
          {currentStep === 2 && (
            <form onSubmit={handleSaveDriver} className="onboarding-form">
              <h3>Stap 2: Chauffeur toevoegen</h3>
              <p className="step-description">Voeg een chauffeur toe om routes te kunnen toewijzen.</p>
              
              {driverError && <div className="error-message">{driverError}</div>}

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={driverFormData.withoutAccount}
                    onChange={(e) => {
                      setDriverFormData(prev => ({
                        ...prev,
                        withoutAccount: e.target.checked,
                        email: e.target.checked ? '' : prev.email,
                        password: e.target.checked ? '' : prev.password
                      }));
                    }}
                  />
                  <span className="checkbox-text">
                    <strong>Doorgaan zonder e-mail chauffeur</strong>
                    <small>Chauffeur zonder account toevoegen (geen inlog mogelijk)</small>
                  </span>
                </label>
              </div>

              <div className="form-group">
                <label htmlFor="driver-name">Naam *</label>
                <input
                  type="text"
                  id="driver-name"
                  value={driverFormData.name}
                  onChange={(e) => setDriverFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              {!driverFormData.withoutAccount && (
                <>
                  <div className="form-group">
                    <label htmlFor="driver-email">E-mailadres *</label>
                    <input
                      type="email"
                      id="driver-email"
                      value={driverFormData.email}
                      onChange={(e) => setDriverFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="driver-password">Wachtwoord *</label>
                    <input
                      type="password"
                      id="driver-password"
                      value={driverFormData.password}
                      onChange={(e) => setDriverFormData(prev => ({ ...prev, password: e.target.value }))}
                      required
                      minLength={6}
                      placeholder="Minimaal 6 tekens"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label htmlFor="driver-phone">Telefoonnummer</label>
                <input
                  type="tel"
                  id="driver-phone"
                  value={driverFormData.phone}
                  onChange={(e) => setDriverFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="driver-license">Rijbewijsnummer</label>
                <input
                  type="text"
                  id="driver-license"
                  value={driverFormData.license_number}
                  onChange={(e) => setDriverFormData(prev => ({ ...prev, license_number: e.target.value }))}
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="onboarding-button primary"
                  disabled={savingDriver}
                >
                  {savingDriver ? 'Opslaan...' : 'Volgende'}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Vehicle */}
          {currentStep === 3 && (
            <form onSubmit={handleSaveVehicle} className="onboarding-form">
              <h3>Stap 3: Voertuig instellen</h3>
              <p className="step-description">Voeg een voertuig toe om routes te kunnen berekenen.</p>
              
              {vehicleError && <div className="error-message">{vehicleError}</div>}

              <div className="form-group">
                <label htmlFor="kenteken">Kenteken</label>
                <input
                  type="text"
                  id="kenteken"
                  value={vehicleFormData.kenteken}
                  onChange={(e) => setVehicleFormData(prev => ({ ...prev, kenteken: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="omschrijving">Omschrijving</label>
                <input
                  type="text"
                  id="omschrijving"
                  value={vehicleFormData.omschrijving}
                  onChange={(e) => setVehicleFormData(prev => ({ ...prev, omschrijving: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="chauffeur">Chauffeur *</label>
                <select
                  id="chauffeur"
                  value={vehicleFormData.chauffeur}
                  onChange={(e) => setVehicleFormData(prev => ({ ...prev, chauffeur: e.target.value }))}
                  required
                >
                  <option value="">Selecteer een chauffeur</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
                {drivers.length === 0 && (
                  <small style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Geen chauffeurs beschikbaar. Ga terug naar stap 2.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="starttijd">Starttijd *</label>
                <input
                  type="time"
                  id="starttijd"
                  value={vehicleFormData.starttijd}
                  onChange={(e) => setVehicleFormData(prev => ({ ...prev, starttijd: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="eindtijd">Eindtijd *</label>
                <input
                  type="time"
                  id="eindtijd"
                  value={vehicleFormData.eindtijd}
                  onChange={(e) => setVehicleFormData(prev => ({ ...prev, eindtijd: e.target.value }))}
                  required
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="onboarding-button primary"
                  disabled={savingVehicle || !vehicleFormData.chauffeur}
                >
                  {savingVehicle ? 'Opslaan...' : 'Voltooien'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default OnboardingModal;
