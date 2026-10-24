import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  UploadCloud,
  ArrowRight,
  Eye,
  Download,
} from 'lucide-react';
import api from '../../api/client';
import { Badge } from '../../components/common/Badge';
import { SkeletonGrid } from '../../components/common/SkeletonLoader';
import { DocumentDetailsModal } from '../../components/documents/DocumentDetailsModal';
import { useToast } from '../../context/ToastContext';

export const OwnerDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const context = useOutletContext();
  const openUploadModal = context?.openUploadModal;

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const fetchOwnerStats = async () => {
    try {
      const res = await api.get('/system/owner-stats');
      setStats(res.data);
    } catch {
      toast.error('Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOwnerStats();

    const handleDocUploaded = () => {
      fetchOwnerStats();
    };
    window.addEventListener('vault:document-uploaded', handleDocUploaded);
    return () => window.removeEventListener('vault:document-uploaded', handleDocUploaded);
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-2xl bg-[#15161A] border border-[#282A33] skeleton-shimmer" />
        <SkeletonGrid count={4} />
        <div className="h-64 rounded-2xl bg-[#15161A] border border-[#282A33] skeleton-shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-2xl bg-[#15161A] border border-[#282A33] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#FFFFFF] tracking-tight">
            Documents Overview
          </h2>
          <p className="text-sm text-[#8E95A5] mt-1 leading-relaxed">
            Upload files, manage categories, and share access with your team.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/documents')}
            className="px-3.5 py-2 rounded-xl bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] text-xs font-medium text-[#FFFFFF] transition-all"
          >
            All documents
          </button>
          {openUploadModal && (
            <button
              onClick={openUploadModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl vault-beige-btn text-xs font-semibold"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload file</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33]">
          <p className="text-xs text-[#8E95A5] font-medium">My uploads</p>
          <p className="text-2xl font-semibold text-[#FFFFFF] mt-2">
            {stats?.my_documents_count || 0}
          </p>
          <p className="text-xs text-[#8E95A5] mt-1.5">Active files</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33]">
          <p className="text-xs text-[#8E95A5] font-medium">Storage used</p>
          <p className="text-2xl font-semibold text-[#FFFFFF] mt-2">
            {formatBytes(stats?.storage_bytes)}
          </p>
          <p className="text-xs text-[#8E95A5] mt-1.5">Across all categories</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33]">
          <p className="text-xs text-[#8E95A5] font-medium">Shared by me</p>
          <p className="text-2xl font-semibold text-[#FFFFFF] mt-2">
            {stats?.shared_out_count || 0}
          </p>
          <p className="text-xs text-[#8E95A5] mt-1.5">Active permission grants</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33]">
          <p className="text-xs text-[#8E95A5] font-medium">Shared with me</p>
          <p className="text-2xl font-semibold text-[#FFFFFF] mt-2">
            {stats?.shared_with_me_count || 0}
          </p>
          <p className="text-xs text-[#8E95A5] mt-1.5">Accessible files</p>
        </div>
      </div>

      {/* Recent Uploads Table */}
      <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#FFFFFF]">Recently uploaded</h3>
          <button
            onClick={() => navigate('/documents')}
            className="text-xs text-[#E8DFD8] hover:underline flex items-center gap-1 transition-colors"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {stats?.recent_uploads?.length === 0 ? (
          <div className="p-8 text-center rounded-xl text-xs text-[#8E95A5]">
            No documents yet. Click "Upload file" to add your first document.
          </div>
        ) : (
          <div className="divide-y divide-[#282A33]/60">
            {stats?.recent_uploads?.map((doc) => (
              <div
                key={doc.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-[#1C1E23] px-3 rounded-xl transition-colors cursor-pointer group"
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-[#FFFFFF] truncate group-hover:text-[#E8DFD8] transition-colors">{doc.title}</p>
                  <p className="text-xs text-[#8E95A5] truncate">{doc.original_filename}</p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Badge variant="CATEGORY">{doc.category}</Badge>
                  <span className="text-xs text-[#8E95A5] hidden sm:inline">
                    {formatBytes(doc.file_size)}
                  </span>
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
