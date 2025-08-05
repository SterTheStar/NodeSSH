const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config/config');

class AuthHandler {
  constructor() {
    this.users = config.auth.users;
  }

  handle(ctx, client) {
    const { method, username } = ctx;
    
    logger.info(`Authentication attempt: ${username} using ${method}`);

    switch (method) {
      case 'password':
        this.handlePasswordAuth(ctx, client);
        break;
      case 'publickey':
        this.handlePublicKeyAuth(ctx, client);
        break;
      default:
        logger.warn(`Unsupported authentication method: ${method}`);
        ctx.reject();
    }
  }

  handlePasswordAuth(ctx, client) {
    const { username, password } = ctx;
    
    if (!config.auth.password) {
      logger.warn('Password authentication is disabled');
      ctx.reject();
      return;
    }

    const user = this.users[username];
    if (!user) {
      logger.warn(`Authentication failed: user ${username} not found`);
      ctx.reject();
      return;
    }

    if (user.password === password) {
      logger.info(`Password authentication successful for user: ${username}`);
      client.username = username;
      client.userConfig = user;
      ctx.accept();
    } else {
      logger.warn(`Password authentication failed for user: ${username}`);
      ctx.reject();
    }
  }

  handlePublicKeyAuth(ctx, client) {
    const { username, key, signature } = ctx;
    
    if (!config.auth.publicKey) {
      logger.warn('Public key authentication is disabled');
      ctx.reject();
      return;
    }

    const user = this.users[username];
    if (!user) {
      logger.warn(`Authentication failed: user ${username} not found`);
      ctx.reject();
      return;
    }

    // Check if this is just a key check (no signature)
    if (!signature) {
      // Check if the key is in the user's authorized keys
      const keyMatch = user.publicKeys.some(authorizedKey => {
        return this.compareKeys(key, authorizedKey);
      });
      
      if (keyMatch) {
        ctx.accept();
      } else {
        ctx.reject();
      }
      return;
    }

    // Verify the signature
    const keyMatch = user.publicKeys.find(authorizedKey => {
      return this.compareKeys(key, authorizedKey);
    });

    if (keyMatch && this.verifySignature(key, signature, ctx.blob)) {
      logger.info(`Public key authentication successful for user: ${username}`);
      client.username = username;
      client.userConfig = user;
      ctx.accept();
    } else {
      logger.warn(`Public key authentication failed for user: ${username}`);
      ctx.reject();
    }
  }

  compareKeys(key1, key2) {
    // Simple key comparison - in production, use proper key parsing
    return key1.data.equals(key2.data) && key1.algo === key2.algo;
  }

  verifySignature(key, signature, blob) {
    try {
      const verify = crypto.createVerify('RSA-SHA1');
      verify.update(blob);
      return verify.verify(key.data, signature);
    } catch (err) {
      logger.error(`Signature verification error: ${err.message}`);
      return false;
    }
  }
}

module.exports = AuthHandler;