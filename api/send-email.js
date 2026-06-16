const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY || 're_iDLLL1LU_NKoUQ1R5oReCnu4AJawE8Sy3');
// Aparte Resend-key voor het deskna.nl domein (gebruikt via de Deskna-toggle)
const resendDeskna = new Resend(process.env.RESEND_API_KEY_DESKNA || 're_ZvgSrdLw_F5qDWU2ct8Bu9fjz7T9w6bcL');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { from, to, subject, html, useDeskna } = req.body;

    // Validation
    if (!from || !to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Missing required fields: from, to, subject, html' 
      });
    }

    // Kies de juiste Resend-client: deskna.nl bij actieve toggle, anders standaard
    const emailClient = useDeskna ? resendDeskna : resend;

    // Send email via Resend
    const data = await emailClient.emails.send({
      from,
      to,
      subject,
      html
    });

    res.json({ 
      success: true, 
      data,
      message: 'E-mail succesvol verzonden!' 
    });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Er is een fout opgetreden bij het verzenden van de e-mail' 
    });
  }
};

