const EXTENSION_ID = 'cbnaodkpfinfiipjblikofhlhlcickei';

export const environment = {
  production: false, // Indicates non-production mode
  domain: 'https://weavadev.z10.web.core.windows.net', // Domain for UAT server
  apiBaseUrl: 'https://weavadev1.azurewebsites.net', // Base URL for APIs
  stripePublicKey:
    'pk_test_51BP1NMKAKZN8LnMwGWDd8v8hq7yt0GdvqPXl8gK6wWNtlxnI2M6CjGNi2SuJAqcXSNd9VB66k3Gvv9IIaEHPyPP6000MTcfb9Y', // Stripe public key
  googleClientId:
    '775687449194-7vhpb5vcrek032djevqq8c575haud8f4.apps.googleusercontent.com', // Google client ID
  firebaseConfig: {}, // Provide the actual firebase configuration object here
  vapidPublicKey:
    'BPFSrJCLEeJLnnfXYi5kT5QqxyuofENOcN9txuawEAwhq6hOsnLgCvpQsbJ7Rco59O_BZntFi5q7BFPQkELrdVo', // VAPID public key
  chromeURL: `chrome-extension://${EXTENSION_ID}`, // Chrome extension URL
  extensionId: EXTENSION_ID, // Chrome extension ID
  facebookAppId: '535363264530123', // Facebook App ID
  facebookGraphVersion: 'v21.0',
  profitWellKey: '7ac9315395ff6284dbf6a22303c12463', // ProfitWell key
  // proxyUrl: '', // Uncomment and provide the proxy URL if required

  azureStorage: {
    accountName: 'weavadev',
    containerName: 'pdfs',
    sasToken: 'sv=2025-01-05&spr=https&se=2025-04-13T21%3A32%3A06Z&sr=b&sp=cw&sig=WFpwmwfMPuRdXW4QDXoIs%2FWJDuzWr9CVv6uiy9DTigQ%3D', // Ensure this is valid
  },

  socketUrl: 'https://weavadev1.azurewebsites.net',

  apiUrl: 'https://weavadev1.azurewebsites.net',
};
