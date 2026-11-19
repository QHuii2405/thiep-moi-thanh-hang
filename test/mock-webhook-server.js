/**
 * IvyInvi - Mock Google Apps Script Webhook Server (Hardened & Concurrency-Protected)
 * Emulates Google Apps Script Web App endpoint with doGet and doPost handlers,
 * in-memory storage for wishes and RSVPs, CORS headers, simulated fault injection,
 * and LockService concurrency control & contention emulation.
 * Zero-dependency native Node.js implementation.
 */

const http = require('http');

class MockWebhookServer {
  constructor(options = {}) {
    this.port = options.port || 0;
    this.server = null;
    this.sockets = new Set();
    this.errorMode = {
      enabled: false,
      statusCode: 500,
      message: 'Simulated internal server error'
    };
    this.latencyMs = 0;
    this.malformedMode = false;
    this.requestLog = [];

    // LockService concurrency emulation
    this.lockConfig = {
      enabled: false,
      timeoutMs: 10000,
      holdMs: 0,
      simulateTimeout: false,
      statusCode: 200,
      timeoutMessage: 'Server busy, please retry'
    };
    this.isLocked = false;
    this.lockQueue = [];

    // In-memory database initialization
    this.defaultWishes = [
      {
        id: 'wish_init_1',
        name: 'Trường Đại học Nông Lâm',
        message: 'Chúc mừng tân cử nhân Vũ Lâm Thanh Hằng gặt hái nhiều thành công rực rỡ!',
        time: '2026-11-19 09:00:00',
        likes: 12
      },
      {
        id: 'wish_init_2',
        name: 'Hội Bạn Thân NLU',
        message: 'Chúc Thanh Hằng luôn xinh đẹp, tự tin và vững bước trên chặng đường mới! 🌸🎓',
        time: '2026-11-19 09:30:00',
        likes: 8
      }
    ];

    this.wishes = JSON.parse(JSON.stringify(this.defaultWishes));
    this.rsvps = [];
  }

  reset() {
    this.wishes = JSON.parse(JSON.stringify(this.defaultWishes));
    this.rsvps = [];
    this.errorMode = { enabled: false, statusCode: 500, message: 'Simulated internal server error' };
    this.latencyMs = 0;
    this.malformedMode = false;
    this.requestLog = [];

    // Reset LockService configuration and clear pending queue
    this.lockConfig = {
      enabled: false,
      timeoutMs: 10000,
      holdMs: 0,
      simulateTimeout: false,
      statusCode: 200,
      timeoutMessage: 'Server busy, please retry'
    };
    this._clearLockQueue();
    this.isLocked = false;
  }

  _clearLockQueue() {
    while (this.lockQueue.length > 0) {
      const item = this.lockQueue.shift();
      if (item.timer) clearTimeout(item.timer);
    }
  }

  seedWishes(wishesArray) {
    this.wishes = JSON.parse(JSON.stringify(wishesArray));
  }

  getWishes() {
    return this.wishes;
  }

  getRSVPs() {
    return this.rsvps;
  }

  getRequestLog() {
    return this.requestLog;
  }

  setErrorMode(enabled, statusCode = 500, message = 'Simulated internal server error') {
    this.errorMode = { enabled, statusCode, message };
  }

  setLatency(ms) {
    this.latencyMs = ms;
  }

  setMalformedMode(enabled) {
    this.malformedMode = enabled;
  }

