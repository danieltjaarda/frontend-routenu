import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Checkout.css';

function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [priceId, setPriceId] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Check if this is a success or cancel page
  const sessionId = searchParams.get('session_id');
  const isSuccess = window.location.pathname.includes('/checkout/success');
  const isCancel = window.location.pathname.includes('/checkout/cancel');

  useEffect(() => {
    if (isSuccess && sessionId) {
      // Verify the session was successful
      verifySession(sessionId);
    }
  }, [isSuccess, sessionId]);

  const verifySession = async (sessionId) => {
    try {
      const response = await fetch(`http://localhost:8001/api/checkout-session/${sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        console.log('Session verified:', data.session);
      }
    } catch (error) {
      console.error('Error verifying session:', error);
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    setError('Stripe checkout is niet beschikbaar');
    setLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="checkout-page">
        <div className="checkout-container">
          <div className="checkout-success">
            <div className="success-icon">✓</div>
            <h1>Betaling succesvol!</h1>
            <p>Bedankt voor je betaling. Je ontvangt binnenkort een bevestiging per e-mail.</p>
            <button 
              className="btn-primary"
              onClick={() => navigate('/routes')}
            >
              Terug naar routes
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isCancel) {
    return (
      <div className="checkout-page">
        <div className="checkout-container">
          <div className="checkout-cancel">
            <div className="cancel-icon">×</div>
            <h1>Betaling geannuleerd</h1>
            <p>Je betaling is geannuleerd. Je kunt opnieuw proberen wanneer je wilt.</p>
            <button 
              className="btn-primary"
              onClick={() => navigate('/routes')}
            >
              Terug naar routes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <div className="checkout-form">
          <h1>Checkout</h1>
          <p className="checkout-description">
            Voer een Stripe Price ID in om een checkout sessie te starten.
          </p>

          <form onSubmit={handleCheckout}>
            <div className="form-group">
              <label htmlFor="priceId">Price ID *</label>
              <input
                type="text"
                id="priceId"
                value={priceId}
                onChange={(e) => setPriceId(e.target.value)}
                placeholder="price_xxxxx"
                required
                disabled={loading}
              />
              <small>Voer een Stripe Price ID in (bijv. price_xxxxx)</small>
            </div>

            <div className="form-group">
              <label htmlFor="quantity">Aantal</label>
              <input
                type="number"
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                min="1"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/routes')}
                disabled={loading}
              >
                Annuleren
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !priceId}
              >
                {loading ? 'Laden...' : 'Naar betaling'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Checkout;


