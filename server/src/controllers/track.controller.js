import mongoose from 'mongoose';
import Track from '../models/track.model.js';
import Event from '../models/event.model.js';

/**
 * Create a new track for an event
 * POST /api/events/:eventId/tracks
 */
export async function createTrack(req, res) {
  try {
    const { eventId } = req.params;
    const { name, description } = req.body;

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

    if (req.user.role === 'organizer' && event.createdBy && event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only add tracks to events you host.'
      });
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Track name is required and must be at least 2 characters long.'
      });
    }

    const normalizedName = name.trim();

    // Check duplicate track name within the same event
    const existingTrack = await Track.findOne({ eventId, name: normalizedName });
    if (existingTrack) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A track with this name already exists in the event.'
      });
    }

    const track = await Track.create({
      eventId,
      name: normalizedName,
      description: description ? String(description).trim() : ''
    });

    return res.status(201).json({
      message: 'Track created successfully',
      track: track.toJSON()
    });
  } catch (error) {
    console.error('[Track Controller] Create error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to create track.'
    });
  }
}

/**
 * Get all tracks for an event
 * GET /api/events/:eventId/tracks
 */
export async function getTracksByEvent(req, res) {
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

    const tracks = await Track.find({ eventId }).sort({ name: 1 });

    return res.status(200).json({
      tracks
    });
  } catch (error) {
    console.error('[Track Controller] List error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to retrieve tracks.'
    });
  }
}

/**
 * Update a track
 * PUT /api/events/:eventId/tracks/:trackId
 */
export async function updateTrack(req, res) {
  try {
    const { eventId, trackId } = req.params;
    const { name, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(trackId)) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Invalid event ID or track ID format.'
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Event not found.'
      });
    }

    if (req.user.role === 'organizer' && event.createdBy && event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update tracks for events you host.'
      });
    }

    const track = await Track.findOne({ _id: trackId, eventId });
    if (!track) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Track not found in this event.'
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Track name must be at least 2 characters long.'
        });
      }
      track.name = name.trim();
    }

    if (description !== undefined) {
      track.description = String(description).trim();
    }

    await track.save();

    return res.status(200).json({
      message: 'Track updated successfully',
      track: track.toJSON()
    });
  } catch (error) {
    console.error('[Track Controller] Update error:', error);
    return res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to update track.'
    });
  }
}

export default {
  createTrack,
  getTracksByEvent,
  updateTrack
};
