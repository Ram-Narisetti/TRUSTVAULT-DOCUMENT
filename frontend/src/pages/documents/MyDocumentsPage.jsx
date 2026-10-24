import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Filter, UploadCloud, RefreshCw, FolderOpen } from 'lucide-react';
import api from '../../api/client';
import { DocumentTable } from '../../components/documents/DocumentTable';
import { DocumentDetailsModal } from '../../components/documents/DocumentDetailsModal';
import { EditMetadataModal } from '../../components/documents/EditMetadataModal';
import { ShareModal } from '../../components/documents/ShareModal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonTable } from '../../components/common/SkeletonLoader';
import { useToast } from '../../context/ToastContext';

const CATEGORIES = ['All', 'Personal', 'Academic', 'Finance', 'Legal', 'Work', 'Other'];
const FILE_TYPES = ['All', 'pdf', 'docx', 'xlsx', 'txt', 'png', 'jpg'];

export const MyDocumentsPage = () => {
  const toast = useToast();
  const context = useOutletContext();
  const openUploadModal = context?.openUploadModal;

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedFileType, setSelectedFileType] = useState('All');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [detailsDoc, setDetailsDoc] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [shareDoc, setShareDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        per_page: 15,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedFileType !== 'All') params.file_type = selectedFileType;

      const res = await api.get('/documents', { params });
      setDocuments(res.data.documents || []);
      setTotalPages(res.data.pages || 1);
    } catch {
      toast.error('Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, selectedFileType, sortBy, sortOrder, toast]);

  useEffect(() => {
    fetchDocuments();

    const handleDocUploaded = () => {
      fetchDocuments();
    };
    window.addEventListener('vault:document-uploaded', handleDocUploaded);
    return () => window.removeEventListener('vault:document-uploaded', handleDocUploaded);
  }, [fetchDocuments]);

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

  const confirmDelete = async () => {
    if (!deleteDoc) return;
    setDeleting(true);
    try {
      await api.delete(`/documents/${deleteDoc.id}`);
      toast.success(`"${deleteDoc.title}" deleted from storage.`);
      setDeleteDoc(null);
      fetchDocuments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete document.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, filename, or description..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/50 text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
            />
            <Search className="w-4 h-4 text-[#8E95A5] absolute left-3.5 top-3.5" />
          </div>

          {/* Quick Refresh & Upload */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchDocuments}
              className="p-2.5 rounded-xl bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] text-[#8E95A5] hover:text-[#FFFFFF] transition-all"
              title="Refresh document list"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {openUploadModal && (
              <button
                onClick={openUploadModal}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl vault-beige-btn text-xs font-semibold flex-shrink-0"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters and Sorting Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#282A33]/70 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#8E95A5] font-medium">Category:</span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-xl transition-all ${
                    selectedCategory === cat
                      ? 'bg-[#E8DFD8] text-[#0A0B0D] font-semibold shadow-sm'
                      : 'bg-[#1C1E23] text-[#8E95A5] hover:text-[#FFFFFF] border border-[#282A33] hover:border-[#E8DFD8]/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[#8E95A5] font-medium">Sort:</span>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [col, ord] = e.target.value.split('-');
                  setSortBy(col);
                  setSortOrder(ord);
                }}
                className="bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
              >
                <option value="created_at-desc">Newest First</option>
                <option value="created_at-asc">Oldest First</option>
                <option value="title-asc">Title (A-Z)</option>
                <option value="file_size-desc">Largest Size</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Documents List */}
      {loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents found"
          description={
            search || selectedCategory !== 'All'
              ? 'No documents match the current filters. Try resetting search.'
              : 'Your vault is currently empty. Upload your first document to begin.'
          }
          action={
            openUploadModal && (
              <button
                onClick={openUploadModal}
                className="vault-beige-btn px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Upload Document Now
              </button>
            )
          }
        />
      ) : (
        <DocumentTable
          documents={documents}
          onViewDetails={(doc) => setDetailsDoc(doc)}
          onDownload={handleDownload}
          onEdit={(doc) => setEditDoc(doc)}
          onShare={(doc) => setShareDoc(doc)}
          onDelete={(doc) => setDeleteDoc(doc)}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[#8E95A5] font-mono">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3.5 py-1.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-xs text-[#FFFFFF] hover:bg-[#282A33] disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3.5 py-1.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-xs text-[#FFFFFF] hover:bg-[#282A33] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsDoc && (
        <DocumentDetailsModal
          isOpen={!!detailsDoc}
          onClose={() => setDetailsDoc(null)}
          document={detailsDoc}
          onEdit={(doc) => setEditDoc(doc)}
          onShare={(doc) => setShareDoc(doc)}
          onDelete={(doc) => setDeleteDoc(doc)}
        />
      )}

      {/* Edit Metadata Modal */}
      {editDoc && (
        <EditMetadataModal
          isOpen={!!editDoc}
          onClose={() => setEditDoc(null)}
          document={editDoc}
          onUpdateSuccess={() => fetchDocuments()}
        />
      )}

      {/* Share Modal */}
      {shareDoc && (
        <ShareModal
          isOpen={!!shareDoc}
          onClose={() => setShareDoc(null)}
          document={shareDoc}
          onPermissionsChanged={() => fetchDocuments()}
        />
      )}

      {/* Delete Confirmation */}
      {deleteDoc && (
        <ConfirmDialog
          isOpen={!!deleteDoc}
          onClose={() => setDeleteDoc(null)}
          onConfirm={confirmDelete}
          title="Delete Document from Vault"
          message={`Are you sure you want to delete "${deleteDoc.title}"? The encrypted file will be permanently removed from disk storage and all access grants revoked.`}
          confirmText="Delete Document"
          isDestructive={true}
          loading={deleting}
        />
      )}
    </div>
  );
};
