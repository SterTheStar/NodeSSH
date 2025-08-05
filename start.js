#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting Node.js SSH Server...');
console.log('================================');

// Check if we're in the right directory
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ package.json not found. Please run this script from the project root.');
  process.exit(1);
}

// Check if Node.js version is compatible
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 14) {
  console.error(`❌ Node.js ${nodeVersion} is not supported. Please use Node.js 14 or higher.`);
  process.exit(1);
}

console.log(`✅ Node.js ${nodeVersion} detected`);

// Check if node_modules exists
const nodeModulesPath = path.join(__dirname, 'node_modules');
if (!fs.existsSync(nodeModulesPath)) {
  console.error('❌ Dependencies not installed. Please run: npm install');
  process.exit(1);
}

console.log('✅ Dependencies found');

// Check if host keys exist
const hostKeyPath = path.join(__dirname, 'keys', 'host_key');
if (!fs.existsSync(hostKeyPath)) {
  console.log('🔑 Generating SSH host keys...');
  try {
    execSync('npm run generate-keys', { stdio: 'inherit' });
    console.log('✅ SSH host keys generated');
  } catch (error) {
    console.error('❌ Failed to generate host keys:', error.message);
    console.error('💡 Please run: npm run generate-keys');
    process.exit(1);
  }
}

// Check if user keys exist
const userKeyPath = path.join(__dirname, 'keys', 'system_user_key.pub');
if (!fs.existsSync(userKeyPath)) {
  console.log('🔑 Generating user keys...');
  try {
    execSync('npm run generate-user-keys', { stdio: 'inherit' });
    console.log('✅ User keys generated');
  } catch (error) {
    console.warn('⚠️  Failed to generate user keys (optional):', error.message);
  }
}

console.log('');
console.log('🎯 Starting SSH Server...');
console.log('');

// Start the server
try {
  require('./src/server.js');
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  console.error('');
  console.error('💡 Troubleshooting tips:');
  console.error('   1. Make sure all dependencies are installed: npm install');
  console.error('   2. If using node-pty, try: npm rebuild node-pty');
  console.error('   3. Check if the port 2222 is available');
  console.error('   4. Verify file permissions on the keys directory');
  console.error('   5. Check the logs in the logs/ directory');
  process.exit(1);
}