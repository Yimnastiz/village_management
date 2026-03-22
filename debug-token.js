const crypto = require('crypto');

// Token from console log
const token = "14iZi1pHG8z23v6z10AiCuDaGd4qhWPI.s6Fnhd2JYCJSgC8SxqF4yAdBO8h2AjgeK0O+TwrzzG4=";

console.log("=== Token Analysis ===");
console.log("Original Token:", token);
console.log("Token length:", token.length);
console.log("Contains dot separator?:", token.includes("."));

// Split by dot
const parts = token.split(".");
console.log("\nParts:", parts.length);
parts.forEach((part, i) => {
  console.log(`Part ${i}:`, part.substring(0, 50) + (part.length > 50 ? "..." : ""));
  
  // Try to decode as base64
  try {
    const decoded = Buffer.from(part, 'base64').toString('utf8');
    console.log(`  Decoded:`, decoded);
  } catch (e) {
    console.log(`  Cannot decode as base64`);
  }
});

// Try JWT decoding
console.log("\n=== Checking if it's a JWT ===");
const jwtParts = token.split(".");
if (jwtParts.length === 3) {
  console.log("✓ Has 3 parts like JWT");
  // Try to decode header
  try {
    const header = JSON.parse(Buffer.from(jwtParts[0], 'base64').toString());
    console.log("Header:", header);
  } catch (e) {
    console.log("Cannot parse as JWT header");
  }
} else if (jwtParts.length === 2) {
  console.log("✓ Has 2 parts (likely signed token)");
  console.log("  Part 1 (data):", jwtParts[0].substring(0, 40) + "...");
  console.log("  Part 2 (signature):", jwtParts[1]);
}
