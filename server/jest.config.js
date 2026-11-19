// jest.config.js
// Tells Jest to work with ES modules (since we use "type": "module" in package.json)
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
};
