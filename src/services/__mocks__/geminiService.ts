
// src/services/__mocks__/geminiService.ts

export const sendMessageToBot = jest.fn().mockImplementation(async (contact, message) => {
  // Simulate a streaming response
  async function* stream() {
    yield { text: 'This ' };
    yield { text: 'is a ' };
    yield { text: 'mocked response.' };
  }
  
  return Promise.resolve(stream());
});
