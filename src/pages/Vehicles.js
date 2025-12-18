import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUserVehicles, deleteItem, saveDriver, getUserDrivers, saveVehicle, updateItem } from '../services/userData';
import { supabase } from '../lib/supabase';
import './Vehicles.css';

function Vehicles({ vehicles: propVehicles = [], onVehicleAdded, setVehicles: setVehiclesProp }) {
  const [showEmailErrorModal, setShowEmailErrorModal] = useState(false);
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [localVehicles, setLocalVehicles] = useState(propVehicles);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Alle voertuigen');
  const [deletingVehicleId, setDeletingVehicleId] = useState(null);
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    setLocalVehicles(propVehicles);
  }, [propVehicles]);

  // Load vehicles and drivers from database
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Load vehicles and drivers
        const [userVehicles, userDrivers] = await Promise.all([
          getUserVehicles(currentUser.id),
          getUserDrivers(currentUser.id)
        ]);
        
        setDrivers(userDrivers || []);
        
        // Map database fields to form fields
        const mappedVehicles = userVehicles.map(vehicle => {
          // Find driver name by driver ID
          const driverId = vehicle.driver || vehicle.chauffeur;
          const driver = userDrivers?.find(d => d.id === driverId);
          const driverName = driver?.name || driverId || '-';
          
          return {
            ...vehicle,
            kenteken: vehicle.license_plate || vehicle.kenteken,
            omschrijving: vehicle.description || vehicle.omschrijving,
            vasteKleur: vehicle.fixed_color || vehicle.vasteKleur,
            brandstofType: vehicle.fuel_type || vehicle.brandstofType,
            verbruik: vehicle.consumption || vehicle.verbruik,
            co2Uitstoot: vehicle.co2_emission || vehicle.co2Uitstoot,
            chauffeur: driverName, // Use driver name instead of ID
            driver: driverId, // Keep driver ID for form editing
            starttijd: vehicle.start_time || vehicle.starttijd,
            eindtijd: vehicle.end_time || vehicle.eindtijd,
            snelheid: vehicle.speed || vehicle.snelheid,
            naam: vehicle.license_plate || vehicle.kenteken || `Voertuig ${vehicle.id?.slice(0, 8)}`
          };
        });
        setLocalVehicles(mappedVehicles);
        if (setVehiclesProp) {
          setVehiclesProp(mappedVehicles);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, setVehiclesProp]);

  // Check if we should open the form automatically
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const vehiclesList = propVehicles.length > 0 ? propVehicles : localVehicles;
    if (params.get('openForm') === 'true' && !loading && vehiclesList.length === 0) {
      setIsFormOpen(true);
      // Remove the query parameter from URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, loading, propVehicles, localVehicles, navigate, location.pathname]);

  const vehicles = propVehicles.length > 0 ? propVehicles : localVehicles;
  const setVehicles = setVehiclesProp || setLocalVehicles;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDriverFormOpen, setIsDriverFormOpen] = useState(false);
  const [driverFormData, setDriverFormData] = useState({
    name: '',
    email: '',
    phone: '',
    license_number: '',
    password: '',
    withoutAccount: false
  });
  const [driverFormLoading, setDriverFormLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');
  const [formData, setFormData] = useState({
    kenteken: '',
    omschrijving: '',
    vasteKleur: '',
    kleurCode: '',
    brandstofType: '',
    verbruik: '',
    co2Uitstoot: '',
    chauffeur: '',
    starttijd: '08:00',
    eindtijd: '20:00',
    snelheid: 'Normaal',
    heeftPauze: false,
    starttijdPauze: '',
    eindtijdPauze: '',
    centsPerKm: ''
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      kenteken: vehicle.kenteken || vehicle.license_plate || '',
      omschrijving: vehicle.omschrijving || vehicle.description || '',
      vasteKleur: vehicle.vasteKleur || vehicle.fixed_color || '',
      kleurCode: vehicle.kleurCode || '#0CC0DF',
      brandstofType: vehicle.brandstofType || vehicle.fuel_type || '',
      verbruik: vehicle.verbruik || vehicle.consumption || '',
      co2Uitstoot: vehicle.co2Uitstoot || vehicle.co2_emission || '',
      chauffeur: vehicle.chauffeur || vehicle.driver || '',
      starttijd: vehicle.starttijd || vehicle.start_time || '08:00',
      eindtijd: vehicle.eindtijd || vehicle.end_time || '20:00',
      snelheid: vehicle.snelheid || vehicle.speed || 'Normaal',
      heeftPauze: vehicle.heeftPauze || (vehicle.planned_break ? true : false),
      starttijdPauze: vehicle.starttijdPauze || (vehicle.planned_break ? vehicle.planned_break.split('-')[0] : ''),
      eindtijdPauze: vehicle.eindtijdPauze || (vehicle.planned_break ? vehicle.planned_break.split('-')[1] : ''),
      centsPerKm: vehicle.centsPerKm || vehicle.cents_per_km || ''
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) return;

    // Prevent double submission
    if (isSubmitting) {
      return;
    }

    // Validate that a driver is selected
    if (!formData.chauffeur || formData.chauffeur.trim() === '') {
      alert('Selecteer een chauffeur voor dit voertuig.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingVehicle) {
        // Update existing vehicle
        const vehicleData = {
          license_plate: formData.kenteken || '',
          description: formData.omschrijving || '',
          fixed_color: formData.vasteKleur || '',
          fuel_type: formData.brandstofType || '',
          consumption: formData.verbruik || '',
          co2_emission: formData.co2Uitstoot || '',
          driver: formData.chauffeur || '',
          start_time: formData.starttijd || '08:00',
          end_time: formData.eindtijd || '20:00',
          speed: formData.snelheid || 'Normaal',
          planned_break: formData.heeftPauze && formData.starttijdPauze && formData.eindtijdPauze
            ? `${formData.starttijdPauze}-${formData.eindtijdPauze}`
            : null,
          cents_per_km: formData.centsPerKm ? parseFloat(formData.centsPerKm) : null
        };
        
        await updateItem('vehicles', editingVehicle.id, vehicleData);
        
        // Update local state
        const updatedVehicles = vehicles.map(v => 
          v.id === editingVehicle.id 
            ? { ...v, ...formData, naam: formData.kenteken || v.naam }
            : v
        );
        setVehicles(updatedVehicles);
        setLocalVehicles(updatedVehicles);
        
        alert('Voertuig bijgewerkt!');
        
        // Close form after update
        setIsFormOpen(false);
        setEditingVehicle(null);
      } else {
        // Add new vehicle
        const vehicleData = {
          license_plate: formData.kenteken || '',
          description: formData.omschrijving || '',
          fixed_color: formData.vasteKleur || '',
          fuel_type: formData.brandstofType || '',
          consumption: formData.verbruik || '',
          co2_emission: formData.co2Uitstoot || '',
          driver: formData.chauffeur || '',
          start_time: formData.starttijd || '08:00',
          end_time: formData.eindtijd || '20:00',
          speed: formData.snelheid || 'Normaal',
          planned_break: formData.heeftPauze && formData.starttijdPauze && formData.eindtijdPauze
            ? `${formData.starttijdPauze}-${formData.eindtijdPauze}`
            : null,
          cents_per_km: formData.centsPerKm ? parseFloat(formData.centsPerKm) : null
        };
        
        await saveVehicle(currentUser.id, vehicleData);
        
        // Close form immediately to prevent double submission
        setIsFormOpen(false);
        setEditingVehicle(null);
        
        // Reload vehicles
        const userVehicles = await getUserVehicles(currentUser.id);
        const mappedVehicles = userVehicles.map(vehicle => ({
          ...vehicle,
          kenteken: vehicle.license_plate || vehicle.kenteken,
          omschrijving: vehicle.description || vehicle.omschrijving,
          vasteKleur: vehicle.fixed_color || vehicle.vasteKleur,
          brandstofType: vehicle.fuel_type || vehicle.brandstofType,
          verbruik: vehicle.consumption || vehicle.verbruik,
          co2Uitstoot: vehicle.co2_emission || vehicle.co2Uitstoot,
          chauffeur: vehicle.driver || vehicle.chauffeur,
          starttijd: vehicle.start_time || vehicle.starttijd,
          eindtijd: vehicle.end_time || vehicle.eindtijd,
          snelheid: vehicle.speed || vehicle.snelheid,
          naam: vehicle.license_plate || vehicle.kenteken || `Voertuig ${vehicle.id?.slice(0, 8)}`
        }));
        setVehicles(mappedVehicles);
        setLocalVehicles(mappedVehicles);
        
        // Notify parent component to update state immediately BEFORE alert
        // This ensures state is updated before any navigation checks
        if (onVehicleAdded) {
          // Pass the full mapped vehicles array so parent can update state immediately
          onVehicleAdded(mappedVehicles);
        }
        
        // Show alert - after this, user should be able to navigate freely
        alert('Voertuig toegevoegd!');
        
        // After adding vehicle, user can now navigate freely
        // Don't redirect automatically - let user navigate manually
      }
      
      // Reset form
      setFormData({
        kenteken: '',
        omschrijving: '',
        vasteKleur: '',
        kleurCode: '',
        brandstofType: '',
        verbruik: '',
        co2Uitstoot: '',
        chauffeur: '',
        starttijd: '08:00',
        eindtijd: '20:00',
        snelheid: 'Normaal',
        heeftPauze: false,
        starttijdPauze: '',
        eindtijdPauze: '',
        centsPerKm: ''
      });
    } catch (error) {
      console.error('Error saving vehicle:', error);
      alert('Fout bij opslaan voertuig: ' + (error.message || 'Onbekende fout'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleDriverInputChange = (e) => {
    const { name, value } = e.target;
    setDriverFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDriverSubmit = async (e) => {
    e.preventDefault();
    setDriverFormLoading(true);

    try {
      let userId = null;

      if (driverFormData.withoutAccount) {
        // Create driver without auth account - use a placeholder user_id
        // We'll need to modify the drivers table to allow null user_id or use a system user
        // For now, we'll create a driver record linked to the current admin user
        // but mark it as a driver without account
        userId = currentUser.id; // Link to admin user for now
      } else {
        // Create auth user for the driver using signUp
        if (!driverFormData.email || !driverFormData.password) {
          throw new Error('E-mailadres en wachtwoord zijn verplicht wanneer je een account aanmaakt.');
        }

        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: driverFormData.email.trim().toLowerCase(),
          password: driverFormData.password,
          options: {
            data: {
              role: 'driver'
            }
          }
        });

        // Handle SMTP/email configuration errors (500 errors) - user might still be created
        if (signupError && (signupError.status === 500 || signupError.message.includes('500') || signupError.message.includes('Internal Server Error') || signupError.message.includes('confirmation email') || signupError.message.includes('Error sending'))) {
          // Check if user was actually created despite the error
          if (signupData && signupData.user) {
            // User was created, just SMTP issue - continue with warning
            console.warn('Driver user created but SMTP error occurred:', signupError);
            // Continue with the signupData - user is created
          } else {
            // Even if signupData.user is not in response, try to verify user was created
            // by attempting to sign in (if user exists, login will work)
            console.warn('SMTP error occurred, checking if user was created by attempting login...');
            try {
              // Try to sign in to verify user exists
              const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email: driverFormData.email.trim().toLowerCase(),
                password: driverFormData.password
              });
              
              if (loginData && loginData.user) {
                // User exists! Use that user ID
                console.warn('Driver user exists despite SMTP error, using logged in user:', loginData.user.id);
                signupData = { user: loginData.user };
                // Sign out immediately since we don't want to stay logged in as the driver
                await supabase.auth.signOut();
              } else {
                // User doesn't exist, but SMTP is configured correctly now
                // This might be a transient error - wait a bit and try again
                console.warn('User not found immediately after signup, waiting 2 seconds and retrying login...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const { data: retryLoginData, error: retryLoginError } = await supabase.auth.signInWithPassword({
                  email: driverFormData.email.trim().toLowerCase(),
                  password: driverFormData.password
                });
                
                if (retryLoginData && retryLoginData.user) {
                  console.warn('Driver user found after retry, using logged in user:', retryLoginData.user.id);
                  signupData = { user: retryLoginData.user };
                  await supabase.auth.signOut();
                } else {
                  // User really doesn't exist
                  throw new Error('De chauffeur kon niet worden aangemaakt. Probeer het opnieuw. Als het probleem aanhoudt, controleer de Supabase instellingen.');
                }
              }
            } catch (checkError) {
              console.error('Error checking if user exists:', checkError);
              // If we can't verify, assume user was not created
              throw new Error('De chauffeur kon niet worden aangemaakt. Probeer het opnieuw. Als het probleem aanhoudt, controleer de Supabase instellingen.');
            }
          }
        } else if (signupError) {
          // Handle other errors
          console.error('Signup error details:', signupError);
          if (signupError.message.includes('already registered') || signupError.message.includes('already been registered')) {
            throw new Error('Dit e-mailadres is al geregistreerd. Gebruik een ander e-mailadres.');
          }
          if (signupError.message.includes('invalid') || signupError.message.includes('Invalid')) {
            throw new Error('Ongeldig e-mailadres. Controleer of het e-mailadres correct is en gebruik een geldig e-maildomein.');
          }
          if (signupError.message.includes('security purposes') || signupError.message.includes('46 seconds') || signupError.message.includes('429')) {
            throw new Error('Te veel pogingen. Wacht even (ongeveer 1 minuut) en probeer het opnieuw.');
          }
          throw signupError;
        }

        if (!signupData || !signupData.user) {
          throw new Error('Kon gebruiker niet aanmaken. Probeer het opnieuw.');
        }

        // Wait a bit for user to be fully created and ensure session is established
        await new Promise(resolve => setTimeout(resolve, 1000));
        userId = signupData.user.id;
      }

      // Save driver profile
      try {
        // For drivers without account, userId is the admin user_id
        // For drivers with account, userId is the driver's user_id and we need to pass admin user_id
        const adminUserId = driverFormData.withoutAccount ? userId : currentUser.id;
        const driverUserId = driverFormData.withoutAccount ? userId : userId;
        await saveDriver(adminUserId, driverUserId, {
          name: driverFormData.name,
          email: driverFormData.withoutAccount ? null : driverFormData.email.trim().toLowerCase(),
          phone: driverFormData.phone || null,
          license_number: driverFormData.license_number || null
        });
      } catch (saveError) {
        console.error('Error saving driver profile:', saveError);
        throw new Error('Chauffeur profiel kon niet worden opgeslagen: ' + (saveError.message || 'Onbekende fout'));
      }

      // Reload drivers list
      const userDrivers = await getUserDrivers(currentUser.id);
      setDrivers(userDrivers || []);

      // Show success message
      if (driverFormData.withoutAccount) {
        alert('Chauffeur zonder account succesvol toegevoegd!');
      } else {
        setSuccessEmail(driverFormData.email.trim().toLowerCase());
        setShowSuccessModal(true);
      }

      setIsDriverFormOpen(false);
      setDriverFormData({
        name: '',
        email: '',
        phone: '',
        license_number: '',
        password: '',
        withoutAccount: false
      });
    } catch (error) {
      console.error('Error adding driver:', error);
      let errorMessage = '';
      
      if (error.message) {
        if (error.message.includes('invalid') || error.message.includes('Invalid')) {
          errorMessage = 'Ongeldig e-mailadres. Gebruik een geldig e-mailadres met een echt e-maildomein (bijv. gmail.com, outlook.com). Testdomeinen zoals example.com worden niet geaccepteerd.';
        } else if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          // Show modal for already registered email
          setShowEmailErrorModal(true);
          setDriverFormLoading(false);
          return;
        } else {
          errorMessage = 'Probeer een ander e-mail adres';
        }
      } else {
        errorMessage = 'Probeer een ander e-mail adres';
      }
      
      alert(errorMessage);
    } finally {
      setDriverFormLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId, vehicleName) => {
    if (!window.confirm(`Weet je zeker dat je het voertuig "${vehicleName || 'Voertuig'}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    if (!currentUser) return;

    try {
      setDeletingVehicleId(vehicleId);
      await deleteItem('vehicles', vehicleId);
      
      // Remove from local state
      const updatedVehicles = vehicles.filter(v => v.id !== vehicleId);
      setVehicles(updatedVehicles);
      setLocalVehicles(updatedVehicles);
      console.log('Voertuig verwijderd');
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert('Fout bij verwijderen voertuig: ' + (error.message || 'Onbekende fout'));
    } finally {
      setDeletingVehicleId(null);
    }
  };

  // Filter vehicles
  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = !searchQuery || 
      (vehicle.naam?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (vehicle.kenteken?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (vehicle.chauffeur?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <div className="vehicles-page">
      <div className="vehicles-header">
        <h1>Voertuigen</h1>
        
        <div className="vehicles-controls">
          <select 
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option>Alle voertuigen</option>
            <option>Actieve voertuigen</option>
            <option>Inactieve voertuigen</option>
          </select>
          
          <button className="btn-new-route" onClick={() => setIsFormOpen(true)}>
            <span className="plus-icon">+</span>
            Voertuig toevoegen
          </button>
          
          <button className="btn-new-route btn-driver" onClick={() => setIsDriverFormOpen(true)}>
            <span className="plus-icon">+</span>
            Chauffeur toevoegen
          </button>
        </div>
      </div>

      {/* Warning if no drivers */}
      {!loading && drivers.length === 0 && (
        <div className="vehicles-warning">
          <p><strong>Geen chauffeurs beschikbaar</strong></p>
          <p>Voeg eerst een chauffeur toe voordat je een voertuig toevoegt.</p>
          <button className="btn-warning-action" onClick={() => setIsDriverFormOpen(true)}>
            Eerste chauffeur toevoegen
          </button>
        </div>
      )}

      {/* Warning if no vehicles */}
      {!loading && drivers.length > 0 && localVehicles.length === 0 && (
        <div className="vehicles-warning">
          <p><strong>Nog geen voertuigen toegevoegd</strong></p>
          <p>Voeg je eerste voertuig toe om routes te kunnen berekenen.</p>
          <button className="btn-warning-action" onClick={() => setIsFormOpen(true)}>
            Eerste voertuig toevoegen
          </button>
        </div>
      )}

      <div className="routes-table-container">
        {loading ? (
          <div className="empty-routes">
            <p>Voertuigen laden...</p>
          </div>
        ) : filteredVehicles.length > 0 ? (
          <table className="routes-table">
            <thead>
              <tr>
                <th>Voertuig naam</th>
                <th>Kenteken</th>
                <th>Chauffeur</th>
                <th>Brandstof</th>
                <th>Starttijd</th>
                <th>Eindtijd</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id} className="route-row">
                  <td className="route-name">{vehicle.naam || 'Voertuig zonder naam'}</td>
                  <td>{vehicle.kenteken || '-'}</td>
                  <td>{vehicle.chauffeur || '-'}</td>
                  <td>{vehicle.brandstofType || '-'}</td>
                  <td>{vehicle.starttijd || '-'}</td>
                  <td>{vehicle.eindtijd || '-'}</td>
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="action-buttons">
                      <button 
                        className="btn-edit"
                        onClick={() => handleEditVehicle(vehicle)}
                        title="Voertuig bewerken"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeleteVehicle(vehicle.id, vehicle.naam)}
                        disabled={deletingVehicleId === vehicle.id}
                        title="Voertuig verwijderen"
                      >
                        {deletingVehicleId === vehicle.id ? (
                          <span className="delete-loading">...</span>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-routes">
            <p>{searchQuery ? 'Geen voertuigen gevonden' : 'Nog geen voertuigen toegevoegd'}</p>
            {!searchQuery && (
              <p className="empty-hint">Klik op "+ Voertuig toevoegen" om een voertuig toe te voegen</p>
            )}
          </div>
        )}
      </div>

      {isFormOpen && (
        <div className="vehicle-form-overlay" onClick={() => {
          setIsFormOpen(false);
          setEditingVehicle(null);
        }}>
          <div className="vehicle-form-content" onClick={(e) => e.stopPropagation()}>
            <div className="vehicle-form-header">
              <h2>{editingVehicle ? 'Voertuig bewerken' : 'Voertuig toevoegen'}</h2>
              <button className="close-button" onClick={() => {
                setIsFormOpen(false);
                setEditingVehicle(null);
              }}>×</button>
            </div>

            <form onSubmit={handleSubmit} className="vehicle-form">
              <div className="form-group">
                <label htmlFor="kenteken">Kenteken</label>
                <input
                  type="text"
                  id="kenteken"
                  name="kenteken"
                  value={formData.kenteken}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="omschrijving">
                  Omschrijving
                  <span className="info-icon">ℹ️</span>
                </label>
                <input
                  type="text"
                  id="omschrijving"
                  name="omschrijving"
                  value={formData.omschrijving}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="vasteKleur">
                  Vaste kleur
                  <span className="info-icon">ℹ️</span>
                </label>
                <div className="color-inputs">
                  <input
                    type="color"
                    id="kleurCode"
                    name="kleurCode"
                    value={formData.kleurCode || '#0CC0DF'}
                    onChange={handleInputChange}
                    className="color-picker"
                  />
                  <input
                    type="text"
                    id="vasteKleur"
                    name="vasteKleur"
                    value={formData.vasteKleur}
                    onChange={handleInputChange}
                    placeholder="Kleur naam"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="brandstofType">
                  Brandstof type
                  <span className="info-icon">ℹ️</span>
                </label>
                <select
                  id="brandstofType"
                  name="brandstofType"
                  value={formData.brandstofType}
                  onChange={handleInputChange}
                >
                  <option value="">Selecteer een brandstof</option>
                  <option value="Benzine">Benzine</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Elektrisch">Elektrisch</option>
                  <option value="Hybride">Hybride</option>
                  <option value="LPG">LPG</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="verbruik">
                  Verbruik (?/100km)
                  <span className="info-icon">ℹ️</span>
                </label>
                <input
                  type="number"
                  id="verbruik"
                  name="verbruik"
                  value={formData.verbruik}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label htmlFor="co2Uitstoot">
                  CO2-Uitstoot (g/km)
                  <span className="info-icon">ℹ️</span>
                </label>
                <input
                  type="number"
                  id="co2Uitstoot"
                  name="co2Uitstoot"
                  value={formData.co2Uitstoot}
                  onChange={handleInputChange}
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="chauffeur">
                  Chauffeur *
                  <span className="info-icon">ℹ️</span>
                </label>
                <select
                  id="chauffeur"
                  name="chauffeur"
                  value={formData.chauffeur}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Selecteer een chauffeur</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.name}>
                      {driver.name}
                    </option>
                  ))}
                </select>
                {drivers.length === 0 && (
                  <small style={{ color: '#e74c3c', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Geen chauffeurs beschikbaar. Voeg eerst een chauffeur toe.
                  </small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="starttijd">
                  Starttijd *
                  <span className="info-icon">ℹ️</span>
                </label>
                <div className="time-input-wrapper">
                  <input
                    type="time"
                    id="starttijd"
                    name="starttijd"
                    value={formData.starttijd}
                    onChange={handleInputChange}
                    required
                  />
                  <span className="clock-icon">🕐</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="eindtijd">
                  Eindtijd *
                  <span className="info-icon">ℹ️</span>
                </label>
                <div className="time-input-wrapper">
                  <input
                    type="time"
                    id="eindtijd"
                    name="eindtijd"
                    value={formData.eindtijd}
                    onChange={handleInputChange}
                    required
                  />
                  <span className="clock-icon">🕐</span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="snelheid">
                  Snelheid
                  <span className="info-icon">ℹ️</span>
                </label>
                <select
                  id="snelheid"
                  name="snelheid"
                  value={formData.snelheid}
                  onChange={handleInputChange}
                >
                  <option value="Normaal">🚚 Normaal</option>
                  <option value="Snel">Snel</option>
                  <option value="Langzaam">Langzaam</option>
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="heeftPauze"
                    checked={formData.heeftPauze}
                    onChange={handleInputChange}
                  />
                  Dit voertuig heeft een geplande pauze
                </label>
              </div>

              {formData.heeftPauze && (
                <>
                  <div className="form-group">
                    <label htmlFor="starttijdPauze">
                      Starttijd pauze
                      <span className="info-icon">ℹ️</span>
                    </label>
                    <input
                      type="time"
                      id="starttijdPauze"
                      name="starttijdPauze"
                      value={formData.starttijdPauze}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="eindtijdPauze">
                      Eindtijd pauze
                      <span className="info-icon">ℹ️</span>
                    </label>
                    <input
                      type="time"
                      id="eindtijdPauze"
                      name="eindtijdPauze"
                      value={formData.eindtijdPauze}
                      onChange={handleInputChange}
                    />
                  </div>
                </>
              )}

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn btn-cancel" 
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingVehicle(null);
                  }}
                >
                  Annuleren
                </button>
                <button type="submit" className="btn btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Opslaan...' : (editingVehicle ? 'Bijwerken' : 'Toevoegen')}
                  {editingVehicle ? 'Voertuig bijwerken' : 'Voertuig toevoegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDriverFormOpen && (
        <div className="vehicle-form-overlay">
          <div className="vehicle-form-content" onClick={(e) => e.stopPropagation()}>
            <div className="vehicle-form-header">
              <h2>Chauffeur toevoegen</h2>
              <button className="close-button" onClick={() => setIsDriverFormOpen(false)}>×</button>
            </div>

            <form onSubmit={handleDriverSubmit} className="vehicle-form">
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="withoutAccount"
                    checked={driverFormData.withoutAccount}
                    onChange={(e) => {
                      setDriverFormData(prev => ({
                        ...prev,
                        withoutAccount: e.target.checked,
                        email: e.target.checked ? '' : prev.email,
                        password: e.target.checked ? '' : prev.password
                      }));
                    }}
                    disabled={driverFormLoading}
                  />
                  Chauffeur zonder account toevoegen (geen inlog mogelijk)
                </label>
              </div>

              <div className="form-group">
                <label htmlFor="driver-name">Naam *</label>
                <input
                  type="text"
                  id="driver-name"
                  name="name"
                  value={driverFormData.name}
                  onChange={handleDriverInputChange}
                  required
                  disabled={driverFormLoading}
                />
              </div>

              {!driverFormData.withoutAccount && (
                <>
                  <div className="form-group">
                    <label htmlFor="driver-email">E-mailadres *</label>
                    <input
                      type="email"
                      id="driver-email"
                      name="email"
                      value={driverFormData.email}
                      onChange={handleDriverInputChange}
                      required
                      disabled={driverFormLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="driver-password">Wachtwoord *</label>
                    <input
                      type="password"
                      id="driver-password"
                      name="password"
                      value={driverFormData.password}
                      onChange={handleDriverInputChange}
                      required
                      minLength={6}
                      disabled={driverFormLoading}
                      placeholder="Minimaal 6 tekens"
                    />
                  </div>
                </>
              )}

              {driverFormData.withoutAccount && (
                <div className="form-group">
                  <label htmlFor="driver-email-optional">E-mailadres (optioneel)</label>
                  <input
                    type="email"
                    id="driver-email-optional"
                    name="email"
                    value={driverFormData.email}
                    onChange={handleDriverInputChange}
                    disabled={driverFormLoading}
                    placeholder="Voor contactdoeleinden"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="driver-phone">Telefoonnummer</label>
                <input
                  type="tel"
                  id="driver-phone"
                  name="phone"
                  value={driverFormData.phone}
                  onChange={handleDriverInputChange}
                  disabled={driverFormLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="driver-license">Rijbewijsnummer</label>
                <input
                  type="text"
                  id="driver-license"
                  name="license_number"
                  value={driverFormData.license_number}
                  onChange={handleDriverInputChange}
                  disabled={driverFormLoading}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsDriverFormOpen(false)}
                  disabled={driverFormLoading}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={driverFormLoading}
                >
                  {driverFormLoading ? 'Opslaan...' : 'Chauffeur toevoegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="success-modal-overlay">
          <div className="success-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="success-modal-header">
              <div className="success-icon">✓</div>
              <h2>Chauffeur succesvol toegevoegd!</h2>
            </div>
            <div className="success-modal-body">
              <p>De chauffeur heeft een e-mail ontvangen op:</p>
              <p className="success-email">{successEmail}</p>
              <p className="success-message">Vraag de chauffeur om in zijn e-mailadres te kijken om zijn account te bevestigen.</p>
            </div>
            <div className="success-modal-actions">
              <button
                className="btn-submit"
                onClick={() => setShowSuccessModal(false)}
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-logo-footer">
        <img src="/logo.png" alt="Routenu" />
      </div>

      {/* Email Error Modal */}
      {showEmailErrorModal && (
        <div className="modal-overlay" onClick={() => setShowEmailErrorModal(false)}>
          <div className="modal-content email-error-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>E-mailadres al geregistreerd</h2>
              <button className="close-button" onClick={() => setShowEmailErrorModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Gebruik een ander e-mail adres</p>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowEmailErrorModal(false)}>
                Oké
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Vehicles;

