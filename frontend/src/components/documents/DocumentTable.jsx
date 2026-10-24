import React from 'react';
import {
  FileText,
  Download,
  Share2,
  Edit3,
  Trash2,
  Eye,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { useAuth } from '../../context/AuthContext';
import { formatISTDate } from '../../utils/date';

export const DocumentTable = ({
  documents = [],
  onViewDetails,
  onDownload,
  onEdit,
  onShare,
  onDelete,
  showOwner = false,
}) => {
  const { user } = useAuth();

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[#282A33] bg-[#15161A]">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm text-[#F4F4F6]">
          <thead className="bg-[#101114] border-b border-[#282A33] text-xs text-[#8E95A5]">
            <tr>
              <th className="py-3.5 px-5 font-medium">Document</th>
              <th className="py-3.5 px-4 font-medium">Category</th>
              <th className="py-3.5 px-4 font-medium">Size</th>
              {showOwner && <th className="py-3.5 px-4 font-medium">Owner</th>}
              <th className="py-3.5 px-4 font-medium">Access</th>
              <th className="py-3.5 px-4 font-medium">Date</th>
              <th className="py-3.5 px-5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#282A33]/60">
            {documents.map((doc) => {
              const isOwner = doc.owner_id === user?.id || doc.user_permission === 'OWNER';
              const canEdit = isOwner || doc.user_permission === 'EDIT';

              return (
                <tr
                  key={doc.id}
                  className="hover:bg-[#1C1E23] transition-colors group cursor-pointer"
                  onClick={() => onViewDetails(doc)}
                >
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-[#8E95A5] group-hover:text-[#E8DFD8] transition-colors flex-shrink-0" />
                      <div className="overflow-hidden">
                        <p className="font-medium text-xs text-[#FFFFFF] truncate max-w-xs group-hover:text-[#E8DFD8] transition-colors">
                          {doc.title}
                        </p>
                        <p className="text-[11px] text-[#8E95A5] truncate max-w-xs">
                          {doc.original_filename}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <Badge variant="CATEGORY">{doc.category}</Badge>
                  </td>

                  <td className="py-3.5 px-4 text-xs text-[#8E95A5]">
                    {formatBytes(doc.file_size)}
                  </td>

                  {showOwner && (
                    <td className="py-3.5 px-4 text-xs text-[#8E95A5]">
                      {doc.owner_name || doc.owner_email || 'Owner'}
                    </td>
                  )}

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <>
                          <Badge variant="OWNER">Owner</Badge>
                          {onShare && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onShare(doc);
                              }}
                              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] hover:border-[#E8DFD8]/40 text-[#E8DFD8] transition-all"
                              title="Manage view/edit access"
                            >
                              {doc.shared_count > 0 ? `Shared (${doc.shared_count})` : '+ Share'}
                            </button>
                          )}
                        </>
                      ) : doc.user_permission ? (
                        <Badge variant={doc.user_permission}>{doc.user_permission === 'EDIT' ? 'Can edit' : 'Can view'}</Badge>
                      ) : (
                        <Badge variant="VIEW">View</Badge>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-xs text-[#8E95A5]">
                    {formatISTDate(doc.created_at)}
                  </td>

                  <td
                    className="py-3.5 px-5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onViewDetails(doc)}
                        className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#FFFFFF] hover:bg-[#282A33] transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onDownload(doc)}
                        className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#E8DFD8] hover:bg-[#282A33] transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {isOwner && onShare && (
                        <button
                          onClick={() => onShare(doc)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-[#E8DFD8] bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] hover:border-[#E8DFD8]/40 transition-colors"
                          title="Manage view & edit access"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Access</span>
                        </button>
                      )}

                      {canEdit && onEdit && (
                        <button
                          onClick={() => onEdit(doc)}
                          className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#F3E5AB] hover:bg-[#282A33] transition-colors"
                          title="Edit metadata"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}

                      {isOwner && onDelete && (
                        <button
                          onClick={() => onDelete(doc)}
                          className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#F87171] hover:bg-[#F87171]/15 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Grid View */}
      <div className="md:hidden divide-y divide-[#282A33]/60">
        {documents.map((doc) => {
          const isOwner = doc.owner_id === user?.id || doc.user_permission === 'OWNER';
          const canEdit = isOwner || doc.user_permission === 'EDIT';

          return (
            <div
              key={doc.id}
              onClick={() => onViewDetails(doc)}
              className="p-4 space-y-3 hover:bg-[#1C1E23] transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="overflow-hidden">
                  <h4 className="font-medium text-sm text-[#FFFFFF] truncate">{doc.title}</h4>
                  <p className="text-xs text-[#8E95A5] truncate">{doc.original_filename}</p>
                </div>
                {isOwner ? (
                  <Badge variant="OWNER">Owner</Badge>
                ) : doc.user_permission ? (
                  <Badge variant={doc.user_permission}>{doc.user_permission === 'EDIT' ? 'Can edit' : 'Can view'}</Badge>
                ) : null}
              </div>

              <div className="flex items-center justify-between text-xs text-[#8E95A5]">
                <Badge variant="CATEGORY">{doc.category}</Badge>
                <span>{formatBytes(doc.file_size)}</span>
                <span>{formatISTDate(doc.created_at)}</span>
              </div>

              <div
                className="flex items-center justify-end gap-2 pt-2 border-t border-[#282A33]/50"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onDownload(doc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-xs text-[#E8DFD8] hover:bg-[#282A33] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                {isOwner && onShare && (
                  <button
                    onClick={() => onShare(doc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-xs text-[#E8DFD8] hover:bg-[#282A33] transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Access</span>
                  </button>
                )}
                {canEdit && onEdit && (
                  <button
                    onClick={() => onEdit(doc)}
                    className="p-2 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#F3E5AB] hover:bg-[#282A33] transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                {isOwner && onDelete && (
                  <button
                    onClick={() => onDelete(doc)}
                    className="p-2 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#F87171] hover:bg-[#F87171]/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
