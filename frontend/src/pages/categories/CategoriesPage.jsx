import React, { useState, useEffect } from 'react';
import { Folder, ArrowRight } from 'lucide-react';
import api from '../../api/client';
import { DocumentTable } from '../../components/documents/DocumentTable';
import { DocumentDetailsModal } from '../../components/documents/DocumentDetailsModal';
import { SkeletonTable } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';

const CATEGORY_META = {
  Personal: { desc: 'Personal records, identification, and private notes' },
  Academic: { desc: 'Research papers, certificates, and course materials' },
  Finance: { desc: 'Invoices, receipts, tax forms, and financial statements' },
  Legal: { desc: 'Contracts, agreements, and legal documentation' },
  Work: { desc: 'Projects, presentations, specifications, and team assets' },
  Other: { desc: 'General files and miscellaneous documents' },
};

export const CategoriesPage = () => {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/system/categories');
        setCategories(res.data.categories || []);
      } catch {
        setCategories(['Personal', 'Academic', 'Finance', 'Legal', 'Work', 'Other']);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    const fetchCategoryDocs = async () => {
      setLoadingDocs(true);
      try {
        const res = await api.get('/documents', { params: { category: selectedCategory } });
        setDocuments(res.data.documents || []);
      } catch {
        toast.error(`Failed to load documents in ${selectedCategory}`);
      } finally {
        setLoadingDocs(false);
      }
    };
    fetchCategoryDocs();
  }, [selectedCategory, toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-[#15161A] border border-[#282A33]">
        <h2 className="text-xl font-semibold text-[#FFFFFF] tracking-tight">Categories</h2>
        <p className="text-sm text-[#8E95A5] mt-1 leading-relaxed">
          Browse documents grouped by domain and purpose.
        </p>
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const meta = CATEGORY_META[cat] || { desc: 'General classified documents' };
          const isSelected = selectedCategory === cat;

          return (
            <div
              key={cat}
              onClick={() => setSelectedCategory(isSelected ? null : cat)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#1C1E23] border-[#E8DFD8] shadow-sm'
                  : 'bg-[#15161A] border-[#282A33] hover:border-[#E8DFD8]/40 hover:bg-[#1C1E23]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[#FFFFFF]">{cat}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1C1E23] border border-[#282A33] text-[#8E95A5]">
                  Folder
                </span>
              </div>
              <p className="text-xs text-[#8E95A5] line-clamp-2 leading-relaxed">{meta.desc}</p>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-[#E8DFD8] font-medium">
                <span>{isSelected ? 'Viewing files' : 'View documents'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtered Documents View */}
      {selectedCategory && (
        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#FFFFFF]">
              {selectedCategory} ({documents.length} files)
            </h3>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-xs text-[#8E95A5] hover:text-[#FFFFFF] transition-colors"
            >
              Close filter
            </button>
          </div>

          {loadingDocs ? (
            <SkeletonTable rows={4} columns={6} />
          ) : documents.length === 0 ? (
            <EmptyState
              title={`No documents in ${selectedCategory}`}
              description="No files are currently assigned to this category."
            />
          ) : (
            <DocumentTable
              documents={documents}
              onViewDetails={(doc) => setSelectedDoc(doc)}
            />
          )}
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
