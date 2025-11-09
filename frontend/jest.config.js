module.exports = {
  testEnvironment: "jsdom",
  coverageDirectory: "coverage",
  collectCoverageFrom: ["*.js", "!jest.config.js", "!coverage/**"],
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
