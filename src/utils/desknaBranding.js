// Centrale Deskna-branding voor e-mails en de live-tracking pagina.
// Wordt gebruikt wanneer een stop met de "Versturen via Deskna.nl"-toggle is
// aangemaakt. Pas de kleuren/logo hieronder aan als de Deskna-huisstijl wijzigt.

export const DESKNA_FROM = 'noreply@deskna.nl';

// Huisstijl: zwart / wit / oranje
export const DESKNA_ORANGE = '#FF6B00';
export const DESKNA_DARK = '#111111';
export const DESKNA_LIGHT = '#ffffff';

// Logo-pad (moet als bestand in /public staan: public/desknalogomail.png)
export const DESKNA_LOGO_PATH = '/desknalogomail.png';

// Absolute URL nodig voor afbeeldingen in e-mails (mailclients laden alleen via https).
const FRONTEND_BASE_URL =
  process.env.REACT_APP_FRONTEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://app.routenu.nl'
    : (typeof window !== 'undefined' ? window.location.origin : 'https://app.routenu.nl'));

export const DESKNA_LOGO_URL = `${FRONTEND_BASE_URL}${DESKNA_LOGO_PATH}`;

// Basis-layout voor een Deskna-mail. Inhoud (bodyHtml) wordt erin geplaatst.
const buildDesknaEmail = ({ previewText = '', bodyHtml, buttonText, buttonLink }) => `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;">
  <span style="display:none;font-size:1px;color:#f4f4f4;">${previewText}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${DESKNA_LIGHT};border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
          <tr>
            <td align="center" style="background:${DESKNA_DARK};padding:28px 20px;">
              <img src="${DESKNA_LOGO_URL}" alt="Deskna" width="160" style="display:block;max-width:160px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:${DESKNA_ORANGE};"></td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px 32px;color:#222;font-size:15px;line-height:1.6;">
              ${bodyHtml}
              ${buttonText && buttonLink ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px 0;">
                <tr>
                  <td align="center" style="background:${DESKNA_ORANGE};border-radius:9999px;">
                    <a href="${buttonLink}" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;">${buttonText}</a>
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px 32px;border-top:1px solid #eee;color:#888;font-size:12px;line-height:1.5;">
              Deze e-mail is verstuurd door Deskna.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Aanmeld-/welkomstmail (wanneer een stop wordt toegevoegd)
export const getDesknaWelcomeEmail = ({ stopName, stopAddress, routeName, routeDate, routeLink }) => {
  const name = stopName || 'klant';
  const subject = `Deskna - U bent aangemeld voor ${routeName || 'de route'}`;
  const bodyHtml = `
    <h2 style="margin:0 0 16px 0;color:${DESKNA_DARK};font-size:22px;">Beste ${name},</h2>
    <p style="margin:0 0 14px 0;">U bent aangemeld voor de route <strong>${routeName || 'Route'}</strong> op <strong>${routeDate || 'binnenkort'}</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#faf7f4;border-radius:8px;border-left:4px solid ${DESKNA_ORANGE};margin:8px 0;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0 0 4px 0;font-weight:bold;color:${DESKNA_DARK};">Uw stop</p>
        <p style="margin:0;color:#444;">${stopAddress || 'Adres wordt binnenkort toegevoegd'}</p>
      </td></tr>
    </table>
    <p style="margin:14px 0 0 0;">U ontvangt verdere informatie zodra de route wordt gestart.</p>`;
  const html = buildDesknaEmail({
    previewText: `U bent aangemeld voor ${routeName || 'de route'}`,
    bodyHtml,
    buttonText: routeLink && routeLink !== '#' ? 'Bekijk route' : null,
    buttonLink: routeLink && routeLink !== '#' ? routeLink : null
  });
  return { subject, html };
};

// Route-gestart / live-tracking mail (wanneer de chauffeur de route start)
export const getDesknaRouteStartedEmail = ({ stopName, routeName, routeDate, stopsText, liveRouteLink }) => {
  const name = stopName || 'klant';
  const subject = `Deskna - Uw route ${routeName || ''} is gestart`;
  const bodyHtml = `
    <h2 style="margin:0 0 16px 0;color:${DESKNA_DARK};font-size:22px;">Beste ${name},</h2>
    <p style="margin:0 0 14px 0;">De route <strong>${routeName || 'Route'}</strong>${routeDate ? ` voor <strong>${routeDate}</strong>` : ''} is gestart!</p>
    ${stopsText ? `<p style="margin:0 0 14px 0;">De route bevat ${stopsText} en wordt nu uitgevoerd.</p>` : ''}
    <p style="margin:0;">U kunt de route live volgen via onderstaande knop:</p>`;
  const html = buildDesknaEmail({
    previewText: `Uw route is gestart - volg deze live`,
    bodyHtml,
    buttonText: 'Route live bekijken',
    buttonLink: liveRouteLink
  });
  return { subject, html };
};
