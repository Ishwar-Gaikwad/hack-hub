import mongoose from 'mongoose';
import Event, { EVENT_STATUSES } from '../models/event.model.js';
import Track from '../models/track.model.js';
import Prize from '../models/prize.model.js';
import AuditLog from '../models/audit.model.js';

export const VALID_STATUS_TRANSITIONS = {
  draft: ['draft', 'published'],
  published: ['published', 'draft', 'active', 'ended'],
  active: ['active', 'judging', 'voting', 'ended'],
  judging: ['judging', 'voting', 'ended', 'active'],
  voting: ['voting', 'ended', 'judging', 'active'],
  ended: ['ended', 'closed', 'active'],
  closed: ['closed']
};

/**
 * Validate date relationships
 */
function validateEventDates(start, deadline, end) {
  const s = new Date(start).getTime();
  const d = new Date(deadline).getTime();
  const e = new Date(end).getTime();

  if (isNaN(s) || isNaN(d) || isNaN(e)) {
    return 'One or more dates are invalid ISO strings.';
  }

  if (s > d) {
    return 'Event start date must be before or equal to the submission deadline.';
  }

  if (d > e) {
    return 'Submission deadline must be before or equal to the event end date.';
  }

  if (s > e) {
    return 'Event start date must be before or equal to the event end date.';
  }

  return null;
}

/**
 * Create a new hackathon event
 * POST /api/events
 */
export async function createEvent(req, res) {
  try {
    const { name, description, startDate, submissionDeadline, endDate, status } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Event name is required and must be at least 2 characters long.'
      });
    }

    if (!startDate || !submissionDeadline || !endDate) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Start date, submission deadline, and end date are all required.'
      });
    }

    const dateValidationError = validateEventDates(startDate, submissionDeadline, endDate);
    if (dateValidationError) {
      return res.status(400).json({
        error: 'BadRequest',
        message: dateValidationError
      });
    }

    let eventStatus = 'published';
    if (status) {
      if (!EVENT_STATUSES.includes(status)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: `Invalid event status. Supported statuses: ${EVENT_STATUSES.join(', ')}.`
        });
      }
      eventStatus = status;
    }

    const event = await Event.create({
      name: name.trim(),
      description: description ? String(description).trim() : '',
      startDate: new Date(startDate),
      submissionDeadline: new Date(submissionDeadline),
      endDate: new Date(endDate),
      status: eventStatus,
      createdBy: req.user._id
    });

    return res.status(201).json({
      message: 'Event created successfully',
      event: event.toJSON()
    });
  } catch (error) {
    console.error('[Event Controller] Create error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to create event.'
    });
  }
}

/**
 * List all events
 * GET /api/events
 */
export async function getEvents(req, res) {
  try {
    const events = await Event.find({}).sort({ startDate: 1, createdAt: -1 });
    return res.status(200).json({
      events
    });
  } catch (error) {
    console.error('[Event Controller] List error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve events.'
    });
  }
}

/**
 * Get single event with tracks and prizes
 * GET /api/events/:id
 */
export async function getEventById(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid event ID format.'
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Event not found.'
      });
    }

    // Load associated tracks and prizes
    const [tracks, prizes] = await Promise.all([
      Track.find({ eventId: event._id }).sort({ name: 1 }),
      Prize.find({ eventId: event._id }).sort({ name: 1 })
    ]);

    return res.status(200).json({
      event: {
        ...event.toJSON(),
        tracks,
        prizes
      }
    });
  } catch (error) {
    console.error('[Event Controller] GetById error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve event.'
    });
  }
}

/**
 * Update an existing event
 * PUT /api/events/:id
 */
export async function updateEvent(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid event ID format.'
      });
    }

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Event not found.'
      });
    }

    const { name, description, startDate, submissionDeadline, endDate, status } = req.body;

    const newStart = startDate || event.startDate;
    const newDeadline = submissionDeadline || event.submissionDeadline;
    const newEnd = endDate || event.endDate;

    const dateValidationError = validateEventDates(newStart, newDeadline, newEnd);
    if (dateValidationError) {
      return res.status(400).json({
        error: 'BadRequest',
        message: dateValidationError
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Event name must be at least 2 characters long.'
        });
      }
      event.name = name.trim();
    }

    if (description !== undefined) {
      event.description = String(description).trim();
    }

    if (startDate) event.startDate = new Date(startDate);
    if (submissionDeadline) event.submissionDeadline = new Date(submissionDeadline);
    if (endDate) event.endDate = new Date(endDate);

    const oldStatus = event.status;
    if (status && status !== oldStatus) {
      if (!EVENT_STATUSES.includes(status)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: `Invalid event status. Supported statuses: ${EVENT_STATUSES.join(', ')}.`
        });
      }
      const allowedNext = VALID_STATUS_TRANSITIONS[oldStatus] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: `Invalid event status transition from '${oldStatus}' to '${status}'.`
        });
      }
      event.status = status;

      await AuditLog.create({
        action: `event.status_${status}`,
        actorId: req.user._id,
        eventId: event._id,
        metadata: { previousStatus: oldStatus, newStatus: status }
      }).catch(() => {});
    }

    await event.save();

    return res.status(200).json({
      message: 'Event updated successfully',
      event: event.toJSON()
    });
  } catch (error) {
    console.error('[Event Controller] Update error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to update event.'
    });
  }
}

export default {
  createEvent,
  getEvents,
  getEventById,
  updateEvent
};
