const fs = require('fs');
const { execSync } = require('child_process');

class SystemDetector {
  static detectSystemName() {
    try {
      // Try to get hostname first
      let hostname = this.getHostname();
      
      // If hostname is generic or looks like container ID, try to get OS name
      if (this.isGenericHostname(hostname) || this.isContainerHostname(hostname)) {
        const osName = this.getOSName();
        if (osName) {
          return osName.toLowerCase();
        }
      }
      
      return hostname;
    } catch (error) {
      console.warn('Could not detect system name:', error.message);
      return 'ssh-server';
    }
  }

  static getHostname() {
    try {
      // Try multiple methods to get hostname
      if (fs.existsSync('/etc/hostname')) {
        return fs.readFileSync('/etc/hostname', 'utf8').trim();
      }
      
      try {
        return execSync('hostname', { encoding: 'utf8', timeout: 1000 }).trim();
      } catch (err) {
        return require('os').hostname();
      }
    } catch (error) {
      return 'ssh-server';
    }
  }

  static getOSName() {
    try {
      // Try to detect Linux distribution
      if (fs.existsSync('/etc/os-release')) {
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
        
        // Look for ID= line
        const idMatch = osRelease.match(/^ID=(.+)$/m);
        if (idMatch) {
          return idMatch[1].replace(/"/g, '');
        }
        
        // Look for NAME= line as fallback
        const nameMatch = osRelease.match(/^NAME="?([^"]+)"?$/m);
        if (nameMatch) {
          const name = nameMatch[1].toLowerCase();
          if (name.includes('ubuntu')) return 'ubuntu';
          if (name.includes('debian')) return 'debian';
          if (name.includes('arch')) return 'archlinux';
          if (name.includes('fedora')) return 'fedora';
          if (name.includes('centos')) return 'centos';
          if (name.includes('rhel')) return 'rhel';
          if (name.includes('opensuse')) return 'opensuse';
          if (name.includes('alpine')) return 'alpine';
          return name.split(' ')[0];
        }
      }
      
      // Try other methods
      if (fs.existsSync('/etc/debian_version')) {
        return 'debian';
      }
      
      if (fs.existsSync('/etc/redhat-release')) {
        return 'rhel';
      }
      
      if (fs.existsSync('/etc/arch-release')) {
        return 'archlinux';
      }
      
      if (fs.existsSync('/etc/alpine-release')) {
        return 'alpine';
      }
      
      // Try uname for other systems
      try {
        const uname = execSync('uname -s', { encoding: 'utf8', timeout: 1000 }).trim().toLowerCase();
        if (uname === 'darwin') return 'macos';
        if (uname === 'freebsd') return 'freebsd';
        if (uname === 'openbsd') return 'openbsd';
        if (uname === 'netbsd') return 'netbsd';
        return uname;
      } catch (err) {
        return null;
      }
      
    } catch (error) {
      return null;
    }
  }

  static isGenericHostname(hostname) {
    const genericNames = [
      'localhost',
      'ssh-server',
      'server',
      'node',
      'container',
      'docker',
      'vm',
      'virtual',
      'host'
    ];
    
    return genericNames.some(name => 
      hostname.toLowerCase().includes(name)
    );
  }

  static isContainerHostname(hostname) {
    // Check if hostname looks like a container ID (long hex string with dashes)
    return hostname.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/) ||
           hostname.match(/^[a-f0-9]{12,}$/) || // Docker container ID
           hostname.match(/^[a-f0-9]{8,}-[a-f0-9]{4,}-[a-f0-9]{4,}/) || // UUID-like
           hostname.includes('container') ||
           hostname.includes('docker');
  }

  static getSystemInfo() {
    try {
      const hostname = this.getHostname();
      const osName = this.getOSName();
      const systemName = this.detectSystemName();
      
      return {
        hostname,
        osName,
        systemName,
        isGeneric: this.isGenericHostname(hostname),
        isContainer: this.isContainerHostname(hostname)
      };
    } catch (error) {
      return {
        hostname: 'ssh-server',
        osName: 'unknown',
        systemName: 'ssh-server',
        isGeneric: true,
        isContainer: false
      };
    }
  }
}

module.exports = SystemDetector;