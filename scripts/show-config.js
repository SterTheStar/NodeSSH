const config = require('../src/config/config');

console.log('SSH Server Configuration:');
console.log('========================');
console.log(`Host: ${config.host}`);
console.log(`Port: ${config.port}`);
console.log(`Detected Shell: ${config.terminal.shell}`);
console.log('');
console.log('Users:');
Object.keys(config.auth.users).forEach(username => {
  const user = config.auth.users[username];
  console.log(`  - Username: ${username}`);
  console.log(`    Password: ${user.password}`);
  console.log(`    Shell: ${user.shell}`);
  console.log(`    Home: ${user.home}`);
  console.log(`    Public Keys: ${user.publicKeys.length} key(s) loaded`);
  console.log('');
});

console.log('Authentication Methods:');
console.log(`  - Password: ${config.auth.password ? 'Enabled' : 'Disabled'}`);
console.log(`  - Public Key: ${config.auth.publicKey ? 'Enabled' : 'Disabled'}`);
console.log('');
console.log('Connection Command:');
console.log(`ssh system@localhost -p ${config.port}`);