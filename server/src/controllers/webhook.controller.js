import crypto from 'crypto';
import Webhook, { SUPPORTED_WEBHOOK_EVENTS } from '../models/webhook.model.js';
import Event from '../models/event.model.js';
import { dispatchWebhook } from '../services/webhook.service.js';
import AuditLog from '../models/audit.model.js';

/**
 * Helper to ensure event exists and organizer owns the event (unless admin)
 */
async function verifyEventOrganizer(eventId, user) {
  const event = await Event.findById(eventId);
  if (!event) {
    return { error: { status: 404, error: 'EventNotFound', message: 'Event not found' } };
  }
  if (user.role === 'organizer' && event.createdBy && event.createdBy.toString() !== user._id.toString()) {
    return { error: { status: 403, error: 'Forbidden', message: 'You can only manage webhooks for hackathons you host' } };
  }
  return { event };
}

/**
 * Register a new event webhook (Organizer/Admin only)
 * POST /api/events/:eventId/webhooks
 */
export async function createWebhook(req, res) {
  const { eventId } = req.params;
  const { targetUrl, secret, subscribedEvents = ['*'] } = req.body;

  try {
    const { event, error } = await verifyEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'A valid targetUrl starting with http:// or https:// is required'
      });
    }

    try {
      const parsedUrl = new URL(targetUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'A valid targetUrl starting with http:// or https:// is required'
      });
    }

    // Generate random secret if not provided
    const webhookSecret = secret && typeof secret === 'string' && secret.trim().length >= 8
      ? secret.trim()
      : crypto.randomBytes(24).toString('hex');

    // Validate subscribed events
    const validEvents = Array.isArray(subscribedEvents) ? subscribedEvents : [subscribedEvents];
    const invalidEvent = validEvents.find(e => e !== '*' && !SUPPORTED_WEBHOOK_EVENTS.includes(e));
    if (invalidEvent) {
      return res.status(400).json({
        error: 'ValidationError',
        message: `Invalid webhook event: "${invalidEvent}". Supported: ${SUPPORTED_WEBHOOK_EVENTS.join(', ')} or "*"`
      });
    }

    const webhook = await Webhook.create({
      eventId: event._id,
      targetUrl,
      secret: webhookSecret,
      subscribedEvents: validEvents,
      active: true
    });

    await AuditLog.create({
      action: 'webhook.created',
      actorId: req.user._id,
      eventId: event._id,
      metadata: { webhookId: webhook._id, targetUrl, subscribedEvents: validEvents },
      ip: String(req.ip || '127.0.0.1')
    });

    return res.status(201).json({
      message: 'Webhook registered successfully',
      webhook: {
        _id: webhook._id,
        eventId: webhook.eventId,
        targetUrl: webhook.targetUrl,
        secret: webhook.secret,
        subscribedEvents: webhook.subscribedEvents,
        active: webhook.active,
        createdAt: webhook.createdAt
      }
    });
  } catch (error) {
    console.error('[Webhook Controller] Error creating webhook:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to create webhook' });
  }
}

export async function updateWebhook(req, res) {
  const { eventId, webhookId } = req.params;
  const { active, targetUrl, subscribedEvents } = req.body;

  try {
    const { error } = await verifyEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    const webhook = await Webhook.findOne({ _id: webhookId, eventId });
    if (!webhook) {
      return res.status(404).json({ error: 'WebhookNotFound', message: 'Webhook not found' });
    }

    if (typeof active === 'boolean') webhook.active = active;
    if (targetUrl) {
      try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('Invalid protocol');
        }
        webhook.targetUrl = targetUrl;
      } catch {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'A valid targetUrl starting with http:// or https:// is required'
        });
      }
    }
    if (Array.isArray(subscribedEvents)) webhook.subscribedEvents = subscribedEvents;

    await webhook.save();

    await AuditLog.create({
      action: 'webhook.updated',
      actorId: req.user._id,
      eventId,
      metadata: { webhookId, active: webhook.active, targetUrl: webhook.targetUrl },
      ip: String(req.ip || '127.0.0.1')
    });

    return res.status(200).json({
      message: 'Webhook updated successfully',
      webhook: {
        _id: webhook._id,
        eventId: webhook.eventId,
        targetUrl: webhook.targetUrl,
        secret: `${webhook.secret.substring(0, 4)}••••••••`,
        subscribedEvents: webhook.subscribedEvents,
        active: webhook.active,
        createdAt: webhook.createdAt
      }
    });
  } catch (error) {
    console.error('[Webhook Controller] Error updating webhook:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to update webhook' });
  }
}

