const { spawn } = require('child_process');
const logger = require('../utils/logger');
const config = require('../config/config');
const SystemDetector = require('../utils/system-detector');

class LiteSessionHandler {
  constructor() {
    this.sessions = new Map();
  }

  handle(accept, reject, client) {
    const session = accept();
    const sessionId = this.generateSessionId();
    
    logger.info(`New lite session created: ${sessionId} for user: ${client.username}`);

    session.on('pty', (accept, reject, info) => {
      logger.info(`PTY request (lite mode): ${JSON.stringify(info)}`);
      
      const ptyInfo = {
        cols: info.cols || 80,
        rows: info.rows || 24,
        term: info.term || 'xterm'
      };

      this.sessions.set(sessionId, {
        ptyInfo,
        session,
        client,
        process: null,
        commandBuffer: '',
        currentDir: client.userConfig?.home || process.env.HOME || '/tmp',
        commandHistory: [],
        historyIndex: -1
      });

      accept && accept();
    });

    session.on('shell', (accept, reject) => {
      this.handleShell(accept, reject, session, client, sessionId);
    });

    session.on('exec', (accept, reject, info) => {
      this.handleExec(accept, reject, info, session, client, sessionId);
    });

    session.on('sftp', (accept, reject) => {
      this.handleSftp(accept, reject, session, client);
    });

    session.on('close', () => {
      this.cleanupSession(sessionId);
    });
  }

  handleShell(accept, reject, session, client, sessionId) {
    logger.info(`Shell request (lite mode) for user: ${client.username}`);
    
    const stream = accept();
    const sessionData = this.sessions.get(sessionId) || { 
      ptyInfo: { cols: 80, rows: 24, term: 'xterm' },
      commandBuffer: '',
      currentDir: client.userConfig?.home || process.env.HOME || '/tmp'
    };
    
    const userConfig = client.userConfig || {};
    const shell = userConfig.shell || config.terminal.shell;
    const homeDir = userConfig.home || process.env.HOME || '/tmp';

    // Send initial welcome and prompt
    stream.write('Welcome to SSH Server (Lite Mode)\r\n');
    stream.write('/bin/bash: warning: setlocale: LC_ALL: cannot change locale (en_US.UTF-8)\r\n');
    stream.write('Welcome to SSH Server (Lite Mode), system! Limited terminal features available.\r\n');
    this.sendPrompt(stream, client.username, sessionData.currentDir);

    // Handle incoming data (commands)
    stream.on('data', (data) => {
      this.handleInput(data, stream, client, sessionData, shell, sessionId);
    });

    stream.on('window-change', (info) => {
      logger.info(`Window resize (lite mode): ${info.cols}x${info.rows}`);
      sessionData.ptyInfo.cols = info.cols;
      sessionData.ptyInfo.rows = info.rows;
    });

    stream.on('close', () => {
      logger.info(`Stream closed for lite session: ${sessionId}`);
      this.cleanupSession(sessionId);
    });

    // Store stream in session for later use
    sessionData.stream = stream;
    this.sessions.set(sessionId, sessionData);
  }

  handleInput(data, stream, client, sessionData, shell, sessionId) {
    const input = data.toString();
    
    // Get client from session data if not provided
    const sessionClient = sessionData.client || client;
    
    // Handle escape sequences (arrow keys, etc.)
    if (input.includes('\x1b[')) {
      this.handleEscapeSequence(input, stream, sessionData, sessionClient);
      this.sessions.set(sessionId, sessionData);
      return;
    }
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const charCode = input.charCodeAt(i);
      
      if (charCode === 13) { // Enter key
        stream.write('\r\n');
        if (sessionData.commandBuffer.trim()) {
          // Add to history
          if (!sessionData.commandHistory) sessionData.commandHistory = [];
          sessionData.commandHistory.push(sessionData.commandBuffer.trim());
          if (sessionData.commandHistory.length > 100) {
            sessionData.commandHistory.shift(); // Keep only last 100 commands
          }
          sessionData.historyIndex = -1;
          
          this.executeCommand(sessionData.commandBuffer.trim(), stream, sessionClient, sessionData, shell);
        } else {
          this.sendPrompt(stream, sessionClient.username, sessionData.currentDir);
        }
        sessionData.commandBuffer = '';
      } else if (charCode === 127 || charCode === 8) { // Backspace
        if (sessionData.commandBuffer.length > 0) {
          sessionData.commandBuffer = sessionData.commandBuffer.slice(0, -1);
          stream.write('\b \b'); // Move back, write space, move back again
        }
      } else if (charCode === 3) { // Ctrl+C
        stream.write('^C\r\n');
        sessionData.commandBuffer = '';
        sessionData.historyIndex = -1;
        this.sendPrompt(stream, sessionClient.username, sessionData.currentDir);
      } else if (charCode === 9) { // Tab key
        this.handleTabCompletion(stream, sessionData, sessionClient);
      } else if (charCode >= 32 && charCode <= 126) { // Printable characters
        sessionData.commandBuffer += char;
        stream.write(char); // Echo the character
      }
      // Ignore other control characters
    }
    
