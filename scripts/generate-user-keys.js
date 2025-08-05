const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');

async function generateUserKeys() {
  const keysDir = path.join(__dirname, '../keys');
  const userKeyPath = path.join(keysDir, 'system_user_key');
  const userKeyPubPath = path.join(keysDir, 'system_user_key.pub');

  // Ensure keys directory exists
  await fs.ensureDir(keysDir);

  console.log('Generating SSH user key pair for system user...');

  // Generate RSA key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Write private key
  await fs.writeFile(userKeyPath, privateKey);
  await fs.chmod(userKeyPath, 0o600);

  // Write public key
  await fs.writeFile(userKeyPubPath, publicKey);
  await fs.chmod(userKeyPubPath, 0o644);

  console.log(`User key pair generated successfully:`);
  console.log(`Private key: ${userKeyPath}`);
  console.log(`Public key: ${userKeyPubPath}`);
  
  return { publicKey, privateKey };
}

// Generate keys if this script is run directly
if (require.main === module) {
  generateUserKeys().catch(console.error);
}

module.exports = { generateUserKeys };