// Default to local dev server. Change to your Vercel URL for production.
// When running locally, use your machine's IP address (not localhost)
// because Expo Go runs on your phone, not your machine.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.1:3000';
