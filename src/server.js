// Load environment variables from .env file
require('dotenv').config();

const { Server } = require('ssh2');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const config = require('./config/config');
const AuthHandler = require('./handlers/auth-handler');

// Conditionally load session handler based on lite mode
let SessionHandler;
if (config.terminal.liteMode) {
  console.log('🔧 Starting in LITE MODE (no PTY dependency)');
  SessionHandler = require('./handlers/lite-session-handler');
} else {
  try {
    SessionHandler = require('./handlers/session-handler');
    console.log('🔧 Starting in FULL MODE (with PTY support)');
  } catch (error) {
    console.warn('⚠️  PTY not available, falling back to LITE MODE');
    console.warn('💡 To use full mode, install node-pty: npm install node-pty');
    SessionHandler = require('./handlers/lite-session-handler');
  }
}

class SSHServer {
  constructor() {
    this.server = new Server({
      hostKeys: [fs.readFileSync(config.hostKeyPath)]
    }, this.handleConnection.bind(this));
    
    this.authHandler = new AuthHandler();
    this.sessionHandler = new SessionHandler();
  }

  handleConnection(client, info) {
    logger.info(`New connection from ${info.ip}:${info.port}`);
    
    client.on('authentication', (ctx) => {
      this.authHandler.handle(ctx, client);
    });

    client.on('ready', () => {
      logger.info(`Client authenticated: ${client.username}`);
      
      client.on('session', (accept, reject) => {
        this.sessionHandler.handle(accept, reject, client);
      });
    });

    client.on('end', () => {
      logger.info(`Client disconnected: ${info.ip}:${info.port}`);
    });

    client.on('error', (err) => {
      logger.error(`Client error: ${err.message}`);
    });
  }

  start() {
    this.server.listen(config.port, config.host, () => {
      logger.info(`SSH Server listening on ${config.host}:${config.port}`);
      console.log(`🚀 SSH Server started successfully!`);
      console.log(`📡 Listening on ${config.host}:${config.port}`);
      console.log(`👤 Default user: system (password: ${config.auth.users.system.password})`);
      console.log(`🔗 Connect with: ssh system@localhost -p ${config.port}`);
    });

    this.server.on('error', (err) => {
      logger.error(`Server error: ${err.message}`);
      console.error(`❌ Server error: ${err.message}`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Shutting down SSH server...');
      console.log('\n🛑 Shutting down SSH server...');
      this.server.close(() => {
        console.log('✅ Server stopped gracefully');
        process.exit(0);
      });
    });
  }
}

// Start the server
const sshServer = new SSHServer();
sshServer.start();