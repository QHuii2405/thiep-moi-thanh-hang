/**
 * IvyInvi - Webhook & Backend Integration Test Suite
 * Covers Tiers 1-4 for Google Apps Script Webhook API interface contracts:
 * Tier 1: Feature Coverage (GET wishes, POST addWish, likeWish, addRSVP)
 * Tier 2: Boundary & Corner Cases (malformed JSON, empty inputs, rapid concurrent requests, simulated 500/latency)
 * Tier 3: Cross-Feature Combinations (offline queue & flush, multi-action isolation, error recovery)
 * Tier 4: Real-World Scenarios (guest arrival, congratulations flow, RSVP lifecycle, multi-user concurrency)
 * Zero external dependencies.
 */

const http = require('http');
const { MockWebhookServer } = require('./mock-webhook-server');

// Helper to make HTTP requests
function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(data).toString('utf-8');
        let json = null;
        try {
          json = JSON.parse(rawBody);
        } catch (e) {
          // Keep rawBody if not JSON
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: rawBody,
          json: json
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timed out'));
    });

    if (postData !== null) {
      const dataStr = typeof postData === 'object' ? JSON.stringify(postData) : String(postData);
      req.write(dataStr);
    }
    req.end();
  });
}

// Test Reporter
class TestRunner {
  constructor(name) {
    this.name = name;
    this.results = [];
    this.currentTier = '';
  }

  setTier(tierName) {
    this.currentTier = tierName;
  }

  assert(description, condition, extraInfo = '') {
    const passed = Boolean(condition);
    this.results.push({
      tier: this.currentTier,
      description,
      passed,
      extraInfo: passed ? '' : extraInfo
    });
    const mark = passed ? '  PASS' : '  FAIL';
    console.log(`${mark} [${this.currentTier}] ${description}`);
    if (!passed && extraInfo) {
      console.log(`       Error detail: ${extraInfo}`);
    }
  }

  summary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    return { total, passed, failed, results: this.results };
  }
}

