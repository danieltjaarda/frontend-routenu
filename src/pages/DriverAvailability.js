import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserDrivers } from '../services/userData';
import { supabase } from '../lib/supabase';
import './DriverAvailability.css';

function DriverAvailability() {
  const { currentUser } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);

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
        if (userDrivers && userDrivers.length > 0) {
          setSelectedDriver(userDrivers[0]);
        }
      } catch (error) {
        console.error('Error loading drivers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDrivers();
  }, [currentUser]);

  // Get current week and next few weeks
  const getWeeks = () => {
    const weeks = [];
    const today = new Date();
    
    for (let i = 0; i < 8; i++) {
      const weekDate = new Date(today);
      weekDate.setDate(today.getDate() + (i * 7));
      const weekKey = getWeekKey(weekDate);
      const weekNumber = weekKey.split('-W')[1];
      const year = weekKey.split('-W')[0];
      
      weeks.push({
        weekKey,
        weekNumber,
        year,
        date: new Date(weekDate),
        isCurrent: i === 0
      });
    }
    
    return weeks;
  };

  // Get ISO week key (format: "2024-W01")
  const getWeekKey = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const year = d.getFullYear();
    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
  };

  const weeks = getWeeks();
  const currentWeekKey = weeks[0]?.weekKey;
  const displayWeek = selectedWeek || currentWeekKey;

  // Get availability for selected driver and week
  const getDriverAvailability = (driver, weekKey) => {
    if (!driver || !driver.availability_schedule) return {};
    return driver.availability_schedule[weekKey] || {};
  };

  const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  const dayNamesShort = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

  const formatAvailability = (availability) => {
    if (!availability || Object.keys(availability).length === 0) {
      return 'Geen beschikbaarheid';
    }

    const days = Object.keys(availability)
      .map(day => {
        const dayIndex = parseInt(day);
        const time = availability[day];
        return `${dayNamesShort[dayIndex]} tot ${time}`;
      })
      .join(', ');

    return days;
  };

  if (loading) {
    return (
      <div className="driver-availability-page">
        <div className="loading-message">Laden...</div>
      </div>
    );
  }

  return (
    <div className="driver-availability-page">
      <div className="page-header">
        <h1>Beschikbaarheid Monteurs</h1>
        <p>Bekijk de beschikbaarheid van monteurs per week</p>
      </div>

      <div className="availability-controls">
        <div className="driver-selector">
          <label>Selecteer monteur:</label>
          <select
            value={selectedDriver?.id || ''}
            onChange={(e) => {
              const driver = drivers.find(d => d.id === e.target.value);
              setSelectedDriver(driver);
            }}
          >
            {drivers.map(driver => (
              <option key={driver.id} value={driver.id}>
                {driver.name || 'Naamloze monteur'}
              </option>
            ))}
          </select>
        </div>

        <div className="week-selector">
          <label>Selecteer week:</label>
          <select
            value={displayWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            {weeks.map(week => (
              <option key={week.weekKey} value={week.weekKey}>
                {week.isCurrent ? 'Huidige week' : 'Week'} {week.weekNumber} ({week.year})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedDriver && (
        <div className="availability-content">
          <div className="driver-info-card">
            <h2>{selectedDriver.name || 'Naamloze monteur'}</h2>
            <p>{selectedDriver.email || '-'}</p>
          </div>

          <div className="week-availability-card">
            <h3>
              Week {weeks.find(w => w.weekKey === displayWeek)?.weekNumber} 
              {weeks.find(w => w.weekKey === displayWeek)?.isCurrent && ' (Huidige week)'}
            </h3>
            
            <div className="availability-details">
              {(() => {
                const availability = getDriverAvailability(selectedDriver, displayWeek);
                if (Object.keys(availability).length === 0) {
                  return (
                    <div className="no-availability">
                      <p>Geen beschikbaarheid ingevuld voor deze week</p>
                    </div>
                  );
                }

                return (
                  <div className="availability-grid">
                    {dayNames.map((dayName, dayIndex) => {
                      const time = availability[dayIndex.toString()];
                      return (
                        <div key={dayIndex} className={`availability-day ${time ? 'available' : 'not-available'}`}>
                          <div className="day-name">{dayName}</div>
                          {time ? (
                            <div className="day-time">Tot {time}</div>
                          ) : (
                            <div className="day-time">Niet beschikbaar</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Show all weeks summary */}
          <div className="all-weeks-summary">
            <h3>Overzicht alle weken</h3>
            <div className="weeks-list">
              {weeks.map(week => {
                const availability = getDriverAvailability(selectedDriver, week.weekKey);
                return (
                  <div key={week.weekKey} className={`week-summary-item ${week.isCurrent ? 'current-week' : ''}`}>
                    <div className="week-header-summary">
                      <span className="week-label">
                        Week {week.weekNumber} {week.isCurrent && '(Huidige week)'}
                      </span>
                    </div>
                    <div className="week-availability-summary">
                      {formatAvailability(availability)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {drivers.length === 0 && (
        <div className="empty-state">
          <p>Nog geen monteurs toegevoegd</p>
          <p className="empty-hint">Voeg eerst monteurs toe via het Chauffeurs menu</p>
        </div>
      )}
    </div>
  );
}

export default DriverAvailability;