  /**
   * Configure LockService emulation parameters
   * @param {Object} options
   * @param {boolean} [options.enabled] - Enable/disable locking
   * @param {number} [options.timeoutMs] - Maximum lock wait timeout in ms (default: 10000)
   * @param {number} [options.holdMs] - Artificial delay while lock is held (simulating Sheet I/O)
   * @param {boolean} [options.simulateTimeout] - Force waitLock to fail with timeout error
   * @param {number} [options.statusCode] - HTTP status code on lock timeout (default: 200)
   * @param {string} [options.timeoutMessage] - Error message on lock timeout
   */
  setLockMode(options = {}) {
    if (typeof options.enabled === 'boolean') this.lockConfig.enabled = options.enabled;
    if (typeof options.timeoutMs === 'number') this.lockConfig.timeoutMs = options.timeoutMs;
    if (typeof options.holdMs === 'number') this.lockConfig.holdMs = options.holdMs;
    if (typeof options.simulateTimeout === 'boolean') this.lockConfig.simulateTimeout = options.simulateTimeout;
    if (typeof options.statusCode === 'number') this.lockConfig.statusCode = options.statusCode;
    if (typeof options.timeoutMessage === 'string') this.lockConfig.timeoutMessage = options.timeoutMessage;
  }

  /**
   * Convenience method to simulate LockService timeout failure
   * @param {boolean} enabled - Enable/disable simulated lock timeout
   * @param {string} [message] - Custom timeout message
   * @param {number} [statusCode] - HTTP status code (default: 200)
   */
  setLockTimeoutMode(enabled, message = 'Server busy, please retry', statusCode = 200) {
    this.lockConfig.enabled = enabled;
    this.lockConfig.simulateTimeout = enabled;
    this.lockConfig.timeoutMessage = message;
    this.lockConfig.statusCode = statusCode;
  }

  _sanitizeString(val) {
    if (typeof val === 'string') {
      return val.trim();
    }
    if (typeof val === 'number' || typeof val === 'boolean') {
      return String(val).trim();
    }
    return '';
  }

  async _acquireLock() {
    if (!this.lockConfig.enabled) {
      return true;
    }

    if (this.lockConfig.simulateTimeout) {
      const err = new Error(this.lockConfig.timeoutMessage || 'Server busy, please retry');
      err.name = 'LockTimeoutException';
      throw err;
    }

    if (!this.isLocked) {
      this.isLocked = true;
      return true;
    }

    // Lock contention: queue the request with timeout
    return new Promise((resolve, reject) => {
      let timer = null;
      const queueItem = {
        resolve: () => {
          if (timer) clearTimeout(timer);
          resolve(true);
        },
        reject: (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        }
      };

      timer = setTimeout(() => {
        const index = this.lockQueue.indexOf(queueItem);
        if (index !== -1) {
          this.lockQueue.splice(index, 1);
        }
        const err = new Error(this.lockConfig.timeoutMessage || 'Server busy, please retry');
        err.name = 'LockTimeoutException';
        reject(err);
      }, this.lockConfig.timeoutMs);

      queueItem.timer = timer;
      this.lockQueue.push(queueItem);
    });
  }

  _releaseLock() {
    if (!this.lockConfig.enabled) {
      return;
    }

    if (this.lockQueue.length > 0) {
      const next = this.lockQueue.shift();
      next.resolve();
    } else {
      this.isLocked = false;
    }
  }

  _sendResponse(res, statusCode, body, contentType = 'text/plain;charset=utf-8') {
    const execute = () => {
      if (res.writableEnded) return;

      res.writeHead(statusCode, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      });

      if (this.malformedMode) {
        res.end('{ malformed_json_response: [ broken ...');
        return;
      }

      if (typeof body === 'object') {
        res.end(JSON.stringify(body));
      } else {
        res.end(String(body));
      }
    };

