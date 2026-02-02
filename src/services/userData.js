import { supabase } from '../lib/supabase';

// Save route (insert or update)
export const saveRoute = async (userId, routeData) => {
  try {
    // If routeData has an id, update existing route
    if (routeData.id) {
      const { data, error } = await supabase
        .from('routes')
        .update({
          ...routeData,
          updated_at: new Date().toISOString()
        })
        .eq('id', routeData.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } else {
      // Insert new route
      const { data, error } = await supabase
        .from('routes')
        .insert({
          user_id: userId,
          ...routeData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data.id;
    }
  } catch (error) {
    console.error('Error saving route:', error);
    throw error;
  }
};

// Get all routes for user
export const getUserRoutes = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('routes')
      .select(`
        *,
        drivers (
          id,
          name,
          email
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Map the data to include driver name from the join
    const routesWithDriverName = (data || []).map(route => ({
      ...route,
      driver_name: route.drivers?.name || route.selected_driver || null
    }));
    
    return routesWithDriverName;
  } catch (error) {
    console.error('Error getting routes:', error);
    throw error;
  }
};

// Get route for specific date
export const getRouteByDate = async (userId, date) => {
  try {
    const dateStr = date instanceof Date 
      ? date.toISOString().split('T')[0] 
      : new Date(date).toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Error getting route by date:', error);
    throw error;
  }
};

// Save vehicle
export const saveVehicle = async (userId, vehicleData) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .insert({
        user_id: userId,
        ...vehicleData,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error saving vehicle:', error);
    throw error;
  }
};

// Get all vehicles for user
export const getUserVehicles = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting vehicles:', error);
    throw error;
  }
};

// Save order
export const saveOrder = async (userId, orderData) => {
  try {
    // Map camelCase to snake_case for database
    const mappedData = {
      name: orderData.name,
      coordinates: orderData.coordinates,
      address: orderData.address,
      email: orderData.email || null,
      phone: orderData.phone || null,
      order_type: orderData.orderType || orderData.order_type || null,
      service_time: orderData.serviceTime || orderData.service_time || 5, // Service tijd in minuten
      customer_info: orderData.customerInfo || orderData.customer_info || null
    };

    // Check if order already exists (use .maybeSingle() to avoid 406 error if not found)
    const { data: existing, error: checkError } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('address', mappedData.address)
      .eq('name', mappedData.name)
      .maybeSingle();

    // If order exists, return its ID
    if (existing && !checkError) {
      return existing.id;
    }

    // Insert new order
    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        ...mappedData,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error saving order:', error);
    throw error;
  }
};

// Get all orders for user with completion status
export const getUserOrders = async (userId) => {
  try {
    // Try to use the view first, fallback to regular query if view doesn't exist
    let data, error;
    
    try {
      const result = await supabase
        .from('orders_with_status')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      data = result.data;
      error = result.error;
      
      // If view doesn't exist, fall back to regular query
      if (error && error.code === '42P01') {
        console.log('orders_with_status view not found, using regular orders query');
        const fallbackResult = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        data = fallbackResult.data;
        error = fallbackResult.error;
        
        // For each order, check if it's completed
        if (data) {
          for (const order of data) {
            try {
              const { data: completionData } = await supabase
                .rpc('is_order_completed', { order_id_param: order.id });
              
              order.is_completed = completionData || false;
            } catch (rpcError) {
              // If function doesn't exist, set to false
              order.is_completed = false;
            }
          }
        }
      }
    } catch (viewError) {
      // View doesn't exist, use regular query
      const fallbackResult = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting orders:', error);
    throw error;
  }
};

// Get order completion details
export const getOrderCompletionInfo = async (orderId) => {
  try {
    const { data, error } = await supabase
      .rpc('get_order_completion_info', { order_id_param: orderId });

    if (error) {
      // If function doesn't exist, return null
      if (error.code === '42883') {
        return null;
      }
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error getting order completion info:', error);
    return null;
  }
};

// Delete item
export const deleteItem = async (tableName, itemId) => {
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
};

// Update item
export const updateItem = async (tableName, itemId, updates) => {
  try {
    // Build update object - only add updated_at if it's likely to exist
    const updateData = { ...updates };
    
    // Add updated_at for tables that typically have it
    if (['routes', 'vehicles', 'orders', 'email_templates', 'user_profiles', 'drivers'].includes(tableName)) {
      updateData.updated_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', itemId)
      .select();

    if (error) throw error;
    
    // Return first item or null
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
};

// Get user profile
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
};

// Save driver
export const saveDriver = async (adminUserId, driverUserId, driverData) => {
  try {
    console.log('Saving driver with adminUserId:', adminUserId, 'driverUserId:', driverUserId, 'driverData:', driverData);
    
    // First check if drivers table exists and is accessible
    const { data: existingDriver, error: checkError } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', driverUserId)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing driver:', checkError);
      // If table doesn't exist or RLS blocks, provide helpful error
      if (checkError.code === '42P01') {
        throw new Error('De drivers tabel bestaat nog niet. Voer het driver-setup.sql script uit in Supabase.');
      }
      if (checkError.code === '42501' || checkError.message.includes('permission')) {
        throw new Error('Geen toegang tot drivers tabel. Controleer de RLS policies in Supabase.');
      }
      throw checkError;
    }
    
    const { data, error } = await supabase
      .from('drivers')
      .upsert({
        user_id: driverUserId,
        admin_user_id: adminUserId, // Link driver to admin who created them
        name: driverData.name,
        email: driverData.email,
        phone: driverData.phone || null,
        license_number: driverData.license_number || null,
        hourly_rate: driverData.hourly_rate || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error saving driver:', error);
      if (error.code === '42501' || error.message.includes('permission') || error.message.includes('policy')) {
        throw new Error('Geen toegang om driver op te slaan. Controleer de RLS policies. Voer driver-setup.sql uit in Supabase.');
      }
      throw error;
    }
    
    console.log('Driver saved successfully:', data);
    return data;
  } catch (error) {
    console.error('Error saving driver:', error);
    throw error;
  }
};

// Check if user is a driver
// Only returns true if the driver has an email (has an account)
// Drivers without account are linked to admin user_id but don't have email, so they shouldn't be considered as "driver users"
export const isUserDriver = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking if user is driver:', error);
      return false;
    }

    // Only return true if driver exists AND has an email (meaning they have an account)
    // Drivers without account have null email and are linked to admin user_id
    return !!(data && data.email);
  } catch (error) {
    console.error('Error checking if user is driver:', error);
    return false;
  }
};

// Get all drivers for user (admin view)
export const getUserDrivers = async (userId) => {
  try {
    // Filter drivers by admin_user_id to ensure data isolation between admin users
    // Drivers can be:
    // 1. Without account: user_id = admin.user_id (legacy)
    // 2. With account: admin_user_id = admin.user_id (new, preferred)
    
    // First, get drivers directly linked to this admin (drivers without account - legacy)
    const { data: directDrivers, error: directError } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (directError) throw directError;
    
    // Second, get drivers with admin_user_id (drivers with account created by this admin)
    // Check if admin_user_id column exists first - use a safe query that won't cause recursion
    let adminDrivers = [];
    try {
      // Use a simple query that checks if column exists by trying to select it
      const { data: adminDriversData, error: adminError } = await supabase
        .from('drivers')
        .select('id, user_id, name, email, phone, license_number, admin_user_id, created_at, updated_at')
        .eq('admin_user_id', userId)
        .order('created_at', { ascending: false });

      if (adminError) {
        // Column might not exist yet (42703 = undefined_column), ignore this error
        if (adminError.code === '42703') {
          console.log('admin_user_id column does not exist yet, skipping admin drivers query');
        } else {
          console.warn('Error getting admin drivers:', adminError);
        }
      } else {
        adminDrivers = adminDriversData || [];
      }
    } catch (error) {
      // Column doesn't exist or other error, skip this query
      if (error.code === '42703') {
        console.log('admin_user_id column may not exist, skipping admin drivers query');
      } else {
        console.warn('Error in admin drivers query:', error);
      }
    }

    // Skip route and vehicle lookups to avoid recursion issues
    // Drivers should be linked via admin_user_id or user_id directly
    // If a driver is used in routes/vehicles, they should already be in directDrivers or adminDrivers

    // Combine and deduplicate drivers
    const allDrivers = [...(directDrivers || []), ...(adminDrivers || [])];
    const uniqueDrivers = allDrivers.filter((driver, index, self) =>
      index === self.findIndex(d => d.id === driver.id)
    );

    return uniqueDrivers;
  } catch (error) {
    console.error('Error getting drivers:', error);
    throw error;
  }
};

// Assign route to driver
export const assignRouteToDriver = async (routeId, driverId) => {
  try {
    const { data, error } = await supabase
      .from('routes')
      .update({ 
        driver_id: driverId,
        route_status: 'planned'
      })
      .eq('id', routeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error assigning route to driver:', error);
    throw error;
  }
};

// Save email template
export const saveEmailTemplate = async (userId, templateData) => {
  try {
    console.log('💾 Saving email template to Supabase:', {
      userId,
      templateType: templateData.template_type,
      htmlContentLength: templateData.html_content?.length,
      htmlContentType: typeof templateData.html_content,
      webhook_url: templateData.webhook_url,
      webhook_urlType: typeof templateData.webhook_url,
      webhook_urlLength: templateData.webhook_url?.length,
      webhook_urlTrimmed: templateData.webhook_url?.trim(),
      hasWebhookUrl: !!(templateData.webhook_url && templateData.webhook_url.trim())
    });
    
    const { data, error } = await supabase
      .from('email_templates')
      .upsert({
        user_id: userId,
        template_type: templateData.template_type,
        subject: templateData.subject,
        html_content: templateData.html_content,
        from_email: templateData.from_email || 'noreply@routenu.nl',
        webhook_url: templateData.webhook_url || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,template_type'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error saving template:', error);
      throw error;
    }
    
    console.log('✅ Template saved to Supabase:', {
      id: data?.id,
      htmlContentLength: data?.html_content?.length,
      htmlContentPreview: data?.html_content?.substring(0, 100),
      webhook_url: data?.webhook_url,
      webhook_urlType: typeof data?.webhook_url,
      webhook_urlLength: data?.webhook_url?.length,
      webhook_urlTrimmed: data?.webhook_url?.trim(),
      hasWebhook: !!(data?.webhook_url && data?.webhook_url.trim()),
      fullData: data // Log full data to see everything
    });
    
    return data;
  } catch (error) {
    console.error('Error saving email template:', error);
    
    // Provide more helpful error message if table doesn't exist
    if (error.message && (
      error.message.includes('email_templates') || 
      error.message.includes('does not exist') ||
      error.message.includes('schema cache') ||
      error.code === 'PGRST205'
    )) {
      const helpfulError = new Error('De email_templates tabel bestaat nog niet. Voer email-templates-setup.sql uit in Supabase SQL Editor.');
      helpfulError.originalError = error;
      throw helpfulError;
    }
    
    throw error;
  }
};

// Get email template
export const getEmailTemplate = async (userId, templateType) => {
  try {
    console.log('Fetching email template from Supabase:', { userId, templateType });
    
    // Use RPC or direct query - RLS should allow if driver has assigned routes
    // But if RLS blocks, we need to use service role or bypass RLS
    // For now, try direct query - RLS policy should allow if driver has routes assigned
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', userId)
      .eq('template_type', templateType)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase error fetching template:', error);
      throw error;
    }
    
    if (data) {
      console.log('📥 Template fetched from Supabase:', {
        id: data.id,
        htmlContentLength: data.html_content?.length,
        htmlContentType: typeof data.html_content,
        htmlContentPreview: data.html_content?.substring(0, 100),
        webhook_url: data.webhook_url,
        webhook_urlType: typeof data.webhook_url,
        webhook_urlLength: data.webhook_url?.length,
        webhook_urlTrimmed: data.webhook_url?.trim(),
        hasWebhook: !!(data.webhook_url && data.webhook_url.trim()),
        fullData: data // Log full data to see everything
      });
    } else {
      console.log('❌ No template found in Supabase for:', { userId, templateType });
      // Try to see if there are any templates for this user
      const { data: allTemplates, error: allError } = await supabase
        .from('email_templates')
        .select('template_type, webhook_url, user_id')
        .eq('user_id', userId);
      
      if (!allError && allTemplates) {
        console.log('📋 Available templates for this user:', allTemplates);
        console.log('📋 Looking for template type:', templateType);
        const matchingTemplate = allTemplates.find(t => t.template_type === templateType);
        if (matchingTemplate) {
          console.log('✅ Found matching template in list:', matchingTemplate);
        } else {
          console.log('❌ No matching template found in list');
        }
      } else if (allError) {
        console.error('❌ Error fetching all templates:', allError);
      }
    }
    
    return data || null;
  } catch (error) {
    console.error('Error getting email template:', error);
    throw error;
  }
};

// Get all email templates for user
export const getUserEmailTemplates = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting email templates:', error);
    throw error;
  }
};

// Send webhook to Zapier via backend API
export const sendWebhook = async (webhookUrl, templateType, data) => {
  if (!webhookUrl || !webhookUrl.trim()) {
    return; // Geen webhook URL, geen fout - gewoon niet verzenden
  }

  try {
    const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8001');
    
    console.log('Sending webhook via backend API:', { webhookUrl, templateType });

    const response = await fetch(`${API_BASE_URL}/api/send-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        webhookUrl: webhookUrl.trim(),
        templateType,
        data
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Webhook response not OK:', response.status, response.statusText, errorData);
      // Geen error gooien - webhook failures mogen email sending niet blokkeren
    } else {
      console.log('Webhook sent successfully');
    }
  } catch (error) {
    console.error('Error sending webhook:', error);
    // Geen error gooien - webhook failures mogen email sending niet blokkeren
  }
};

// Recalculate arrival times based on actual arrival times
export const recalculateArrivalTimes = async (routeId, routeData, actualTimestamps, userServiceTime = null) => {
  try {
    if (!routeData || !routeData.stops || routeData.stops.length === 0) {
      return [];
    }

    // Get route start time
    const routeStartTime = actualTimestamps.find(t => t.stop_index === -1)?.route_started_at;
    if (!routeStartTime) {
      // Fallback to original calculation if no start time
      return calculateOriginalArrivalTimes(routeData, routeData.route_started_at, userServiceTime);
    }

    const startTime = new Date(routeStartTime);
    const recalculatedTimes = [];
    
    // For each stop, calculate based on actual arrival or estimated
    routeData.stops.forEach((stop, index) => {
      const timestamp = actualTimestamps.find(t => t.stop_index === index);
      
      if (timestamp && timestamp.actual_arrival_time) {
        // Use actual arrival time
        const arrivalTime = new Date(timestamp.actual_arrival_time);
        // Use service time from user profile (if provided), otherwise from route_data, or default 5 minutes
        const serviceTimeMinutes = userServiceTime || routeData.route_data?.service_time || 5;
        const departureTime = timestamp.actual_departure_time 
          ? new Date(timestamp.actual_departure_time)
          : new Date(arrivalTime.getTime() + (serviceTimeMinutes * 60 * 1000));
        
        recalculatedTimes.push({
          arrival: arrivalTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
          departure: departureTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
          isActual: true,
          delay: null // Will calculate delay if needed
        });
      } else {
        // Estimate based on previous actual times and route data
        let estimatedArrival;
        
        if (index === 0) {
          // First stop: estimate from start
          const segmentDuration = routeData.route_data?.waypoints?.[1]?.duration || 
                                 (routeData.route_data?.duration / (routeData.stops.length + 1));
          estimatedArrival = new Date(startTime.getTime() + (segmentDuration * 1000));
        } else {
          // Use last actual arrival time or estimate
          const lastActual = recalculatedTimes[recalculatedTimes.length - 1];
          if (lastActual && lastActual.isActual) {
            const lastArrival = actualTimestamps.find(t => t.stop_index === index - 1)?.actual_arrival_time;
            const lastDeparture = actualTimestamps.find(t => t.stop_index === index - 1)?.actual_departure_time || lastArrival;
            const segmentDuration = routeData.route_data?.waypoints?.[index + 1]?.duration || 
                                   (routeData.route_data?.duration / (routeData.stops.length + 1));
            estimatedArrival = new Date(new Date(lastDeparture).getTime() + (segmentDuration * 1000));
          } else {
            // Fallback to original calculation
            const segmentDuration = routeData.route_data?.waypoints?.[index + 1]?.duration || 
                                   (routeData.route_data?.duration / (routeData.stops.length + 1));
            estimatedArrival = new Date(startTime.getTime() + (segmentDuration * 1000));
          }
        }
        
        // Use service time from user profile (if provided), otherwise from route_data, or default 5 minutes
        const serviceTimeMinutes = userServiceTime || routeData.route_data?.service_time || 5;
        const estimatedDeparture = new Date(estimatedArrival.getTime() + (serviceTimeMinutes * 60 * 1000));
        
        recalculatedTimes.push({
          arrival: estimatedArrival.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
          departure: estimatedDeparture.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
          isActual: false,
          delay: null
        });
      }
    });
    
    return recalculatedTimes;
  } catch (error) {
    console.error('Error recalculating arrival times:', error);
    const routeStartTime = actualTimestamps?.find(t => t.stop_index === -1)?.route_started_at;
    return calculateOriginalArrivalTimes(routeData, routeStartTime || routeData.route_started_at, userServiceTime);
  }
};

// Calculate original arrival times (fallback)
const calculateOriginalArrivalTimes = (routeData, routeStartTime = null, userServiceTime = null) => {
  if (!routeData || !routeData.stops || routeData.stops.length === 0) return [];
  
  // Use route_started_at if available, otherwise use departure_time from route data
  let startTime;
  if (routeStartTime) {
    startTime = new Date(routeStartTime);
  } else if (routeData.route_started_at) {
    startTime = new Date(routeData.route_started_at);
  } else {
    // Fallback to departure_time (but this should not happen if route is started)
    const departureTime = routeData.departure_time || '08:00';
    const [hours, minutes] = departureTime.split(':').map(Number);
    startTime = new Date();
    startTime.setHours(hours, minutes, 0, 0);
  }
  
  const times = [];
  let cumulativeDuration = 0;
  
  if (routeData.route_data?.waypoints && routeData.route_data.waypoints.length > 0) {
    routeData.stops.forEach((stop, index) => {
      const segmentDuration = routeData.route_data.waypoints[index + 1]?.duration || 
                              (routeData.route_data.duration / (routeData.stops.length + 1));
      cumulativeDuration += segmentDuration;
      
      const arrivalTime = new Date(startTime.getTime() + (cumulativeDuration * 1000));
      // Use service time from user profile (if provided), otherwise from route_data, or default 5 minutes
      const serviceTimeMinutes = userServiceTime || routeData.route_data?.service_time || 5;
      const departureTime = new Date(arrivalTime.getTime() + (serviceTimeMinutes * 60 * 1000));
      
      times.push({
        arrival: arrivalTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        departure: departureTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        isActual: false
      });
    });
  }
  
  return times;
};

// Get route stop timestamps
export const getRouteStopTimestamps = async (routeId) => {
  try {
    const { data, error } = await supabase
      .from('route_stop_timestamps')
      .select('*')
      .eq('route_id', routeId)
      .order('stop_index', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting route stop timestamps:', error);
    throw error;
  }
};

// Send registration webhook to Zapier
export const sendRegistrationWebhook = async (userData) => {
  console.log('sendRegistrationWebhook called with:', userData);
  const REGISTRATION_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/20451847/ua2iy39/';
  
  if (!userData) {
    console.warn('No user data provided for registration webhook');
    return;
  }

  try {
    const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8001');
    
    console.log('Sending registration webhook via backend API:', {
      API_BASE_URL,
      webhookUrl: REGISTRATION_WEBHOOK_URL,
      userData
    });

    const payload = {
      webhookUrl: REGISTRATION_WEBHOOK_URL,
      templateType: 'user-registered',
        data: {
          event: 'user_registered',
          user_id: userData.userId || userData.id || '',
          user_name: userData.name || userData.displayName || '',
          user_email: userData.email || '',
          user_phone: userData.phone || '',
          start_address: userData.startAddress || '',
          start_coordinates: userData.startCoordinates || null,
          registration_date: userData.registrationDate || new Date().toISOString(),
          timestamp: new Date().toISOString()
        }
    };

    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${API_BASE_URL}/api/send-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('Webhook response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Registration webhook response not OK:', response.status, response.statusText, errorData);
      // Geen error gooien - webhook failures mogen registratie niet blokkeren
    } else {
      const responseData = await response.json().catch(() => ({}));
      console.log('Registration webhook sent successfully:', responseData);
    }
  } catch (error) {
    console.error('Error sending registration webhook:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    // Geen error gooien - webhook failures mogen registratie niet blokkeren
  }
};

// Get all monthly costs for user
export const getUserMonthlyCosts = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('monthly_costs')
      .select('*')
      .eq('user_id', userId)
      .order('month', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting monthly costs:', error);
    throw error;
  }
};

// Get all picked up bikes for user (admin view)
export const getPickedUpBikes = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('picked_up_bikes')
      .select('*')
      .eq('user_id', userId)
      .order('picked_up_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting picked up bikes:', error);
    throw error;
  }
};

