const fs = require('fs');
const path = require('path');

const lockFile = path.join(__dirname, '.next', 'dev', 'lock');
try {
  if (fs.existsSync(lockFile)) {
    fs.unlinkSync(lockFile);
    console.log('✓ Lock file removed');
  }
} catch (err) {
  console.log('Lock file already cleared or not found');
}
console.log('Ready to start dev server');