    if (this.latencyMs > 0) {
      setTimeout(execute, this.latencyMs);
    } else {
      execute();
    }
  }

  _handleGet(req, res, parsedUrl) {
    const action = parsedUrl.searchParams ? parsedUrl.searchParams.get('action') : null;

    if (action === 'getWishes' || !action) {
      return this._sendResponse(res, 200, {
        status: 'success',
        count: this.wishes.length,
        timestamp: new Date().toISOString(),
        data: this.wishes
      });
    }

    if (action === 'getRSVP' || action === 'getRSVPs') {
      return this._sendResponse(res, 200, {
        status: 'success',
        count: this.rsvps.length,
        timestamp: new Date().toISOString(),
        data: this.rsvps
      });
    }

    if (action === 'health') {
      return this._sendResponse(res, 200, {
        status: 'ok',
        uptime: process.uptime(),
        wishesCount: this.wishes.length,
        rsvpsCount: this.rsvps.length
      });
    }

    return this._sendResponse(res, 400, {
        status: 'error',
        message: `Unknown GET action: "${action}"`
    });
  }

  async _handlePost(req, res, rawBody) {
    let payload;
    try {
      if (!rawBody || rawBody.trim() === '') {
        return this._sendResponse(res, 400, {
          status: 'error',
          message: 'Empty request body'
        });
      }
      payload = JSON.parse(rawBody);
    } catch (err) {
      return this._sendResponse(res, 400, {
        status: 'error',
        message: 'Malformed JSON payload: ' + err.message
      });
    }

    // Guard against non-object payloads (e.g. JSON literal "null", primitives, arrays)
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return this._sendResponse(res, 400, {
        status: 'error',
        message: 'Request payload must be a valid JSON object'
      });
    }

    const action = payload.action;

    if (!action) {
      return this._sendResponse(res, 400, {
        status: 'error',
        message: 'Missing required "action" parameter in payload'
      });
    }

    // Acquire Google Apps Script LockService concurrency lock
    let lockAcquired = false;
    try {
      await this._acquireLock();
      lockAcquired = true;
    } catch (lockErr) {
      const statusCode = this.lockConfig.statusCode || 200;
      return this._sendResponse(res, statusCode, {
        status: 'error',
        message: lockErr.message || 'Server busy, please retry'
      });
    }

    try {
      // Simulate sheet write I/O delay if configured
      if (this.lockConfig.holdMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.lockConfig.holdMs));
      }

      // 1. ADD WISH
      if (action === 'addWish') {
        const name = this._sanitizeString(payload.name);
        const message = this._sanitizeString(payload.message);

        if (!name || !message) {
          return this._sendResponse(res, 400, {
            status: 'error',
            message: 'Both "name" and "message" are required and cannot be empty'
          });
        }

        const id = payload.id ? String(payload.id).trim() : 'wish_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const likes = typeof payload.likes === 'number' ? payload.likes : 1;
        const time = payload.time ? String(payload.time).trim() : new Date().toISOString().replace('T', ' ').substring(0, 19);
        const device = typeof payload.device === 'string' ? payload.device.trim() : 'web';

        const newWish = {
          id: id,
          name: name,
          message: message,
          time: time,
          likes: likes,
          device: device
        };

        // Atomic unshift to top of feed
        this.wishes.unshift(newWish);

        return this._sendResponse(res, 200, {
          status: 'success',
          message: 'Wish recorded successfully',
          data: {
            id: newWish.id,
            name: newWish.name,
            message: newWish.message,
            time: newWish.time,
            likes: newWish.likes
          }
        });
      }

      // 2. LIKE WISH
      if (action === 'likeWish') {
        const wishId = this._sanitizeString(payload.id);
        if (!wishId) {
          return this._sendResponse(res, 400, {
            status: 'error',
            message: 'Missing "id" parameter for likeWish action'
          });
        }

        const target = this.wishes.find(w => String(w.id) === String(wishId));
        if (!target) {
          return this._sendResponse(res, 404, {
            status: 'error',
            message: `Wish with ID "${wishId}" not found`
          });
        }

        target.likes = (target.likes || 0) + 1;

        return this._sendResponse(res, 200, {
          status: 'success',
          id: target.id,
          likes: target.likes
        });
      }

      // 3. ADD RSVP
      if (action === 'addRSVP') {
        const name = this._sanitizeString(payload.name);
        const status = this._sanitizeString(payload.status);

        if (!name) {
          return this._sendResponse(res, 400, {
            status: 'error',
            message: '"name" is required for RSVP submission'
          });
        }

        const rsvpRecord = {
          id: 'rsvp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: name,
          status: status || 'Tham dự',
          phone: this._sanitizeString(payload.phone),
          device: typeof payload.device === 'string' ? payload.device.trim() : 'web',
          timestamp: new Date().toISOString()
        };

        this.rsvps.push(rsvpRecord);

        return this._sendResponse(res, 200, {
          status: 'success',
          message: 'RSVP recorded successfully',
          data: rsvpRecord
        });
      }

      return this._sendResponse(res, 400, {
        status: 'error',
        message: `Unsupported POST action: "${action}"`
      });
    } finally {
      if (lockAcquired) {
        this._releaseLock();
      }
    }
  }

  start(port = this.port) {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        try {
          const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

          this.requestLog.push({
            method: req.method,
            url: req.url,
            timestamp: Date.now()
          });

          // Handle CORS OPTIONS preflight
          if (req.method === 'OPTIONS') {
            return this._sendResponse(res, 204, '');
          }

          // Fault injection check
          if (this.errorMode.enabled) {
            return this._sendResponse(
              res,
              this.errorMode.statusCode,
              { status: 'error', message: this.errorMode.message }
            );
          }

          if (req.method === 'GET') {
            return this._handleGet(req, res, parsedUrl);
          }

          if (req.method === 'POST') {
            let bodyChunks = [];
            req.on('data', chunk => bodyChunks.push(chunk));
            req.on('end', async () => {
              try {
                const rawBody = Buffer.concat(bodyChunks).toString('utf-8');
                await this._handlePost(req, res, rawBody);
              } catch (err) {
                this._sendResponse(res, 500, {
                  status: 'error',
                  message: 'Internal server error: ' + err.message
                });
              }
            });
            req.on('error', err => {
              this._sendResponse(res, 500, { status: 'error', message: err.message });
            });
            return;
          }

          return this._sendResponse(res, 405, { status: 'error', message: `Method ${req.method} Not Allowed` });
        } catch (err) {
          this._sendResponse(res, 500, {
            status: 'error',
            message: 'Internal server error: ' + err.message
          });
        }
      });

      // Track active sockets for immediate graceful shutdown
      this.sockets = new Set();
      this.server.on('connection', socket => {
        this.sockets.add(socket);
        socket.on('close', () => {
          this.sockets.delete(socket);
        });
      });

      this.server.on('error', reject);

      this.server.listen(port, () => {
        const address = this.server.address();
        this.port = address.port;
        this.url = `http://127.0.0.1:${this.port}`;
        resolve({
          port: this.port,
          url: this.url,
          server: this.server
        });
      });
    });
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        return resolve();
      }

      // Close all connections immediately
      if (typeof this.server.closeAllConnections === 'function') {
        this.server.closeAllConnections();
      }

      // Destroy tracked sockets if any remain
      if (this.sockets) {
        for (const socket of this.sockets) {
          socket.destroy();
        }
        this.sockets.clear();
      }

      // Clear any pending lock timers
      this._clearLockQueue();
      this.isLocked = false;

      this.server.close(err => {
        if (err) return reject(err);
        this.server = null;
        resolve();
      });
    });
  }
}

function createMockWebhookServer(options) {
  return new MockWebhookServer(options);
}

// Support CLI execution
if (require.main === module) {
  const cliPort = parseInt(process.argv[2], 10) || 3000;
  const server = new MockWebhookServer({ port: cliPort });
  server.start().then(({ port, url }) => {
    console.log(`[MockWebhookServer] Listening on ${url} (port ${port})`);
    console.log(`[MockWebhookServer] GET  ${url}?action=getWishes`);
    console.log(`[MockWebhookServer] POST ${url} with { action: "addWish" | "likeWish" | "addRSVP" }`);
  }).catch(err => {
    console.error('[MockWebhookServer] Failed to start:', err);
    process.exit(1);
  });
}

module.exports = {
  MockWebhookServer,
  createMockWebhookServer
};
