import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { getUserDrivers, deleteItem, saveDriver } from '../services/userData';
import { supabase } from '../lib/supabase';
import './Drivers.css';

function Drivers() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEmailErrorModal, setShowEmailErrorModal] = useState(false);
  const [deletingDriverId, setDeletingDriverId] = useState(null);
  const [isDriverFormOpen, setIsDriverFormOpen] = useState(false);
  const [driverFormData, setDriverFormData] = useState({
    name: '',
    email: '',
    phone: '',
    license_number: '',
    password: '',
    hourly_rate: '',
    withoutAccount: false
  });
  const [driverFormLoading, setDriverFormLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successEmail, setSuccessEmail] = useState('');
  const [editingDriver, setEditingDriver] = useState(null);

  useEffect(() => {
    const loadDrivers = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userDrivers = await getUserDrivers(currentUser.id);
        setDrivers(userDrivers || []);
      } catch (error) {
        console.error('Error loading drivers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDrivers();
  }, [currentUser]);

  // Check if we should open the form automatically
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openForm') === 'true' && !loading && drivers.length === 0) {
      setIsDriverFormOpen(true);
      // Remove the query parameter from URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search, loading, drivers.length, navigate, location.pathname]);

  const handleDeleteDriver = async (driverId, driverName) => {
    if (!window.confirm(`Weet je zeker dat je de chauffeur "${driverName || 'Chauffeur'}" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    if (!currentUser) return;

    try {
      setDeletingDriverId(driverId);
      await deleteItem('drivers', driverId);
      
      // Remove from local state
      setDrivers(prev => prev.filter(d => d.id !== driverId));
      console.log('Chauffeur verwijderd');
    } catch (error) {
      console.error('Error deleting driver:', error);
      alert('Fout bij verwijderen chauffeur: ' + (error.message || 'Onbekende fout'));
    } finally {
      setDeletingDriverId(null);
    }
  };

  const handleDriverInputChange = (e) => {
    const { name, value } = e.target;
    setDriverFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditDriver = (driver) => {
    setEditingDriver(driver);
    setDriverFormData({
      name: driver.name || '',
      email: driver.email || '',
      phone: driver.phone || '',
      license_number: driver.license_number || '',
      password: '',
      hourly_rate: driver.hourly_rate ? driver.hourly_rate.toString() : '',
      withoutAccount: !driver.email
    });
    setIsDriverFormOpen(true);
  };

  const handleUpdateDriver = async (e) => {
    e.preventDefault();
    if (!editingDriver || !currentUser) return;

    setDriverFormLoading(true);
    try {
      const { updateItem } = await import('../services/userData');
      await updateItem('drivers', editingDriver.id, {
        name: driverFormData.name,
        phone: driverFormData.phone || null,
        license_number: driverFormData.license_number || null,
        hourly_rate: driverFormData.hourly_rate ? parseFloat(driverFormData.hourly_rate) : null
      });

      // Reload drivers list
      const userDrivers = await getUserDrivers(currentUser.id);
      setDrivers(userDrivers || []);

      alert('Chauffeur bijgewerkt!');
      setIsDriverFormOpen(false);
      setEditingDriver(null);
      setDriverFormData({
        name: '',
        email: '',
        phone: '',
        license_number: '',
        password: '',
        hourly_rate: '',
        withoutAccount: false
      });
    } catch (error) {
      console.error('Error updating driver:', error);
      alert('Fout bij bijwerken chauffeur: ' + (error.message || 'Onbekende fout'));
    } finally {
      setDriverFormLoading(false);
    }
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
                  throw new Error('Probeer een ander e-mail adres');
                }
              }
            } catch (checkError) {
              console.error('Error checking if user exists:', checkError);
              // If we can't verify, assume user was not created
              throw new Error('Probeer een ander e-mail adres');
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
          license_number: driverFormData.license_number || null,
          hourly_rate: driverFormData.hourly_rate ? parseFloat(driverFormData.hourly_rate) : null
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
        setIsDriverFormOpen(false);
        setDriverFormData({
          name: '',
          email: '',
          phone: '',
          license_number: '',
          password: '',
          hourly_rate: '',
          withoutAccount: false
        });
      } else {
        setSuccessEmail(driverFormData.email.trim().toLowerCase());
        setIsDriverFormOpen(false);
        setDriverFormData({
          name: '',
          email: '',
          phone: '',
          license_number: '',
          password: '',
          hourly_rate: '',
          withoutAccount: false
        });
        setShowSuccessModal(true);
      }

      // After adding driver, check if vehicle is needed and redirect
      try {
        const { getUserVehicles } = await import('../services/userData');
        const userVehicles = await getUserVehicles(currentUser.id);
        if (!userVehicles || userVehicles.length === 0) {
          // No vehicle yet, redirect to vehicles page after a short delay
          setTimeout(() => {
            window.location.href = '/voertuigen';
          }, 2000);
        }
      } catch (error) {
        console.error('Error checking vehicles:', error);
        // Still redirect to vehicles page as fallback
        setTimeout(() => {
          window.location.href = '/voertuigen';
        }, 2000);
      }
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

  return (
    <div className="drivers-page">
      <div className="drivers-header">
        <h1>Chauffeurs</h1>
        <div className="drivers-controls">
          <button className="btn-new-route btn-driver" onClick={() => setIsDriverFormOpen(true)}>
            <span className="plus-icon">+</span>
            Chauffeur toevoegen
          </button>
        </div>
      </div>

      <div className="routes-table-container">
        {loading ? (
          <div className="empty-routes">
            <p>Chauffeurs laden...</p>
          </div>
        ) : drivers.length > 0 ? (
          <table className="routes-table">
            <thead>
              <tr>
                <th>Naam</th>
                <th>E-mailadres</th>
                <th>Telefoonnummer</th>
                <th>Rijbewijsnummer</th>
                <th>Uurtarief</th>
                <th>Beschikbare dagen</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => {
                // Format available days for display
                const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
                const availableDays = driver.available_days || [];
                const availableDaysDisplay = availableDays.length > 0 
                  ? availableDays.map(day => dayNames[day]).join(', ')
                  : '-';
                
                return (
                <tr key={driver.id} className="route-row">
                  <td className="route-name">{driver.name || 'Chauffeur zonder naam'}</td>
                  <td>{driver.email || '-'}</td>
                  <td>{driver.phone || '-'}</td>
                  <td>{driver.license_number || '-'}</td>
                  <td>{driver.hourly_rate ? `€${parseFloat(driver.hourly_rate).toFixed(2)}` : '-'}</td>
                  <td style={{ fontSize: '13px', color: availableDays.length > 0 ? '#1d1d1f' : '#86868b' }}>
                    {availableDaysDisplay}
                  </td>
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="action-buttons">
                      <button 
                        className="btn-edit"
                        onClick={() => handleEditDriver(driver)}
                        title="Chauffeur bewerken"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeleteDriver(driver.id, driver.name)}
                        disabled={deletingDriverId === driver.id}
                        title="Chauffeur verwijderen"
                      >
                        {deletingDriverId === driver.id ? (
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
              );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-routes">
            <p>Nog geen chauffeurs toegevoegd</p>
            <p className="empty-hint">Klik op "+ Chauffeur toevoegen" om een chauffeur toe te voegen</p>
          </div>
        )}
      </div>

      {isDriverFormOpen && (
        <div className="vehicle-form-overlay">
          <div className="vehicle-form-content" onClick={(e) => e.stopPropagation()}>
            <div className="vehicle-form-header">
              <h2>{editingDriver ? 'Chauffeur bewerken' : 'Chauffeur toevoegen'}</h2>
              <button className="close-button" onClick={() => {
                setIsDriverFormOpen(false);
                setEditingDriver(null);
                setDriverFormData({
                  name: '',
                  email: '',
                  phone: '',
                  license_number: '',
                  password: '',
                  hourly_rate: '',
                  withoutAccount: false
                });
              }}>×</button>
            </div>

            <form onSubmit={editingDriver ? handleUpdateDriver : handleDriverSubmit} className="vehicle-form">
              {!editingDriver && (
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
              )}

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

              {!editingDriver && !driverFormData.withoutAccount && (
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

              {!editingDriver && driverFormData.withoutAccount && (
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

              {editingDriver && driverFormData.email && (
                <div className="form-group">
                  <label>E-mailadres</label>
                  <input
                    type="email"
                    value={driverFormData.email}
                    disabled
                    className="input-disabled"
                  />
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    E-mailadres kan niet worden gewijzigd
                  </small>
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

              <div className="form-group">
                <label htmlFor="driver-hourly-rate">Uurloon (€)</label>
                <input
                  type="number"
                  id="driver-hourly-rate"
                  name="hourly_rate"
                  value={driverFormData.hourly_rate}
                  onChange={handleDriverInputChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  disabled={driverFormLoading}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setIsDriverFormOpen(false);
                    setEditingDriver(null);
                    setDriverFormData({
                      name: '',
                      email: '',
                      phone: '',
                      license_number: '',
                      password: '',
                      hourly_rate: '',
                      withoutAccount: false
                    });
                  }}
                  disabled={driverFormLoading}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={driverFormLoading}
                >
                  {driverFormLoading ? 'Opslaan...' : (editingDriver ? 'Chauffeur bijwerken' : 'Chauffeur toevoegen')}
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
    </div>
  );
}

export default Drivers;

