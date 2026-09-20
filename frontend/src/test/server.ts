// Mock Service Worker: answers the fetch calls of the real HTTP client, so the
// integration tests exercise everything except the network itself.
import { setupServer } from "msw/node";

/** Absolute, because fetch in Node has no page to resolve a relative URL against. */
export const TEST_BASE_URL = "http://calculator.test";
export const CALCULATE_URL = `${TEST_BASE_URL}/api/v1/calculate`;

export const server = setupServer();
