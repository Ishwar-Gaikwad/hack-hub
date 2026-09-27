import Event from '../models/event.model.js';
import Project from '../models/project.model.js';

/**
 * Embeddable Standalone Gallery HTML view (for iframes on external websites)
 * GET /embed/gallery/:eventId
 */
export async function getEmbedGalleryHtml(req, res) {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).send('<h3>Event not found</h3>');
    }

    const projects = await Project.find({ eventId, status: 'submitted' })
      .populate('teamId', 'name')
      .populate('trackId', 'name')
      .lean();

    const projectCardsHtml = projects.map(p => `
      <div class="card">
        <div class="card-header">
          <span class="badge">${escapeHtml(p.trackId?.name || 'General')}</span>
        </div>
        <h3 class="card-title">${escapeHtml(p.title)}</h3>
        <p class="card-desc">${escapeHtml(p.description || 'No description provided.')}</p>
        <div class="meta">
          <span><strong>Team:</strong> ${escapeHtml(p.teamId?.name || 'Independent')}</span>
        </div>
        ${p.repositoryUrl ? `
          <div class="actions">
            <a href="${escapeHtml(p.repositoryUrl)}" target="_blank" rel="noopener noreferrer" class="repo-btn">
              View Repository &rarr;
            </a>
          </div>
        ` : ''}
      </div>
    `).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(event.name)} - Project Showcase</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090d16;
      color: #f1f5f9;
      padding: 1rem;
    }
    .header {
      margin-bottom: 1.5rem;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 0.75rem;
    }
    .header h2 { font-size: 1.25rem; color: #818cf8; }
    .header p { font-size: 0.85rem; color: #94a3b8; margin-top: 2px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: #4f46e5;
    }
    .card-header { margin-bottom: 0.5rem; }
    .badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      padding: 2px 8px;
      border-radius: 9999px;
    }
    .card-title {
      font-size: 1rem;
      font-weight: 600;
      color: #f8fafc;
      margin-bottom: 0.4rem;
    }
    .card-desc {
      font-size: 0.8rem;
      color: #94a3b8;
      line-height: 1.4;
      flex: 1;
      margin-bottom: 0.75rem;
    }
    .meta { font-size: 0.75rem; color: #64748b; margin-bottom: 0.75rem; }
    .actions { border-top: 1px solid #1e293b; padding-top: 0.5rem; margin-top: auto; }
    .repo-btn {
      color: #818cf8;
      text-decoration: none;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .repo-btn:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${escapeHtml(event.name)}</h2>
    <p>Submitted Project Showcase (${projects.length} ${projects.length === 1 ? 'project' : 'projects'})</p>
  </div>
  <div class="grid">
    ${projectCardsHtml || '<p style="color: #64748b; font-size: 0.9rem;">No projects submitted yet.</p>'}
  </div>
</body>
</html>`;

    // Security headers for iframe embedding
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(html);
  } catch (error) {
    console.error('[Embed Controller] Error generating embed gallery:', error);
    return res.status(500).send('<h3>Error loading embeddable gallery</h3>');
  }
}

/**
 * Embeddable JSON API with open CORS (for custom external widgets)
 * GET /api/embed/gallery/:eventId
 */
export async function getEmbedGalleryJson(req, res) {
  const { eventId } = req.params;

  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'EventNotFound', message: 'Event not found' });
    }

    const projects = await Project.find({ eventId, status: 'submitted' })
      .populate('teamId', 'name')
      .populate('trackId', 'name')
      .lean();

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      eventId: event._id,
      eventName: event.name,
      count: projects.length,
      projects: projects.map(p => ({
        projectId: p._id,
        title: p.title,
        description: p.description,
        teamName: p.teamId?.name || 'Independent',
        trackName: p.trackId?.name || 'General',
        repositoryUrl: p.repositoryUrl
      }))
    });
  } catch (error) {
    console.error('[Embed Controller] Error returning embed JSON:', error);
    return res.status(500).json({ error: 'InternalServerError', message: 'Failed to load embed data' });
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#32;');
}

export default {
  getEmbedGalleryHtml,
  getEmbedGalleryJson
};
