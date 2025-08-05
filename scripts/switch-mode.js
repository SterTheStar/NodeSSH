const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');

function switchMode(mode) {
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    process.exit(1);
  }

  let envContent = fs.readFileSync(envPath, 'utf8');
  
  if (mode === 'lite') {
    envContent = envContent.replace(/LITE_MODE=false/g, 'LITE_MODE=true');
    console.log('🔧 Switched to LITE MODE');
    console.log('💡 This mode works without node-pty dependency');
    console.log('⚠️  Limited terminal features (no interactive applications like vim, htop)');
  } else if (mode === 'full') {
    envContent = envContent.replace(/LITE_MODE=true/g, 'LITE_MODE=false');
    console.log('🔧 Switched to FULL MODE');
    console.log('💡 This mode requires node-pty for full terminal support');
    console.log('✅ Full terminal features available');
  } else {
    console.error('❌ Invalid mode. Use "lite" or "full"');
    process.exit(1);
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Mode switched successfully');
  console.log('🔄 Restart the server to apply changes');
}

// Get mode from command line arguments
const mode = process.argv[2];
if (!mode) {
  console.log('Usage: node scripts/switch-mode.js <lite|full>');
  console.log('');
  console.log('Modes:');
  console.log('  lite - No PTY dependency, basic terminal support');
  console.log('  full - Full PTY support, all terminal features');
  process.exit(1);
}

switchMode(mode);