// Get picked up bikes for driver (mechanic portal)
export const getPickedUpBikesForDriver = async (driverId) => {
  try {
    const { data, error } = await supabase
      .from('picked_up_bikes')
      .select('*')
      .eq('driver_id', driverId)
      .order('picked_up_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting picked up bikes for driver:', error);
    throw error;
  }
};

// Save monthly cost
export const saveMonthlyCost = async (userId, costData) => {
  try {
    const { data, error } = await supabase
      .from('monthly_costs')
      .upsert({
        id: costData.id || undefined,
        user_id: userId,
        name: costData.name,
        description: costData.description || null,
        amount: parseFloat(costData.amount),
        cost_type: costData.cost_type || 'advertisement',
        month: costData.month, // Should be first day of month (YYYY-MM-01)
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving monthly cost:', error);
    throw error;
  }
};

// Delete monthly cost
export const deleteMonthlyCost = async (costId) => {
  try {
    const { error } = await supabase
      .from('monthly_costs')
      .delete()
      .eq('id', costId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting monthly cost:', error);
    throw error;
  }
};

// Get monthly costs for a specific month
export const getMonthlyCostsForMonth = async (userId, month) => {
  try {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    
    const { data, error } = await supabase
      .from('monthly_costs')
      .select('*')
      .eq('user_id', userId)
      .gte('month', monthStart.toISOString().split('T')[0])
      .lt('month', monthEnd.toISOString().split('T')[0]);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting monthly costs for month:', error);
    throw error;
  }
};
