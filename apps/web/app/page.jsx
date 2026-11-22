'use client';

import React from 'react';
import { RoomSyncProvider, useRoomSync } from '../lib/context.jsx';
import { Sidebar } from '../components/Sidebar.jsx';
import { MasterBoardView } from '../components/views/MasterBoardView.jsx';
import { DashboardView } from '../components/views/DashboardView.jsx';
import { ExpensesView } from '../components/views/ExpensesView.jsx';
import { ShoppingView } from '../components/views/ShoppingView.jsx';
import { ChoresView } from '../components/views/ChoresView.jsx';
import { BillsPollsActivityView } from '../components/views/BillsPollsActivityView.jsx';

function MainContent() {
  const { activeTab } = useRoomSync();

  return (
    <main style={{ flex: 1, padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      {activeTab === 'board' && <MasterBoardView />}
      {activeTab === 'dashboard' && <DashboardView />}
      {activeTab === 'expenses' && <ExpensesView />}
      {activeTab === 'shopping' && <ShoppingView />}
      {activeTab === 'chores' && <ChoresView />}
      {(activeTab === 'bills' || activeTab === 'polls' || activeTab === 'activity') && <BillsPollsActivityView />}
      {activeTab === 'analytics' && <ExpensesView />}
      {activeTab === 'settings' && <DashboardView />}
    </main>
  );
}

export default function HomePage() {
  return (
    <RoomSyncProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas-bg)' }}>
        <Sidebar />
        <MainContent />
      </div>
    </RoomSyncProvider>
  );
}
