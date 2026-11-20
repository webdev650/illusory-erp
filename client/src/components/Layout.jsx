import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import CustomizeHomeDrawer from './CustomizeHomeDrawer';
import { usePreferences } from '../context/PreferencesContext';

export const Layout = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCustomizeDrawerOpen, setIsCustomizeDrawerOpen] = useState(false);
  const { preferences } = usePreferences();

  const isCollapsed = preferences?.sidebarCollapsed ?? false;

  return (
    <div className="min-h-screen bg-[#F5F6FA] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 flex flex-col font-sans">
      {/* Sidebar Navigation */}
      <Sidebar isMobileOpen={isMobileOpen} setIsMobileOpen={setIsMobileOpen} />

      {/* Main Content Container with dynamic left padding based on collapse state */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-16' : 'lg:pl-72'
        }`}
      >
        <Navbar
          setIsMobileOpen={setIsMobileOpen}
          onOpenCustomizeDrawer={() => setIsCustomizeDrawerOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet context={{ onOpenCustomizeDrawer: () => setIsCustomizeDrawerOpen(true) }} />
        </main>

        <Footer />
      </div>

      {/* Customize Dashboard Layout Drawer */}
      <CustomizeHomeDrawer
        isOpen={isCustomizeDrawerOpen}
        onClose={() => setIsCustomizeDrawerOpen(false)}
      />
    </div>
  );
};

export default Layout;
