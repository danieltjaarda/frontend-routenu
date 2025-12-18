import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getUserMonthlyCosts, saveMonthlyCost, deleteMonthlyCost } from '../services/userData';
import './MonthlyCostsManager.css';

function MonthlyCostsManager({ userId }) {
  const [costs, setCosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCost, setEditingCost] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    cost_type: 'advertisement',
    month: new Date().toISOString().slice(0, 7) + '-01' // First day of current month
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (userId) {
      loadCosts();
    }
  }, [userId]);

  const loadCosts = async () => {
    try {
      setLoading(true);
      const userCosts = await getUserMonthlyCosts(userId);
      setCosts(userCosts || []);
    } catch (error) {
      console.error('Error loading costs:', error);
      setMessage('Fout bij laden van kosten');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (cost = null) => {
    if (cost) {
      setEditingCost(cost);
      setFormData({
        name: cost.name || '',
        description: cost.description || '',
        amount: cost.amount || '',
        cost_type: cost.cost_type || 'advertisement',
        month: cost.month ? cost.month.slice(0, 7) + '-01' : new Date().toISOString().slice(0, 7) + '-01'
      });
    } else {
      setEditingCost(null);
      setFormData({
        name: '',
        description: '',
        amount: '',
        cost_type: 'advertisement',
        month: new Date().toISOString().slice(0, 7) + '-01'
      });
    }
    setIsFormOpen(true);
    setMessage('');
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCost(null);
    setFormData({
      name: '',
      description: '',
      amount: '',
      cost_type: 'advertisement',
      month: new Date().toISOString().slice(0, 7) + '-01'
    });
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.amount || parseFloat(formData.amount) <= 0) {
      setMessage('Vul alle verplichte velden in');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const costData = {
        id: editingCost?.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        amount: parseFloat(formData.amount),
        cost_type: formData.cost_type,
        month: formData.month // Already in YYYY-MM-01 format
      };

      await saveMonthlyCost(userId, costData);
      await loadCosts();
      handleCloseForm();
      setMessage('Kosten opgeslagen!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving cost:', error);
      setMessage('Fout bij opslaan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (costId, costName) => {
    if (!window.confirm(`Weet je zeker dat je "${costName}" wilt verwijderen?`)) {
      return;
    }

    try {
      await deleteMonthlyCost(costId);
      await loadCosts();
      setMessage('Kosten verwijderd!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting cost:', error);
      setMessage('Fout bij verwijderen: ' + error.message);
    }
  };

  if (loading) {
    return <div className="loading-message">Laden...</div>;
  }

  return (
    <div className="monthly-costs-manager">
      <div className="costs-header">
        <h3>Maandelijkse Kosten</h3>
        <button className="btn-add-cost" onClick={() => handleOpenForm()}>
          + Kosten toevoegen
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('Fout') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {costs.length === 0 ? (
        <div className="empty-costs">
          <p>Nog geen maandelijkse kosten toegevoegd</p>
        </div>
      ) : (
        <div className="costs-list">
          {costs.map((cost) => (
            <div key={cost.id} className="cost-item">
              <div className="cost-info">
                <div className="cost-name">{cost.name}</div>
                {cost.description && (
                  <div className="cost-description">{cost.description}</div>
                )}
                <div className="cost-meta">
                  <span className="cost-type">{cost.cost_type === 'advertisement' ? 'Advertentie' : 'Overig'}</span>
                  <span className="cost-month">
                    {new Date(cost.month).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div className="cost-amount">€{parseFloat(cost.amount).toFixed(2)}</div>
              <div className="cost-actions">
                <button
                  className="btn-edit-cost"
                  onClick={() => handleOpenForm(cost)}
                  title="Bewerken"
                >
                  ✏️
                </button>
                <button
                  className="btn-delete-cost"
                  onClick={() => handleDelete(cost.id, cost.name)}
                  title="Verwijderen"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="modal-overlay" onClick={handleCloseForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCost ? 'Kosten bewerken' : 'Nieuwe kosten toevoegen'}</h3>
              <button className="close-button" onClick={handleCloseForm}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="cost-form">
              <div className="form-group">
                <label htmlFor="cost-name">Naam *</label>
                <input
                  type="text"
                  id="cost-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Bijv. Google Ads"
                />
              </div>

              <div className="form-group">
                <label htmlFor="cost-description">Beschrijving</label>
                <textarea
                  id="cost-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optionele beschrijving"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label htmlFor="cost-amount">Bedrag (€) *</label>
                <input
                  type="number"
                  id="cost-amount"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label htmlFor="cost-type">Type *</label>
                <select
                  id="cost-type"
                  value={formData.cost_type}
                  onChange={(e) => setFormData({ ...formData, cost_type: e.target.value })}
                  required
                >
                  <option value="advertisement">Advertentie</option>
                  <option value="other">Overig</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="cost-month">Maand *</label>
                <input
                  type="month"
                  id="cost-month"
                  value={formData.month.slice(0, 7)}
                  onChange={(e) => setFormData({ ...formData, month: e.target.value + '-01' })}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseForm}>
                  Annuleren
                </button>
                <button type="submit" className="btn-save" disabled={saving}>
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonthlyCostsManager;

