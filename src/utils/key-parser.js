const crypto = require('crypto');
const fs = require('fs');

class KeyParser {
  static parsePublicKey(pemContent) {
    try {
      // Remove PEM headers and whitespace
      const keyData = pemContent
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\s/g, '');
      
      const buffer = Buffer.from(keyData, 'base64');
      
      // Parse the DER-encoded public key
      // This is a simplified parser for RSA keys
      return {
        algo: 'ssh-rsa',
        data: buffer
      };
    } catch (err) {
      console.error('Error parsing public key:', err.message);
      return null;
    }
  }

  static loadPublicKeyFromFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return this.parsePublicKey(content);
      }
    } catch (err) {
      console.error('Error loading public key from file:', err.message);
    }
    return null;
  }

  // Convert PEM to OpenSSH format for easier handling
  static pemToOpenSSH(pemContent) {
    try {
      const keyObject = crypto.createPublicKey(pemContent);
      const sshKey = keyObject.export({
        type: 'spki',
        format: 'der'
      });
      
      // Create SSH-RSA format
      const keyType = 'ssh-rsa';
      const keyData = sshKey.toString('base64');
      
      return {
        algo: keyType,
        data: Buffer.from(keyData, 'base64')
      };
    } catch (err) {
      console.error('Error converting PEM to SSH format:', err.message);
      return null;
    }
  }
}

module.exports = KeyParser;