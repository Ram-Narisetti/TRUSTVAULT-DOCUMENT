import React, { useState } from 'react';
import {
  Download,
  Share2,
  Edit3,
  Trash2,
  Copy,
  Check,
  Eye,
  Info,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { UserAvatar } from '../common/UserAvatar';
import { DocumentPreview } from './DocumentPreview';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatIST } from '../../utils/date';
import api from '../../api/client';

export const DocumentDetailsModal = ({
  isOpen,
  onClose,
  document,
  onEdit,
  onShare,
  onDelete,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'details'
  const [copiedHash, setCopiedHash] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!document) return null;

  const isOwner = document.owner_id === user?.id || document.user_permission === 'OWNER';
  const canEdit = isOwner || document.user_permission === 'EDIT';

  const copyHashToClipboard = () => {
    if (document.file_hash) {
      navigator.clipboard.writeText(document.file_hash);
      setCopiedHash(true);
      toast.info('Hash copied to clipboard');
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await api.get(`/documents/${document.id}/download`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: document.mime_type });
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', document.original_filename || `${document.title}.${document.file_extension}`);
      window.document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('File downloaded.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to download document.');
    } finally {
      setDownloading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={document.title}
      subtitle={document.original_filename}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Navigation Tabs & Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-[#282A33]">
          {/* Tab buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#101114] border border-[#282A33]">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'preview'
                  ? 'bg-[#1C1E23] text-[#FFFFFF] border border-[#282A33]'
                  : 'text-[#8E95A5] hover:text-[#FFFFFF]'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#E8DFD8]" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'details'
                  ? 'bg-[#1C1E23] text-[#FFFFFF] border border-[#282A33]'
                  : 'text-[#8E95A5] hover:text-[#FFFFFF]'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-[#E8DFD8]" />
              <span>Details & Info</span>
            </button>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            <Badge variant="CATEGORY">{document.category}</Badge>
            {isOwner ? (
              <Badge variant="OWNER">Owner</Badge>
            ) : document.user_permission ? (
              <Badge variant={document.user_permission}>
                {document.user_permission === 'EDIT' ? 'Can edit' : 'Can view'}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Tab 1: Content Preview */}
        {activeTab === 'preview' && (
          <div className="space-y-3">
            <DocumentPreview document={document} onDownload={handleDownload} />
          </div>
        )}

        {/* Tab 2: Details & Metadata */}
        {activeTab === 'details' && (
          <div className="space-y-3.5">
            {/* Description */}
            {document.description ? (
              <div className="p-3.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-xs text-[#A0A5B5] leading-relaxed">
                <p className="text-xs text-[#FFFFFF] font-medium mb-1">Description</p>
                <p>{document.description}</p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#101114] border border-[#282A33] text-xs text-[#8E95A5] italic">
                No description provided for this document.
              </div>
            )}

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3.5 rounded-xl bg-[#1C1E23] border border-[#282A33]">
                <span className="text-[#8E95A5] block">File size</span>
                <p className="text-[#FFFFFF] font-medium mt-1">{formatBytes(document.file_size)}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1C1E23] border border-[#282A33]">
                <span className="text-[#8E95A5] block">Uploaded date (IST)</span>
                <p className="text-[#FFFFFF] font-medium mt-1">
                  {formatIST(document.created_at, false)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1C1E23] border border-[#282A33]">
                <span className="text-[#8E95A5] block">Owner</span>
                <div className="flex items-center gap-2 mt-1">
                  <UserAvatar
                    user={{
                      full_name: document.owner_name,
                      email: document.owner_email,
                      avatar_url: document.owner_avatar_url,
                    }}
                    size="xs"
                  />
                  <p className="text-[#FFFFFF] font-medium truncate">
                    {document.owner_name || document.owner_email || 'Owner'}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1C1E23] border border-[#282A33]">
                <div className="flex items-center justify-between">
                  <span className="text-[#8E95A5] block">Access & Sharing</span>
                  {isOwner && onShare && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onShare(document);
                      }}
                      className="text-xs text-[#E8DFD8] hover:underline font-medium"
                    >
                      Manage
                    </button>
                  )}
                </div>
                <p className="text-[#FFFFFF] font-medium mt-1">
                  {document.shared_count > 0 ? `Shared with ${document.shared_count} user(s)` : 'Private to you'}
                </p>
              </div>
            </div>

            {/* SHA-256 Checksum */}
            <div className="p-3.5 rounded-xl bg-[#101114] border border-[#282A33]">
              <div className="flex items-center justify-between text-xs text-[#8E95A5] mb-1.5">
                <span>SHA-256 Checksum</span>
                <button
                  onClick={copyHashToClipboard}
                  className="flex items-center gap-1 text-xs text-[#E8DFD8] hover:underline"
                >
                  {copiedHash ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="font-mono text-[11px] text-[#A0A5B5] break-all bg-[#15161A] p-2 rounded-lg border border-[#282A33] select-all">
                {document.file_hash}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3.5 border-t border-[#282A33]">
          <div className="flex items-center gap-2">
            {isOwner && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(document);
                }}
                className="px-3 py-2 rounded-xl text-xs font-medium text-[#F87171] hover:bg-[#F87171]/15 border border-[#F87171]/30 transition-colors"
              >
                Delete
              </button>
            )}

            {isOwner && onShare && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShare(document);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#E8DFD8] bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] hover:border-[#E8DFD8]/40 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Manage Access</span>
              </button>
            )}

            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(document);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#A0A5B5] hover:text-[#FFFFFF] bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl vault-beige-btn font-semibold text-xs transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Downloading...' : 'Download'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
