const fs = require('fs');
const path = require('path');

function removeDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
          removeDir(fullPath);
        } else {
          fs.unlinkSync(fullPath);
        }
      });
      fs.rmdirSync(dir);
      console.log(`✓ Removed ${dir}`);
    }
  } catch (err) {
    console.log(`Could not remove ${dir}:`, err.message);
  }
}

removeDir('.next');
console.log('✓ Clean done');
