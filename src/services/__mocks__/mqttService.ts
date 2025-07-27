
// src/services/__mocks__/mqttService.ts

const mockMqttService = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  publish: jest.fn(),
  subscribe: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  isConnected: jest.fn(() => true), // Assume connected in tests
};

export const mqttService = mockMqttService;
