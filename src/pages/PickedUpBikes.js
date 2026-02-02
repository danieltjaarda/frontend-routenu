import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPickedUpBikes } from '../services/userData';
import './PickedUpBikes.css';

function PickedUpBikes() {
  const { currentUser } = useAuth();
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadBikes = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getPickedUpBikes(currentUser.id);
        setBikes(data || []);
        setError(null);
      } catch (err) {
        console.error('Error loading picked up bikes:', err);
        setError('Fout bij het laden van opgehaalde fietsen');
      } finally {
        setLoading(false);
      }
    };

    loadBikes();
  }, [currentUser]);

  const calculateDaysSincePickup = (pickedUpAt) => {
    if (!pickedUpAt) return 0;
    const pickupDate = new Date(pickedUpAt);
    const today = new Date();
    const diffTime = Math.abs(today - pickupDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="picked-up-bikes-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-message">Opgehaalde fietsen laden...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="picked-up-bikes-page">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="picked-up-bikes-page">
      <div className="page-header">
        <h1>Opgehaalde Fietsen</h1>
        <p className="page-subtitle">Overzicht van alle opgehaalde fietsen</p>
      </div>

      {bikes.length === 0 ? (
        <div className="empty-state">
          <p>Er zijn nog geen opgehaalde fietsen.</p>
        </div>
      ) : (
        <div className="bikes-list">
          {bikes.map((bike) => {
            const daysSince = calculateDaysSincePickup(bike.picked_up_at);
            return (
              <div key={bike.id} className="bike-card">
                <div className="bike-card-header">
                  <div className="bike-info">
                    <h3>{bike.stop_name || 'Onbekende stop'}</h3>
                    <p className="bike-address">{bike.stop_address || '-'}</p>
                  </div>
                  <div className="days-badge">
                    <span className="days-number">{daysSince}</span>
                    <span className="days-label">dag{daysSince !== 1 ? 'en' : ''}</span>
                  </div>
                </div>
                <div className="bike-details">
                  <div className="detail-row">
                    <span className="detail-label">Route:</span>
                    <span className="detail-value">{bike.route_name || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Route datum:</span>
                    <span className="detail-value">{bike.route_date ? formatDate(bike.route_date) : '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Opgehaald op:</span>
                    <span className="detail-value">{formatDateTime(bike.picked_up_at)}</span>
                  </div>
                  {bike.driver_name && (
                    <div className="detail-row">
                      <span className="detail-label">Chauffeur:</span>
                      <span className="detail-value">{bike.driver_name}</span>
                    </div>
                  )}
                  {bike.stop_email && (
                    <div className="detail-row">
                      <span className="detail-label">E-mail:</span>
                      <span className="detail-value">{bike.stop_email}</span>
                    </div>
                  )}
                  {bike.stop_phone && (
                    <div className="detail-row">
                      <span className="detail-label">Telefoon:</span>
                      <span className="detail-value">{bike.stop_phone}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PickedUpBikes;

