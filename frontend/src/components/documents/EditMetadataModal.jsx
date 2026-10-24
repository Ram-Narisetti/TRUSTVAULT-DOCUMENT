import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import api from '../../api/client';

const ALLOWED_CATEGORIES = ['Personal', 'Academic', 'Finance', 'Legal', 'Work', 'Other'];

export const EditMetadataModal = ({ isOpen, onClose, document, onUpdateSuccess }) => {
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Other');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (document) {
      setTitle(document.title || '');
      setCategory(document.category || 'Other');
      setDescription(document.description || '');
    }
  }, [document]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!document) return;

    setSaving(true);
    try {
      const res = await api.put(`/documents/${document.id}`, {
        title: title.trim(),
        category,
        description: description.trim(),
      });

      toast.success('Document metadata updated successfully.');
      if (onUpdateSuccess) onUpdateSuccess(res.data.document);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update document metadata.');
    } finally {
      setSaving(false);
    }
  };

  if (!document) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Document Metadata"
      subtitle={`Updating properties for "${document.title}"`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">Document Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
          >
            {ALLOWED_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3.5 py-2 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3.5 border-t border-[#282A33]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-xl text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="vault-beige-btn px-5 py-2 text-sm font-semibold rounded-xl disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
