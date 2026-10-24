import React, { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import api from '../../api/client';
import { DocumentTable } from '../../components/documents/DocumentTable';
import { DocumentDetailsModal } from '../../components/documents/DocumentDetailsModal';
import { EditMetadataModal } from '../../components/documents/EditMetadataModal';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonTable } from '../../components/common/SkeletonLoader';
import { useToast } from '../../context/ToastContext';

export const SharedDocumentsPage = () => {
  const toast = useToast();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editDoc, setEditDoc] = useState(null);

  const fetchSharedDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/documents/shared', { params });
      setDocuments(res.data.documents || []);
    } catch {
      toast.error('Failed to load shared documents.');
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    fetchSharedDocs();
  }, [fetchSharedDocs]);

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

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#FFFFFF]">
              Shared with me
            </h2>
            <p className="text-xs text-[#8E95A5] mt-0.5">
              Documents other users have shared with you.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shared files..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/50 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-[#8E95A5] absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : documents.length === 0 ? (
        <EmptyState
          title="No shared documents"
          description={
            search
              ? 'No shared documents match your search query.'
              : 'No documents have been shared with your account yet.'
          }
        />
      ) : (
        <DocumentTable
          documents={documents}
          showOwner={true}
          onViewDetails={(doc) => setSelectedDoc(doc)}
          onDownload={handleDownload}
          onEdit={(doc) => setEditDoc(doc)}
        />
      )}

      {/* Modals */}
      {selectedDoc && (
        <DocumentDetailsModal
          isOpen={!!selectedDoc}
          onClose={() => setSelectedDoc(null)}
          document={selectedDoc}
          onEdit={(doc) => setEditDoc(doc)}
        />
      )}

      {editDoc && (
        <EditMetadataModal
          isOpen={!!editDoc}
          onClose={() => setEditDoc(null)}
          document={editDoc}
          onUpdateSuccess={() => fetchSharedDocs()}
        />
      )}
    </div>
  );
};
