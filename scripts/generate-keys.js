const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

async function generateHostKey() {
  const keysDir = path.join(__dirname, '../keys');
  const hostKeyPath = path.join(keysDir, 'host_key');
  const hostKeyPubPath = path.join(keysDir, 'host_key.pub');

  // Ensure keys directory exists
  await fs.ensureDir(keysDir);

  console.log('Generating SSH host key...');

  try {
    // Try to use ssh-keygen if available (preferred method)
    execSync(`ssh-keygen -t rsa -b 2048 -f "${hostKeyPath}" -N "" -C "ssh-server-host-key"`, {
      stdio: 'pipe'
    });
    
    console.log(`Host key generated successfully using ssh-keygen:`);
    console.log(`Private key: ${hostKeyPath}`);
    console.log(`Public key: ${hostKeyPubPath}`);
    
  } catch (sshKeygenError) {
    console.log('ssh-keygen not available, using Node.js crypto...');
    
    // Fallback to Node.js crypto with OpenSSH format
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',  // Changed to PKCS1 format
        format: 'pem'
      }
    });

    // Convert to OpenSSH format
    const opensshPrivateKey = convertToOpenSSHFormat(privateKey);
    
    // Write private key
    await fs.writeFile(hostKeyPath, opensshPrivateKey);
    await fs.chmod(hostKeyPath, 0o600);

    // Write public key
    await fs.writeFile(hostKeyPubPath, publicKey);
    await fs.chmod(hostKeyPubPath, 0o644);

    console.log(`Host key generated successfully using Node.js crypto:`);
    console.log(`Private key: ${hostKeyPath}`);
    console.log(`Public key: ${hostKeyPubPath}`);
  }
}

function convertToOpenSSHFormat(pemKey) {
  // Simple conversion - for ssh2 library compatibility
  // Remove PEM headers and format as OpenSSH private key
  const keyData = pemKey
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  return `-----BEGIN OPENSSH PRIVATE KEY-----
${keyData}
-----END OPENSSH PRIVATE KEY-----`;
}

// Generate keys if this script is run directly
if (require.main === module) {
  generateHostKey().catch(console.error);
}

module.exports = { generateHostKey };