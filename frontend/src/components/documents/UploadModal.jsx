import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, X } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import api from '../../api/client';

const ALLOWED_CATEGORIES = ['Personal', 'Academic', 'Finance', 'Legal', 'Work', 'Other'];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export const UploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Other');
  const [description, setDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setCategory('Other');
    setDescription('');
    setUploading(false);
    setUploadProgress(0);
    setErrorMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelection = (selectedFile) => {
    setErrorMessage('');
    if (!selectedFile) return;

    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage('Selected file exceeds maximum allowed size (15MB).');
      return;
    }

    const ext = selectedFile.name.split('.').pop().toLowerCase();
    const forbidden = ['exe', 'bat', 'cmd', 'sh', 'py', 'js', 'php', 'vbs', 'dll', 'msi'];
    if (forbidden.includes(ext)) {
      setErrorMessage(`Executable files (.${ext}) are not supported.`);
      return;
    }

    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title.trim() || file.name);
    formData.append('category', category);
    formData.append('description', description.trim());

    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      toast.success('Document uploaded.');
      if (onUploadSuccess) onUploadSuccess(res.data.document);
      resetForm();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to upload document.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!uploading) {
          resetForm();
          onClose();
        }
      }}
      title="Upload Document"
      subtitle="Supported formats: PDF, DOCX, XLSX, TXT, PNG, JPG (Max 15MB)"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-7 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-[#E8DFD8] bg-[#E8DFD8]/10'
              : file
              ? 'border-[#E8DFD8]/60 bg-[#1C1E23]'
              : 'border-[#282A33] hover:border-[#E8DFD8]/50 bg-[#101114]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileSelection(e.target.files[0])}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center gap-3.5 w-full">
              <div className="w-10 h-10 rounded-xl bg-[#1C1E23] border border-[#282A33] flex items-center justify-center text-[#E8DFD8] flex-shrink-0">
                <File className="w-5 h-5" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-[#FFFFFF] truncate">{file.name}</p>
                <p className="text-xs text-[#8E95A5]">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#F87171] hover:bg-[#282A33] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-xl bg-[#1C1E23] border border-[#282A33] flex items-center justify-center text-[#E8DFD8] mb-2.5">
                <UploadCloud className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-[#FFFFFF]">
                Drop file here or click to browse
              </p>
              <p className="text-xs text-[#8E95A5] mt-1">
                Files are stored securely in your private vault
              </p>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {uploading && (
          <div className="space-y-1.5 p-3 rounded-xl bg-[#101114] border border-[#282A33]">
            <div className="flex justify-between text-xs text-[#8E95A5]">
              <span>Uploading file...</span>
              <span className="font-medium text-[#FFFFFF]">{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#1C1E23] overflow-hidden">
              <div
                className="h-full bg-[#E8DFD8] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Metadata Inputs */}
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
              Document Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q1 Financial Review"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/50 text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
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
            <label className="block text-xs font-medium text-[#A0A5B5] mb-1.5">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Add details about this file..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/50 text-sm focus:outline-none focus:border-[#E8DFD8] transition-colors"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-3.5 border-t border-[#282A33]">
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium rounded-xl text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading || !file}
            className="vault-beige-btn px-5 py-2 text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
