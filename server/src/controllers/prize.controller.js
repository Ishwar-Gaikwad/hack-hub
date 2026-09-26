import mongoose from 'mongoose';
import Prize from '../models/prize.model.js';
import Event from '../models/event.model.js';

/**
 * Create a new prize for an event
 * POST /api/events/:eventId/prizes
 */
export async function createPrize(req, res) {
  try {
    const { eventId } = req.params;
    const { name, description, value } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid event ID format.'
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Event not found.'
      });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Prize name is required and must be at least 2 characters long.'
      });
    }

    const prize = await Prize.create({
      eventId,
      name: name.trim(),
      description: description ? String(description).trim() : '',
      value: value ? String(value).trim() : ''
    });

    return res.status(201).json({
      message: 'Prize created successfully',
      prize: prize.toJSON()
    });
  } catch (error) {
    console.error('[Prize Controller] Create error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to create prize.'
    });
  }
}

/**
 * Get all prizes for an event
 * GET /api/events/:eventId/prizes
 */
export async function getPrizesByEvent(req, res) {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid event ID format.'
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Event not found.'
      });
    }

    const prizes = await Prize.find({ eventId }).sort({ name: 1 });

    return res.status(200).json({
      prizes
    });
  } catch (error) {
    console.error('[Prize Controller] List error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve prizes.'
    });
  }
}

/**
 * Update a prize
 * PUT /api/events/:eventId/prizes/:prizeId
 */
export async function updatePrize(req, res) {
  try {
    const { eventId, prizeId } = req.params;
    const { name, description, value } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(prizeId)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid event ID or prize ID format.'
      });
    }

    const prize = await Prize.findOne({ _id: prizeId, eventId });
    if (!prize) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Prize not found in this event.'
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Prize name must be at least 2 characters long.'
        });
      }
      prize.name = name.trim();
    }

    if (description !== undefined) {
      prize.description = String(description).trim();
    }

    if (value !== undefined) {
      prize.value = String(value).trim();
    }

    await prize.save();

    return res.status(200).json({
      message: 'Prize updated successfully',
      prize: prize.toJSON()
    });
  } catch (error) {
    console.error('[Prize Controller] Update error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to update prize.'
    });
  }
}

export default {
  createPrize,
  getPrizesByEvent,
  updatePrize
};
