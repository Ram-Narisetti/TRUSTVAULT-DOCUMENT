import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { Badge } from '../../components/common/Badge';
import { UserAvatar } from '../../components/common/UserAvatar';
import { SkeletonTable } from '../../components/common/SkeletonLoader';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatISTDate, formatIST } from '../../utils/date';

export const UserManagementPage = () => {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [updating, setUpdating] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: 15 };
      if (search.trim()) params.search = search.trim();
      if (selectedRole !== 'All') params.role = selectedRole;

      const res = await api.get('/users', { params });
      setUsers(res.data.users || []);
      setTotalPages(res.data.pages || 1);
    } catch {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedRole, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async () => {
    if (!toggleTarget) return;

    if (toggleTarget.id === currentUser?.id) {
      toast.error('You cannot deactivate your own account.');
      setToggleTarget(null);
      return;
    }

    setUpdating(true);
    try {
      const res = await api.put(`/users/${toggleTarget.id}/status`);
      toast.success(res.data.message);
      setToggleTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user status.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-[#15161A] border border-[#282A33]">
        <h2 className="text-xl font-semibold text-[#FFFFFF] tracking-tight">Users & Access</h2>
        <p className="text-sm text-[#8E95A5] mt-1 leading-relaxed">
          Manage team members, roles, and access status.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, username, or email..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/50 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
          />
          <Search className="w-3.5 h-3.5 text-[#8E95A5] absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#8E95A5]">Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(1);
              }}
              className="bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
            >
              <option value="All">All roles</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <button
            onClick={fetchUsers}
            className="p-2 rounded-xl bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] text-[#8E95A5] hover:text-[#FFFFFF] transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="No accounts match your current filters."
        />
      ) : (
        <div className="w-full overflow-hidden rounded-2xl border border-[#282A33] bg-[#15161A]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#FFFFFF]">
              <thead className="bg-[#101114] border-b border-[#282A33] text-xs text-[#8E95A5]">
                <tr>
                  <th className="py-3.5 px-5 font-medium">Name</th>
                  <th className="py-3.5 px-4 font-medium">Role</th>
                  <th className="py-3.5 px-4 font-medium">Status</th>
                  <th className="py-3.5 px-4 font-medium">Joined</th>
                  <th className="py-3.5 px-4 font-medium">Last active</th>
                  <th className="py-3.5 px-5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#282A33]/60 text-xs">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;

                  return (
                    <tr key={u.id} className="hover:bg-[#1C1E23] transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={u} size="xs" />
                          <div>
                            <p className="font-medium text-[#FFFFFF]">{u.full_name}</p>
                            <p className="text-[11px] text-[#8E95A5]">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={u.role}>{u.role.toUpperCase()}</Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={u.is_active ? 'ACTIVE' : 'DEACTIVATED'}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-[#8E95A5]">
                        {formatISTDate(u.created_at)}
                      </td>

                      <td className="py-3.5 px-4 text-[#8E95A5]">
                        {u.last_login_at ? formatIST(u.last_login_at, false) : 'Never'}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        {isSelf ? (
                          <span className="text-xs text-[#8E95A5]">You</span>
                        ) : (
                          <button
                            onClick={() => setToggleTarget(u)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                              u.is_active
                                ? 'bg-[#F87171]/10 text-[#F87171] border-[#F87171]/25 hover:bg-[#F87171]/20'
                                : 'bg-[#E8DFD8]/10 text-[#E8DFD8] border-[#E8DFD8]/25 hover:bg-[#E8DFD8]/20'
                            }`}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

      {/* Confirmation Dialog */}
      {toggleTarget && (
        <ConfirmDialog
          isOpen={!!toggleTarget}
          onClose={() => setToggleTarget(null)}
          onConfirm={handleToggleStatus}
          title={toggleTarget.is_active ? 'Deactivate user' : 'Activate user'}
          message={
            toggleTarget.is_active
              ? `Are you sure you want to deactivate ${toggleTarget.full_name}? They will not be able to log in.`
              : `Reactivate account for ${toggleTarget.full_name}? They will regain access to their documents.`
          }
          confirmText={toggleTarget.is_active ? 'Deactivate' : 'Activate'}
          isDestructive={toggleTarget.is_active}
          loading={updating}
        />
      )}
    </div>
  );
};
