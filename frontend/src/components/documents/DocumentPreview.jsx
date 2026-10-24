import React, { useState, useEffect } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  Download,
  Eye,
} from 'lucide-react';
import api from '../../api/client';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const DocumentPreview = ({ document, onDownload }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [previewType, setPreviewType] = useState('unsupported');
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let activeUrl = null;

    const fetchPreviewContent = async () => {
      if (!document?.id) return;
      setLoading(true);
      setError(null);
      setZoomLevel(100);

      const ext = (document.file_extension || '').toLowerCase();
      const mime = (document.mime_type || '').toLowerCase();

      const isImg =
        ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext) || mime.startsWith('image/');
      const isPdf = ext === 'pdf' || mime === 'application/pdf';
      const isTxt =
        [
          'txt',
          'csv',
          'json',
          'md',
          'log',
          'xml',
          'html',
          'css',
          'js',
          'jsx',
          'ts',
          'tsx',
          'py',
          'sql',
          'yaml',
          'yml',
          'env',
        ].includes(ext) ||
        mime.startsWith('text/') ||
        mime === 'application/json';
      const isMedia =
        ['mp4', 'webm', 'mp3', 'wav', 'ogg'].includes(ext) ||
        mime.startsWith('video/') ||
        mime.startsWith('audio/');

      if (!isImg && !isPdf && !isTxt && !isMedia) {
        setPreviewType('unsupported');
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/documents/${document.id}/preview`, {
          responseType: isTxt ? 'text' : 'blob',
        });

        if (isTxt) {
          setPreviewType('text');
          setTextContent(
            typeof response.data === 'string'
              ? response.data
              : JSON.stringify(response.data, null, 2)
          );
        } else {
          const blobType = isPdf ? 'application/pdf' : response.data.type || mime;
          const blob = new Blob([response.data], { type: blobType });
          activeUrl = URL.createObjectURL(blob);
          setPreviewUrl(activeUrl);

          if (isImg) setPreviewType('image');
          else if (isPdf) setPreviewType('pdf');
          else if (isMedia) setPreviewType('media');
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Unable to render content preview.');
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewContent();

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [document]);

  const copyText = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 rounded-2xl bg-[#101114] border border-[#282A33] min-h-[260px]">
        <LoadingSpinner size="md" text="Loading document preview..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-[#101114] border border-[#282A33] text-center space-y-3 min-h-[220px]">
        <AlertCircle className="w-8 h-8 text-[#F87171]" />
        <div>
          <p className="text-sm font-medium text-[#FFFFFF]">Preview Unavailable</p>
          <p className="text-xs text-[#8E95A5] mt-1">{error}</p>
        </div>
        {onDownload && (
          <button
            onClick={() => onDownload(document)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] text-xs font-medium text-[#E8DFD8] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download file instead</span>
          </button>
        )}
      </div>
    );
  }

  // 1. Image Preview
  if (previewType === 'image') {
    return (
      <div className="rounded-2xl bg-[#101114] border border-[#282A33] overflow-hidden">
        {/* Controls Bar */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#15161A] border-b border-[#282A33] text-xs">
          <div className="flex items-center gap-2 text-[#8E95A5]">
            <ImageIcon className="w-3.5 h-3.5 text-[#E8DFD8]" />
            <span className="font-mono text-[11px] text-[#A0A5B5]">{document.original_filename}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
              className="p-1 rounded-lg text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-[#8E95A5] px-1">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(200, z + 25))}
              className="p-1 rounded-lg text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3.5 bg-[#282A33] mx-1" />
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-lg text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Image Stage */}
        <div
          className={`flex items-center justify-center p-4 bg-[#0A0B0D] overflow-auto transition-all ${
            isExpanded ? 'max-h-[560px] min-h-[400px]' : 'max-h-[360px] min-h-[220px]'
          }`}
        >
          <img
            src={previewUrl}
            alt={document.title}
            style={{ width: `${zoomLevel}%`, maxWidth: 'none' }}
            className="rounded-lg object-contain shadow-md transition-all duration-150"
          />
        </div>
      </div>
    );
  }

  // 2. PDF Preview
  if (previewType === 'pdf') {
    return (
      <div className="rounded-2xl bg-[#101114] border border-[#282A33] overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#15161A] border-b border-[#282A33] text-xs">
          <div className="flex items-center gap-2 text-[#8E95A5]">
            <FileText className="w-3.5 h-3.5 text-[#E8DFD8]" />
            <span className="font-mono text-[11px] text-[#A0A5B5]">{document.original_filename}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-lg text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className={`w-full bg-[#1C1E23] transition-all ${isExpanded ? 'h-[560px]' : 'h-[360px]'}`}>
          <object
            data={previewUrl}
            type="application/pdf"
            className="w-full h-full rounded-b-2xl border-none"
          >
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3">
              <p className="text-xs text-[#8E95A5]">PDF plugin is not supported in this browser window.</p>
              {onDownload && (
                <button
                  onClick={() => onDownload(document)}
                  className="vault-beige-btn px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  Download PDF to view
                </button>
              )}
            </div>
          </object>
        </div>
      </div>
    );
  }

  // 3. Text & Code Preview
  if (previewType === 'text') {
    const lines = textContent.split('\n');

    return (
      <div className="rounded-2xl bg-[#101114] border border-[#282A33] overflow-hidden">
        {/* Controls */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#15161A] border-b border-[#282A33] text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#A0A5B5]">{document.original_filename}</span>
            <span className="text-[10px] text-[#8E95A5]">({lines.length} lines)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWordWrap(!wordWrap)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                wordWrap ? 'bg-[#282A33] text-[#E8DFD8]' : 'text-[#8E95A5] hover:text-[#FFFFFF]'
              }`}
            >
              Wrap
            </button>
            <button
              onClick={copyText}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-[#E8DFD8]" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-lg text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#1C1E23] transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Scrollable Text Body */}
        <div
          className={`overflow-auto p-4 font-mono text-xs text-[#E8DFD8]/90 transition-all ${
            isExpanded ? 'max-h-[560px]' : 'max-h-[320px]'
          } ${wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}`}
        >
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-[#1C1E23]/40">
                  <td className="w-10 pr-3 text-right select-none text-[#8E95A5]/40 font-mono text-[11px] align-top">
                    {idx + 1}
                  </td>
                  <td className="text-left font-mono text-[11.5px] leading-relaxed text-[#E8DFD8]">
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 4. Media Preview (Audio / Video)
  if (previewType === 'media') {
    const isVideo = ['mp4', 'webm'].includes((document.file_extension || '').toLowerCase());

    return (
      <div className="rounded-2xl bg-[#101114] border border-[#282A33] p-4 flex flex-col items-center justify-center">
        {isVideo ? (
          <video src={previewUrl} controls className="max-h-[320px] rounded-xl w-full" />
        ) : (
          <audio src={previewUrl} controls className="w-full mt-2" />
        )}
      </div>
    );
  }

  // 5. Unsupported binary file fallback card
  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-[#101114] border border-[#282A33] text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-[#1C1E23] border border-[#282A33] flex items-center justify-center text-[#E8DFD8]">
        <FileText className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#FFFFFF]">{document.original_filename}</p>
        <p className="text-xs text-[#8E95A5] mt-1">
          Binary document format (.{document.file_extension?.toUpperCase() || 'BIN'})
        </p>
      </div>
      {onDownload && (
        <button
          onClick={() => onDownload(document)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl vault-beige-btn text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download to view contents</span>
        </button>
      )}
    </div>
  );
};
