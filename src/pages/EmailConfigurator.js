import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserRoutes, saveEmailTemplate, getEmailTemplate } from '../services/userData';
import './EmailConfigurator.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8001');

// SVG Icons
const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </svg>
);

const TestIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const EmailIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const TEMPLATES = [
  { id: 'klanten-informeren', name: 'Klanten informeren', description: 'Informeer klanten dat ze zijn aangemeld voor de route' },
  { id: 'klant-aangemeld', name: 'Klant aangemeld', description: 'Verzend bevestiging wanneer een nieuwe stop met e-mail wordt toegevoegd' },
  { id: 'route-live-bekijken', name: 'Route live bekijken', description: 'Klanten kunnen live de route voortgang volgen' },
  { id: 'route-gestart', name: 'Route gestart', description: 'Informeer klanten dat de route is gestart' }
];

function EmailConfigurator() {
  const { currentUser } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    const loadRoutes = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const userRoutes = await getUserRoutes(currentUser.id);
        setRoutes(userRoutes);
        if (userRoutes.length > 0 && !selectedRoute) {
          setSelectedRoute(userRoutes[0].id);
        }
      } catch (error) {
        console.error('Error loading routes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();
  }, [currentUser]);

  const getTemplateContent = (templateType, route) => {
    const routeName = route?.name || 'Route';
    const routeDate = route?.date 
      ? new Date(route.date).toLocaleDateString('nl-NL', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : 'vandaag';
    const stopsCount = route?.stops?.length || 0;
    const routeLink = route?.id ? `https://routenu.nl/route/${route.id}` : '#';

    const templates = {
      'klanten-informeren': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0CC0DF;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #0CC0DF;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 9999px;
      margin-top: 20px;
    }
    .time-info {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
      border-left: 4px solid #0CC0DF;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RouteNu</h1>
  </div>
  <div class="content">
    <h2>Beste klant,</h2>
    <p>U bent aangemeld voor de route <strong>${routeName}</strong> op ${routeDate}.</p>
    <div class="time-info">
      <p><strong>Verwachte aankomsttijd:</strong> \${stopTimeRange}</p>
    </div>
    <p>Meer informatie ontvangt u op de dag zelf van de route.</p>
    <a href="${routeLink}" class="button">Bekijk route</a>
  </div>
</body>
</html>`,

      'route-live-bekijken': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0CC0DF;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #0CC0DF;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 9999px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RouteNu</h1>
  </div>
  <div class="content">
    <h2>Beste klant,</h2>
    <p>U kunt nu live de voortgang van route <strong>${routeName}</strong> voor ${routeDate} volgen.</p>
    <p>De route bevat ${stopsCount} stop${stopsCount !== 1 ? 's' : ''} en is nu actief.</p>
    <a href="${routeLink}" class="button">Route live bekijken</a>
  </div>
</body>
</html>`,

      'route-gestart': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0CC0DF;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #0CC0DF;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 9999px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RouteNu</h1>
  </div>
  <div class="content">
    <h2>Beste klant,</h2>
    <p>Route <strong>${routeName}</strong> voor ${routeDate} is gestart!</p>
    <p>De route bevat ${stopsCount} stop${stopsCount !== 1 ? 's' : ''} en wordt nu uitgevoerd.</p>
    <a href="${routeLink}" class="button">Volg route</a>
  </div>
</body>
</html>`,

      'klant-aangemeld': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0CC0DF;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #0CC0DF;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 9999px;
      margin-top: 20px;
    }
    .info-box {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RouteNu</h1>
  </div>
  <div class="content">
    <h2>Beste \${stopName},</h2>
    <p>De route <strong>\${routeName}</strong> is aangemaakt en u bent aangemeld voor deze route op <strong>\${routeDate}</strong>.</p>
    <div class="info-box">
      <p><strong>Uw stop:</strong></p>
      <p>\${stopAddress}</p>
    </div>
    <p>U ontvangt verdere informatie zodra de route is berekend en geoptimaliseerd.</p>
    <a href="\${routeLink}" class="button">Bekijk route</a>
  </div>
</body>
</html>`
    };

    return templates[templateType] || templates['klanten-informeren'];
  };

  const handleTemplateClick = (template) => {
    setSelectedTemplate(template.id);
    setIsEditorOpen(true);
  };

  return (
    <div className="email-configurator-page">
      <div className="email-configurator-header">
        <h1>E-mail Templates</h1>
      </div>

      <div className="routes-table-container">
        {loading ? (
          <div className="empty-routes">
            <p>Templates laden...</p>
          </div>
        ) : (
          <table className="routes-table">
            <thead>
              <tr>
                <th>Template naam</th>
                <th>Beschrijving</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATES.map((template) => (
                <tr 
                  key={template.id} 
                  className="route-row"
                  onClick={() => handleTemplateClick(template)}
                >
                  <td className="route-name">{template.name}</td>
                  <td>{template.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="template-integrations">
        <div className="integration-item">
          <div className="integration-icon-wrapper email-icon-wrapper">
            <EmailIcon />
          </div>
          <div className="integration-text">
            <h3>E-mail Templates</h3>
            <p>Configureer en beheer uw e-mail templates voor automatische notificaties</p>
          </div>
        </div>
        <div className="integration-item">
          <img src="/zapier-icon.webp" alt="Zapier" className="integration-icon zapier-icon-large" />
          <div className="integration-text">
            <h3>Zapier Integratie</h3>
            <p>Voeg webhook URLs toe om automatisch data naar Zapier te versturen wanneer templates worden gebruikt</p>
          </div>
        </div>
      </div>

      <div className="page-logo-footer">
        <img src="/logo.png" alt="Routenu" />
      </div>

      {isEditorOpen && selectedTemplate && (
        <EmailEditor
          template={{ id: selectedTemplate, name: TEMPLATES.find(t => t.id === selectedTemplate)?.name || 'Template' }}
          routes={routes}
          selectedRoute={selectedRoute}
          onRouteChange={setSelectedRoute}
          onClose={() => {
            setIsEditorOpen(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
}

function EmailEditor({ template, routes, selectedRoute, onRouteChange, onClose }) {
  const { currentUser } = useAuth();
  const [htmlContent, setHtmlContent] = useState('');
  const [emailData, setEmailData] = useState({
    subject: '',
    from: 'noreply@routenu.nl',
    webhook_url: ''
  });
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [sendStatus, setSendStatus] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [showNotification, setShowNotification] = useState(false);

  const getTemplateContent = (templateType, route) => {
    const routeName = route?.name || 'Route';
    const routeDate = route?.date 
      ? new Date(route.date).toLocaleDateString('nl-NL', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : 'vandaag';
    const stopsCount = route?.stops?.length || 0;
    const routeLink = route?.id ? `https://routenu.nl/route/${route.id}` : '#';

    const templates = {
      'klanten-informeren': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0CC0DF;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #0CC0DF;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 9999px;
      margin-top: 20px;
    }
    .time-info {
      background: white;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
      border-left: 4px solid #0CC0DF;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RouteNu</h1>
  </div>
  <div class="content">
    <h2>Beste klant,</h2>
    <p>U bent aangemeld voor de route <strong>${routeName}</strong> op ${routeDate}.</p>
    <div class="time-info">
      <p><strong>Verwachte aankomsttijd:</strong> \${stopTimeRange}</p>
    </div>
    <p>Meer informatie ontvangt u op de dag zelf van de route.</p>
    <a href="${routeLink}" class="button">Bekijk route</a>
  </div>
</body>
</html>`,

      'route-live-bekijken': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0CC0DF;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #0CC0DF;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 9999px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RouteNu</h1>
  </div>
  <div class="content">
    <h2>Beste klant,</h2>
    <p>U kunt nu live de voortgang van route <strong>${routeName}</strong> voor ${routeDate} volgen.</p>
    <p>De route bevat ${stopsCount} stop${stopsCount !== 1 ? 's' : ''} en is nu actief.</p>
    <a href="${routeLink}" class="button">Route live bekijken</a>
  </div>
</body>
</html>`,

      'route-gestart': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #0CC0DF;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 0 0 8px 8px;
    }
    .button {
      display: inline-block;
      background: #0CC0DF;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 9999px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RouteNu</h1>
  </div>
  <div class="content">
    <h2>Beste klant,</h2>
    <p>Route <strong>${routeName}</strong> voor ${routeDate} is gestart!</p>
    <p>De route bevat ${stopsCount} stop${stopsCount !== 1 ? 's' : ''} en wordt nu uitgevoerd.</p>
    <a href="${routeLink}" class="button">Volg route</a>
  </div>
</body>
</html>`
    };

    return templates[templateType] || templates['klanten-informeren'];
  };

  const selectedRouteData = routes.find(r => r.id === selectedRoute);

  // Functie om preview HTML te maken met mockdata of echte data
  const getPreviewHtml = () => {
    if (!htmlContent) return '';
    
    // Gebruik echte route data als beschikbaar, anders mockdata
    const routeName = selectedRouteData?.name || 'Route 15 januari 2024';
    const routeDate = selectedRouteData?.date 
      ? new Date(selectedRouteData.date).toLocaleDateString('nl-NL', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : new Date().toLocaleDateString('nl-NL', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });
    const stopsCount = selectedRouteData?.stops?.length || 5;
    const routeLink = selectedRouteData?.id 
      ? `https://routenu.nl/route/${selectedRouteData.id}` 
      : 'https://routenu.nl/route/12345';

    const stopName = 'Jan Jansen'; // Mock data voor preview
    const stopAddress = 'Hoofdstraat 123, Amsterdam, Netherlands'; // Mock data voor preview
    const stopTimeRange = '09:30 - 09:35'; // Mock data voor preview
    const liveRouteLink = selectedRouteData?.id 
      ? `https://routenu.nl/route/${selectedRouteData.id}/TOKEN/email@example.com`
      : 'https://routenu.nl/route/12345/TOKEN/email@example.com';

    return htmlContent
      .replace(/\$\{routeName\}/g, routeName)
      .replace(/\$\{routeDate\}/g, routeDate)
      .replace(/\$\{stopsCount\}/g, stopsCount.toString())
      .replace(/\$\{routeLink\}/g, routeLink)
      .replace(/\$\{liveRouteLink\}/g, liveRouteLink)
      .replace(/\$\{stopName\}/g, stopName)
      .replace(/\$\{stopAddress\}/g, stopAddress)
      .replace(/\$\{stopTimeRange\}/g, stopTimeRange);
  };

  // Load saved template on mount
  useEffect(() => {
    const loadSavedTemplate = async () => {
      if (!template || !template.id) {
        // If no template, use default if route data available
        if (selectedRouteData) {
          const newContent = getTemplateContent('klanten-informeren', selectedRouteData);
          setHtmlContent(newContent);
        }
        return;
      }

      if (!currentUser) {
        // If no user, use default template
        if (selectedRouteData) {
          const newContent = getTemplateContent(template.id, selectedRouteData);
          setHtmlContent(newContent);
        }
        return;
      }
      
      try {
        const savedTemplate = await getEmailTemplate(currentUser.id, template.id);
        if (savedTemplate) {
          setHtmlContent(savedTemplate.html_content);
          setEmailData(prev => ({
            ...prev,
            subject: savedTemplate.subject,
            from: savedTemplate.from_email || 'noreply@routenu.nl',
            webhook_url: savedTemplate.webhook_url || ''
          }));
        } else if (selectedRouteData) {
          // Use default template if no saved template exists
          const newContent = getTemplateContent(template.id, selectedRouteData);
          setHtmlContent(newContent);
        }
      } catch (error) {
        console.error('Error loading saved template:', error);
        // Fallback to default template
        if (selectedRouteData && template) {
          try {
            const newContent = getTemplateContent(template.id, selectedRouteData);
            setHtmlContent(newContent);
          } catch (fallbackError) {
            console.error('Error generating fallback template:', fallbackError);
          }
        }
      }
    };

    loadSavedTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, template?.id, selectedRoute]);

  const handleSaveTemplate = async () => {
    // Validatie
    setValidationError(null);
    
    if (!currentUser) {
      setValidationError('Je moet ingelogd zijn om templates op te slaan');
      return;
    }
    
    if (!template) {
      setValidationError('Geen template geselecteerd');
      return;
    }
    
    if (!emailData.subject || !emailData.subject.trim()) {
      setValidationError('Vul alstublieft een onderwerp in');
      return;
    }
    
    if (!htmlContent || !htmlContent.trim()) {
      setValidationError('Vul alstublieft HTML inhoud in');
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      console.log('Saving template:', {
        templateType: template.id,
        subject: emailData.subject,
        htmlContentLength: htmlContent.length,
        htmlContentPreview: htmlContent.substring(0, 200),
        fromEmail: emailData.from
      });
      
      console.log('Saving template with data:', {
        userId: currentUser.id,
        templateType: template.id,
        hasWebhookUrl: !!(emailData.webhook_url && emailData.webhook_url.trim()),
        webhookUrl: emailData.webhook_url || 'NOT SET'
      });
      
      const savedData = await saveEmailTemplate(currentUser.id, {
        template_type: template.id,
        subject: emailData.subject,
        html_content: htmlContent,
        from_email: emailData.from,
        webhook_url: emailData.webhook_url || null
      });

      console.log('Template saved successfully:', {
        id: savedData?.id,
        htmlContentLength: savedData?.html_content?.length,
        htmlContentPreview: savedData?.html_content?.substring(0, 200),
        webhook_url: savedData?.webhook_url,
        hasWebhook: !!(savedData?.webhook_url && savedData?.webhook_url.trim())
      });

      // Toon notificatie
      setShowNotification(true);
      
      // Sluit editor na 1 seconde
      setTimeout(() => {
        onClose();
        setShowNotification(false);
      }, 1000);
    } catch (error) {
      console.error('Error saving template:', error);
      
      // Check if error is about missing table
      let errorMessage = 'Fout bij opslaan template: ' + (error.message || 'Onbekende fout');
      if (error.message && (
        error.message.includes('email_templates') || 
        error.message.includes('does not exist') ||
        error.message.includes('schema cache') ||
        error.code === 'PGRST205'
      )) {
        errorMessage = 'De email_templates tabel bestaat nog niet. Voer email-templates-setup.sql uit in Supabase SQL Editor om de tabel aan te maken.';
      }
      
      setValidationError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Functie om variabelen te vervangen in HTML content
  const replaceTemplateVariables = (content) => {
    if (!selectedRouteData) return content;
    
    const routeName = selectedRouteData.name || 'Route';
    const routeDate = selectedRouteData.date 
      ? new Date(selectedRouteData.date).toLocaleDateString('nl-NL', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        })
      : 'vandaag';
    const stopsCount = selectedRouteData.stops?.length || 0;
    const routeLink = selectedRouteData.id ? `https://routenu.nl/route/${selectedRouteData.id}` : '#';
    // For preview, use a mock live route link (will be replaced with personal link when route starts)
    const liveRouteLink = selectedRouteData.id ? `https://routenu.nl/route/${selectedRouteData.id}/TOKEN/email@example.com` : '#';

    return content
      .replace(/\$\{routeName\}/g, routeName)
      .replace(/\$\{routeDate\}/g, routeDate)
      .replace(/\$\{stopsCount\}/g, stopsCount.toString())
      .replace(/\$\{routeLink\}/g, routeLink)
      .replace(/\$\{liveRouteLink\}/g, liveRouteLink)
      .replace(/\$\{stopName\}/g, '') // Wordt vervangen door echte data bij verzenden
      .replace(/\$\{stopAddress\}/g, '') // Wordt vervangen door echte data bij verzenden
      .replace(/\$\{stopTimeRange\}/g, '09:30 - 09:35'); // Wordt vervangen door echte data bij verzenden
  };

  const handleSendEmail = async () => {
    if (!emailData.subject) {
      alert('Vul alstublieft een onderwerp in');
      return;
    }

    if (!selectedRouteData) {
      alert('Selecteer eerst een route');
      return;
    }

    setIsSending(true);
    setSendStatus(null);

    try {
      // Vervang variabelen in HTML content
      const processedHtml = replaceTemplateVariables(htmlContent);
      const processedSubject = replaceTemplateVariables(emailData.subject);

      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: emailData.from,
          to: 'noreply@routenu.nl', // Placeholder - wordt niet gebruikt bij automatisch verzenden
          subject: processedSubject,
          html: processedHtml
        })
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (response.ok) {
        setSendStatus({ success: true, message: 'E-mail succesvol verzonden!' });
        // Note: E-mails worden automatisch verzonden vanuit de app, dit is alleen voor test doeleinden
      } else {
        throw new Error(data.message || data.error?.message || `HTTP ${response.status}: E-mail verzenden mislukt`);
      }
    } catch (error) {
      console.error('Email send error:', error);
      let errorMessage = 'Er is een fout opgetreden bij het verzenden van de e-mail';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Netwerkfout: Kan geen verbinding maken met de Resend API. Controleer je internetverbinding of probeer het later opnieuw.';
      }
      
      setSendStatus({ 
        success: false, 
        message: errorMessage
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      alert('Vul alstublieft een test e-mailadres in');
      return;
    }

    setIsSendingTest(true);
    setSendStatus(null);

    try {
      // Vervang variabelen in HTML content
      const processedHtml = replaceTemplateVariables(htmlContent);
      const processedSubject = replaceTemplateVariables(emailData.subject || 'Test e-mail');

      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: emailData.from,
          to: testEmail,
          subject: `[TEST] ${processedSubject}`,
          html: processedHtml
        })
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (response.ok) {
        setSendStatus({ success: true, message: `Test e-mail succesvol verzonden naar ${testEmail}!` });
      } else {
        throw new Error(data.message || data.error?.message || `HTTP ${response.status}: Test e-mail verzenden mislukt`);
      }
    } catch (error) {
      console.error('Test email send error:', error);
      let errorMessage = 'Er is een fout opgetreden bij het verzenden van de test e-mail';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Netwerkfout: Kan geen verbinding maken met de Resend API. Controleer je internetverbinding of probeer het later opnieuw.';
      }
      
      setSendStatus({ 
        success: false, 
        message: errorMessage
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <>
      {showNotification && (
        <div className="save-notification">
          Opgeslagen
        </div>
      )}
      <div className="email-editor-overlay" onClick={onClose}>
        <div className="email-editor-content" onClick={(e) => e.stopPropagation()}>
        <div className="email-editor-header">
          <h2>{template.name}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="email-layout">
          <div className="email-editor-section">
            <div className="email-form">
              <div className="form-group">
                <label htmlFor="route">Route selecteren *</label>
                {routes.length === 0 ? (
                  <div className="no-routes">Geen routes beschikbaar</div>
                ) : (
                  <select
                    id="route"
                    value={selectedRoute}
                    onChange={(e) => onRouteChange(e.target.value)}
                    className="route-select"
                  >
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name || `Route ${route.date ? new Date(route.date).toLocaleDateString('nl-NL') : 'zonder datum'}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="from">Van (From)</label>
                <input
                  type="email"
                  id="from"
                  value={emailData.from}
                  disabled
                  placeholder="noreply@routenu.nl"
                  className="disabled-input"
                />
                <small className="form-hint">Dit adres kan niet worden aangepast</small>
              </div>

              <div className="form-group">
                <label htmlFor="test-email">Test E-mailadres</label>
                <input
                  type="email"
                  id="test-email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@voorbeeld.nl"
                />
                <small className="form-hint">Voer een e-mailadres in om een test e-mail te versturen</small>
              </div>

              <div className="form-group">
                <label htmlFor="subject">Onderwerp (Subject) *</label>
                <input
                  type="text"
                  id="subject"
                  value={emailData.subject}
                  onChange={(e) => {
                    setEmailData({ ...emailData, subject: e.target.value });
                    setValidationError(null);
                  }}
                  placeholder="Bijv. Uw route is klaar"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="webhook-url" className="webhook-label">
                  <img src="/zapier-icon.webp" alt="Zapier" className="zapier-icon" />
                  Zapier Webhook URL (optioneel)
                </label>
                <input
                  type="url"
                  id="webhook-url"
                  value={emailData.webhook_url}
                  onChange={(e) => {
                    setEmailData({ ...emailData, webhook_url: e.target.value });
                    setValidationError(null);
                  }}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                />
                <small className="form-hint">Voer een Zapier webhook URL in om automatisch webhooks te versturen wanneer deze template wordt gebruikt. Laat leeg als je geen webhook wilt gebruiken.</small>
              </div>

              <div className="form-group">
                <label htmlFor="html-content">
                  HTML Inhoud
                  <span className="variables-hint">
                    Variabelen: <code>{'${routeName}'}</code> <code>{'${routeDate}'}</code> <code>{'${stopsCount}'}</code> <code>{'${routeLink}'}</code> <code>{'${liveRouteLink}'}</code>
                    {template?.id === 'klant-aangemeld' && (
                      <> <code>{'${stopName}'}</code> <code>{'${stopAddress}'}</code></>
                    )}
                    {template?.id === 'klanten-informeren' && (
                      <> <code>{'${stopTimeRange}'}</code></>
                    )}
                  </span>
                </label>
                <textarea
                  id="html-content"
                  className="html-editor"
                  value={htmlContent}
                  onChange={(e) => {
                    setHtmlContent(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder="Voer hier je HTML code in..."
                  rows={15}
                />
              </div>

              {validationError && (
                <div className="validation-error">
                  {validationError}
                </div>
              )}

              <div className="form-actions">
                <button
                  className="btn-save"
                  onClick={handleSaveTemplate}
                  disabled={isSaving}
                  title="Sla template op voor later gebruik"
                >
                  {isSaving ? (
                    'Opslaan...'
                  ) : (
                    <>
                      <SaveIcon />
                      Template opslaan
                    </>
                  )}
                </button>
                <button
                  className="btn-test"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTest || !testEmail || !emailData.subject}
                >
                  {isSendingTest ? (
                    'Verzenden...'
                  ) : (
                    <>
                      <TestIcon />
                      Test e-mail verzenden
                    </>
                  )}
                </button>
                <button
                  className="btn-send"
                  onClick={handleSendEmail}
                  disabled={isSending || !emailData.subject || !selectedRouteData}
                >
                  {isSending ? (
                    'Verzenden...'
                  ) : (
                    <>
                      <SendIcon />
                      E-mail verzenden
                    </>
                  )}
                </button>
              </div>

              {sendStatus && (
                <div className={`send-status ${sendStatus.success ? 'success' : 'error'}`}>
                  {sendStatus.message}
                </div>
              )}
            </div>
          </div>

          <div className="email-preview-section">
            <div className="preview-header">
              <h3>Live Preview</h3>
              <p className="preview-hint">Preview wordt automatisch bijgewerkt</p>
            </div>
            <div className="preview-container">
              <iframe
                title="Email Preview"
                className="preview-iframe"
                srcDoc={getPreviewHtml()}
                sandbox="allow-same-origin allow-scripts"
              />
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}

export default EmailConfigurator;
