import crypto from 'crypto';
import Webhook from '../models/webhook.model.js';

/**
 * Compute HMAC-SHA256 signature for webhook payload
 * @param {string|object} payload
 * @param {string} secret
 * @returns {string} sha256=<hex>
 */
export function signPayload(payload, secret) {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(content, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Dispatch an event to all active subscribed webhooks with bounded retries and logging
 * @param {string|mongoose.Types.ObjectId} eventId
 * @param {string} eventName
 * @param {object} payload
 */
export async function dispatchWebhook(eventId, eventName, payload) {
  try {
    const webhooks = await Webhook.find({
      eventId,
      active: true,
      $or: [{ subscribedEvents: eventName }, { subscribedEvents: '*' }]
    });

    if (!webhooks || webhooks.length === 0) {
      return { dispatched: 0, successful: 0 };
    }

    const timestamp = new Date().toISOString();
    const bodyObj = {
      event: eventName,
      timestamp,
      eventId: eventId.toString(),
      data: payload
    };
    const bodyStr = JSON.stringify(bodyObj);

    let successCount = 0;

    for (const hook of webhooks) {
      const signature = signPayload(bodyStr, hook.secret);
      const headers = {
        'Content-Type': 'application/json',
        'X-HackHub-Event': eventName,
        'X-HackHub-Delivery': crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
        'X-HackHub-Timestamp': timestamp,
        'X-HackHub-Signature': signature
      };

      let attempt = 0;
      let delivered = false;
      let lastStatusCode = 0;
      let lastError = null;
      const maxRetries = 2; // bounded retries

      while (attempt <= maxRetries && !delivered) {
        attempt++;
        try {
          // Use global fetch (Node 18+) with 4-second timeout controller
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const response = await fetch(hook.targetUrl, {
            method: 'POST',
            headers,
            body: bodyStr,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          lastStatusCode = response.status;
          if (response.ok) {
            delivered = true;
            successCount++;
          } else {
            lastError = `HTTP ${response.status}: ${response.statusText}`;
            if (response.status >= 400 && response.status < 500) {
              // 4xx client errors should not retry
              break;
            }
          }
        } catch (fetchErr) {
          lastError = fetchErr.message;
        }

        if (!delivered && attempt <= maxRetries) {
          // Bounded backoff: wait 50ms before next attempt
          await new Promise(r => setTimeout(r, 50));
        }
      }

      // Record delivery log to Webhook document
      hook.deliveryLogs.push({
        timestamp: new Date(),
        event: eventName,
        statusCode: lastStatusCode,
        success: delivered,
        error: delivered ? null : (lastError || 'Delivery failed'),
        retryCount: attempt - 1
      });

      // Keep only last 50 delivery logs to avoid unbounded growth
      if (hook.deliveryLogs.length > 50) {
        hook.deliveryLogs = hook.deliveryLogs.slice(-50);
      }

      await hook.save();
    }

    return { dispatched: webhooks.length, successful: successCount };
  } catch (err) {
    console.error('[Webhook Service] Dispatch error:', err);
    return { dispatched: 0, successful: 0, error: err.message };
  }
}

export default {
  signPayload,
  dispatchWebhook
};
