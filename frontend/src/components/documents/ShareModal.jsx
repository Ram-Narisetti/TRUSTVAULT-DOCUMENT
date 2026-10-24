import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Eye, Edit3, Check, UserPlus } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { UserAvatar } from '../common/UserAvatar';
import { useToast } from '../../context/ToastContext';
import api from '../../api/client';

export const ShareModal = ({ isOpen, onClose, document, onPermissionsChanged }) => {
  const toast = useToast();

  const [permissions, setPermissions] = useState([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [permissionLevel, setPermissionLevel] = useState('VIEW');
  const [granting, setGranting] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const fetchGrants = useCallback(async () => {
    if (!document) return;
    setLoadingGrants(true);
    try {
      const res = await api.get(`/documents/${document.id}/permissions`);
      setPermissions(res.data.permissions || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load permissions.');
    } finally {
      setLoadingGrants(false);
    }
  }, [document, toast]);

  useEffect(() => {
    if (isOpen && document) {
      fetchGrants();
      setSearchQuery('');
      setSelectedRecipient(null);
      setSearchResults([]);
      setPermissionLevel('VIEW');
    }
  }, [isOpen, document, fetchGrants]);

  // Search users autocomplete
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/sharing/recipients?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data.users || []);
      } catch {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleGrantAccess = async (e) => {
    e.preventDefault();
    if (!selectedRecipient && !searchQuery) return;

    const email = selectedRecipient ? selectedRecipient.email : searchQuery.trim();
    setGranting(true);

    try {
      await api.post(`/documents/${document.id}/permissions`, {
        recipient_email: email,
        permission: permissionLevel,
      });

      toast.success(`Access granted (${permissionLevel === 'EDIT' ? 'Can edit' : 'Can view'}) to ${email}`);
      setSelectedRecipient(null);
      setSearchQuery('');
      setSearchResults([]);
      fetchGrants();
      if (onPermissionsChanged) onPermissionsChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to share document.');
    } finally {
      setGranting(false);
    }
  };

  const handleUpdatePermission = async (grant, newLevel) => {
    setUpdatingId(grant.id);
    try {
      await api.post(`/documents/${document.id}/permissions`, {
        recipient_email: grant.user_email,
        permission: newLevel,
      });

      toast.success(`Updated ${grant.user_name || grant.user_email} to ${newLevel === 'EDIT' ? 'Can edit' : 'Can view'}`);
      setPermissions((prev) =>
        prev.map((p) => (p.id === grant.id ? { ...p, permission_level: newLevel } : p))
      );
      if (onPermissionsChanged) onPermissionsChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update access level.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRevoke = async (targetUserId, targetEmail) => {
    setRevokingId(targetUserId);
    try {
      await api.delete(`/documents/${document.id}/permissions/${targetUserId}`);
      toast.success(`Removed access for ${targetEmail}`);
      setPermissions((prev) => prev.filter((p) => p.user_id !== targetUserId));
      if (onPermissionsChanged) onPermissionsChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke access.');
    } finally {
      setRevokingId(null);
    }
  };

  if (!document) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Document Access"
      subtitle={`Configure view and edit permissions for "${document.title}"`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        {/* Grant New Permission Section */}
        <form onSubmit={handleGrantAccess} className="p-4 rounded-xl bg-[#101114] border border-[#282A33] space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FFFFFF]">
            <UserPlus className="w-4 h-4 text-[#E8DFD8]" />
            <span>Grant access to another user</span>
          </div>

          {/* User selector input */}
          <div className="relative">
            <label className="block text-xs text-[#A0A5B5] mb-1.5">
              Select user by email or username
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedRecipient(null);
              }}
              placeholder="Search user name or email..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1C1E23] border border-[#282A33] text-[#FFFFFF] placeholder-[#8E95A5]/50 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
            />

            {/* Autocomplete dropdown */}
            {searchResults.length > 0 && !selectedRecipient && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#15161A] border border-[#282A33] rounded-xl shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedRecipient(u);
                      setSearchQuery(u.email);
                      setSearchResults([]);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-left hover:bg-[#1C1E23] text-sm text-[#FFFFFF] border-b border-[#282A33]/50 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserAvatar user={u} size="xs" />
                      <div>
                        <p className="font-medium text-xs text-[#FFFFFF]">{u.full_name}</p>
                        <p className="text-xs text-[#8E95A5]">{u.email}</p>
                      </div>
                    </div>
                    <Check className="w-3.5 h-3.5 text-[#E8DFD8]" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Separate Option for Edit and View */}
          <div>
            <label className="block text-xs text-[#A0A5B5] mb-2 font-medium">
              Choose permission type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: View Access */}
              <div
                onClick={() => setPermissionLevel('VIEW')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  permissionLevel === 'VIEW'
                    ? 'bg-[#1C1E23] border-[#E8DFD8] shadow-sm'
                    : 'bg-[#15161A] border-[#282A33] hover:border-[#E8DFD8]/40 hover:bg-[#1C1E23]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#E8DFD8]" />
                    <span className="text-xs font-semibold text-[#FFFFFF]">Can View</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      permissionLevel === 'VIEW'
                        ? 'border-[#E8DFD8] bg-[#E8DFD8]'
                        : 'border-[#8E95A5] bg-transparent'
                    }`}
                  >
                    {permissionLevel === 'VIEW' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0A0B0D]" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-[#8E95A5] leading-relaxed">
                  Can preview document details and download the file.
                </p>
              </div>

              {/* Option 2: Edit Access */}
              <div
                onClick={() => setPermissionLevel('EDIT')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  permissionLevel === 'EDIT'
                    ? 'bg-[#1C1E23] border-[#E8DFD8] shadow-sm'
                    : 'bg-[#15161A] border-[#282A33] hover:border-[#E8DFD8]/40 hover:bg-[#1C1E23]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-[#E8DFD8]" />
                    <span className="text-xs font-semibold text-[#FFFFFF]">Can Edit</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      permissionLevel === 'EDIT'
                        ? 'border-[#E8DFD8] bg-[#E8DFD8]'
                        : 'border-[#8E95A5] bg-transparent'
                    }`}
                  >
                    {permissionLevel === 'EDIT' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0A0B0D]" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-[#8E95A5] leading-relaxed">
                  Can view, download, and update title, category, and metadata.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={granting || !searchQuery.trim()}
              className="vault-beige-btn px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {granting ? 'Granting...' : 'Grant Access'}
            </button>
          </div>
        </form>

        {/* Existing Users with Access Section */}
        <div>
          <h4 className="text-xs font-medium text-[#A0A5B5] mb-2.5">
            Users with access ({permissions.length})
          </h4>

          {loadingGrants ? (
            <LoadingSpinner size="sm" text="Loading permissions..." />
          ) : permissions.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#101114] border border-[#282A33] text-center text-xs text-[#8E95A5]">
              No other users currently have access to this document.
            </div>
          ) : (
            <div className="space-y-2">
              {permissions.map((grant) => (
                <div
                  key={grant.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#1C1E23] border border-[#282A33] text-sm"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <UserAvatar
                      user={{
                        full_name: grant.user_name,
                        email: grant.user_email,
                        avatar_url: grant.user_avatar_url,
                      }}
                      size="sm"
                    />
                    <div className="overflow-hidden">
                      <p className="font-medium text-[#FFFFFF] text-xs truncate">
                        {grant.user_name || 'User'}
                      </p>
                      <p className="text-xs text-[#8E95A5] truncate">{grant.user_email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {/* Inline Separate Permission Changer */}
                    <select
                      value={grant.permission_level}
                      disabled={updatingId === grant.id}
                      onChange={(e) => handleUpdatePermission(grant, e.target.value)}
                      className="bg-[#15161A] border border-[#282A33] text-[#FFFFFF] rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-[#E8DFD8] transition-colors"
                    >
                      <option value="VIEW">Can view</option>
                      <option value="EDIT">Can edit</option>
                    </select>

                    {/* Revoke button */}
                    <button
                      type="button"
                      onClick={() => handleRevoke(grant.user_id, grant.user_email)}
                      disabled={revokingId === grant.user_id}
                      className="p-1.5 rounded-lg text-[#8E95A5] hover:text-[#F87171] hover:bg-[#F87171]/15 transition-colors"
                      title="Revoke access"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
