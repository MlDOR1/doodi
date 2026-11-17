import nextJest from "next/jest.js";

process.env.NODE_ENV = "test";

export default nextJest({ dir: "./" })(() => {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl || !/\/[^/]*test[^/]*$/i.test(testUrl.split("?")[0])) {
    throw new Error("TEST_DATABASE_URL must point at a dedicated database whose name contains 'test'");
  }
  process.env.DATABASE_URL = testUrl;

  return {
    testEnvironment: "node",
    testMatch: ["<rootDir>/tests/api.jest.ts"],
    extensionsToTreatAsEsm: [".ts"],
    moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
    globalSetup: "<rootDir>/tests/global-setup.ts",
    testTimeout: 60000,
    verbose: true,
  };
});
