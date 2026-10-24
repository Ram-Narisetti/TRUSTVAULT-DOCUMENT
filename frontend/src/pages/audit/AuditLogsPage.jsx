import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { Badge } from '../../components/common/Badge';
import { SkeletonTable } from '../../components/common/SkeletonLoader';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatIST } from '../../utils/date';

const ACTIONS = [
  'All',
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILED',
  'DOCUMENT_UPLOAD',
  'DOCUMENT_DOWNLOAD',
  'DOCUMENT_DELETE',
  'DOCUMENT_METADATA_UPDATE',
  'PERMISSION_GRANTED',
  'PERMISSION_REVOKED',
  'ACCESS_DENIED',
  'USER_STATUS_CHANGE',
];

export const AuditLogsPage = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin ? '/audit/system' : '/audit/my-documents';
      const params = { page, per_page: 20 };
      if (selectedAction !== 'All') params.action = selectedAction;
      if (selectedStatus !== 'All') params.status = selectedStatus;
      if (search.trim()) params.search = search.trim();

      const res = await api.get(endpoint, { params });
      setLogs(res.data.logs || []);
      setTotalPages(res.data.pages || 1);
    } catch {
      toast.error('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, selectedAction, selectedStatus, search, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-2xl bg-[#15161A] border border-[#282A33]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#FFFFFF] tracking-tight">
              {isAdmin ? 'Audit Logs' : 'Activity History'}
            </h2>
            <p className="text-sm text-[#8E95A5] mt-1 leading-relaxed">
              {isAdmin
                ? 'Complete record of logins, file operations, permission changes, and security events.'
                : 'Recent activity for your documents and shared files.'}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#101114] border border-[#282A33] text-xs text-[#E8DFD8] self-start sm:self-auto flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#34D399]" />
            <span>Timezone: IST (GMT+5:30)</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {isAdmin && (
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by email, action, or document ID..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/50 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
              />
              <Search className="w-3.5 h-3.5 text-[#8E95A5] absolute left-3 top-2.5" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="p-2 rounded-xl bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] text-[#8E95A5] hover:text-[#FFFFFF] transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action and Status Dropdowns */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#282A33]/70 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#8E95A5]">Action:</span>
              <select
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setPage(1);
                }}
                className="bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
              >
                {ACTIONS.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#8E95A5]">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setPage(1);
                }}
                className="bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
              >
                <option value="All">All statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="DENIED">Denied</option>
                <option value="FAILURE">Failure</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Logs Table */}
      {loading ? (
        <SkeletonTable rows={8} columns={7} />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No audit events found"
          description="No activity matches your current filters."
        />
      ) : (
        <div className="w-full overflow-hidden rounded-2xl border border-[#282A33] bg-[#15161A]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#FFFFFF]">
              <thead className="bg-[#101114] border-b border-[#282A33] text-[#8E95A5]">
                <tr>
                  <th className="py-3.5 px-4 font-medium">Time (IST)</th>
                  <th className="py-3.5 px-4 font-medium">Action</th>
                  <th className="py-3.5 px-4 font-medium">User</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium">Resource</th>
                  <th className="py-3.5 px-4 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282A33]/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#1C1E23] transition-colors">
                    <td className="py-3 px-4 text-[#8E95A5] whitespace-nowrap font-mono text-[11px]">
                      {log.timestamp_ist || formatIST(log.timestamp)}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#FFFFFF]">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-[#8E95A5] truncate max-w-xs">
                      {log.actor_email}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={log.status}>{log.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-[#8E95A5]">
                      {log.resource_type ? `${log.resource_type} #${log.resource_id || ''}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-[#8E95A5] whitespace-nowrap">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-[#8E95A5]">
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
    </div>
  );
};