    // Update session data
    this.sessions.set(sessionId, sessionData);
  }

  handleEscapeSequence(input, stream, sessionData, client) {
    if (input.includes('\x1b[A')) { // Up arrow
      this.handleHistoryUp(stream, sessionData, client);
    } else if (input.includes('\x1b[B')) { // Down arrow
      this.handleHistoryDown(stream, sessionData, client);
    } else if (input.includes('\x1b[C')) { // Right arrow
      // Ignore for now
    } else if (input.includes('\x1b[D')) { // Left arrow
      // Ignore for now
    }
  }

  handleHistoryUp(stream, sessionData, client) {
    if (!sessionData.commandHistory || sessionData.commandHistory.length === 0) {
      return;
    }
    
    if (sessionData.historyIndex === -1) {
      sessionData.historyIndex = sessionData.commandHistory.length - 1;
    } else if (sessionData.historyIndex > 0) {
      sessionData.historyIndex--;
    }
    
    const command = sessionData.commandHistory[sessionData.historyIndex];
    this.replaceCurrentLine(stream, sessionData, client, command);
  }

  handleHistoryDown(stream, sessionData, client) {
    if (!sessionData.commandHistory || sessionData.commandHistory.length === 0) {
      return;
    }
    
    if (sessionData.historyIndex === -1) {
      return;
    }
    
    if (sessionData.historyIndex < sessionData.commandHistory.length - 1) {
      sessionData.historyIndex++;
      const command = sessionData.commandHistory[sessionData.historyIndex];
      this.replaceCurrentLine(stream, sessionData, client, command);
    } else {
      sessionData.historyIndex = -1;
      this.replaceCurrentLine(stream, sessionData, client, '');
    }
  }

  replaceCurrentLine(stream, sessionData, client, newCommand) {
    // Clear current line
    const currentLength = sessionData.commandBuffer.length;
    for (let i = 0; i < currentLength; i++) {
      stream.write('\b \b');
    }
    
    // Write new command
    sessionData.commandBuffer = newCommand;
    stream.write(newCommand);
  }

  handleTabCompletion(stream, sessionData, client) {
    const fs = require('fs');
    const path = require('path');
    
    const buffer = sessionData.commandBuffer;
    const parts = buffer.split(' ');
    const lastPart = parts[parts.length - 1];
    
    try {
      let searchDir = sessionData.currentDir;
      let searchPattern = lastPart;
      
      // Handle paths
      if (lastPart.includes('/')) {
        const lastSlash = lastPart.lastIndexOf('/');
        const dirPart = lastPart.substring(0, lastSlash + 1);
        searchPattern = lastPart.substring(lastSlash + 1);
        
        if (dirPart.startsWith('/')) {
          searchDir = dirPart;
        } else if (dirPart.startsWith('~/')) {
          searchDir = path.join(client.userConfig?.home || process.env.HOME || '/tmp', dirPart.substring(2));
        } else {
          searchDir = path.resolve(sessionData.currentDir, dirPart);
        }
      }
      
      if (!fs.existsSync(searchDir)) {
        return;
      }
      
      const files = fs.readdirSync(searchDir)
        .filter(file => file.startsWith(searchPattern))
        .sort();
      
      if (files.length === 0) {
        return;
      } else if (files.length === 1) {
        // Single match - complete it
        const completion = files[0].substring(searchPattern.length);
        const fullPath = path.join(searchDir, files[0]);
        
        // Add trailing slash for directories
        const isDir = fs.statSync(fullPath).isDirectory();
        const finalCompletion = completion + (isDir ? '/' : ' ');
        
        sessionData.commandBuffer += finalCompletion;
        stream.write(finalCompletion);
      } else {
        // Multiple matches - show them
        stream.write('\r\n');
        
        // Show matches in columns
        const cols = Math.floor(sessionData.ptyInfo.cols / 20) || 4;
        for (let i = 0; i < files.length; i += cols) {
          const row = files.slice(i, i + cols);
          stream.write(row.map(f => f.padEnd(18)).join(' ') + '\r\n');
        }
        
        // Find common prefix
        let commonPrefix = files[0];
        for (let i = 1; i < files.length; i++) {
          let j = 0;
          while (j < commonPrefix.length && j < files[i].length && 
                 commonPrefix[j] === files[i][j]) {
            j++;
          }
          commonPrefix = commonPrefix.substring(0, j);
        }
        
        // Complete with common prefix
        if (commonPrefix.length > searchPattern.length) {
          const completion = commonPrefix.substring(searchPattern.length);
          sessionData.commandBuffer += completion;
        }
        
        // Redraw prompt and command
        this.sendPrompt(stream, client.username, sessionData.currentDir);
        stream.write(sessionData.commandBuffer);
      }
    } catch (err) {
      // Ignore tab completion errors
    }
  }

  executeCommand(command, stream, client, sessionData, shell) {
    logger.info(`Executing command (lite mode): ${command}`);
    
    // Handle built-in commands
    if (command === 'exit' || command === 'logout') {
      stream.write('logout\r\n');
      stream.end();
      return;
    }
    
    if (command.startsWith('cd ') || command === 'cd') {
      this.handleCdCommand(command, stream, sessionData, client);
      return;
    }

    // Execute external command
    const childProcess = spawn(shell, ['-c', command], {
      cwd: sessionData.currentDir,
      env: {
        ...process.env,
        USER: client.username,
        HOME: client.userConfig?.home || process.env.HOME || '/tmp',
        SHELL: shell,
        TERM: sessionData.ptyInfo.term,
        LC_ALL: 'C'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    childProcess.stdout.on('data', (data) => {
      // Convert LF to CRLF for proper display
      const output = data.toString().replace(/\n/g, '\r\n');
      stream.write(output);
    });

    childProcess.stderr.on('data', (data) => {
      const output = data.toString().replace(/\n/g, '\r\n');
      stream.write(output);
    });

    childProcess.on('exit', (code, signal) => {
      logger.info(`Command exited with code: ${code}, signal: ${signal}`);
      this.sendPrompt(stream, client.username, sessionData.currentDir);
    });

    childProcess.on('error', (err) => {
      logger.error(`Command error: ${err.message}`);
      stream.write(`bash: ${command}: command not found\r\n`);
      this.sendPrompt(stream, client.username, sessionData.currentDir);
    });
  }

  handleCdCommand(command, stream, sessionData, client) {
    const path = require('path');
    const fs = require('fs');
    
    let targetDir;
    
    // Handle 'cd' without arguments
    if (command === 'cd') {
      targetDir = client.userConfig?.home || process.env.HOME || '/tmp';
    } else {
      targetDir = command.substring(3).trim();
      // If no directory specified after 'cd ', go to home directory
      if (!targetDir) {
        targetDir = client.userConfig?.home || process.env.HOME || '/tmp';
      }
    }
    
    let newDir;
    
    // Handle special cases
    if (targetDir === '~') {
      newDir = client.userConfig?.home || process.env.HOME || '/tmp';
    } else if (targetDir === '-') {
      // Go to previous directory (not implemented yet, just stay in current)
      stream.write(`bash: cd: OLDPWD not set\r\n`);
      this.sendPrompt(stream, client.username, sessionData.currentDir);
      return;
    } else if (targetDir.startsWith('~/')) {
      // Handle ~/path
      const homeDir = client.userConfig?.home || process.env.HOME || '/tmp';
      newDir = path.join(homeDir, targetDir.substring(2));
    } else if (targetDir.startsWith('/')) {
      // Absolute path
      newDir = targetDir;
    } else {
      // Relative path
      newDir = path.resolve(sessionData.currentDir, targetDir);
    }
    
    try {
      if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
        sessionData.currentDir = newDir;
      } else {
        stream.write(`bash: cd: ${targetDir}: No such file or directory\r\n`);
      }
    } catch (err) {
      stream.write(`bash: cd: ${targetDir}: Permission denied\r\n`);
    }
    
    this.sendPrompt(stream, client.username, sessionData.currentDir);
  }

  sendPrompt(stream, username, currentDir) {
    const path = require('path');
    const dirName = path.basename(currentDir);
    const systemName = SystemDetector.detectSystemName();
    const prompt = `[${username}@${systemName} ${dirName}]$ `;
    stream.write(prompt);
  }

  handleExec(accept, reject, info, session, client, sessionId) {
    logger.info(`Exec request (lite mode): ${info.command}`);
    
    const stream = accept();
    const userConfig = client.userConfig || {};
    const shell = userConfig.shell || config.terminal.shell;
    const homeDir = userConfig.home || process.env.HOME || '/tmp';

    const childProcess = spawn(shell, ['-c', info.command], {
      cwd: homeDir,
      env: {
        ...process.env,
        USER: client.username,
        HOME: homeDir,
        SHELL: shell,
        LC_ALL: 'C'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    childProcess.stdout.on('data', (data) => {
      stream.write(data);
    });

    childProcess.stderr.on('data', (data) => {
      stream.stderr.write(data);
    });

    childProcess.on('exit', (code, signal) => {
      logger.info(`Command exited with code: ${code}, signal: ${signal}`);
      stream.exit(code || 0);
    });

    childProcess.on('error', (err) => {
      logger.error(`Command error: ${err.message}`);
      stream.exit(1);
    });

    stream.on('close', () => {
      if (childProcess && !childProcess.killed) {
        childProcess.kill();
      }
    });
  }

  handleSftp(accept, reject, session, client) {
    logger.info(`SFTP request (lite mode) for user: ${client.username}`);
    reject();
  }

  generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  cleanupSession(sessionId) {
    const sessionData = this.sessions.get(sessionId);
    if (sessionData && sessionData.process && !sessionData.process.killed) {
      sessionData.process.kill();
    }
    this.sessions.delete(sessionId);
    logger.info(`Lite session cleaned up: ${sessionId}`);
  }

  getWelcomeMessage(username) {
    return `Welcome to SSH Server (Lite Mode), ${username}! Limited terminal features available.`;
  }
}

module.exports = LiteSessionHandler;