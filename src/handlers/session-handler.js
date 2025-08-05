const pty = require('node-pty');
const logger = require('../utils/logger');
const config = require('../config/config');
const SystemDetector = require('../utils/system-detector');

class SessionHandler {
  constructor() {
    this.sessions = new Map();
  }

  handle(accept, reject, client) {
    const session = accept();
    const sessionId = this.generateSessionId();
    
    logger.info(`New session created: ${sessionId} for user: ${client.username}`);

    session.on('pty', (accept, reject, info) => {
      this.handlePty(accept, reject, info, session, client, sessionId);
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

  handlePty(accept, reject, info, session, client, sessionId) {
    logger.info(`PTY request: ${JSON.stringify(info)}`);
    
    const ptyInfo = {
      cols: info.cols || 80,
      rows: info.rows || 24,
      term: info.term || 'xterm-256color'
    };

    this.sessions.set(sessionId, {
      ptyInfo,
      session,
      client,
      terminal: null
    });

    accept && accept();
  }

  handleShell(accept, reject, session, client, sessionId) {
    logger.info(`Shell request for user: ${client.username}`);
    
    const stream = accept();
    const sessionData = this.sessions.get(sessionId);
    
    if (!sessionData) {
      logger.error(`Session not found: ${sessionId}`);
      stream.end();
      return;
    }

    const userConfig = client.userConfig || {};
    const shell = userConfig.shell || config.terminal.shell;
    const homeDir = userConfig.home || process.env.HOME || '/tmp';

    // Create PTY with proper environment
    const terminal = pty.spawn(shell, [], {
      name: sessionData.ptyInfo.term,
      cols: sessionData.ptyInfo.cols,
      rows: sessionData.ptyInfo.rows,
      cwd: homeDir,
      env: {
        ...process.env,
        ...config.terminal.env,
        USER: client.username,
        HOME: homeDir,
        SHELL: shell,
        TERM: sessionData.ptyInfo.term
      }
    });

    // Store terminal in session
    sessionData.terminal = terminal;
    this.sessions.set(sessionId, sessionData);

    // Handle terminal data
    terminal.onData((data) => {
      stream.write(data);
    });

    terminal.onExit((code, signal) => {
      logger.info(`Terminal exited with code: ${code}, signal: ${signal}`);
      stream.end();
    });

    // Handle stream data
    stream.on('data', (data) => {
      terminal.write(data);
    });

    // Handle window resize
    stream.on('window-change', (info) => {
      logger.info(`Window resize: ${info.cols}x${info.rows}`);
      terminal.resize(info.cols, info.rows);
      sessionData.ptyInfo.cols = info.cols;
      sessionData.ptyInfo.rows = info.rows;
    });

    stream.on('close', () => {
      logger.info(`Stream closed for session: ${sessionId}`);
      if (terminal && !terminal.killed) {
        terminal.kill();
      }
      this.cleanupSession(sessionId);
    });

    // Send welcome message
    const welcomeMessage = this.getWelcomeMessage(client.username);
    terminal.write(`echo "${welcomeMessage}"\n`);
  }

  handleExec(accept, reject, info, session, client, sessionId) {
    logger.info(`Exec request: ${info.command}`);
    
    const stream = accept();
    const sessionData = this.sessions.get(sessionId) || { ptyInfo: { cols: 80, rows: 24, term: 'xterm' } };
    
    const userConfig = client.userConfig || {};
    const shell = userConfig.shell || config.terminal.shell;
    const homeDir = userConfig.home || process.env.HOME || '/tmp';

    // Execute command in PTY
    const terminal = pty.spawn(shell, ['-c', info.command], {
      name: sessionData.ptyInfo.term,
      cols: sessionData.ptyInfo.cols,
      rows: sessionData.ptyInfo.rows,
      cwd: homeDir,
      env: {
        ...process.env,
        ...config.terminal.env,
        USER: client.username,
        HOME: homeDir,
        SHELL: shell
      }
    });

    terminal.onData((data) => {
      stream.write(data);
    });

    terminal.onExit((code, signal) => {
      logger.info(`Command exited with code: ${code}, signal: ${signal}`);
      stream.exit(code || 0);
    });

    stream.on('close', () => {
      if (terminal && !terminal.killed) {
        terminal.kill();
      }
    });
  }

  handleSftp(accept, reject, session, client) {
    logger.info(`SFTP request for user: ${client.username}`);
    // For now, reject SFTP requests - can be implemented later
    reject();
  }

  generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  cleanupSession(sessionId) {
    const sessionData = this.sessions.get(sessionId);
    if (sessionData && sessionData.terminal && !sessionData.terminal.killed) {
      sessionData.terminal.kill();
    }
    this.sessions.delete(sessionId);
    logger.info(`Session cleaned up: ${sessionId}`);
  }

  getWelcomeMessage(username) {
    const systemInfo = SystemDetector.getSystemInfo();
    return `Welcome to SSH Server on ${systemInfo.systemName}, ${username}! You are now connected to a full Linux terminal.`;
  }
}

module.exports = SessionHandler;