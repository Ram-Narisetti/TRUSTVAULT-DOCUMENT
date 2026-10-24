import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { UploadModal } from '../documents/UploadModal';
import { useAuth } from '../../context/AuthContext';

export const AppLayout = () => {
  const { isViewer } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#0A0B0D] text-[#F4F4F6]">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          onOpenUploadModal={!isViewer ? () => setIsUploadOpen(true) : null}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-300">
          <Outlet context={{ openUploadModal: () => setIsUploadOpen(true) }} />
        </main>
      </div>

      {/* Global Upload Modal */}
      {!isViewer && (
        <UploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onUploadSuccess={() => {
            window.dispatchEvent(new Event('vault:document-uploaded'));
          }}
        />
      )}
    </div>
  );
};
