const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const KeyParser = require('../utils/key-parser');

// Function to detect available shell
function detectShell() {
  const shells = ['/bin/zsh', '/bin/bash', '/bin/sh'];
  
  for (const shell of shells) {
    try {
      if (fs.existsSync(shell)) {
        return shell;
      }
    } catch (err) {
      continue;
    }
  }
  
  // Fallback to system default
  try {
    return execSync('echo $SHELL', { encoding: 'utf8' }).trim() || '/bin/bash';
  } catch (err) {
    return '/bin/bash';
  }
}

// Function to load public key if exists
function loadPublicKey() {
  const pubKeyPath = path.join(__dirname, '../../keys/system_user_key.pub');
  try {
    const key = KeyParser.loadPublicKeyFromFile(pubKeyPath);
    return key ? [key] : [];
  } catch (err) {
    console.warn('Could not load public key:', err.message);
  }
  return [];
}

module.exports = {
  // Server configuration
  host: process.env.SSH_HOST || '0.0.0.0',
  port: process.env.SSH_PORT || 2222,
  
  // Host key path
  hostKeyPath: process.env.HOST_KEY_PATH || path.join(__dirname, '../../keys/host_key'),
  
  // Authentication settings
  auth: {
    // Allow password authentication
    password: process.env.ENABLE_PASSWORD_AUTH !== 'false',
    // Allow public key authentication
    publicKey: process.env.ENABLE_PUBLICKEY_AUTH !== 'false',
    // Default users (in production, use a proper user management system)
    users: {
      'system': {
        password: process.env.DEFAULT_USER_PASSWORD || '123456',
        publicKeys: loadPublicKey(),
        shell: process.env.DEFAULT_USER_SHELL || detectShell(),
        home: process.env.DEFAULT_USER_HOME || process.env.HOME || '/tmp'
      }
    }
  },
  
  // Terminal settings
  terminal: {
    shell: process.env.SHELL || detectShell(),
    // Lite mode - disable PTY for compatibility
    liteMode: process.env.LITE_MODE === 'true' || process.env.LITE_MODE === '1',
    env: {
      TERM: process.env.TERM || 'xterm-256color',
      COLORTERM: process.env.COLORTERM || 'truecolor',
      LANG: process.env.CUSTOM_LANG || process.env.LANG || 'en_US.UTF-8',
      LC_ALL: process.env.CUSTOM_LC_ALL || process.env.LC_ALL || 'en_US.UTF-8'
    }
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/ssh-server.log'
  }
};