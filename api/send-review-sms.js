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
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Telefoonnummer is verplicht' });
    }

    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
    const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const REVIEW_SMS_TEXT = 'Krijg €5 teruggestort op uw rekening na het achter laten van een positieve review via de onderstaande link https://g.page/r/CbN0OzH7sWQzEAE/review';

    // Format telefoonnummer naar internationaal formaat
    let formattedPhone = to.replace(/\s/g, '').replace(/-/g, '');
    if (formattedPhone.startsWith('06')) {
      formattedPhone = '+31' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('0')) {
      formattedPhone = '+31' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+31' + formattedPhone;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const body = new URLSearchParams({
      To: formattedPhone,
      MessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      Body: REVIEW_SMS_TEXT
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'SMS versturen mislukt' });
    }

    return res.status(200).json({ success: true, sid: data.sid });
  } catch (error) {
    console.error('Error sending SMS:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