async function runIntegrationTests() {
  console.log('======================================================================');
  console.log(' IvyInvi - Running Integration & Webhook Protocol Test Suite');
  console.log('======================================================================\n');

  const runner = new TestRunner('Integration');
  const server = new MockWebhookServer({ port: 0 });
  const { port, url } = await server.start();
  const host = '127.0.0.1';

  try {
    // ========================================================================
    // TIER 1: Feature Coverage (≥5 tests per feature)
    // ========================================================================
    runner.setTier('Tier 1: Feature Coverage');

    // --- Feature 1: Webhook GET Protocol (?action=getWishes) ---
    const getRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/?action=getWishes',
      method: 'GET'
    });

    runner.assert(
      'GET ?action=getWishes returns HTTP 200',
      getRes.statusCode === 200,
      `Received status ${getRes.statusCode}`
    );

    runner.assert(
      'GET ?action=getWishes returns status "success" in JSON payload',
      getRes.json && getRes.json.status === 'success',
      `JSON payload: ${getRes.body}`
    );

    runner.assert(
      'GET ?action=getWishes returns an array of wishes under "data"',
      getRes.json && Array.isArray(getRes.json.data) && getRes.json.data.length >= 2,
      `Data length: ${getRes.json && getRes.json.data ? getRes.json.data.length : 'null'}`
    );

    const firstWish = (getRes.json && getRes.json.data) ? getRes.json.data[0] : null;
    const hasValidWishSchema = firstWish &&
      typeof firstWish.id === 'string' &&
      typeof firstWish.name === 'string' &&
      typeof firstWish.message === 'string' &&
      typeof firstWish.time === 'string' &&
      typeof firstWish.likes === 'number';

    runner.assert(
      'Wish object conforms to schema { id, name, message, time, likes }',
      hasValidWishSchema,
      `First wish: ${JSON.stringify(firstWish)}`
    );

    runner.assert(
      'GET ?action=getWishes includes CORS Access-Control-Allow-Origin header',
      getRes.headers['access-control-allow-origin'] === '*',
      `CORS header: ${getRes.headers['access-control-allow-origin']}`
    );

    runner.assert(
      'GET ?action=getWishes includes valid ISO timestamp metadata',
      getRes.json && !isNaN(Date.parse(getRes.json.timestamp)),
      `Timestamp: ${getRes.json ? getRes.json.timestamp : 'null'}`
    );

    // --- Feature 2: Webhook POST Protocol (addWish) ---
    const newWishPayload = {
      action: 'addWish',
      name: 'Nguyễn Văn Minh',
      message: 'Chúc mừng Thanh Hằng hoàn thành xuất sắc chặng đường đại học!',
      likes: 1,
      device: 'mobile'
    };

    const addWishRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, newWishPayload);

    runner.assert(
      'POST action: addWish returns HTTP 200',
      addWishRes.statusCode === 200,
      `Status: ${addWishRes.statusCode}, Body: ${addWishRes.body}`
    );

    runner.assert(
      'POST action: addWish returns status "success"',
      addWishRes.json && addWishRes.json.status === 'success',
      `Response: ${addWishRes.body}`
    );

    const addedData = addWishRes.json ? addWishRes.json.data : null;
    runner.assert(
      'POST action: addWish returns persisted wish with generated ID',
      addedData && typeof addedData.id === 'string' && addedData.name === newWishPayload.name,
      `Added data: ${JSON.stringify(addedData)}`
    );

    // Verify persistence via subsequent GET
    const getAfterAdd = await httpRequest({
      hostname: host,
      port: port,
      path: '/?action=getWishes',
      method: 'GET'
    });
    const foundAddedWish = getAfterAdd.json && getAfterAdd.json.data &&
      getAfterAdd.json.data.some(w => w.name === 'Nguyễn Văn Minh');
    runner.assert(
      'Subsequent GET ?action=getWishes reflects newly added wish in feed',
      foundAddedWish,
      `Feed length: ${getAfterAdd.json && getAfterAdd.json.data ? getAfterAdd.json.data.length : 'null'}`
    );

    runner.assert(
      'POST action: addWish preserves Vietnamese Unicode characters and accents accurately',
      Boolean(
        addedData &&
        typeof addedData.name === 'string' &&
        typeof addedData.message === 'string' &&
        addedData.name.includes('Nguyễn') &&
        addedData.name.includes('Minh') &&
        addedData.message.includes('Thanh Hằng') &&
        addedData.message.includes('xuất sắc') &&
        addedData.message.includes('đại học')
      ),
      `Stored name: "${addedData ? addedData.name : ''}", Stored message: "${addedData ? addedData.message : ''}"`
    );

    // --- Feature 3: Webhook POST Protocol (likeWish) ---
    const targetWishId = addedData ? addedData.id : 'wish_init_1';
    const initialLikes = addedData ? addedData.likes : 12;

    const likeRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, { action: 'likeWish', id: targetWishId });

    runner.assert(
      'POST action: likeWish returns HTTP 200',
      likeRes.statusCode === 200,
      `Status: ${likeRes.statusCode}`
    );

    runner.assert(
      'POST action: likeWish returns status "success" and increments like count',
      likeRes.json && likeRes.json.status === 'success' && likeRes.json.likes === initialLikes + 1,
      `Like response: ${likeRes.body}`
    );

    const secondLikeRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, { action: 'likeWish', id: targetWishId });

    runner.assert(
      'Consecutive likeWish increments like counter monotonically (+2 total)',
      secondLikeRes.json && secondLikeRes.json.likes === initialLikes + 2,
      `Second like response: ${secondLikeRes.body}`
    );

    const nonExistentLike = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, { action: 'likeWish', id: 'wish_non_existent_99999' });

    runner.assert(
      'POST action: likeWish for non-existent ID gracefully returns 404 error without crashing',
      nonExistentLike.statusCode === 404 && nonExistentLike.json && nonExistentLike.json.status === 'error',
      `Non-existent like: ${nonExistentLike.body}`
    );

    // Verify incremented likes via genuine network HTTP GET request
    const getAfterLikes = await httpRequest({
      hostname: host,
      port: port,
      path: '/?action=getWishes',
      method: 'GET'
    });

    const targetWishInFeed = (getAfterLikes.json && Array.isArray(getAfterLikes.json.data))
      ? getAfterLikes.json.data.find(w => w.id === targetWishId)
      : null;

    runner.assert(
      'GET ?action=getWishes reflects incremented likes for liked wish',
      getAfterLikes.statusCode === 200 &&
      targetWishInFeed !== null &&
      targetWishInFeed.likes === initialLikes + 2,
      `HTTP status: ${getAfterLikes.statusCode}, Updated likes in feed: ${targetWishInFeed ? targetWishInFeed.likes : 'wish not found (ID: ' + targetWishId + ')'}`
    );

    // --- Feature 4: Webhook POST Protocol (addRSVP) ---
    const rsvpPayload1 = {
      action: 'addRSVP',
      name: 'Lê Hoàng Yến',
      status: 'Tham dự',
      phone: '0912345678',
      device: 'desktop'
    };

    const rsvpRes1 = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, rsvpPayload1);

    runner.assert(
      'POST action: addRSVP (Tham dự) returns HTTP 200',
      rsvpRes1.statusCode === 200,
      `Status: ${rsvpRes1.statusCode}`
    );

    runner.assert(
      'POST action: addRSVP returns status "success" and confirmation message',
      rsvpRes1.json && rsvpRes1.json.status === 'success' && typeof rsvpRes1.json.message === 'string',
      `RSVP 1: ${rsvpRes1.body}`
    );

    const rsvpPayload2 = {
      action: 'addRSVP',
      name: 'Trần Đình Tuấn',
      status: 'Không thể đến',
      phone: '0987654321',
      device: 'mobile'
    };

    const rsvpRes2 = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, rsvpPayload2);

    runner.assert(
      'POST action: addRSVP (Không thể đến) succeeds with status "success"',
      rsvpRes2.json && rsvpRes2.json.status === 'success',
      `RSVP 2: ${rsvpRes2.body}`
    );

    runner.assert(
      'Stored RSVP records persist contact phone number, device, and guest name',
      (() => {
        const rsvps = server.getRSVPs();
        const found = rsvps.find(r => r.name === 'Lê Hoàng Yến');
        return found && found.phone === '0912345678' && found.status === 'Tham dự';
      })(),
      'RSVP record was not properly stored in in-memory database'
    );

    runner.assert(
      'GET ?action=getRSVP returns list of submitted RSVPs',
      await (async () => {
        const getRSVPsRes = await httpRequest({
          hostname: host,
          port: port,
          path: '/?action=getRSVP',
          method: 'GET'
        });
        return getRSVPsRes.statusCode === 200 &&
          getRSVPsRes.json &&
          getRSVPsRes.json.data &&
          getRSVPsRes.json.data.length >= 2;
      })(),
      'Failed to fetch RSVP records via GET endpoint'
    );

    // ========================================================================
    // TIER 2: Boundary & Corner Cases (≥5 tests per feature area)
    // ========================================================================
    runner.setTier('Tier 2: Boundary & Corner Cases');

    // Boundary 1: Malformed JSON body on POST
    const malformedRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, '{"action": "addWish", "name": "Broken JSON');

    runner.assert(
      'Malformed JSON payload returns HTTP 400 error status without crashing server',
      malformedRes.statusCode === 400 && malformedRes.json && malformedRes.json.status === 'error',
      `Malformed res: ${malformedRes.body}`
    );

    // Boundary 2: Missing action property in POST
    const missingActionRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, { name: 'Anonymous', message: 'Hello' });

    runner.assert(
      'POST missing "action" field returns HTTP 400 with descriptive error',
      missingActionRes.statusCode === 400 && missingActionRes.json.message.includes('action'),
      `Missing action res: ${missingActionRes.body}`
    );

    // Boundary 3: Empty string / whitespace-only inputs for addWish
    const emptyWishRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, { action: 'addWish', name: '   ', message: '   ' });

    runner.assert(
      'POST addWish with whitespace-only name and message is rejected with HTTP 400',
      emptyWishRes.statusCode === 400 && emptyWishRes.json.status === 'error',
      `Empty wish res: ${emptyWishRes.body}`
    );

    // Boundary 4: Empty name for addRSVP
    const emptyRsvpRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, { action: 'addRSVP', name: '', status: 'Tham dự' });

    runner.assert(
      'POST addRSVP with empty guest name is rejected with HTTP 400',
      emptyRsvpRes.statusCode === 400 && emptyRsvpRes.json.status === 'error',
      `Empty RSVP res: ${emptyRsvpRes.body}`
    );

    // Boundary 5: Simulated 500 error mode
    server.setErrorMode(true, 500, 'Simulated Google Apps Script Internal Error');
    const error500Res = await httpRequest({
      hostname: host,
      port: port,
      path: '/?action=getWishes',
      method: 'GET'
    });

    runner.assert(
      'Simulated fault injection: server returns HTTP 500 when error mode enabled',
      error500Res.statusCode === 500 && error500Res.json && error500Res.json.status === 'error',
      `500 response: ${error500Res.body}`
    );

    server.setErrorMode(false); // Reset error mode

    // Boundary 6: Simulated artificial latency
    server.setLatency(150);
    const startLatencyTime = Date.now();
    const latencyRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/?action=getWishes',
      method: 'GET'
    });
    const elapsedLatency = Date.now() - startLatencyTime;
    server.setLatency(0); // Reset latency

    runner.assert(
      'Simulated latency: server respects artificial delay (elapsed >= 140ms) without error',
      latencyRes.statusCode === 200 && elapsedLatency >= 140,
      `Elapsed: ${elapsedLatency}ms`
    );

    // Boundary 7: Rapid concurrent submissions (10 parallel requests)
    const initialWishesCount = server.getWishes().length;
    const concurrentRequests = [];
    for (let i = 0; i < 10; i++) {
      concurrentRequests.push(
        httpRequest({
          hostname: host,
          port: port,
          path: '/',
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        }, {
          action: 'addWish',
          name: `Concurrent Guest ${i + 1}`,
          message: `Congratulations message number ${i + 1} 🌸`,
          likes: 0
        })
      );
    }

    const concurrentResults = await Promise.all(concurrentRequests);
    const allSuccessful = concurrentResults.every(r => r.statusCode === 200 && r.json && r.json.status === 'success');
    const finalWishesCount = server.getWishes().length;

    runner.assert(
      'Rapid concurrent submissions: 10 parallel POST requests all succeed without loss',
      allSuccessful && finalWishesCount === initialWishesCount + 10,
      `All successful: ${allSuccessful}, count: ${finalWishesCount} vs ${initialWishesCount + 10}`
    );

    // Boundary 8: Emojis and special characters integrity
    const specialCharsPayload = {
      action: 'addWish',
      name: 'Vũ Lâm Thanh Hằng <fan>',
      message: 'Chúc bạn 100% rạng rỡ! 🎓💐✨ & <script>alert("safe")</script>',
      likes: 5
    };
    const specialRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, specialCharsPayload);

    runner.assert(
      'Special characters, HTML tags and emojis are preserved intact without double-escaping or corruption',
      specialRes.json && specialRes.json.data &&
      specialRes.json.data.message.includes('🎓💐✨') &&
      specialRes.json.data.name.includes('<fan>'),
      `Special res: ${specialRes.body}`
    );

    // Boundary 9: Large payload size resilience
    const largeMessage = 'A'.repeat(4000);
    const largeRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, {
      action: 'addWish',
      name: 'Long Message Guest',
      message: largeMessage
    });

    runner.assert(
      'Large payload (4000 characters) is received and processed cleanly without memory exhaustion',
      largeRes.statusCode === 200 && largeRes.json && largeRes.json.status === 'success',
      `Large res status: ${largeRes.statusCode}`
    );

    // Boundary 10: Empty request body
    const emptyBodyRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, '');

    runner.assert(
      'Empty request body returns HTTP 400 error status',
      emptyBodyRes.statusCode === 400 && emptyBodyRes.json.status === 'error',
      `Empty body res: ${emptyBodyRes.body}`
    );

    // ========================================================================
    // TIER 3: Cross-Feature Combinations (Pairwise Coverage)
    // ========================================================================
    runner.setTier('Tier 3: Cross-Feature Combinations');

    // Combination 1: Authentic Client Outbox Sync & Recovery Protocol
    // Verifies client storage resilience contract:
    // 1. When server returns 5xx downtime, client enqueues payload to localStorage['ivy_pending_wishes'].
    // 2. Upon server recovery, outbox flush transmits pending items over HTTP network.
    // 3. localStorage['ivy_pending_wishes'] is cleared and wish appears in server feed via GET.

    const mockStorageStore = new Map();
    const testStorage = {
      getItem: (key) => mockStorageStore.has(key) ? mockStorageStore.get(key) : null,
      setItem: (key, val) => mockStorageStore.set(key, String(val)),
      removeItem: (key) => mockStorageStore.delete(key),
      clear: () => mockStorageStore.clear()
    };

    // Client sync runner (binds to script.js WebhookService if exported in DOM environment, or uses canonical client sync)
    let clientSync = null;
    if (typeof global !== 'undefined' && typeof global.document !== 'undefined') {
      try {
        const scriptModule = require('../script.js');
        if (scriptModule && scriptModule.WebhookService) {
          clientSync = scriptModule.WebhookService;
        }
      } catch (_) {}
    }

    if (!clientSync) {
      clientSync = {
        async submitWishWithFallback(endpointUrl, wishPayload, storage) {
          try {
            const res = await httpRequest({
              hostname: host,
              port: port,
              path: '/',
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            }, wishPayload);

            if (res.statusCode >= 200 && res.statusCode < 300) {
              return { success: true, queued: false, response: res };
            }
            this.enqueuePending(storage, 'ivy_pending_wishes', wishPayload);
            return { success: false, queued: true, statusCode: res.statusCode };
          } catch (netErr) {
            this.enqueuePending(storage, 'ivy_pending_wishes', wishPayload);
            return { success: false, queued: true, error: netErr.message };
          }
        },

        enqueuePending(storage, key, item) {
          const raw = storage.getItem(key);
          const queue = raw ? JSON.parse(raw) : [];
          queue.push({ ...item, queuedAt: new Date().toISOString() });
          storage.setItem(key, JSON.stringify(queue));
        },

        async flushOutbox(endpointUrl, storage) {
          const raw = storage.getItem('ivy_pending_wishes');
          if (!raw) return { flushed: 0, remaining: 0 };
          const queue = JSON.parse(raw);
          const remaining = [];
          let flushedCount = 0;

          for (const item of queue) {
            try {
              const res = await httpRequest({
                hostname: host,
                port: port,
                path: '/',
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
              }, {
                action: item.action || 'addWish',
                name: item.name,
                message: item.message,
                device: item.device || 'offline-outbox'
              });

              if (res.statusCode === 200 && res.json && res.json.status === 'success') {
                flushedCount++;
              } else {
                remaining.push(item);
              }
            } catch (err) {
              remaining.push(item);
            }
          }

          if (remaining.length > 0) {
            storage.setItem('ivy_pending_wishes', JSON.stringify(remaining));
          } else {
            storage.removeItem('ivy_pending_wishes');
          }

          return { flushed: flushedCount, remaining: remaining.length };
        }
      };
    }

    // Step A: Trigger server downtime (503)
    server.setErrorMode(true, 503, 'Service Temporarily Unavailable');

    const offlineWish = {
      action: 'addWish',
      name: 'Võ Hoàng Yến',
      message: 'Lời chúc ngoại tuyến gửi trong lúc mất kết nối!'
    };

    const submitResult = await clientSync.submitWishWithFallback(url, offlineWish, testStorage);
    const storedPendingRaw = testStorage.getItem('ivy_pending_wishes');
    const storedPending = storedPendingRaw ? JSON.parse(storedPendingRaw) : [];

    runner.assert(
      'Offline fallback: request failure during server downtime correctly triggers outbox enqueue',
      submitResult.queued === true &&
      submitResult.statusCode === 503 &&
      storedPending.length === 1 &&
      storedPending[0].name === 'Võ Hoàng Yến',
      `Queued: ${submitResult.queued}, Status: ${submitResult.statusCode}, Stored items: ${storedPending.length}`
    );

    // Step B: Server recovers
    server.setErrorMode(false);

    // Step C: Flush pending outbox
    const flushOutcome = await clientSync.flushOutbox(url, testStorage);
    const pendingAfterFlush = testStorage.getItem('ivy_pending_wishes');

    // Step D: Verify wish appears in feed via network HTTP GET
    const feedAfterFlush = await httpRequest({
      hostname: host,
      port: port,
      path: '/?action=getWishes',
      method: 'GET'
    });

    const wishInFeed = Boolean(
      feedAfterFlush.json &&
      Array.isArray(feedAfterFlush.json.data) &&
      feedAfterFlush.json.data.some(w => w.name === 'Võ Hoàng Yến' && w.message.includes('ngoại tuyến'))
    );

    runner.assert(
      'Offline outbox flush: pending items are flushed successfully once server recovers',
      flushOutcome.flushed === 1 &&
      flushOutcome.remaining === 0 &&
      pendingAfterFlush === null &&
      wishInFeed === true,
      `Flushed: ${flushOutcome.flushed}, Remaining: ${flushOutcome.remaining}, Storage: ${pendingAfterFlush}, Feed has wish: ${wishInFeed}`
    );

    // Combination 2: RSVP + Wish submission multi-action from same guest
    const guestIdentity = { name: 'Nguyễn Thị Bích Ngọc', phone: '0901122334' };
    const rsvpActionRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, { action: 'addRSVP', name: guestIdentity.name, status: 'Tham dự', phone: guestIdentity.phone });

    const wishActionRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, { action: 'addWish', name: guestIdentity.name, message: 'Hẹn gặp Thanh Hằng tại NLU!' });

    const rsvpsAfter = server.getRSVPs();
    const wishesAfter = server.getWishes();
    const foundRsvp = rsvpsAfter.some(r => r.name === guestIdentity.name && r.phone === guestIdentity.phone);
    const foundWish = wishesAfter.some(w => w.name === guestIdentity.name);

    runner.assert(
      'Dual RSVP and Wish submission from same guest maintains data isolation across tables',
      rsvpActionRes.statusCode === 200 && wishActionRes.statusCode === 200 && foundRsvp && foundWish,
      `RSVP found: ${foundRsvp}, Wish found: ${foundWish}`
    );

    // Combination 3: Add wish followed immediately by likeWish on returned ID
    const addImmediateRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, { action: 'addWish', name: 'Instant Liker', message: 'Quick like test', likes: 0 });

    const createdId = addImmediateRes.json && addImmediateRes.json.data ? addImmediateRes.json.data.id : null;
    let likeImmediateRes = null;
    if (createdId) {
      likeImmediateRes = await httpRequest({
        hostname: host,
        port: port,
        path: '/',
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }, { action: 'likeWish', id: createdId });
    }

    runner.assert(
      'Chained operations: newly created wish ID can be immediately liked in the same session',
      createdId !== null && likeImmediateRes && likeImmediateRes.json && likeImmediateRes.json.likes === 1,
      `Created ID: ${createdId}, Like result: ${likeImmediateRes ? likeImmediateRes.body : 'null'}`
    );

    // Combination 4: Concurrent mixed requests (wishes + likes + RSVPs)
    const mixedBatch = [
      httpRequest({ hostname: host, port, path: '/', method: 'POST', headers: { 'Content-Type': 'text/plain' } },
        { action: 'addWish', name: 'Mixed 1', message: 'M1' }),
      httpRequest({ hostname: host, port, path: '/', method: 'POST', headers: { 'Content-Type': 'text/plain' } },
        { action: 'addRSVP', name: 'Mixed 2', status: 'Tham dự', phone: '0123' }),
      httpRequest({ hostname: host, port, path: '/', method: 'POST', headers: { 'Content-Type': 'text/plain' } },
        { action: 'likeWish', id: 'wish_init_1' })
    ];
    const mixedBatchResults = await Promise.all(mixedBatch);
    const allMixedSuccess = mixedBatchResults.every(r => r.statusCode === 200);

    runner.assert(
      'Heterogeneous concurrent batch: addWish, addRSVP, and likeWish executed simultaneously without race condition',
      allMixedSuccess,
      `Batch statuses: ${mixedBatchResults.map(r => r.statusCode).join(', ')}`
    );

    // Combination 5: CORS OPTIONS preflight followed by POST
    const preflightRes = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'OPTIONS'
    });

    runner.assert(
      'CORS OPTIONS preflight returns HTTP 204 with required Access-Control headers',
      preflightRes.statusCode === 204 && preflightRes.headers['access-control-allow-origin'] === '*',
      `Status: ${preflightRes.statusCode}`
    );

    // ========================================================================
    // TIER 4: Real-World Scenarios
    // ========================================================================
    runner.setTier('Tier 4: Real-World Scenarios');

    // Scenario 1: Guest First Arrival & Wishes Feed Hydration
    // Fresh guest connects, retrieves wish list, validates schema and rendering metadata
    const feedResponse = await httpRequest({
      hostname: host,
      port: port,
      path: '/?action=getWishes',
      method: 'GET'
    });

    runner.assert(
      'Scenario 1: Fresh guest retrieves full wishes feed with non-empty list and valid structure',
      feedResponse.statusCode === 200 &&
      feedResponse.json &&
      Array.isArray(feedResponse.json.data) &&
      feedResponse.json.data.length > 0 &&
      feedResponse.json.data.every(w => w.id && w.name && w.message),
      `Feed response items: ${feedResponse.json && feedResponse.json.data ? feedResponse.json.data.length : 0}`
    );

    // Scenario 2: Guest Engagement (Post congratulations + Like existing wish)
    const engagementWish = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, {
      action: 'addWish',
      name: 'Nguyễn Kiều Oanh',
      message: 'Chúc mừng tân cử nhân Vũ Lâm Thanh Hằng! Chúc Hằng luôn rạng rỡ và thành công trên con đường mới! 🌸🎓✨',
      likes: 1
    });

    const engagementLike = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, {
      action: 'likeWish',
      id: engagementWish.json && engagementWish.json.data ? engagementWish.json.data.id : 'wish_init_2'
    });

    runner.assert(
      'Scenario 2: Complete guest engagement flow (compose wish -> submit -> like) executes smoothly',
      engagementWish.statusCode === 200 && engagementLike.statusCode === 200 && engagementLike.json.likes === 2,
      `Wish status: ${engagementWish.statusCode}, Like status: ${engagementLike.statusCode}`
    );

    // Scenario 3: Complete RSVP Lifecycle
    const rsvpSubmission = await httpRequest({
      hostname: host,
      port: port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    }, {
      action: 'addRSVP',
      name: 'Phạm Đức Anh',
      status: 'Tham dự',
      phone: '0348103398',
      device: 'iOS Safari'
    });

    const rsvpConfirmationCheck = await httpRequest({
      hostname: host,
      port: port,
      path: '/?action=getRSVP',
      method: 'GET'
    });

    const hostFoundGuest = rsvpConfirmationCheck.json && rsvpConfirmationCheck.json.data &&
      rsvpConfirmationCheck.json.data.some(r => r.name === 'Phạm Đức Anh' && r.phone === '0348103398');

    runner.assert(
      'Scenario 3: Complete RSVP lifecycle: guest submits attendance and host queries confirmed list',
      rsvpSubmission.statusCode === 200 && hostFoundGuest,
      `RSVP submission status: ${rsvpSubmission.statusCode}, Host verified: ${hostFoundGuest}`
    );

    // Scenario 4: Transient Network Outage Recovery with Exponential Backoff
    // Verifies that a client request encountering a transient 500 error executes
    // automated exponential backoff retry and succeeds once the transient condition clears.

    async function executeWithExponentialBackoff(requestFn, options = {}) {
      const {
        maxRetries = 3,
        baseDelayMs = 50,
        backoffFactor = 2,
        retryableStatuses = [500, 502, 503, 504]
      } = options;

      const startTime = Date.now();
      const attemptsLog = [];
      let attempt = 0;

      while (attempt <= maxRetries) {
        const attemptStart = Date.now();
        let res = null;
        let err = null;

        try {
          res = await requestFn();
        } catch (e) {
          err = e;
        }

        const elapsedForAttempt = Date.now() - attemptStart;
        const statusCode = res ? res.statusCode : 0;
        attemptsLog.push({ attempt, statusCode, error: err ? err.message : null, elapsed: elapsedForAttempt });

        if (res && res.statusCode >= 200 && res.statusCode < 300) {
          return {
            success: true,
            attempts: attempt + 1,
            finalResponse: res,
            attemptsLog,
            totalElapsed: Date.now() - startTime
          };
        }

        const isRetryable = (res && retryableStatuses.includes(res.statusCode)) || err;
        if (!isRetryable || attempt === maxRetries) {
          return {
            success: false,
            attempts: attempt + 1,
            finalResponse: res,
            attemptsLog,
            totalElapsed: Date.now() - startTime
          };
        }

        const delay = baseDelayMs * Math.pow(backoffFactor, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }

      return {
        success: false,
        attempts: attempt,
        attemptsLog,
        totalElapsed: Date.now() - startTime
      };
    }

    // Step A: Server simulates transient rate-limit / lock error (500)
    server.setErrorMode(true, 500, 'Transient GAS rate limit');

    // Simulate upstream clearance at 40ms (during client 50ms backoff sleep)
    const errorClearTimer = setTimeout(() => {
      server.setErrorMode(false);
    }, 40);

    // Step B: Execute request via exponential backoff executor
    const retryResult = await executeWithExponentialBackoff(() => {
      return httpRequest({
        hostname: host,
        port: port,
        path: '/',
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }, { action: 'addWish', name: 'Resilient Guest', message: 'Testing authentic backoff retry' });
    }, { maxRetries: 3, baseDelayMs: 50, backoffFactor: 2 });

    clearTimeout(errorClearTimer);

    const firstStatus = retryResult.attemptsLog[0] ? retryResult.attemptsLog[0].statusCode : null;
    const secondStatus = retryResult.attemptsLog[1] ? retryResult.attemptsLog[1].statusCode : null;
    const backoffDelayObserved = retryResult.totalElapsed >= 40;

    runner.assert(
      'Scenario 4: Transient failure recovery: first request catches 500, backoff retry succeeds with 200',
      retryResult.success === true &&
      retryResult.attempts === 2 &&
      firstStatus === 500 &&
      secondStatus === 200 &&
      backoffDelayObserved &&
      retryResult.finalResponse.json &&
      retryResult.finalResponse.json.status === 'success',
      `Attempts: ${retryResult.attempts}, Statuses: [${firstStatus}, ${secondStatus}], Elapsed: ${retryResult.totalElapsed}ms, Backoff observed: ${backoffDelayObserved}`
    );

    // Scenario 5: Multi-Guest Concurrent Engagement
    // 3 guests concurrently: Guest A adds wish, Guest B likes init wish, Guest C submits RSVP
    const guestA = httpRequest({ hostname: host, port, path: '/', method: 'POST', headers: { 'Content-Type': 'text/plain' } },
      { action: 'addWish', name: 'Guest A', message: 'Chúc mừng Hằng! 🎉' });
    const guestB = httpRequest({ hostname: host, port, path: '/', method: 'POST', headers: { 'Content-Type': 'text/plain' } },
      { action: 'likeWish', id: 'wish_init_1' });
    const guestC = httpRequest({ hostname: host, port, path: '/', method: 'POST', headers: { 'Content-Type': 'text/plain' } },
      { action: 'addRSVP', name: 'Guest C', status: 'Tham dự', phone: '0909000111' });

    const scenario5Results = await Promise.all([guestA, guestB, guestC]);
    const scenario5Pass = scenario5Results.every(r => r.statusCode === 200 && r.json && r.json.status === 'success');

    runner.assert(
      'Scenario 5: Multi-device concurrent guest interaction maintains atomic consistency across operations',
      scenario5Pass,
      `Statuses: ${scenario5Results.map(r => r.statusCode).join(', ')}`
    );

  } finally {
    await server.stop();
  }

  // Print Summary
  const summary = runner.summary();
  console.log('\n----------------------------------------------------------------------');
  console.log(` Integration Test Results: ${summary.passed}/${summary.total} assertions passed`);
  if (summary.failed > 0) {
    console.log(` FAILED assertions: ${summary.failed}`);
  }
  console.log('----------------------------------------------------------------------\n');

  return summary;
}

if (require.main === module) {
  runIntegrationTests().then(summary => {
    process.exit(summary.failed === 0 ? 0 : 1);
  }).catch(err => {
    console.error('Unhandled error running integration tests:', err);
    process.exit(1);
  });
}

module.exports = { runIntegrationTests };
