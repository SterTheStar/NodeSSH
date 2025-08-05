# Node.js SSH Server

A modular and fully-featured SSH server implementation using Node.js and the ssh2 library. This server provides a complete Linux terminal experience with support for all standard terminal features.

## Features

- **Full Terminal Support**: Complete Linux terminal experience with PTY support
- **Lite Mode**: Basic terminal support without PTY dependency for compatibility
- **Multiple Authentication Methods**: Password and public key authentication
- **Modular Architecture**: Well-structured codebase with separate handlers
- **Comprehensive Logging**: Winston-based logging system
- **Window Resize Support**: Dynamic terminal resizing
- **Command Execution**: Support for both interactive shells and command execution
- **User Management**: Configurable user accounts and permissions
- **Environment Variables**: Proper environment setup for authentic terminal experience

## Project Structure

```
├── src/
│   ├── server.js              # Main server file
│   ├── config/
│   │   └─��� config.js          # Configuration settings
│   ├── handlers/
│   │   ├── auth-handler.js    # Authentication logic
│   │   └── session-handler.js # Session and terminal management
│   └── utils/
│       └── logger.js          # Logging utility
├── scripts/
│   └── generate-keys.js       # SSH key generation script
├── keys/                      # SSH host keys (generated)
├── logs/                      # Log files
└── package.json
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Generate SSH host keys:
```bash
npm run generate-keys
```

3. Start the server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Operating Modes

The server supports two operating modes:

### Full Mode (Default)
- Complete terminal experience with PTY support
- Interactive applications (vim, nano, htop, etc.)
- Full color and formatting support
- Requires `node-pty` dependency

### Lite Mode
- Basic terminal support without PTY dependency
- Command execution and basic shell operations
- Limited interactive application support
- Works without native compilation

**Switch between modes:**
```bash
# Enable lite mode (no PTY dependency)
npm run lite-mode

# Enable full mode (requires node-pty)
npm run full-mode

# Restart server to apply changes
npm start
```

**When to use Lite Mode:**
- Docker containers without build tools
- Systems where node-pty compilation fails
- Minimal installations
- Basic command execution needs

## Configuration

The server can be configured in two ways:

### 1. Environment Variables (.env file)

Copy `.env.example` to `.env` and modify the values:

```bash
cp .env.example .env
```

Key environment variables:
- `SSH_HOST`: Server host (default: 0.0.0.0)
- `SSH_PORT`: Server port (default: 2222)
- `DEFAULT_USER_PASSWORD`: System user password (default: 123456)
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `ENABLE_PASSWORD_AUTH`: Enable password authentication (default: true)
- `ENABLE_PUBLICKEY_AUTH`: Enable public key authentication (default: true)

### 2. Direct Configuration

Edit `src/config/config.js` to customize:

- **Server settings**: Host, port
- **Authentication**: Enable/disable password/key auth, manage users
- **Terminal settings**: Default shell, environment variables
- **Logging**: Log levels and file locations

### Default User

The server comes with one default user:
- Username: `system`, Password: `123456` (configurable via `DEFAULT_USER_PASSWORD`)

**⚠️ Change these credentials before production use!**

## Usage

### Connecting to the Server

```bash
# Connect with password authentication
ssh admin@localhost -p 2222

# Connect with specific terminal type
ssh admin@localhost -p 2222 -t "TERM=xterm-256color"
```

### Supported Features

- **Interactive Shell**: Full bash/zsh shell with all features
- **Command Execution**: Run single commands
- **File Operations**: All standard file operations (ls, cat, vim, etc.)
- **Process Management**: Run background processes, job control
- **Terminal Applications**: Support for vim, nano, htop, etc.
- **Colors and Formatting**: Full color and formatting support
- **Tab Completion**: Shell tab completion works normally
- **History**: Command history is maintained

## Environment Variables

- `SSH_HOST`: Server host (default: 0.0.0.0)
- `SSH_PORT`: Server port (default: 2222)
- `HOST_KEY_PATH`: Path to host key file
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `LOG_FILE`: Log file path
- `NODE_ENV`: Environment (development/production)

## Security Considerations

1. **Change Default Credentials**: Always change default usernames and passwords
2. **Host Key Security**: Protect the host key file with proper permissions
3. **User Management**: Implement proper user management for production
4. **Network Security**: Use firewalls and network restrictions
5. **Logging**: Monitor logs for suspicious activity

## Advanced Configuration

### Adding Users

Edit `src/config/config.js`:

```javascript
users: {
  'newuser': {
    password: 'securepassword',
    publicKeys: [], // Add public keys here
    shell: '/bin/bash',
    home: '/home/newuser'
  }
}
```

### Custom Environment

Modify the terminal environment in `src/config/config.js`:

```javascript
terminal: {
  shell: '/bin/zsh', // Change default shell
  env: {
    TERM: 'xterm-256color',
    CUSTOM_VAR: 'value'
  }
}
```

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure host key has correct permissions (600)
2. **Connection Refused**: Check if port is available and not blocked
3. **Authentication Failed**: Verify username/password or key configuration
4. **Terminal Issues**: Check TERM environment variable and client settings

### Logs

Check logs for detailed information:
- Main log: `logs/ssh-server.log`
- Error log: `logs/error.log`

## Development

### Adding New Features

1. **Authentication Methods**: Extend `AuthHandler` class
2. **Session Types**: Add new session types in `SessionHandler`
3. **Commands**: Implement custom command handlers
4. **Protocols**: Add support for additional SSH protocols (SFTP, SCP)

### Testing

Test the server with various SSH clients:
- OpenSSH client
- PuTTY
- Terminal applications

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please check the logs first and ensure your configuration is correct. The server provides detailed logging to help diagnose problems.