/**
 * List webhooks for an event (Organizer/Admin only)
 * GET /api/events/:eventId/webhooks
 */
export async function getWebhooks(req, res) {
  const { eventId } = req.params;

  try {
    const { error } = await verifyEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    const webhooks = await Webhook.find({ eventId }).sort({ createdAt: -1 });

    return res.status(200).json({
      count: webhooks.length,
      webhooks: webhooks.map(h => ({
        _id: h._id,
        eventId: h.eventId,
        targetUrl: h.targetUrl,
        secret: h.secret ? `${h.secret.substring(0, 4)}••••••••` : '••••••••',
        subscribedEvents: h.subscribedEvents,
        active: h.active,
        deliveryCount: h.deliveryLogs.length,
        failures: h.deliveryLogs.filter(d => !d.success).length,
        lastDelivery: h.deliveryLogs[h.deliveryLogs.length - 1] || null,
        recentDeliveries: h.deliveryLogs.slice(-10),
        createdAt: h.createdAt
      }))
    });
  } catch (error) {
    console.error('[Webhook Controller] Error getting webhooks:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve webhooks' });
  }
}

/**
 * Delete a webhook (Organizer/Admin only)
 * DELETE /api/events/:eventId/webhooks/:webhookId
 */
export async function deleteWebhook(req, res) {
  const { eventId, webhookId } = req.params;

  try {
    const { error } = await verifyEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    const deleted = await Webhook.findOneAndDelete({ _id: webhookId, eventId });
    if (!deleted) {
      return res.status(404).json({ error: 'WebhookNotFound', message: 'Webhook not found' });
    }

    await AuditLog.create({
      action: 'webhook.deleted',
      actorId: req.user._id,
      eventId,
      metadata: { webhookId, targetUrl: deleted.targetUrl },
      ip: String(req.ip || '127.0.0.1')
    });

    return res.status(200).json({
      message: 'Webhook deleted successfully',
      webhookId
    });
  } catch (error) {
    console.error('[Webhook Controller] Error deleting webhook:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to delete webhook' });
  }
}

/**
 * Test webhook delivery by dispatching a test ping event
 * POST /api/events/:eventId/webhooks/:webhookId/test
 */
export async function testWebhook(req, res) {
  const { eventId, webhookId } = req.params;

  try {
    const { error } = await verifyEventOrganizer(eventId, req.user);
    if (error) {
      return res.status(error.status).json({ error: error.error, message: error.message });
    }

    const webhook = await Webhook.findOne({ _id: webhookId, eventId });
    if (!webhook) {
      return res.status(404).json({ error: 'WebhookNotFound', message: 'Webhook not found' });
    }

    const testPayload = {
      message: 'HackHub webhook test delivery',
      timestamp: new Date().toISOString(),
      initiatedBy: req.user.email
    };

    const dispatchResult = await dispatchWebhook(eventId, 'test.ping', testPayload);

    // Refresh webhook to get updated delivery logs
    const refreshed = await Webhook.findById(webhookId);
    const lastLog = refreshed.deliveryLogs[refreshed.deliveryLogs.length - 1];

    return res.status(200).json({
      message: 'Test webhook dispatched',
      result: dispatchResult,
      lastDelivery: lastLog
    });
  } catch (error) {
    console.error('[Webhook Controller] Error testing webhook:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to test webhook' });
  }
}

export default {
  createWebhook,
  getWebhooks,
  updateWebhook,
  deleteWebhook,
  testWebhook
};
