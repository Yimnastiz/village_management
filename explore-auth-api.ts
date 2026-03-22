// Note: This file is for debugging only and should not be committed
interface AuthLike {
  [key: string]: any;
}

// @ts-ignore - debug file
const auth: AuthLike = {};

// Check what methods are available on auth object
console.log("=== Better Auth Available Methods ===");
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(auth));
console.log("Methods on auth:", methods.filter((m: string) => m.includes('sign') || m.includes('token') || m.includes('session')));

// Also check for utilities
const allProps = Object.keys(auth);
console.log("\nAll properties on auth:", allProps.length);
console.log("Properties sample:", allProps.slice(0, 20));

// Look for session verification utilities
if (auth.sessionManager) {
  console.log("\nauthSessionManager exists:", Object.keys(auth.sessionManager));
}

// Try to find crypto utilities
try {
  const utils = require("better-auth/lib/crypto");
  console.log("\nbetter-auth/lib/crypto exports:", Object.keys(utils));
} catch (e) {
  console.log("\nno better-auth/lib/crypto");
}

try {
  const core = require("better-auth/core/utils");
  console.log("\nbetter-auth/core/utils exports:", Object.keys(core));
} catch (e) {
  console.log("\nno better-auth/core/utils");
}
