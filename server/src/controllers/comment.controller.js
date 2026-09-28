import mongoose from 'mongoose';
import Comment from '../models/comment.model.js';
import Project from '../models/project.model.js';
import Event from '../models/event.model.js';
import AuditLog from '../models/audit.model.js';

/**
 * Basic HTML sanitization to prevent script injection / XSS
 */
function sanitizeContent(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Get comments for a project
 * GET /api/events/:eventId/projects/:projectId/comments
 */
export async function getComments(req, res) {
  const { projectId } = req.params;

  try {
    const comments = await Comment.find({ projectId })
      .populate('authorId', 'email role')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = comments.map(c => ({
      _id: c._id,
      projectId: c.projectId,
      eventId: c.eventId,
      author: {
        _id: c.authorId?._id,
        email: c.authorId?.email,
        role: c.authorId?.role
      },
      content: c.content,
      createdAt: c.createdAt
    }));

    return res.status(200).json({
      count: formatted.length,
      comments: formatted
    });
  } catch (error) {
    console.error('[Comment Controller] Error retrieving comments:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve comments' });
  }
}

/**
 * Add a comment to a project
 * POST /api/events/:eventId/projects/:projectId/comments
 */
export async function createComment(req, res) {
  const { eventId, projectId } = req.params;
  const { content } = req.body;
  const authorId = req.user._id;
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';

  try {
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Comment content cannot be empty'
      });
    }

    const trimmed = content.trim();
    if (trimmed.length > 1000) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Comment cannot exceed 1000 characters'
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'ProjectNotFound', message: 'Project not found' });
    }

    if (eventId && project.eventId.toString() !== eventId) {
      return res.status(400).json({ error: 'EventMismatch', message: 'Project does not belong to this event' });
    }

    const sanitized = sanitizeContent(trimmed);

    const comment = await Comment.create({
      eventId: project.eventId,
      projectId: project._id,
      authorId,
      content: sanitized
    });

    await AuditLog.create({
      action: 'comment.created',
      actorId: authorId,
      eventId: project.eventId,
      projectId: project._id,
      metadata: { commentId: comment._id, length: sanitized.length },
      ip: String(clientIp)
    });

    const populated = await Comment.findById(comment._id).populate('authorId', 'email role');

    return res.status(201).json({
      message: 'Comment added successfully',
      comment: {
        _id: populated._id,
        projectId: populated.projectId,
        eventId: populated.eventId,
        author: {
          _id: populated.authorId?._id,
          email: populated.authorId?.email,
          role: populated.authorId?.role
        },
        content: populated.content,
        createdAt: populated.createdAt
      }
    });
  } catch (error) {
    console.error('[Comment Controller] Error creating comment:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to post comment' });
  }
}

/**
 * Delete a comment (author or organizer/admin moderation)
 * DELETE /api/comments/:commentId
 */
export async function deleteComment(req, res) {
  const { commentId } = req.params;
  const user = req.user;
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'CommentNotFound', message: 'Comment not found' });
    }

    const isAuthor = comment.authorId.toString() === user._id.toString();
    const isModerator = ['organizer', 'admin'].includes(user.role);

    if (!isAuthor && !isModerator) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to delete this comment'
      });
    }

    await Comment.findByIdAndDelete(commentId);

    await AuditLog.create({
      action: 'comment.deleted',
      actorId: user._id,
      eventId: comment.eventId,
      projectId: comment.projectId,
      metadata: {
        commentId,
        moderated: isModerator && !isAuthor
      },
      ip: String(clientIp)
    });

    return res.status(200).json({
      message: 'Comment deleted successfully',
      commentId
    });
  } catch (error) {
    console.error('[Comment Controller] Error deleting comment:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to delete comment' });
  }
}

/**
 * Update an existing comment (author only)
 * PUT /api/comments/:commentId
 */
export async function updateComment(req, res) {
  const { commentId, eventId, projectId } = req.params;
  const { content } = req.body;
  const user = req.user;
  const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'CommentNotFound', message: 'Comment not found' });
    }

    if (eventId && comment.eventId.toString() !== eventId) {
      return res.status(400).json({ error: 'EventMismatch', message: 'Comment does not belong to this event' });
    }

    if (projectId && comment.projectId.toString() !== projectId) {
      return res.status(400).json({ error: 'ProjectMismatch', message: 'Comment does not belong to this project' });
    }

    const isAuthor = comment.authorId.toString() === user._id.toString();
    if (!isAuthor && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to edit another user\'s comment'
      });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Comment content cannot be empty'
      });
    }

    const trimmed = content.trim();
    if (trimmed.length > 1000) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Comment cannot exceed 1000 characters'
      });
    }

    comment.content = sanitizeContent(trimmed);
    await comment.save();

    await AuditLog.create({
      action: 'comment.updated',
      actorId: user._id,
      eventId: comment.eventId,
      projectId: comment.projectId,
      metadata: { commentId, length: comment.content.length },
      ip: String(clientIp)
    });

    const populated = await Comment.findById(comment._id).populate('authorId', 'email role');

    return res.status(200).json({
      message: 'Comment updated successfully',
      comment: {
        _id: populated._id,
        projectId: populated.projectId,
        eventId: populated.eventId,
        author: {
          _id: populated.authorId?._id,
          email: populated.authorId?.email,
          role: populated.authorId?.role
        },
        content: populated.content,
        createdAt: populated.createdAt
      }
    });
  } catch (error) {
    console.error('[Comment Controller] Error updating comment:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to update comment' });
  }
}

