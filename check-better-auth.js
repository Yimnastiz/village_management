// Simple script to check Better Auth package structure
const path = require('path');
const fs = require('fs');

const betterAuthPath = path.join(process.cwd(), 'node_modules/better-auth');

if (fs.existsSync(betterAuthPath)) {
  console.log("✓ better-auth found at:", betterAuthPath);
  
  // List main exports
  const packageJson = JSON.parse(fs.readFileSync(path.join(betterAuthPath, 'package.json'), 'utf8'));
  console.log("\nExports from package.json:");
  if (packageJson.exports) {
    Object.entries(packageJson.exports).forEach(([key, value]) => {
      if (typeof value === 'string') {
        console.log(`  ${key}: ${value}`);
      }
    });
  }
  
  // Check lib directory
  const libPath = path.join(betterAuthPath, 'lib');
  if (fs.existsSync(libPath)) {
    const files = fs.readdirSync(libPath);
    console.log("\nFiles in lib/:", files.slice(0, 15));
  }
  
  // Check if there's a session utilities
  const sessionUtilPath = path.join(betterAuthPath, 'lib', 'session');
  if (fs.existsSync(sessionUtilPath)) {
    console.log("\nSession utilities found:", fs.readdirSync(sessionUtilPath));
  }
  
} else {
  console.log("✗ better-auth not found");
}
