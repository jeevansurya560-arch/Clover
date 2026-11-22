'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSocket } from './socket.js';
import { fetchApi } from './api.js';

const RoomSyncContext = createContext(null);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 5,
      refetchOnWindowFocus: true
    }
  }
});

export function RoomSyncProvider({ children }) {
  // Default to "You (Alex)"
  const [currentUser, setCurrentUser] = useState({
    id: '00000000-0000-0000-0000-000000000003',
    email: 'you@roomsync.app',
    full_name: 'You (Alex)',
    avatar_url: 'avatar-you'
  });

  const [currentHousehold, setCurrentHousehold] = useState({
    id: '11111111-1111-1111-1111-111111111111',
    name: 'DreamHouse',
    currency: 'INR',
    join_code: 'DREAM2026'
  });

  const [activeTab, setActiveTab] = useState('board');
  const [syncStatus, setSyncStatus] = useState('In Sync');
  const [lastSyncTime, setLastSyncTime] = useState('Just now');
  const [profiles, setProfiles] = useState([]);

  // Load all profiles for demo switching
  useEffect(() => {
    fetchApi('/api/auth/profiles')
      .then(res => {
        if (res.profiles) setProfiles(res.profiles);
      })
      .catch(err => console.warn('Failed to load profiles:', err.message));
  }, []);

  // Connect Socket.IO and listen for realtime household updates
  useEffect(() => {
    const socket = getSocket(currentUser.id);

    // Join household room
    socket.emit('household:join', currentHousehold.id, (ack) => {
      if (ack?.success) {
        setSyncStatus('In Sync');
      }
    });

    const handleEvent = (data) => {
      console.log('[Realtime Event Received]', data);
      setSyncStatus('In Sync');
      setLastSyncTime('Just now');

      // Invalidate queries so TanStack Query updates live
      queryClient.invalidateQueries();
    };

    socket.on('expense:created', handleEvent);
    socket.on('expense:voided', handleEvent);
    socket.on('settlement:recorded', handleEvent);
    socket.on('shopping:item_added', handleEvent);
    socket.on('shopping:item_updated', handleEvent);
    socket.on('chore:created', handleEvent);
    socket.on('chore:completed', handleEvent);
    socket.on('bill:created', handleEvent);
    socket.on('bill:paid', handleEvent);
    socket.on('poll:voted', handleEvent);

    return () => {
      socket.off('expense:created', handleEvent);
      socket.off('settlement:recorded', handleEvent);
      socket.off('shopping:item_added', handleEvent);
      socket.off('chore:completed', handleEvent);
      socket.off('bill:paid', handleEvent);
      socket.off('poll:voted', handleEvent);
    };
  }, [currentUser.id, currentHousehold.id]);

  const switchUser = async (userId) => {
    try {
      const res = await fetchApi('/api/auth/demo-switch', {
        method: 'POST',
        body: { userId }
      });
      if (res.user) {
        setCurrentUser(res.user);
        queryClient.invalidateQueries();
      }
    } catch (err) {
      console.error('Failed to switch demo user:', err.message);
    }
  };

  return (
    <RoomSyncContext.Provider
      value={{
        currentUser,
        switchUser,
        currentHousehold,
        setCurrentHousehold,
        activeTab,
        setActiveTab,
        syncStatus,
        lastSyncTime,
        profiles
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </RoomSyncContext.Provider>
  );
}

export function useRoomSync() {
  const context = useContext(RoomSyncContext);
  if (!context) {
    throw new Error('useRoomSync must be used within RoomSyncProvider');
  }
  return context;
}
