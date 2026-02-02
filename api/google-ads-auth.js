// Google Ads OAuth2 Authorization Flow
// Endpoint: /api/google-ads-auth
// 
// Step 1: Visit /api/google-ads-auth?action=authorize to start OAuth flow
// Step 2: After Google login, you'll be redirected with the refresh_token
// Step 3: Save the refresh_token in your environment variables

const { google } = require('googleapis');

module.exports = async (req, res) => {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GOOGLE_ADS_REDIRECT_URI || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/google-ads-auth`;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'Missing Google OAuth credentials',
      message: 'Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET environment variables'
    });
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  const action = req.query.action;
  const code = req.query.code;

  // Step 1: Start authorization flow
  if (action === 'authorize') {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force consent to get refresh_token
      scope: ['https://www.googleapis.com/auth/adwords']
    });

    return res.redirect(authUrl);
  }

  // Step 2: Handle OAuth callback with authorization code
  if (code) {
    try {
      const { tokens } = await oauth2Client.getToken(code);
      
      // Return the tokens - user should save refresh_token to env
      return res.status(200).json({
        success: true,
        message: 'Authorization successful! Save the refresh_token below in your environment variables as GOOGLE_ADS_REFRESH_TOKEN',
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date,
        note: 'The refresh_token is only shown once. Make sure to save it!'
      });
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      return res.status(500).json({
        error: 'Failed to exchange authorization code',
        message: error.message
      });
    }
  }

  // Default: show instructions
  return res.status(200).json({
    message: 'Google Ads OAuth2 Authorization',
    instructions: [
      '1. Visit /api/google-ads-auth?action=authorize to start the OAuth flow',
      '2. Login with your Google account that has access to Google Ads',
      '3. After authorization, you will receive a refresh_token',
      '4. Save the refresh_token as GOOGLE_ADS_REFRESH_TOKEN environment variable',
      '5. The /api/google-ads-costs endpoint will then work automatically'
    ],
    authorize_url: `${REDIRECT_URI}?action=authorize`
  });
};




