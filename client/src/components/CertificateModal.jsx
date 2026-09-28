import React from 'react';
import { Award, CheckCircle2, Download, Printer, ShieldCheck, X } from 'lucide-react';

export default function CertificateModal({ isOpen, onClose, certificate, eventId, recipientId, type = 'participation' }) {
  if (!isOpen || !certificate) return null;

  const eventName = certificate.event?.name || certificate.eventName || 'HackHub Hackathon';
  const recipientName = certificate.recipient?.name || certificate.recipient?.email || certificate.recipientEmail || 'Participant';
  const recipientEmail = certificate.recipient?.email || certificate.recipientEmail || '';
  const projectTitle = certificate.achievement?.projectTitle || certificate.projectTitle || '';
  const teamName = certificate.achievement?.teamName || certificate.teamName || '';
  const awardTitle = certificate.achievement?.title || certificate.title || certificate.award || 'Certificate of Participation';
  const issueDate = certificate.issueDate
    ? new Date(certificate.issueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const hash = certificate.verification?.hash || certificate.verificationHash || '';
  const certId = certificate.certificateId || `CERT-${String(eventId || '').substring(0, 6).toUpperCase()}-${String(recipientId || '').substring(0, 6).toUpperCase()}`;

  const downloadUrl = `/api/events/${eventId}/certificates/${type}/${recipientId}?format=html`;

  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
  };

  const handlePrint = () => {
    const printWindow = window.open(downloadUrl, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };

  return (
    <div className="organizer-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="cert-modal-title">
      <div className="organizer-modal-dialog cert-modal-dialog" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} className="text-accent" />
            <h3 id="cert-modal-title">Verifiable Certificate</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close certificate">
            <X size={18} />
          </button>
        </div>

        <div className="cert-preview-card">
          <div className="cert-card-header">
            <span className="cert-kicker">{eventName}</span>
            <h2 className="cert-award-title">{awardTitle}</h2>
          </div>

          <div className="cert-card-body">
            <p className="cert-presented-to">This certifies that</p>
            <h3 className="cert-recipient-name">{recipientName}</h3>
            {recipientEmail && recipientEmail !== recipientName && (
              <p className="cert-recipient-email">{recipientEmail}</p>
            )}

            {projectTitle && (
              <p className="cert-project-note">
                for successful submission and presentation of <strong>{projectTitle}</strong>
                {teamName ? ` as part of team ${teamName}` : ''}.
              </p>
            )}

            <div className="cert-meta-row">
              <div>
                <span className="cert-meta-label">Date Issued</span>
                <strong>{issueDate}</strong>
              </div>
              <div>
                <span className="cert-meta-label">Certificate ID</span>
                <code>{certId}</code>
              </div>
            </div>

            {hash && (
              <div className="cert-hash-box">
                <div className="cert-hash-title">
                  <ShieldCheck size={14} />
                  <span>Cryptographic Verification Hash (SHA-256)</span>
                </div>
                <code className="cert-hash-value">{hash}</code>
              </div>
            )}

            <p className="cert-disclaimer">
              Cryptographically hashed and verified against HackHub platform evaluation records. Does not constitute an external accredited legal diploma.
            </p>
          </div>
        </div>

        <div className="organizer-inline-actions" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button className="btn-secondary btn-sm" onClick={handlePrint}>
            <Printer size={14} /> Print
          </button>
          <button className="btn-primary btn-sm" onClick={handleDownload}>
            <Download size={14} /> Download Certificate
          </button>
          <button className="btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
