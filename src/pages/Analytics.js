import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserVehicles, getMonthlyCostsForMonth } from '../services/userData';
import './Analytics.css';

// Active Route Card Component
function ActiveRouteCard({ route }) {
  const [routeStopDetails, setRouteStopDetails] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  useEffect(() => {
    const loadDetails = async () => {
      try {
        const { data } = await supabase
          .from('route_stop_details')
          .select('stop_index, completed_at')
          .eq('route_id', route.id);
        setRouteStopDetails(data || []);
      } catch (error) {
        console.error('Error loading stop details:', error);
      }
    };
    loadDetails();
  }, [route.id]);
  
  const completedStops = routeStopDetails.filter(d => d.completed_at).length;
  const totalStops = route.stops?.length || 0;
  const progressPercentage = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;
  
  const routeDate = route.date 
    ? new Date(route.date).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : '-';
  
  const startedAt = route.route_started_at 
    ? new Date(route.route_started_at).toLocaleTimeString('nl-NL', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-';
  
  return (
    <div className="active-route-card">
      <div className="active-route-header">
        <div className="active-route-info">
          <h3>{route.name || 'Route zonder naam'}</h3>
          <div className="active-route-meta">
            <span className="meta-item">
              <svg className="meta-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2V6M14 2V6M3 10H17M5 4H15C16.1046 4 17 4.89543 17 6V16C17 17.1046 16.1046 18 15 18H5C3.89543 18 3 17.1046 3 16V6C3 4.89543 3.89543 4 5 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {routeDate}
            </span>
            <span className="meta-item">
              <svg className="meta-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 10C3 6.68629 5.68629 4 9 4H11C14.3137 4 17 6.68629 17 10C17 13.3137 14.3137 16 11 16H9C5.68629 16 3 13.3137 3 10Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 10H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {route.drivers?.name || route.selected_driver || 'Geen chauffeur'}
            </span>
            {startedAt !== '-' && (
              <span className="meta-item">
                <svg className="meta-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 6V10L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Gestart om {startedAt}
              </span>
            )}
          </div>
        </div>
        <div className="active-route-status">
          <span className="status-badge started">LIVE</span>
        </div>
      </div>
      <div className="active-route-progress">
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="progress-text">
          {completedStops} van {totalStops} stops voltooid ({Math.round(progressPercentage)}%)
        </div>
      </div>
      {route.stops && route.stops.length > 0 && (
        <div className="active-route-stops">
          <button 
            className="toggle-stops-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Verberg' : 'Toon'} stops ({totalStops})
            <span className="toggle-icon">{isExpanded ? '▲' : '▼'}</span>
          </button>
          {isExpanded && (
            <div className="stops-list-active">
              {route.stops.map((stop, index) => {
                const isCompleted = routeStopDetails.some(
                  d => d.stop_index === index && d.completed_at
                );
                return (
                  <div 
                    key={index} 
                    className={`stop-item-active ${isCompleted ? 'completed' : ''}`}
                  >
                    <span className="stop-number-active">{index + 1}</span>
                    <div className="stop-info-active">
                      <div className="stop-name-active">{stop.name || `Stop ${index + 1}`}</div>
                      {stop.address && (
                        <div className="stop-address-active">
                          <svg className="address-icon" width="12" height="12" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 1C6.13401 1 3 4.13401 3 8C3 12.5 10 19 10 19C10 19 17 12.5 17 8C17 4.13401 13.866 1 10 1Z" stroke="currentColor" strokeWidth="1.5"/>
                            <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
                          </svg>
                          {stop.address}
                        </div>
                      )}
                    </div>
                    {isCompleted && (
                      <span className="stop-check">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M16.6667 5L7.5 14.1667L3.33334 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Analytics() {
  const { currentUser } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [allRoutes, setAllRoutes] = useState([]);
  const [activeRoutes, setActiveRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stopDetails, setStopDetails] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [btwPercentage, setBtwPercentage] = useState(() => {
    const saved = localStorage.getItem('analytics_btw_percentage');
    return saved ? parseFloat(saved) : 0;
  });
  const [tempBtwPercentage, setTempBtwPercentage] = useState(btwPercentage);
  
  // Shop repairs state
  const [shopRepairs, setShopRepairs] = useState([]);
  const [allShopRepairs, setAllShopRepairs] = useState([]);
  const [showAddRepairModal, setShowAddRepairModal] = useState(false);
  const [editingRepair, setEditingRepair] = useState(null);
  const [repairForm, setRepairForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    customer_name: '',
    revenue: '',
    parts_cost: '',
    labor_hours: '',
    btw_percentage: '21'
  });
  const [activeTab, setActiveTab] = useState('routes'); // 'routes' or 'shop'

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Get today's date as YYYY-MM-DD string using local time
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        
        // Load completed routes
        const { data: routesData, error: routesError } = await supabase
          .from('routes')
          .select(`
            *,
            drivers (
              name,
              email,
              hourly_rate
            )
          `)
          .eq('user_id', currentUser.id)
          .eq('route_status', 'completed')
          .order('date', { ascending: false });

        if (routesError) throw routesError;
        setAllRoutes(routesData || []);
        setRoutes(routesData || []);
        
        // Load active routes (started, today or future)
        const { data: activeRoutesData, error: activeRoutesError } = await supabase
          .from('routes')
          .select(`
            *,
            drivers (
              name,
              email,
              hourly_rate
            )
          `)
          .eq('user_id', currentUser.id)
          .eq('route_status', 'started')
          .gte('date', todayStr)
          .order('date', { ascending: true })
          .order('route_started_at', { ascending: false });

        if (activeRoutesError) {
          console.error('Error loading active routes:', activeRoutesError);
        } else {
          setActiveRoutes(activeRoutesData || []);
        }
        
        // Load shop repairs
        const { data: repairsData, error: repairsError } = await supabase
          .from('shop_repairs')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('date', { ascending: false });

        if (repairsError) {
          console.log('Shop repairs table might not exist yet:', repairsError);
          setAllShopRepairs([]);
          setShopRepairs([]);
        } else {
          setAllShopRepairs(repairsData || []);
          setShopRepairs(repairsData || []);
        }
        
        // Load vehicles
        const userVehicles = await getUserVehicles(currentUser.id);
        setVehicles(userVehicles || []);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  // Filter routes and shop repairs based on selected period
  useEffect(() => {
    const filterByPeriod = (items, dateField = 'date') => {
      if (periodFilter === 'all') return items;
      if (periodFilter === 'date' && !selectedDate) return [];

      const now = new Date();
      return items.filter(item => {
        if (!item[dateField]) return false;
        const itemDate = new Date(item[dateField]);
        
        switch (periodFilter) {
          case 'day':
            return itemDate.toDateString() === now.toDateString();
          
          case 'date':
            if (!selectedDate) return false;
            const selected = new Date(selectedDate);
            return itemDate.toDateString() === selected.toDateString();
          
          case 'week':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            return itemDate >= weekStart && itemDate <= weekEnd;
          
          case 'month':
            return itemDate.getMonth() === now.getMonth() && 
                   itemDate.getFullYear() === now.getFullYear();
          
          case 'quarter':
            const currentQuarter = Math.floor(now.getMonth() / 3);
            const itemQuarter = Math.floor(itemDate.getMonth() / 3);
            return itemQuarter === currentQuarter && 
                   itemDate.getFullYear() === now.getFullYear();
          
          case 'year':
            return itemDate.getFullYear() === now.getFullYear();
          
          default:
            return true;
        }
      });
    };

    setRoutes(filterByPeriod(allRoutes));
    setShopRepairs(filterByPeriod(allShopRepairs));
  }, [periodFilter, allRoutes, allShopRepairs, selectedDate]);

  const loadStopDetails = async (routeId) => {
    try {
      const { data, error } = await supabase
        .from('route_stop_details')
        .select('*')
        .eq('route_id', routeId)
        .order('stop_index', { ascending: true });

      if (error) throw error;
      setStopDetails(data || []);
    } catch (error) {
      console.error('Error loading stop details:', error);
    }
  };

  const handleRouteClick = async (route) => {
    if (selectedRoute?.id === route.id) {
      setSelectedRoute(null);
      setStopDetails([]);
    } else {
      setSelectedRoute(route);
      await loadStopDetails(route.id);
    }
  };

  const calculateTotalRevenue = (route) => {
    if (!stopDetails.length || stopDetails[0]?.route_id !== route.id) return 0;
    return stopDetails.reduce((sum, detail) => sum + (parseFloat(detail.amount_received) || 0), 0);
  };

  const calculateTotalPartsCost = (route) => {
    if (!stopDetails.length || stopDetails[0]?.route_id !== route.id) return 0;
    return stopDetails.reduce((sum, detail) => sum + (parseFloat(detail.parts_cost) || 0), 0);
  };

  const calculateVehicleCost = (route) => {
    const distanceKm = route.actual_distance_km 
      ? parseFloat(route.actual_distance_km) 
      : (route.route_data?.distance ? route.route_data.distance / 1000 : 0);
    
    if (distanceKm === 0) return 0;
    
    if (route.diesel_price_per_liter) {
      const vehicleWithConsumption = vehicles.find(v => v.consumption);
      if (vehicleWithConsumption && vehicleWithConsumption.consumption) {
        const consumptionStr = vehicleWithConsumption.consumption.toString();
        const consumptionMatch = consumptionStr.match(/(\d+\.?\d*)/);
        const consumptionLitersPer100km = consumptionMatch ? parseFloat(consumptionMatch[1]) : 0;
        
        if (consumptionLitersPer100km > 0) {
          const fuelCost = (distanceKm / 100) * consumptionLitersPer100km * parseFloat(route.diesel_price_per_liter);
          return fuelCost;
        }
      }
    }
    
    const vehicleWithCost = vehicles.find(v => v.cents_per_km && v.cents_per_km > 0);
    if (!vehicleWithCost || !vehicleWithCost.cents_per_km) return 0;
    
    return (distanceKm * parseFloat(vehicleWithCost.cents_per_km)) / 100;
  };

  const calculateDriverCost = (route) => {
    const hoursWorked = parseFloat(route.hours_worked) || 0;
    const hourlyRate = route.drivers?.hourly_rate ? parseFloat(route.drivers.hourly_rate) : 0;
    return hoursWorked * hourlyRate;
  };

  const calculateProfit = (route) => {
    const revenue = calculateTotalRevenue(route);
    const partsCost = calculateTotalPartsCost(route);
    const vehicleCost = calculateVehicleCost(route);
    const driverCost = calculateDriverCost(route);
    
    return revenue - partsCost - vehicleCost - driverCost;
  };

  // Shop repair functions
  const handleAddRepair = async () => {
    if (!currentUser) return;
    
    try {
      const repairData = {
        user_id: currentUser.id,
        date: repairForm.date,
        description: repairForm.description || null,
        customer_name: repairForm.customer_name || null,
        revenue: parseFloat(repairForm.revenue) || 0,
        parts_cost: parseFloat(repairForm.parts_cost) || 0,
        labor_hours: parseFloat(repairForm.labor_hours) || 0,
        btw_percentage: parseFloat(repairForm.btw_percentage) || 21
      };

      if (editingRepair) {
        const { error } = await supabase
          .from('shop_repairs')
          .update(repairData)
          .eq('id', editingRepair.id);
        
        if (error) throw error;
        
        setAllShopRepairs(prev => prev.map(r => r.id === editingRepair.id ? { ...r, ...repairData } : r));
      } else {
        const { data, error } = await supabase
          .from('shop_repairs')
          .insert(repairData)
          .select()
          .single();
        
        if (error) throw error;
        
        setAllShopRepairs(prev => [data, ...prev]);
      }
      
      resetRepairForm();
    } catch (error) {
      console.error('Error saving repair:', error);
      alert('Fout bij opslaan van reparatie. Controleer of de tabel bestaat in Supabase.');
    }
  };

  const handleEditRepair = (repair) => {
    setEditingRepair(repair);
    setRepairForm({
      date: repair.date,
      description: repair.description || '',
      customer_name: repair.customer_name || '',
      revenue: repair.revenue?.toString() || '',
      parts_cost: repair.parts_cost?.toString() || '',
      labor_hours: repair.labor_hours?.toString() || '',
      btw_percentage: repair.btw_percentage?.toString() || '21'
    });
    setShowAddRepairModal(true);
  };

  const handleDeleteRepair = async (repairId) => {
    if (!window.confirm('Weet je zeker dat je deze reparatie wilt verwijderen?')) return;
    
    try {
      const { error } = await supabase
        .from('shop_repairs')
        .delete()
        .eq('id', repairId);
      
      if (error) throw error;
      
      setAllShopRepairs(prev => prev.filter(r => r.id !== repairId));
    } catch (error) {
      console.error('Error deleting repair:', error);
    }
  };

  const resetRepairForm = () => {
    setShowAddRepairModal(false);
    setEditingRepair(null);
    setRepairForm({
      date: new Date().toISOString().split('T')[0],
      description: '',
      customer_name: '',
      revenue: '',
      parts_cost: '',
      labor_hours: '',
      btw_percentage: '21'
    });
  };

  const [totals, setTotals] = useState({ 
    totalRevenue: 0, 
    totalPartsCost: 0, 
    totalVehicleCost: 0, 
    totalDriverCost: 0, 
    totalMonthlyCosts: 0, 
    totalProfit: 0,
    totalDistance: 0,
    totalHours: 0,
    shopRevenue: 0,
    shopPartsCost: 0,
    shopHours: 0,
    shopLaborCost: 0
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadTotals = async () => {
      if (routes.length === 0 && shopRepairs.length === 0) {
        setTotals({ 
          totalRevenue: 0, totalPartsCost: 0, totalVehicleCost: 0, totalDriverCost: 0, 
          totalMonthlyCosts: 0, totalProfit: 0, totalDistance: 0, totalHours: 0,
          shopRevenue: 0, shopPartsCost: 0, shopHours: 0, shopLaborCost: 0
        });
        return;
      }

      let totalRevenue = 0;
      let totalPartsCost = 0;
      let totalVehicleCost = 0;
      let totalDriverCost = 0;
      let totalMonthlyCosts = 0;
      let totalDistance = 0;
      let totalHours = 0;

      // Calculate shop repair totals
      let shopRevenue = 0;
      let shopPartsCost = 0;
      let shopHours = 0;
      let shopLaborCost = 0;
      const LABOR_RATE = 20; // €20 per uur
      
      shopRepairs.forEach(repair => {
        shopRevenue += parseFloat(repair.revenue) || 0;
        shopPartsCost += parseFloat(repair.parts_cost) || 0;
        const hours = parseFloat(repair.labor_hours) || 0;
        shopHours += hours;
        shopLaborCost += hours * LABOR_RATE;
      });

      try {
        let monthToCheck = new Date();
        if (periodFilter === 'date' && selectedDate) {
          monthToCheck = new Date(selectedDate);
        }
        
        if (periodFilter === 'all') {
          const uniqueMonths = new Set();
          routes.forEach(route => {
            if (route.date) {
              const routeDate = new Date(route.date);
              const monthKey = `${routeDate.getFullYear()}-${String(routeDate.getMonth() + 1).padStart(2, '0')}`;
              uniqueMonths.add(monthKey);
            }
          });
          
          for (const monthKey of uniqueMonths) {
            const [year, month] = monthKey.split('-');
            const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const costs = await getMonthlyCostsForMonth(currentUser.id, monthDate);
            totalMonthlyCosts += costs.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0);
          }
        } else {
          if (periodFilter === 'quarter') {
            const currentQuarter = Math.floor(monthToCheck.getMonth() / 3);
            for (let i = 0; i < 3; i++) {
              const monthDate = new Date(monthToCheck.getFullYear(), currentQuarter * 3 + i, 1);
              const costs = await getMonthlyCostsForMonth(currentUser.id, monthDate);
              totalMonthlyCosts += costs.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0);
            }
          } else if (periodFilter === 'year') {
            for (let i = 0; i < 12; i++) {
              const monthDate = new Date(monthToCheck.getFullYear(), i, 1);
              const costs = await getMonthlyCostsForMonth(currentUser.id, monthDate);
              totalMonthlyCosts += costs.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0);
            }
          } else {
            const costs = await getMonthlyCostsForMonth(currentUser.id, monthToCheck);
            totalMonthlyCosts += costs.reduce((sum, cost) => sum + (parseFloat(cost.amount) || 0), 0);
          }
        }
      } catch (error) {
        console.error('Error loading monthly costs:', error);
      }

      for (const route of routes) {
        try {
          const { data: details } = await supabase
            .from('route_stop_details')
            .select('*')
            .eq('route_id', route.id);

          if (details) {
            const revenue = details.reduce((sum, detail) => sum + (parseFloat(detail.amount_received) || 0), 0);
            const partsCost = details.reduce((sum, detail) => sum + (parseFloat(detail.parts_cost) || 0), 0);
            const vehicleCost = calculateVehicleCost(route);
            const hoursWorked = parseFloat(route.hours_worked) || 0;
            const hourlyRate = route.drivers?.hourly_rate ? parseFloat(route.drivers.hourly_rate) : 0;
            const driverCost = hoursWorked * hourlyRate;

            const distanceKm = route.actual_distance_km 
              ? parseFloat(route.actual_distance_km) 
              : (route.route_data?.distance ? route.route_data.distance / 1000 : 0);

            totalRevenue += revenue;
            totalPartsCost += partsCost;
            totalVehicleCost += vehicleCost;
            totalDriverCost += driverCost;
            totalDistance += distanceKm;
            totalHours += hoursWorked;
          }
        } catch (error) {
          console.error(`Error loading details for route ${route.id}:`, error);
        }
      }

      // Include shop repairs in totals
      const combinedRevenue = totalRevenue + shopRevenue;
      const combinedPartsCost = totalPartsCost + shopPartsCost;
      const totalProfit = combinedRevenue - combinedPartsCost - totalVehicleCost - totalDriverCost - totalMonthlyCosts;
      
      setTotals({ 
        totalRevenue: combinedRevenue, 
        totalPartsCost: combinedPartsCost, 
        totalVehicleCost, 
        totalDriverCost, 
        totalMonthlyCosts,
        totalProfit,
        totalDistance,
        totalHours,
        shopRevenue,
        shopPartsCost,
        shopHours,
        shopLaborCost
      });
    };
    
    loadTotals();
  }, [routes, shopRepairs, periodFilter, selectedDate, vehicles, currentUser]);

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-message">
          <div className="loading-spinner"></div>
          <span>Gegevens laden...</span>
        </div>
      </div>
    );
  }

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case 'day': return 'Vandaag';
      case 'week': return 'Deze week';
      case 'month': return 'Deze maand';
      case 'quarter': return 'Dit kwartaal';
      case 'year': return 'Dit jaar';
      case 'date': 
        if (selectedDate) {
          const date = new Date(selectedDate);
          return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
        }
        return 'Selecteer datum';
      default: return 'Alle tijd';
    }
  };

  const handlePeriodFilterChange = (value) => {
    setPeriodFilter(value);
    if (value !== 'date') {
      setSelectedDate('');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const totalCosts = totals.totalPartsCost + totals.totalVehicleCost + totals.totalDriverCost + totals.totalMonthlyCosts;
  const netProfit = btwPercentage > 0 && totals.totalProfit > 0 
    ? totals.totalProfit - (totals.totalProfit * (btwPercentage / 100))
    : totals.totalProfit;

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div className="analytics-header-top">
          <div>
            <h1>Analytics</h1>
            <p>Inzicht in je routes en winkelreparaties</p>
          </div>
          <div className="analytics-controls">
            <select 
              className="period-filter-select"
              value={periodFilter}
              onChange={(e) => handlePeriodFilterChange(e.target.value)}
            >
              <option value="all">Alle tijd</option>
              <option value="day">Vandaag</option>
              <option value="week">Deze week</option>
              <option value="month">Deze maand</option>
              <option value="quarter">Dit kwartaal</option>
              <option value="year">Dit jaar</option>
              <option value="date">Specifieke datum</option>
            </select>
            {periodFilter === 'date' && (
              <input
                type="date"
                className="date-filter-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            )}
            <button 
              className="btn-settings"
              onClick={() => {
                setTempBtwPercentage(btwPercentage);
                setShowSettings(true);
              }}
              title="Instellingen"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 13C11.6569 13 13 11.6569 13 10C13 8.34315 11.6569 7 10 7C8.34315 7 7 8.34315 7 10C7 11.6569 8.34315 13 10 13Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M16.167 10C16.167 9.58333 16.125 9.16667 16.042 8.75L17.917 7.25L16.25 4.375L14.042 5.20833C13.458 4.70833 12.792 4.33333 12.042 4.08333L11.667 1.66667H8.33333L7.95833 4.08333C7.20833 4.33333 6.54167 4.70833 5.95833 5.20833L3.75 4.375L2.08333 7.25L3.95833 8.75C3.875 9.16667 3.83333 9.58333 3.83333 10C3.83333 10.4167 3.875 10.8333 3.95833 11.25L2.08333 12.75L3.75 15.625L5.95833 14.7917C6.54167 15.2917 7.20833 15.6667 7.95833 15.9167L8.33333 18.3333H11.667L12.042 15.9167C12.792 15.6667 13.458 15.2917 14.042 14.7917L16.25 15.625L17.917 12.75L16.042 11.25C16.125 10.8333 16.167 10.4167 16.167 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        
        {(routes.length > 0 || shopRepairs.length > 0) && (
          <div className="analytics-summary">
            {/* Revenue Card */}
            <div className="summary-card">
              <div className="summary-label">Totale Omzet</div>
              <div className="summary-value">{formatCurrency(totals.totalRevenue)}</div>
              <div className="summary-period">{getPeriodLabel()}</div>
              <div className="stats-row">
                {totals.totalRevenue - totals.shopRevenue > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Routes</span>
                    <span className="stat-value">{formatCurrency(totals.totalRevenue - totals.shopRevenue)}</span>
                  </div>
                )}
                {totals.shopRevenue > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Winkel</span>
                    <span className="stat-value">{formatCurrency(totals.shopRevenue)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Costs Card */}
            <div className="summary-card">
              <div className="summary-label">Totale Kosten</div>
              <div className="summary-value">{formatCurrency(totalCosts)}</div>
              <div className="stats-row">
                {totals.totalPartsCost > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Onderdelen</span>
                    <span className="stat-value">{formatCurrency(totals.totalPartsCost)}</span>
                  </div>
                )}
                {totals.totalVehicleCost > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Voertuig</span>
                    <span className="stat-value">{formatCurrency(totals.totalVehicleCost)}</span>
                  </div>
                )}
                {totals.totalDriverCost > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Chauffeur</span>
                    <span className="stat-value">{formatCurrency(totals.totalDriverCost)}</span>
                  </div>
                )}
                {totals.totalMonthlyCosts > 0 && (
                  <div className="stat-item">
                    <span className="stat-label">Maandelijkse Kosten</span>
                    <span className="stat-value">{formatCurrency(totals.totalMonthlyCosts)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Gross Profit Card */}
            <div className="summary-card">
              <div className="summary-label">Bruto Winst</div>
              <div className="summary-value">
                {formatCurrency(totals.totalProfit)}
              </div>
              {totals.totalRevenue > 0 && (
                <div className="summary-trend">
                  <span>{((totals.totalProfit / totals.totalRevenue) * 100).toFixed(1)}% marge</span>
                </div>
              )}
            </div>

            {/* Net Profit Card (if BTW is set) */}
            {btwPercentage > 0 && (
              <div className="summary-card">
                <div className="summary-label">Netto Winst</div>
                <div className="summary-value">
                  {formatCurrency(netProfit)}
                </div>
                <div className="summary-period">Na {btwPercentage}% BTW</div>
              </div>
            )}

            {/* Activity Count Card */}
            <div className="summary-card">
              <div className="summary-label">Activiteiten</div>
              <div className="summary-value">{routes.length + shopRepairs.length}</div>
              <div className="stats-row">
                <div className="stat-item">
                  <span className="stat-label">Routes</span>
                  <span className="stat-value">{routes.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Winkel</span>
                  <span className="stat-value">{shopRepairs.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h2>Instellingen</h2>
              <button className="close-button" onClick={() => setShowSettings(false)}>×</button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-group">
                <label htmlFor="btw-percentage">BTW Percentage</label>
                <input
                  type="number"
                  id="btw-percentage"
                  value={tempBtwPercentage}
                  onChange={(e) => setTempBtwPercentage(parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="bijv. 21"
                />
                <small>Dit percentage wordt van de bruto winst afgetrokken om de netto winst te berekenen.</small>
              </div>
            </div>
            <div className="settings-modal-footer">
              <button className="btn-cancel" onClick={() => setShowSettings(false)}>
                Annuleren
              </button>
              <button 
                className="btn-save"
                onClick={() => {
                  setBtwPercentage(tempBtwPercentage);
                  localStorage.setItem('analytics_btw_percentage', tempBtwPercentage.toString());
                  setShowSettings(false);
                }}
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Repair Modal */}
      {showAddRepairModal && (
        <div className="settings-modal-overlay" onClick={resetRepairForm}>
          <div className="settings-modal repair-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h2>{editingRepair ? 'Reparatie Bewerken' : 'Winkelreparatie Toevoegen'}</h2>
              <button className="close-button" onClick={resetRepairForm}>×</button>
            </div>
            <div className="settings-modal-body">
              <div className="settings-group">
                <label htmlFor="repair-date">Datum</label>
                <input
                  type="date"
                  id="repair-date"
                  value={repairForm.date}
                  onChange={(e) => setRepairForm(prev => ({ ...prev, date: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="settings-group">
                <label htmlFor="repair-customer">Klantnaam (optioneel)</label>
                <input
                  type="text"
                  id="repair-customer"
                  value={repairForm.customer_name}
                  onChange={(e) => setRepairForm(prev => ({ ...prev, customer_name: e.target.value }))}
                  placeholder="bijv. Jan de Vries"
                />
              </div>
              <div className="settings-group">
                <label htmlFor="repair-description">Beschrijving</label>
                <input
                  type="text"
                  id="repair-description"
                  value={repairForm.description}
                  onChange={(e) => setRepairForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="bijv. Band vervangen, rem afstellen"
                />
              </div>
              <div className="form-row">
                <div className="settings-group">
                  <label htmlFor="repair-revenue">Omzet (€)</label>
                  <input
                    type="number"
                    id="repair-revenue"
                    value={repairForm.revenue}
                    onChange={(e) => setRepairForm(prev => ({ ...prev, revenue: e.target.value }))}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="settings-group">
                  <label htmlFor="repair-parts">Onderdelen (€)</label>
                  <input
                    type="number"
                    id="repair-parts"
                    value={repairForm.parts_cost}
                    onChange={(e) => setRepairForm(prev => ({ ...prev, parts_cost: e.target.value }))}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="settings-group">
                  <label htmlFor="repair-hours">Arbeidsuren</label>
                  <input
                    type="number"
                    id="repair-hours"
                    value={repairForm.labor_hours}
                    onChange={(e) => setRepairForm(prev => ({ ...prev, labor_hours: e.target.value }))}
                    placeholder="0.5"
                    step="0.25"
                    min="0"
                  />
                </div>
                <div className="settings-group">
                  <label htmlFor="repair-btw">BTW Percentage</label>
                  <select
                    id="repair-btw"
                    className="btw-select"
                    value={repairForm.btw_percentage}
                    onChange={(e) => setRepairForm(prev => ({ ...prev, btw_percentage: e.target.value }))}
                  >
                    <option value="0">0% (vrijgesteld)</option>
                    <option value="9">9% (laag tarief)</option>
                    <option value="21">21% (standaard)</option>
                  </select>
                </div>
              </div>
              {(repairForm.revenue || repairForm.parts_cost || repairForm.labor_hours) && (() => {
                const revenue = parseFloat(repairForm.revenue) || 0;
                const partsCost = parseFloat(repairForm.parts_cost) || 0;
                const laborCost = (parseFloat(repairForm.labor_hours) || 0) * 20;
                const grossProfit = revenue - partsCost - laborCost;
                const btwRate = parseFloat(repairForm.btw_percentage) || 0;
                const btwAmount = grossProfit > 0 ? grossProfit * (btwRate / 100) : 0;
                const netProfit = grossProfit - btwAmount;
                
                return (
                  <div className="repair-profit-preview">
                    <div className="profit-preview-details">
                      <span><span>Omzet</span> <span>{formatCurrency(revenue)}</span></span>
                      <span><span>Onderdelen</span> <span>-{formatCurrency(partsCost)}</span></span>
                      {repairForm.labor_hours && parseFloat(repairForm.labor_hours) > 0 && (
                        <span><span>Arbeid ({repairForm.labor_hours}u × €20)</span> <span>-{formatCurrency(laborCost)}</span></span>
                      )}
                    </div>
                    <div className="profit-preview-row">
                      <span>Bruto Winst</span>
                      <strong className={grossProfit >= 0 ? 'profit' : 'loss'}>
                        {formatCurrency(grossProfit)}
                      </strong>
                    </div>
                    {btwRate > 0 && grossProfit > 0 && (
                      <>
                        <div className="profit-preview-row btw-row">
                          <span>BTW ({btwRate}%)</span>
                          <span className="btw-amount">-{formatCurrency(btwAmount)}</span>
                        </div>
                        <div className="profit-preview-total">
                          <span>Netto Winst</span>
                          <strong className={netProfit >= 0 ? 'profit' : 'loss'}>
                            {formatCurrency(netProfit)}
                          </strong>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="settings-modal-footer">
              <button className="btn-cancel" onClick={resetRepairForm}>
                Annuleren
              </button>
              <button 
                className="btn-save"
                onClick={handleAddRepair}
                disabled={!repairForm.date}
              >
                {editingRepair ? 'Opslaan' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="analytics-tabs">
        <button 
          className={`tab-button ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 10H7L10 3L13 17L16 10H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Routes ({routes.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => setActiveTab('shop')}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3H17L15 11H5L3 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 11L4 17H16L15 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="7" cy="19" r="1" fill="currentColor"/>
            <circle cx="13" cy="19" r="1" fill="currentColor"/>
          </svg>
          Winkelreparaties ({shopRepairs.length})
        </button>
      </div>

      <div className="analytics-content">
        {activeTab === 'routes' ? (
          // Routes Tab
          <>
            {/* Active Routes Section */}
            {activeRoutes.length > 0 && (
              <>
                <div className="content-header">
                  <h2>Actieve Routes</h2>
                  <span className="route-count active-routes">{activeRoutes.length} {activeRoutes.length === 1 ? 'route' : 'routes'} bezig</span>
                </div>
                <div className="active-routes-section">
                  {activeRoutes.map((route) => (
                    <ActiveRouteCard key={route.id} route={route} />
                  ))}
                </div>
              </>
            )}
            
            {/* Completed Routes Section */}
            {routes.length === 0 && activeRoutes.length === 0 ? (
              <div className="empty-analytics">
                <div className="empty-analytics-icon">
                  <svg width="48" height="48" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 10H7L10 3L13 17L16 10H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Nog geen routes</h3>
                <p>Start routes om ze hier te zien</p>
              </div>
            ) : routes.length === 0 ? (
              <div className="empty-analytics">
                <div className="empty-analytics-icon">
                  <svg width="48" height="48" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 10H7L10 3L13 17L16 10H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Nog geen voltooide routes</h3>
                <p>Voltooi routes om je analytics hier te zien</p>
              </div>
            ) : (
              <>
                <div className="content-header">
                  <h2>Voltooide Routes</h2>
                  <span className="route-count">{routes.length} {routes.length === 1 ? 'route' : 'routes'}</span>
                </div>
              <table className="routes-table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Datum</th>
                    <th>Stops</th>
                    <th>Afstand</th>
                    <th>Uren</th>
                    <th>Winst</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => {
                    const isSelected = selectedRoute?.id === route.id;
                    const revenue = isSelected ? calculateTotalRevenue(route) : 0;
                    const partsCost = isSelected ? calculateTotalPartsCost(route) : 0;
                    const vehicleCost = isSelected ? calculateVehicleCost(route) : 0;
                    const driverCost = isSelected ? calculateDriverCost(route) : 0;
                    const profit = isSelected ? calculateProfit(route) : 0;
                    
                    const distanceKm = route.actual_distance_km 
                      ? parseFloat(route.actual_distance_km) 
                      : (route.route_data?.distance ? route.route_data.distance / 1000 : 0);

                    return (
                      <React.Fragment key={route.id}>
                        <tr 
                          className={isSelected ? 'selected' : ''}
                          onClick={() => handleRouteClick(route)}
                        >
                          <td>
                            <div className="route-name">{route.name || 'Route zonder naam'}</div>
                            <div className="route-driver">{route.drivers?.name || route.selected_driver || 'Geen chauffeur'}</div>
                          </td>
                          <td>
                            <span className="route-date">
                              {route.date ? new Date(route.date).toLocaleDateString('nl-NL', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              }) : '-'}
                            </span>
                          </td>
                          <td>
                            <span className="route-stops-badge">
                              {route.stops?.length || 0}
                            </span>
                          </td>
                          <td>{distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : '-'}</td>
                          <td>{route.hours_worked ? `${route.hours_worked} u` : '-'}</td>
                          <td>
                            <span className={`route-amount ${isSelected ? (profit >= 0 ? 'positive' : 'negative') : ''}`}>
                              {isSelected ? formatCurrency(profit) : '–'}
                            </span>
                          </td>
                        </tr>
                        {isSelected && (
                          <tr className="route-details-row">
                            <td colSpan="6" className="route-details-content">
                              <div className="details-grid">
                                <div className="detail-card">
                                  <div className="detail-card-label">Omzet</div>
                                  <div className="detail-card-value revenue">{formatCurrency(revenue)}</div>
                                </div>
                                <div className="detail-card">
                                  <div className="detail-card-label">Onderdelen</div>
                                  <div className="detail-card-value cost">{formatCurrency(partsCost)}</div>
                                </div>
                                {vehicleCost > 0 && (
                                  <div className="detail-card">
                                    <div className="detail-card-label">Voertuigkosten</div>
                                    <div className="detail-card-value cost">{formatCurrency(vehicleCost)}</div>
                                    <div className="detail-card-calculation">
                                      {distanceKm.toFixed(1)} km gereden
                                    </div>
                                  </div>
                                )}
                                {driverCost > 0 && (
                                  <div className="detail-card">
                                    <div className="detail-card-label">Chauffeurkosten</div>
                                    <div className="detail-card-value cost">{formatCurrency(driverCost)}</div>
                                    <div className="detail-card-calculation">
                                      {route.hours_worked}u × €{route.drivers?.hourly_rate}/u
                                    </div>
                                  </div>
                                )}
                                <div className="detail-card">
                                  <div className="detail-card-label">Bruto Winst</div>
                                  <div className={`detail-card-value ${profit >= 0 ? 'profit' : 'cost'}`}>
                                    {formatCurrency(profit)}
                                  </div>
                                </div>
                                {btwPercentage > 0 && profit > 0 && (
                                  <div className="detail-card">
                                    <div className="detail-card-label">Netto Winst</div>
                                    <div className="detail-card-value profit">
                                      {formatCurrency(profit - (profit * (btwPercentage / 100)))}
                                    </div>
                                    <div className="detail-card-calculation">
                                      Na {btwPercentage}% BTW
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {stopDetails.length > 0 && (
                                <div className="stops-section">
                                  <div className="stops-section-header">
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M10 1C6.13401 1 3 4.13401 3 8C3 12.5 10 19 10 19C10 19 17 12.5 17 8C17 4.13401 13.866 1 10 1Z" stroke="currentColor" strokeWidth="2"/>
                                      <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="2"/>
                                    </svg>
                                    Stop Details ({stopDetails.length})
                                  </div>
                                  <div className="stops-list">
                                    {stopDetails.map((detail) => (
                                      <div key={detail.id} className="stop-item">
                                        <span className="stop-number">{detail.stop_index + 1}</span>
                                        <div className="stop-info">
                                          <div className="stop-description">
                                            {detail.work_description || 'Geen beschrijving'}
                                          </div>
                                          <div className="stop-amounts">
                                            {detail.amount_received > 0 && (
                                              <span className="stop-revenue">+{formatCurrency(detail.amount_received)}</span>
                                            )}
                                            {detail.parts_cost > 0 && (
                                              <span className="stop-cost">-{formatCurrency(detail.parts_cost)}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              </>
            )}
          </>
        ) : (
          // Shop Repairs Tab
          <>
            <div className="content-header">
              <h2>Winkelreparaties</h2>
              <div className="header-actions">
                <span className="route-count">{shopRepairs.length} {shopRepairs.length === 1 ? 'reparatie' : 'reparaties'}</span>
                <button 
                  className="btn-add-repair"
                  onClick={() => setShowAddRepairModal(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Reparatie Toevoegen
                </button>
              </div>
            </div>
            {shopRepairs.length === 0 ? (
              <div className="empty-analytics">
                <div className="empty-analytics-icon">
                  <svg width="48" height="48" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C4.89543 2 4 2.89543 4 4V16C4 17.1046 4.89543 18 6 18H14C15.1046 18 16 17.1046 16 16V4C16 2.89543 15.1046 2 14 2Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 6H12M8 10H12M8 14H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3>Nog geen winkelreparaties</h3>
                <p>Voeg je eerste winkelreparatie toe om bij te houden</p>
                <button 
                  className="btn-add-repair-large"
                  onClick={() => setShowAddRepairModal(true)}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Eerste Reparatie Toevoegen
                </button>
              </div>
            ) : (
              <table className="routes-table repairs-table">
                <thead>
                  <tr>
                    <th>Beschrijving</th>
                    <th>Datum</th>
                    <th>Klant</th>
                    <th>Omzet</th>
                    <th>Kosten</th>
                    <th>Winst</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shopRepairs.map((repair) => {
                    const laborCost = (parseFloat(repair.labor_hours) || 0) * 20; // €20 per uur
                    const totalCost = (parseFloat(repair.parts_cost) || 0) + laborCost;
                    const grossProfit = (parseFloat(repair.revenue) || 0) - totalCost;
                    const btwRate = parseFloat(repair.btw_percentage) || 21;
                    const btwAmount = grossProfit > 0 ? grossProfit * (btwRate / 100) : 0;
                    const netProfit = grossProfit - btwAmount;
                    
                    return (
                      <tr key={repair.id}>
                        <td>
                          <div className="route-name">{repair.description || 'Geen beschrijving'}</div>
                          <div className="route-driver">
                            {repair.labor_hours > 0 && `${repair.labor_hours}u × €20`}
                            {repair.labor_hours > 0 && btwRate > 0 && ' · '}
                            {btwRate > 0 && `${btwRate}% BTW`}
                            {!repair.labor_hours && btwRate === 0 && '-'}
                          </div>
                        </td>
                        <td>
                          <span className="route-date">
                            {new Date(repair.date).toLocaleDateString('nl-NL', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </td>
                        <td>{repair.customer_name || '-'}</td>
                        <td className="amount-cell positive">{formatCurrency(repair.revenue || 0)}</td>
                        <td className="amount-cell negative">{formatCurrency(totalCost)}</td>
                        <td>
                          <div className="profit-cell">
                            <span className={`route-amount ${netProfit >= 0 ? 'positive' : 'negative'}`}>
                              {formatCurrency(netProfit)}
                            </span>
                            {btwRate > 0 && grossProfit > 0 && (
                              <span className="profit-subtitle">na BTW</span>
                            )}
                          </div>
                        </td>
                        <td className="actions-cell">
                          <button 
                            className="btn-icon"
                            onClick={() => handleEditRepair(repair)}
                            title="Bewerken"
                          >
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M14.166 2.5L17.5 5.83333L6.66667 16.6667H3.33334V13.3333L14.166 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button 
                            className="btn-icon btn-icon-danger"
                            onClick={() => handleDeleteRepair(repair.id)}
                            title="Verwijderen"
                          >
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M3 5H17M8 5V3H12V5M15 5V17C15 17.5523 14.5523 18 14 18H6C5.44772 18 5 17.5523 5 17V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      <div className="page-logo-footer">
        <img src="/logo.png" alt="Routenu" />
      </div>
    </div>
  );
}

export default Analytics;
