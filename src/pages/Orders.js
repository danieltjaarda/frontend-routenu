import React, { useState, useMemo, useEffect } from 'react';
import { getOrderCompletionInfo } from '../services/userData';
import './Orders.css';

function Orders({ allOrders, onAddOrderToRoute }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Alle opdrachten');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderCompletionInfo, setOrderCompletionInfo] = useState(null);
  const [loadingCompletionInfo, setLoadingCompletionInfo] = useState(false);

  // Load completion info when order is selected
  useEffect(() => {
    const loadCompletionInfo = async () => {
      if (selectedOrder) {
        setLoadingCompletionInfo(true);
        try {
          const info = await getOrderCompletionInfo(selectedOrder.id);
          setOrderCompletionInfo(info);
        } catch (error) {
          console.error('Error loading completion info:', error);
          setOrderCompletionInfo(null);
        } finally {
          setLoadingCompletionInfo(false);
        }
      }
    };
    
    loadCompletionInfo();
  }, [selectedOrder]);

  // Filter opdrachten op basis van zoekterm en status
  const filteredOrders = useMemo(() => {
    let filtered = allOrders;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => 
        order.name?.toLowerCase().includes(query) ||
        order.address?.toLowerCase().includes(query) ||
        order.email?.toLowerCase().includes(query) ||
        order.phone?.includes(query) ||
        order.orderType?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (filterStatus === 'Actieve opdrachten') {
      filtered = filtered.filter(order => !order.is_completed);
    } else if (filterStatus === 'Voltooide opdrachten') {
      filtered = filtered.filter(order => order.is_completed);
    }
    
    return filtered;
  }, [allOrders, searchQuery, filterStatus]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="orders-page">
      <div className="orders-header">
        <h1>Opdrachten</h1>
        
        <div className="orders-controls">
          <div className="search-container">
          <input
            type="text"
              className="search-input"
            placeholder="Zoek in opdrachten..."
            value={searchQuery}
              onChange={handleSearchChange}
          />
          {searchQuery && (
            <button 
                className="clear-search"
                onClick={handleClearSearch}
              title="Wis zoekopdracht"
            >
              ×
            </button>
          )}
          </div>
          
          <select 
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option>Alle opdrachten</option>
            <option>Actieve opdrachten</option>
            <option>Voltooide opdrachten</option>
          </select>
        </div>
      </div>

      <div className="routes-table-container">
      {filteredOrders.length === 0 ? (
          <div className="empty-routes">
          <p>{searchQuery ? 'Geen opdrachten gevonden' : 'Nog geen opdrachten toegevoegd'}</p>
          {!searchQuery && (
            <p className="empty-hint">Voeg opdrachten toe via de Routes pagina</p>
          )}
        </div>
      ) : (
          <table className="routes-table">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Adres</th>
                <th>E-mail</th>
                <th>Telefoon</th>
                <th>Type</th>
                <th>Status</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
          {filteredOrders.map((order) => (
                <tr 
                  key={order.id} 
                  className={`route-row ${order.is_completed ? 'order-completed' : ''}`}
                  onClick={() => setSelectedOrder(order)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="route-name">{order.name || '-'}</td>
                  <td>{order.address || '-'}</td>
                  <td>{order.email || '-'}</td>
                  <td>{order.phone || '-'}</td>
                  <td>
                    {order.orderType && (
                      <span className="order-type-badge">{order.orderType}</span>
                    )}
                    {!order.orderType && '-'}
                  </td>
                  <td>
                    {order.is_completed ? (
                      <span className="order-status completed" title="Voltooid">
                        ✓ Voltooid
                      </span>
                    ) : (
                      <span className="order-status pending" title="Niet voltooid">
                        Actief
                      </span>
                    )}
                  </td>
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <div className="action-buttons">
                      {onAddOrderToRoute && (
                        <button
                          className="btn-edit"
                          onClick={() => onAddOrderToRoute(order)}
                          title="Toevoegen aan route"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
          ))}
            </tbody>
          </table>
        )}
        </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content order-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Opdracht Details</h2>
              <button className="close-button" onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="order-detail-section">
                <h3>Basis Informatie</h3>
                <div className="detail-row">
                  <strong>Naam:</strong>
                  <span>{selectedOrder.name || '-'}</span>
                </div>
                <div className="detail-row">
                  <strong>Adres:</strong>
                  <span>{selectedOrder.address || '-'}</span>
                </div>
                <div className="detail-row">
                  <strong>E-mail:</strong>
                  <span>{selectedOrder.email || '-'}</span>
                </div>
                <div className="detail-row">
                  <strong>Telefoon:</strong>
                  <span>{selectedOrder.phone || '-'}</span>
                </div>
                <div className="detail-row">
                  <strong>Type:</strong>
                  <span>{selectedOrder.orderType || '-'}</span>
                </div>
                <div className="detail-row">
                  <strong>Status:</strong>
                  <span>
                    {selectedOrder.is_completed ? (
                      <span className="order-status completed">✓ Voltooid</span>
                    ) : (
                      <span className="order-status pending">Actief</span>
                    )}
                  </span>
                </div>
              </div>

              {loadingCompletionInfo ? (
                <div className="loading-message">Laden...</div>
              ) : orderCompletionInfo && orderCompletionInfo.is_completed ? (
                <div className="order-detail-section">
                  <h3>Voltooiing Informatie</h3>
                  <div className="detail-row">
                    <strong>Voltooid op:</strong>
                    <span>
                      {orderCompletionInfo.completed_at 
                        ? new Date(orderCompletionInfo.completed_at).toLocaleString('nl-NL')
                        : '-'}
                    </span>
                  </div>
                  {orderCompletionInfo.route_name && (
                    <div className="detail-row">
                      <strong>Route:</strong>
                      <span>{orderCompletionInfo.route_name}</span>
                    </div>
                  )}
                  {orderCompletionInfo.route_date && (
                    <div className="detail-row">
                      <strong>Route datum:</strong>
                      <span>{new Date(orderCompletionInfo.route_date).toLocaleDateString('nl-NL')}</span>
                    </div>
                  )}
                  {orderCompletionInfo.work_description && (
                    <div className="detail-row">
                      <strong>Werkzaamheden:</strong>
                      <span>{orderCompletionInfo.work_description}</span>
                    </div>
                  )}
                  {orderCompletionInfo.amount_received && (
                    <div className="detail-row">
                      <strong>Ontvangen bedrag:</strong>
                      <span>€{parseFloat(orderCompletionInfo.amount_received).toFixed(2)}</span>
                    </div>
                  )}
                  {orderCompletionInfo.parts_cost && (
                    <div className="detail-row">
                      <strong>Onderdelen kosten:</strong>
                      <span>€{parseFloat(orderCompletionInfo.parts_cost).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ) : selectedOrder.is_completed ? (
                <div className="order-detail-section">
                  <p className="info-message">Deze opdracht is voltooid, maar er zijn geen aanvullende details beschikbaar.</p>
                </div>
              ) : null}
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSelectedOrder(null)}>
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

export default Orders;

