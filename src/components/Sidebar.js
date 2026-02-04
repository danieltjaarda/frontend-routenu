import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

// SVG Icon Components
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

const GridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
  </svg>
);

const ListIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const RouteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4"></path>
    <circle cx="3" cy="12" r="2" fill="currentColor"></circle>
    <circle cx="12" cy="12" r="2" fill="currentColor"></circle>
    <circle cx="21" cy="12" r="2" fill="currentColor"></circle>
  </svg>
);

const LocationPinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

const BoxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

const TruckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="3" width="15" height="13"></rect>
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
    <circle cx="5.5" cy="18.5" r="2.5"></circle>
    <circle cx="18.5" cy="18.5" r="2.5"></circle>
  </svg>
);

const PersonIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const EnvelopeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const BikeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="5.5" cy="17.5" r="3.5"></circle>
    <circle cx="18.5" cy="17.5" r="3.5"></circle>
    <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"></path>
    <path d="M12 17.5V14l-3-3 4-3 2 3h3"></path>
  </svg>
);

const TabletIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
    <line x1="12" y1="18" x2="12.01" y2="18"></line>
  </svg>
);

const PencilIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);

const TargetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"></circle>
    <circle cx="12" cy="12" r="6"></circle>
    <circle cx="12" cy="12" r="2"></circle>
  </svg>
);

const StarsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const AnalyticsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

const WarehouseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const TodayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

function Sidebar({ onNavigate, currentView }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, currentUser } = useAuth();
  const [activeItem, setActiveItem] = useState('today'); // Default actief item
  const [isDriver, setIsDriver] = useState(false);

  // Check if user is a driver
  useEffect(() => {
    const checkIfDriver = async () => {
      if (!currentUser) {
        setIsDriver(false);
        return;
      }

      try {
        const { isUserDriver } = await import('../services/userData');
        const driver = await isUserDriver(currentUser.id);
        setIsDriver(driver);
      } catch (error) {
        console.error('Error checking if user is driver:', error);
        setIsDriver(false);
      }
    };

    checkIfDriver();
  }, [currentUser]);

  // Sync activeItem met current path
  useEffect(() => {
    const path = location.pathname;
    if (path === '/vandaag' || path === '/today') {
      setActiveItem('today');
    } else if (path === '/routes' || path === '/route-aanmaken') {
      setActiveItem('routes');
    } else if (path === '/chauffeurs') {
      setActiveItem('truck');
    } else if (path === '/pakketten') {
      setActiveItem('box');
    } else if (path === '/analytics') {
      setActiveItem('analytics');
    } else if (path === '/chauffeurs-lijst') {
      setActiveItem('person');
    } else if (path === '/berichten' || path === '/email') {
      setActiveItem('envelope');
    } else if (path === '/opgehaalde-fietsen' || path === '/nieuwe') {
      setActiveItem('bike');
    } else if (path === '/voorraad') {
      setActiveItem('warehouse');
    } else if (path === '/profiel') {
      setActiveItem('profile');
    }
  }, [location.pathname]);

  const menuItems = [
    { id: 'today', icon: TodayIcon, label: 'Route van vandaag', view: 'today', path: '/vandaag' },
    { id: 'routes', icon: LocationPinIcon, label: 'Routes', view: 'routes', path: '/routes' },
    { id: 'truck', icon: TruckIcon, label: 'Voertuigen', view: 'vehicles', path: '/chauffeurs' },
    { id: 'box', icon: BoxIcon, label: 'Pakketten', tooltip: 'Opdrachten', view: 'orders', path: '/pakketten' },
    { id: 'warehouse', icon: WarehouseIcon, label: 'Voorraad', view: 'inventory', path: '/voorraad' },
    { id: 'person', icon: PersonIcon, label: 'Chauffeurs', view: 'drivers', path: '/chauffeurs-lijst' },
    { id: 'analytics', icon: AnalyticsIcon, label: 'Analytics', view: 'analytics', path: '/analytics' },
    { id: 'envelope', icon: EnvelopeIcon, label: 'Berichten', view: 'email', path: '/berichten' },
    { id: 'bike', icon: BikeIcon, label: 'Nieuwe', tooltip: 'Opgehaalde fietsen', view: 'pickedUpBikes', path: '/opgehaalde-fietsen' },
  ];

  // Don't show sidebar for drivers
  if (isDriver) {
    return null;
  }

  return (
    <div className="sidebar-menu">
      <div className="menu-items">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              className={`menu-item ${activeItem === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveItem(item.id);
                if (item.path) {
                  navigate(item.path);
                } else if (item.view && onNavigate) {
                  onNavigate(item.view);
                }
              }}
            >
          <span className="menu-icon">
            <IconComponent />
          </span>
          <span className="menu-tooltip">{item.tooltip || item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="menu-user">
        <button 
          className="user-button" 
          onClick={() => {
            navigate('/profiel');
            setActiveItem('profile');
          }}
        >
          <span className="user-icon">
            <UserIcon />
          </span>
          <span className="menu-tooltip">Profiel</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;

