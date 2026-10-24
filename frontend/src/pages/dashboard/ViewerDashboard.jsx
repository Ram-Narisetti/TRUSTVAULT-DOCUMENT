import React, { useState, useEffect } from 'react';
import { Download, Eye } from 'lucide-react';
import api from '../../api/client';
import { Badge } from '../../components/common/Badge';
import { DocumentDetailsModal } from '../../components/documents/DocumentDetailsModal';
import { useToast } from '../../context/ToastContext';

export const ViewerDashboard = () => {
  const toast = useToast();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    const fetchSharedDocs = async () => {
      try {
        const res = await api.get('/documents/shared');
        setDocuments(res.data.documents || []);
      } catch {
        toast.error('Failed to load shared documents.');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedDocs();
  }, [toast]);

  const handleDownload = async (doc) => {
    try {
      const response = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: doc.mime_type });
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.original_filename || `${doc.title}.${doc.file_extension}`);
      window.document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Document downloaded.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to download document.');
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-2xl bg-[#15161A] border border-[#282A33] skeleton-shimmer" />
        <div className="h-64 rounded-2xl bg-[#15161A] border border-[#282A33] skeleton-shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-2xl bg-[#15161A] border border-[#282A33]">
        <h2 className="text-xl font-semibold text-[#FFFFFF] tracking-tight">Shared with you</h2>
        <p className="text-sm text-[#8E95A5] mt-1 leading-relaxed">
          Documents you have been granted permission to view or edit.
        </p>
      </div>

      {/* Shared Documents Section */}
      <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-4">
        <h3 className="text-sm font-semibold text-[#FFFFFF]">Accessible documents ({documents.length})</h3>

        {documents.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#8E95A5]">
            No documents have been shared with you yet.
          </div>
        ) : (
          <div className="divide-y divide-[#282A33]/60">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-[#1C1E23] px-3 rounded-xl transition-colors cursor-pointer group"
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-[#FFFFFF] truncate group-hover:text-[#E8DFD8] transition-colors">{doc.title}</p>
                  <p className="text-xs text-[#8E95A5] truncate">
                    From: {doc.owner_name || doc.owner_email} &bull; {formatBytes(doc.file_size)}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Badge variant="CATEGORY">{doc.category}</Badge>
                  <Badge variant={doc.user_permission || 'VIEW'}>
                    {doc.user_permission || 'VIEW'}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#282A33] transition-colors"
                      title="Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#E8DFD8] hover:bg-[#282A33] transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedDoc && (
        <DocumentDetailsModal
          isOpen={!!selectedDoc}
          onClose={() => setSelectedDoc(null)}
          document={selectedDoc}
        />
      )}
    </div>
  );
};
