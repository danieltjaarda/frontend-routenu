import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './Inventory.css';

function Inventory() {
  const { currentUser } = useAuth();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('Alle categorieën');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportError, setBulkImportError] = useState(null);
  const [bulkImportSuccess, setBulkImportSuccess] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState('price');
  const [sortDirection, setSortDirection] = useState('desc');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    article_number: '',
    quantity: 0,
    min_quantity: 0,
    price: '',
    purchase_price: '',
    category: '',
    location: '',
    supplier: '',
    notes: ''
  });

  // Load parts from database
  useEffect(() => {
    const loadParts = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('inventory')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('name', { ascending: true });

        if (error) throw error;
        setParts(data || []);
      } catch (error) {
        console.error('Error loading inventory:', error);
      } finally {
        setLoading(false);
      }
    };

    loadParts();
  }, [currentUser]);

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(parts.map(p => p.category).filter(Boolean));
    return ['Alle categorieën', ...Array.from(cats).sort()];
  }, [parts]);

  // Filter and sort parts
  const filteredParts = useMemo(() => {
    let filtered = parts;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(part =>
        part.name?.toLowerCase().includes(query) ||
        part.article_number?.toLowerCase().includes(query) ||
        part.category?.toLowerCase().includes(query) ||
        part.supplier?.toLowerCase().includes(query)
      );
    }

    if (filterCategory !== 'Alle categorieën') {
      filtered = filtered.filter(part => part.category === filterCategory);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'sku':
          aVal = a.article_number?.toLowerCase() || '';
          bVal = b.article_number?.toLowerCase() || '';
          break;
        case 'quantity':
          aVal = a.quantity || 0;
          bVal = b.quantity || 0;
          break;
        case 'price':
          aVal = parseFloat(a.price) || 0;
          bVal = parseFloat(b.price) || 0;
          break;
        case 'category':
          aVal = a.category?.toLowerCase() || '';
          bVal = b.category?.toLowerCase() || '';
          break;
        default:
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
      }

      if (sortBy === 'quantity' || sortBy === 'price') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      } else {
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }
    });

    return filtered;
  }, [parts, searchQuery, filterCategory, sortBy, sortDirection]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems(filteredParts.map(p => p.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
    setShowSortMenu(false);
  };

  // Match product name to image filename
  const getProductImage = (productName) => {
    if (!productName) return null;
    
    // Normalize product name for matching
    const normalize = (str) => {
      return str
        .toLowerCase()
        .replace(/\([^)]*\)/g, '') // Remove text in parentheses
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    };

    const normalizedName = normalize(productName);
    
    // Comprehensive mappings for product names to image filenames
    const imageMappings = {
      // Accu's
      'v20-accu': '/producten kopie/v20-accu.jpg',
      'v8-accu-laadpoort': '/producten kopie/ouxi-oplader.jpg',
      'accuslot': '/producten kopie/v20-accuhouder.jpg',
      'accuhouder-v20': '/producten kopie/v20-accuhouder.jpg',
      'accurail': '/producten kopie/v20-accuhouder.jpg',
      
      // Onderdelen
      'voorvork': '/producten kopie/voorvork.jpg',
      'ketting': '/producten kopie/ouxi-ketting.jpg',
      'verende-schokdemper': '/producten kopie/v20-vering.jpg',
      'trapas': '/producten kopie/trapas-v20.jpg',
      'rubberen-handvatset': '/producten kopie/ouxi-handvaten.jpg',
      'rubberen-handvatsets': '/producten kopie/ouxi-handvaten.jpg',
      
      // Remmen
      'remblokken': '/producten kopie/mechanische-remblokken.jpg',
      'logan-remmenset-links': '/producten kopie/v20-remschijf.jpg',
      'logan-remmenset-rechts': '/producten kopie/v20-remschijf.jpg',
      'hydraulische-rem-voor': '/producten kopie/v20-remschijf.jpg',
      'hydraulische-rem-links': '/producten kopie/v20-remschijf.jpg',
      'hydraulische-rem-rechts': '/producten kopie/v20-remschijf.jpg',
      'hydraulische-rem-achter': '/producten kopie/v20-remschijf.jpg',
      
      // Display
      'h6c-display': '/producten kopie/v20-display.jpg',
      
      // Motor
      'motortandwiel-36t-500w': '/producten kopie/v20-motor-tandwielen-500w.jpg',
      '250w-tandwiel': '/producten kopie/motor-tandwielen-500w.jpg',
      'v20-controller': '/producten kopie/ouxi-v8-controller.jpg',
      
      // Sensor
      'trapkrachtsensor': '/producten kopie/v20-trapsensor.jpg',
      
      // Banden
      'mini-buitenband': '/producten kopie/v20-mini-binnenband.jpg',
      'mini-binnenband': '/producten kopie/v20-mini-binnenband.jpg',
      'kenda-binnen-en-buitenband-set': '/producten kopie/v20-mini-binnenband.jpg',
    };

    // Try exact match first
    if (imageMappings[normalizedName]) {
      return imageMappings[normalizedName];
    }

    // Try partial matches - check if any key is contained in the normalized name
    for (const [key, value] of Object.entries(imageMappings)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        return value;
      }
    }

    // Try word-by-word matching
    const words = normalizedName.split('-').filter(w => w.length > 2);
    for (const word of words) {
      for (const [key, value] of Object.entries(imageMappings)) {
        if (key.includes(word) || word.includes(key.split('-')[0])) {
          return value;
        }
      }
    }

    // Try removing numbers and special patterns
    const withoutNumbers = normalizedName.replace(/\d+/g, '');
    for (const [key, value] of Object.entries(imageMappings)) {
      const keyWithoutNumbers = key.replace(/\d+/g, '');
      if (withoutNumbers.includes(keyWithoutNumbers) || keyWithoutNumbers.includes(withoutNumbers)) {
        return value;
      }
    }

    return null;
  };

  // Stats
  const stats = useMemo(() => {
    const totalParts = parts.length;
    const totalValue = parts.reduce((sum, p) => sum + (p.quantity * (parseFloat(p.price) || 0)), 0);
    const lowStock = parts.filter(p => p.quantity <= p.min_quantity).length;
    return { totalParts, totalValue, lowStock };
  }, [parts]);

  const resetForm = () => {
    setFormData({
      name: '',
      article_number: '',
      quantity: 0,
      min_quantity: 0,
      price: '',
      purchase_price: '',
      category: '',
      location: '',
      supplier: '',
      notes: ''
    });
  };

  const handleOpenAddModal = () => {
    resetForm();
    setEditingPart(null);
    setShowAddModal(true);
  };

  const handleEditPart = (part) => {
    setFormData({
      name: part.name || '',
      article_number: part.article_number || '',
      quantity: part.quantity || 0,
      min_quantity: part.min_quantity || 0,
      price: part.price || '',
      purchase_price: part.purchase_price || '',
      category: part.category || '',
      location: part.location || '',
      supplier: part.supplier || '',
      notes: part.notes || ''
    });
    setEditingPart(part);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingPart(null);
    resetForm();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSavePart = async () => {
    if (!formData.name.trim()) {
      alert('Vul een naam in voor het onderdeel');
      return;
    }

    setSaving(true);
    try {
      const partData = {
        user_id: currentUser.id,
        name: formData.name.trim(),
        article_number: formData.article_number.trim() || null,
        quantity: parseInt(formData.quantity) || 0,
        min_quantity: parseInt(formData.min_quantity) || 0,
        price: formData.price ? parseFloat(formData.price) : null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        category: formData.category.trim() || null,
        location: formData.location.trim() || null,
        supplier: formData.supplier.trim() || null,
        notes: formData.notes.trim() || null
      };

      if (editingPart) {
        // Update existing
        const { error } = await supabase
          .from('inventory')
          .update(partData)
          .eq('id', editingPart.id);

        if (error) throw error;

        setParts(prev => prev.map(p => 
          p.id === editingPart.id ? { ...p, ...partData } : p
        ));
      } else {
        // Create new
        const { data, error } = await supabase
          .from('inventory')
          .insert([partData])
          .select()
          .single();

        if (error) throw error;
        setParts(prev => [...prev, data]);
      }

      handleCloseModal();
    } catch (error) {
      console.error('Error saving part:', error);
      alert('Er is een fout opgetreden bij het opslaan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePart = async (partId) => {
    if (!window.confirm('Weet je zeker dat je dit onderdeel wilt verwijderen?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', partId);

      if (error) throw error;
      setParts(prev => prev.filter(p => p.id !== partId));
    } catch (error) {
      console.error('Error deleting part:', error);
      alert('Er is een fout opgetreden bij het verwijderen');
    }
  };

  const handleDeleteAll = async () => {
    if (parts.length === 0) {
      alert('Er zijn geen items om te verwijderen');
      return;
    }

    const itemCount = parts.length;

    // Dubbele bevestiging voor veiligheid
    const firstConfirm = window.confirm(
      `WAARSCHUWING: Je staat op het punt om ALLE ${itemCount} voorraaditems te verwijderen.\n\nDit kan niet ongedaan worden gemaakt!\n\nKlik op OK om door te gaan.`
    );

    if (!firstConfirm) return;

    const secondConfirm = window.prompt(
      `Typ "VERWIJDER ALLES" om te bevestigen dat je alle ${itemCount} items wilt verwijderen:`
    );

    if (secondConfirm !== 'VERWIJDER ALLES') {
      alert('Verwijdering geannuleerd. Je moet exact "VERWIJDER ALLES" typen om door te gaan.');
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('user_id', currentUser.id);

      if (error) throw error;
      setParts([]);
      alert(`Alle ${itemCount} voorraaditems zijn succesvol verwijderd.`);
    } catch (error) {
      console.error('Error deleting all parts:', error);
      alert('Er is een fout opgetreden bij het verwijderen van alle items');
    }
  };

  const handleUpdateQuantity = async (partId, delta) => {
    const part = parts.find(p => p.id === partId);
    if (!part) return;

    const newQuantity = Math.max(0, part.quantity + delta);

    try {
      const { error } = await supabase
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('id', partId);

      if (error) throw error;
      setParts(prev => prev.map(p => 
        p.id === partId ? { ...p, quantity: newQuantity } : p
      ));
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  // Helper function to parse Dutch price format (€23,29 -> 23.29)
  const parsePrice = (value) => {
    if (!value || value === '') return null;
    // Remove € symbol and spaces, replace comma with dot
    const cleaned = value.toString().replace(/€/g, '').replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };

  // Parse CSV content (simple CSV parser that handles quoted values)
  const parseCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV moet minimaal een header en één regel data bevatten');

    // Simple CSV parser that handles quoted values
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    const items = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
      if (values.length === 0 || !values[0]) continue; // Skip empty lines

      const item = {};
      headers.forEach((header, index) => {
        const value = values[index] || '';
        if (header === 'naam' || header === 'name') {
          item.name = value;
        } else if (header === 'artikelnummer' || header === 'article_number') {
          item.article_number = value || null;
        } else if (header === 'aantal' || header === 'quantity') {
          item.quantity = parseInt(value) || 0;
        } else if (header === 'minimum' || header === 'min_quantity') {
          item.min_quantity = parseInt(value) || 0;
        } else if (header === 'prijs' || header === 'price' || header === 'prijs_per_stuk' || header === 'prijs per stuk') {
          item.price = parsePrice(value);
        } else if (header === 'inkoopprijs' || header === 'purchase_price') {
          item.purchase_price = parsePrice(value);
        } else if (header === 'categorie' || header === 'category') {
          item.category = value || null;
        } else if (header === 'locatie' || header === 'location') {
          item.location = value || null;
        } else if (header === 'leverancier' || header === 'supplier') {
          item.supplier = value || null;
        } else if (header === 'notities' || header === 'notes') {
          item.notes = value || null;
        }
      });

      if (item.name) {
        items.push(item);
      }
    }

    return items;
  };

  // Parse JSON content
  const parseJSON = (jsonText) => {
    try {
      const data = JSON.parse(jsonText);
      if (!Array.isArray(data)) {
        throw new Error('JSON moet een array van items bevatten');
      }
      return data.map(item => ({
        name: item.name || item.naam,
        article_number: item.article_number || item.artikelnummer || null,
        quantity: parseInt(item.quantity || item.aantal || 0),
        min_quantity: parseInt(item.min_quantity || item.minimum || 0),
        price: parsePrice(item.price || item.prijs || item.prijs_per_stuk),
        purchase_price: parsePrice(item.purchase_price || item.inkoopprijs),
        category: item.category || item.categorie || null,
        location: item.location || item.locatie || null,
        supplier: item.supplier || item.leverancier || null,
        notes: item.notes || item.notities || null
      })).filter(item => item.name);
    } catch (error) {
      throw new Error(`Ongeldige JSON: ${error.message}`);
    }
  };

  // Detect file type based on content
  const detectFileType = (fileText, fileName) => {
    const trimmed = fileText.trim();
    
    // Check file extension first
    if (fileName.toLowerCase().endsWith('.csv')) {
      return 'csv';
    }
    if (fileName.toLowerCase().endsWith('.json')) {
      return 'json';
    }
    
    // Detect by content
    // CSV usually starts with headers and contains commas
    if (trimmed.includes(',') && (trimmed.startsWith('Naam') || trimmed.startsWith('name') || trimmed.split('\n')[0].includes(','))) {
      return 'csv';
    }
    
    // JSON usually starts with [ or {
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      return 'json';
    }
    
    // Default to CSV if it contains commas (more likely)
    if (trimmed.includes(',')) {
      return 'csv';
    }
    
    return null;
  };

  // Handle file upload
  const handleBulkImport = async (file) => {
    if (!file) return;

    setBulkImporting(true);
    setBulkImportError(null);
    setBulkImportSuccess(null);

    try {
      const fileText = await file.text();
      let items = [];

      const fileType = detectFileType(fileText, file.name);
      
      if (!fileType) {
        throw new Error('Kon bestandstype niet detecteren. Zorg dat het een CSV of JSON bestand is. CSV bestanden moeten beginnen met een header regel (bijv. "Naam,Aantal,Categorie"), JSON bestanden moeten beginnen met [ of {');
      }

      try {
        if (fileType === 'csv') {
          items = parseCSV(fileText);
        } else if (fileType === 'json') {
          items = parseJSON(fileText);
        }
      } catch (parseError) {
        throw new Error(`Fout bij het lezen van het ${fileType.toUpperCase()} bestand: ${parseError.message}. Controleer of het bestand het juiste formaat heeft.`);
      }

      if (items.length === 0) {
        throw new Error('Geen geldige items gevonden in het bestand. Controleer of het bestand de juiste structuur heeft.');
      }

      // Prepare items for database
      const itemsToInsert = items.map(item => ({
        user_id: currentUser.id,
        name: item.name.trim(),
        article_number: item.article_number?.trim() || null,
        quantity: item.quantity || 0,
        min_quantity: item.min_quantity || 0,
        price: item.price || null,
        purchase_price: item.purchase_price || null,
        category: item.category?.trim() || null,
        location: item.location?.trim() || null,
        supplier: item.supplier?.trim() || null,
        notes: item.notes?.trim() || null
      }));

      // Check for existing items and update or insert
      let inserted = 0;
      let updated = 0;
      let errors = [];

      for (const item of itemsToInsert) {
        try {
          // Check if item exists
          const { data: existing } = await supabase
            .from('inventory')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('name', item.name)
            .single();

          if (existing) {
            // Update existing item
            const { error } = await supabase
              .from('inventory')
              .update({
                quantity: item.quantity,
                min_quantity: item.min_quantity,
                price: item.price,
                purchase_price: item.purchase_price,
                category: item.category,
                location: item.location,
                supplier: item.supplier,
                notes: item.notes,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id);

            if (error) throw error;
            updated++;
          } else {
            // Insert new item
            const { error } = await supabase
              .from('inventory')
              .insert([item]);

            if (error) throw error;
            inserted++;
          }
        } catch (error) {
          errors.push(`${item.name}: ${error.message}`);
        }
      }

      // Reload parts
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setParts(data || []);

      // Show success message
      if (errors.length > 0) {
        setBulkImportSuccess(`${inserted} items toegevoegd, ${updated} items bijgewerkt. ${errors.length} fouten: ${errors.join('; ')}`);
      } else {
        setBulkImportSuccess(`${inserted} items toegevoegd, ${updated} items bijgewerkt.`);
      }
    } catch (error) {
      console.error('Error importing bulk items:', error);
      setBulkImportError(error.message || 'Er is een fout opgetreden bij het importeren');
    } finally {
      setBulkImporting(false);
    }
  };

  const handleBulkImportFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleBulkImport(file);
    }
  };

  const downloadTemplate = (format) => {
    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === 'csv') {
      filename = 'voorraad-template.csv';
      mimeType = 'text/csv';
      content = 'Naam,Aantal,Categorie,Prijs per stuk,Artikelnummer,Minimum,Inkoopprijs,Locatie,Leverancier,Notities\nV20 accu,1,Accu,150.00,,0,,,,\nVoorvork,5,Onderdelen,45.50,,0,,,,\nKetting,6,Onderdelen,12.99,,0,,,,\n';
    } else {
      filename = 'voorraad-template.json';
      mimeType = 'application/json';
      content = JSON.stringify([
        {
          naam: 'V20 accu',
          aantal: 1,
          categorie: 'Accu',
          prijs_per_stuk: '150.00'
        },
        {
          naam: 'Voorvork',
          aantal: 5,
          categorie: 'Onderdelen',
          prijs_per_stuk: '45.50'
        },
        {
          naam: 'Ketting',
          aantal: 6,
          categorie: 'Onderdelen',
          prijs_per_stuk: '12.99'
        }
      ], null, 2);
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="inventory-page">
        <div className="loading-state">Laden...</div>
      </div>
    );
  }

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <h1>Voorraad</h1>
        <div className="header-actions">
          <button className="btn-export" onClick={() => alert('Export functionaliteit komt binnenkort')}>
            Exporteren
          </button>
          <button className="btn-import" onClick={() => setShowBulkImportModal(true)}>
            Importeren
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="inventory-stats">
        <div className="stat-card">
          <div className="stat-icon parts-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.totalParts}</span>
            <span className="stat-label">Onderdelen</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon value-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">€{stats.totalValue.toFixed(2)}</span>
            <span className="stat-label">Voorraadwaarde</span>
          </div>
        </div>
        <div className="stat-card">
          <div className={`stat-icon ${stats.lowStock > 0 ? 'warning-icon' : 'success-icon'}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div className="stat-content">
            <span className="stat-value">{stats.lowStock}</span>
            <span className="stat-label">Lage voorraad</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-bar-left">
          <button className="filter-tab active">Alle</button>
          <button className="btn-add-filter" onClick={handleOpenAddModal} title="Onderdeel toevoegen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
        <div className="filter-bar-right">
          <div className="search-container-icon">
            <input
              type="text"
              className="search-input-icon"
              placeholder="Zoeken..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          <button className="icon-btn" title="Filter">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
          </button>
          <button className="icon-btn" title="Kolommen">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </button>
          <div className="sort-container">
            <button 
              className="icon-btn sort-btn" 
              onClick={() => setShowSortMenu(!showSortMenu)}
              title="Sorteren"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="7" y1="12" x2="21" y2="12"></line>
                <line x1="11" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            {showSortMenu && (
              <div className="sort-menu">
                <div className="sort-menu-header">Sorteren op</div>
                <div className="sort-options">
                  <label className="sort-option">
                    <input 
                      type="radio" 
                      name="sortBy" 
                      checked={sortBy === 'name'} 
                      onChange={() => handleSort('name')}
                    />
                    <span>Productnaam</span>
                  </label>
                  <label className="sort-option">
                    <input 
                      type="radio" 
                      name="sortBy" 
                      checked={sortBy === 'sku'} 
                      onChange={() => handleSort('sku')}
                    />
                    <span>Artikelnummer</span>
                  </label>
                  <label className="sort-option">
                    <input 
                      type="radio" 
                      name="sortBy" 
                      checked={sortBy === 'quantity'} 
                      onChange={() => handleSort('quantity')}
                    />
                    <span>Voorraad</span>
                  </label>
                  <label className="sort-option">
                    <input 
                      type="radio" 
                      name="sortBy" 
                      checked={sortBy === 'price'} 
                      onChange={() => handleSort('price')}
                    />
                    <span>Prijs</span>
                  </label>
                  <label className="sort-option">
                    <input 
                      type="radio" 
                      name="sortBy" 
                      checked={sortBy === 'category'} 
                      onChange={() => handleSort('category')}
                    />
                    <span>Categorie</span>
                  </label>
                </div>
                <div className="sort-direction">
                  <button 
                    className={`sort-dir-btn ${sortDirection === 'asc' ? 'active' : ''}`}
                    onClick={() => setSortDirection('asc')}
                  >
                    ↑ A-Z
                  </button>
                  <button 
                    className={`sort-dir-btn ${sortDirection === 'desc' ? 'active' : ''}`}
                    onClick={() => setSortDirection('desc')}
                  >
                    ↓ Z-A
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Table - Shopify Style */}
      <div className="inventory-table-wrapper">
        {filteredParts.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
            <h3>{searchQuery ? 'Geen onderdelen gevonden' : 'Nog geen onderdelen in voorraad'}</h3>
            <p>{searchQuery ? 'Probeer andere zoektermen' : 'Begin met het toevoegen van je eerste onderdeel'}</p>
            {!searchQuery && (
              <button className="btn-add-first" onClick={handleOpenAddModal}>
                Voeg je eerste onderdeel toe
              </button>
            )}
          </div>
        ) : (
          <table className="inventory-table-shopify">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input 
                    type="checkbox" 
                    checked={selectedItems.length === filteredParts.length && filteredParts.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th 
                  className={`sortable ${sortBy === 'name' ? 'active' : ''}`}
                  onClick={() => handleSort('name')}
                >
                  Product
                  {sortBy === 'name' && (
                    <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  className={`sortable ${sortBy === 'sku' ? 'active' : ''}`}
                  onClick={() => handleSort('sku')}
                >
                  Artikelnummer
                  {sortBy === 'sku' && (
                    <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th>Categorie</th>
                <th 
                  className={`sortable ${sortBy === 'quantity' ? 'active' : ''}`}
                  onClick={() => handleSort('quantity')}
                >
                  Voorraad
                  {sortBy === 'quantity' && (
                    <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th 
                  className={`sortable ${sortBy === 'price' ? 'active' : ''}`}
                  onClick={() => handleSort('price')}
                >
                  Prijs
                  {sortBy === 'price' && (
                    <span className="sort-arrow">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map((part) => (
                <tr 
                  key={part.id}
                  className={part.quantity <= part.min_quantity ? 'low-stock-row' : ''}
                >
                  <td className="checkbox-col">
                    <input 
                      type="checkbox" 
                      checked={selectedItems.includes(part.id)}
                      onChange={() => handleSelectItem(part.id)}
                    />
                  </td>
                  <td className="product-col">
                    <div className="product-cell">
                      <div className="product-thumbnail">
                        {getProductImage(part.name) ? (
                          <img 
                            src={getProductImage(part.name)} 
                            alt={part.name}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextElementSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <svg 
                          width="40" 
                          height="40" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="1.5"
                          style={{ display: getProductImage(part.name) ? 'none' : 'flex' }}
                        >
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        </svg>
                      </div>
                      <div className="product-info">
                        <div className="product-name-cell">{part.name}</div>
                        {part.quantity <= part.min_quantity && (
                          <span className="low-stock-indicator">Lage voorraad</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="sku-col">
                    {part.article_number || 'Geen artikelnummer'}
                  </td>
                  <td className="category-col">
                    {part.category ? (
                      <span className="category-badge-table">{part.category}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="quantity-col">
                    <div className="quantity-cell">
                      <button 
                        className="qty-btn-table minus"
                        onClick={() => handleUpdateQuantity(part.id, -1)}
                        disabled={part.quantity <= 0}
                      >
                        −
                      </button>
                      <span className="quantity-value-table">{part.quantity}</span>
                      <button 
                        className="qty-btn-table plus"
                        onClick={() => handleUpdateQuantity(part.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="price-col">
                    {part.price ? `€${parseFloat(part.price).toFixed(2)}` : '-'}
                  </td>
                  <td className="actions-col">
                    <div className="table-actions">
                      <button
                        className="table-action-btn edit"
                        onClick={() => handleEditPart(part)}
                        title="Bewerken"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        className="table-action-btn delete"
                        onClick={() => handleDeletePart(part.id)}
                        title="Verwijderen"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk Import Modal */}
      {showBulkImportModal && (
        <div className="modal-overlay" onClick={() => !bulkImporting && setShowBulkImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bulk importeren</h2>
              <button className="close-button" onClick={() => !bulkImporting && setShowBulkImportModal(false)} disabled={bulkImporting}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <p style={{ marginBottom: '16px', color: '#666' }}>
                  Upload een CSV of JSON bestand met voorraaditems. Download eerst een voorbeeldbestand om het juiste formaat te zien.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <button 
                    className="btn-template" 
                    onClick={() => downloadTemplate('csv')}
                    disabled={bulkImporting}
                  >
                    Download CSV template
                  </button>
                  <button 
                    className="btn-template" 
                    onClick={() => downloadTemplate('json')}
                    disabled={bulkImporting}
                  >
                    Download JSON template
                  </button>
                </div>
              </div>

              <div className="form-group full-width">
                <label>Selecteer bestand (CSV of JSON)</label>
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleBulkImportFileChange}
                  disabled={bulkImporting}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '8px', width: '100%' }}
                />
              </div>

              {bulkImportError && (
                <div className="bulk-import-error" style={{ 
                  marginTop: '16px', 
                  padding: '12px', 
                  background: '#ffebee', 
                  color: '#c62828', 
                  borderRadius: '8px',
                  fontSize: '14px'
                }}>
                  <strong>Fout:</strong> {bulkImportError}
                </div>
              )}

              {bulkImportSuccess && (
                <div className="bulk-import-success" style={{ 
                  marginTop: '16px', 
                  padding: '12px', 
                  background: '#e8f5e9', 
                  color: '#2e7d32', 
                  borderRadius: '8px',
                  fontSize: '14px'
                }}>
                  <strong>Succes:</strong> {bulkImportSuccess}
                </div>
              )}

              <div style={{ marginTop: '20px', padding: '12px', background: '#f5f5f5', borderRadius: '8px', fontSize: '13px', color: '#666' }}>
                <strong>CSV formaat:</strong> Naam,Aantal,Categorie,Artikelnummer,Minimum,Prijs,Inkoopprijs,Locatie,Leverancier,Notities<br/>
                <strong>JSON formaat:</strong> Array van objecten met velden: naam, aantal, categorie, artikelnummer, minimum, prijs, inkoopprijs, locatie, leverancier, notities
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-cancel" 
                onClick={() => {
                  setShowBulkImportModal(false);
                  setBulkImportError(null);
                  setBulkImportSuccess(null);
                }}
                disabled={bulkImporting}
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPart ? 'Onderdeel bewerken' : 'Onderdeel toevoegen'}</h2>
              <button className="close-button" onClick={handleCloseModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Naam *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Bijv. Binnenband 26 inch"
                  />
                </div>
                <div className="form-group">
                  <label>Artikelnummer</label>
                  <input
                    type="text"
                    name="article_number"
                    value={formData.article_number}
                    onChange={handleInputChange}
                    placeholder="Bijv. BB-26-001"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Aantal</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Minimum voorraad</label>
                  <input
                    type="number"
                    name="min_quantity"
                    value={formData.min_quantity}
                    onChange={handleInputChange}
                    min="0"
                    placeholder="Melding bij lage voorraad"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Verkoopprijs (€)</label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Inkoopprijs (€)</label>
                  <input
                    type="number"
                    name="purchase_price"
                    value={formData.purchase_price}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Categorie</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="Bijv. Banden, Remmen, Verlichting"
                    list="category-suggestions"
                  />
                  <datalist id="category-suggestions">
                    {categories.filter(c => c !== 'Alle categorieën').map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Locatie</label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="Bijv. Schap A3, Magazijn"
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Leverancier</label>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleInputChange}
                  placeholder="Bijv. Shimano, Bosch"
                />
              </div>

              <div className="form-group full-width">
                <label>Notities</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Extra opmerkingen..."
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={handleCloseModal}>
                Annuleren
              </button>
              <button 
                className="btn-save" 
                onClick={handleSavePart}
                disabled={saving}
              >
                {saving ? 'Opslaan...' : (editingPart ? 'Bijwerken' : 'Toevoegen')}
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

export default Inventory;













