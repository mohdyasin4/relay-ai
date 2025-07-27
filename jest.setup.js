
import '@testing-library/jest-dom';

// Mock crypto which is not available in JSDOM
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-string-' + Math.random().toString(36).substring(2, 15)
  }
});

// Mock environment variables
process.env.API_KEY = 'mock-api-key';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: key => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock services to prevent actual network calls during tests
jest.mock('./src/services/geminiService');
jest.mock('./src/services/mqttService');
