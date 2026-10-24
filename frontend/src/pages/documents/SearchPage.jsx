import React, { useState, useEffect } from 'react';
import { Search, Eye, Download } from 'lucide-react';
import api from '../../api/client';
import { Badge } from '../../components/common/Badge';
import { DocumentDetailsModal } from '../../components/documents/DocumentDetailsModal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export const SearchPage = () => {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/documents/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res.data.documents || []);
        setHasSearched(true);
      } catch {
        toast.error('Search query failed.');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, toast]);

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

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="p-6 md:p-8 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-[#FFFFFF] tracking-tight">Search Documents</h2>
          <p className="text-sm text-[#8E95A5] mt-1 leading-relaxed">
            Find documents by title, file name, or description.
          </p>
        </div>

        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search..."
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/50 text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
          />
          <Search className="w-4 h-4 text-[#8E95A5] absolute left-3.5 top-3.5" />
        </div>
      </div>

      {/* Results Section */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="md" text="Searching..." />
        </div>
      ) : hasSearched && results.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-[#282A33] bg-[#15161A] text-xs text-[#8E95A5]">
          No documents matching "{query}" were found.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className="p-4 rounded-xl bg-[#15161A] border border-[#282A33] hover:border-[#E8DFD8]/40 hover:bg-[#1C1E23] flex items-center justify-between gap-4 transition-all cursor-pointer group"
            >
              <div className="overflow-hidden">
                <h4 className="text-sm font-medium text-[#FFFFFF] truncate group-hover:text-[#E8DFD8] transition-colors">{doc.title}</h4>
                <p className="text-xs text-[#8E95A5] truncate">{doc.original_filename}</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <Badge variant="CATEGORY">{doc.category}</Badge>
                {doc.user_permission && (
                  <Badge variant={doc.user_permission}>{doc.user_permission}</Badge>
                )}
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
