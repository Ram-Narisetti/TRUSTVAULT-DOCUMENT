import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
} from 'lucide-react';
import api from '../../api/client';
import { Badge } from '../../components/common/Badge';
import { SkeletonGrid } from '../../components/common/SkeletonLoader';
import { useToast } from '../../context/ToastContext';
import { formatISTTime } from '../../utils/date';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const res = await api.get('/system/stats');
        setStats(res.data);
      } catch (err) {
        toast.error('Failed to load system dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminStats();
  }, [toast]);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-2xl bg-[#15161A] border border-[#282A33] skeleton-shimmer" />
        <SkeletonGrid count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 rounded-2xl bg-[#15161A] border border-[#282A33] skeleton-shimmer" />
          <div className="lg:col-span-2 h-64 rounded-2xl bg-[#15161A] border border-[#282A33] skeleton-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-6 rounded-2xl bg-[#15161A] border border-[#282A33] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#FFFFFF] tracking-tight">
            System Overview
          </h2>
          <p className="text-sm text-[#8E95A5] mt-1 leading-relaxed">
            Monitor active users, storage utilization, access grants, and audit events.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/users')}
            className="px-3.5 py-2 rounded-xl bg-[#1C1E23] hover:bg-[#282A33] border border-[#282A33] text-xs font-medium text-[#FFFFFF] transition-all"
          >
            Manage users
          </button>
          <button
            onClick={() => navigate('/audit-logs')}
            className="vault-beige-btn px-4 py-2 rounded-xl text-xs font-semibold"
          >
            View audit logs
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33]">
          <p className="text-xs text-[#8E95A5] font-medium">Total users</p>
          <p className="text-2xl font-semibold text-[#FFFFFF] mt-2">{stats?.total_users || 0}</p>
          <p className="text-xs text-[#8E95A5] mt-1.5">
            <span className="text-[#E8DFD8]">{stats?.active_users || 0} active</span>
            <span className="mx-1">&bull;</span>
            <span>{stats?.deactivated_users || 0} inactive</span>
          </p>
        </div>

        {/* Total Documents */}
        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33]">
          <p className="text-xs text-[#8E95A5] font-medium">Documents</p>
          <p className="text-2xl font-semibold text-[#FFFFFF] mt-2">{stats?.total_documents || 0}</p>
          <p className="text-xs text-[#8E95A5] mt-1.5">
            Storage: <span className="text-[#FFFFFF]">{formatBytes(stats?.storage_bytes)}</span>
          </p>
        </div>

        {/* Active Shares */}
        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33]">
          <p className="text-xs text-[#8E95A5] font-medium">Active shares</p>
          <p className="text-2xl font-semibold text-[#FFFFFF] mt-2">{stats?.total_shares || 0}</p>
          <p className="text-xs text-[#8E95A5] mt-1.5">Granted permissions</p>
        </div>

        {/* Denied Access Attempts */}
        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33]">
          <p className="text-xs text-[#8E95A5] font-medium">Blocked requests</p>
          <p className="text-2xl font-semibold text-[#F87171] mt-2">{stats?.denied_attempts || 0}</p>
          <p className="text-xs text-[#8E95A5] mt-1.5">Unauthorized attempts</p>
        </div>
      </div>

      {/* Role Breakdown and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role Distribution Card */}
        <div className="p-5 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-4">
          <h3 className="text-sm font-semibold text-[#FFFFFF]">User roles</h3>

          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-[#1C1E23] border border-[#282A33] flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#FFFFFF]">Administrators</p>
                <p className="text-[11px] text-[#8E95A5]">System management</p>
              </div>
              <span className="font-semibold text-sm text-[#E8DFD8]">
                {stats?.role_breakdown?.admin || 0}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#1C1E23] border border-[#282A33] flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#FFFFFF]">Owners</p>
                <p className="text-[11px] text-[#8E95A5]">Upload & sharing</p>
              </div>
              <span className="font-semibold text-sm text-[#E8DFD8]">
                {stats?.role_breakdown?.owner || 0}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#1C1E23] border border-[#282A33] flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#A0A5B5]">Viewers</p>
                <p className="text-[11px] text-[#8E95A5]">Read-only access</p>
              </div>
              <span className="font-semibold text-sm text-[#FFFFFF]">
                {stats?.role_breakdown?.viewer || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Audit Activity Stream */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#15161A] border border-[#282A33] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#FFFFFF]">Recent activity</h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#E8DFD8] bg-[#101114] border border-[#282A33]">
                IST (GMT+5:30)
              </span>
            </div>
            <button
              onClick={() => navigate('/audit-logs')}
              className="text-xs text-[#E8DFD8] hover:underline flex items-center gap-1 transition-colors"
            >
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {stats?.recent_activity?.length === 0 ? (
              <p className="text-xs text-[#8E95A5] py-6 text-center">No recent activity.</p>
            ) : (
              stats?.recent_activity?.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#1C1E23] border border-[#282A33] text-xs hover:border-[#E8DFD8]/30 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Badge variant={log.status}>{log.status}</Badge>
                    <div className="overflow-hidden">
                      <p className="text-[#FFFFFF] font-medium truncate">{log.action}</p>
                      <p className="text-[#8E95A5] text-[11px] truncate">
                        {log.actor_email}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-[#8E95A5] flex-shrink-0">
                    {formatISTTime(log.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
