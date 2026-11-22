'use client';

import React from 'react';
import { useRoomSync } from '../lib/context.jsx';
import { PixelHouse, PixelClover, UserAvatar } from './PixelIcons.jsx';
import {
  Home,
  Receipt,
  ShoppingCart,
  CheckSquare,
  Vote,
  Activity,
  BarChart2,
  Settings,
  Users
} from 'lucide-react';

export function Sidebar() {
  const { activeTab, setActiveTab, currentHousehold, currentUser, profiles, switchUser } = useRoomSync();

  const navItems = [
    { id: 'board', label: 'Master Board', icon: Home },
    { id: 'dashboard', label: '1. Dashboard', icon: Home },
    { id: 'expenses', label: '2. Expenses', icon: Receipt },
    { id: 'shopping', label: '3. Shopping', icon: ShoppingCart },
    { id: 'chores', label: '4. Chores', icon: CheckSquare },
    { id: 'bills', label: '5. Bills & Polls', icon: Vote },
    { id: 'activity', label: 'Activity Feed', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];

  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: '#1E2B2B', // Dark teal / Ink Plum styling from screenshot
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        borderRight: '2px solid #30263E',
        padding: '16px 12px',
        flexShrink: 0
      }}
    >
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 8px 16px', borderBottom: '1px solid #2F3E3E' }}>
        <PixelClover size={28} />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Clover
        </span>
      </div>

      {/* Household Selector Card */}
      <div
        style={{
          margin: '14px 0',
          padding: '10px 12px',
          backgroundColor: '#263737',
          border: '1.5px solid #3A4E4E',
          borderRadius: '10px',
        }}
      >
        <div style={{ fontSize: '11px', color: '#97A9A9', textTransform: 'uppercase', fontWeight: 700 }}>
          Household
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, margin: '2px 0 6px', color: '#FFFFFF' }}>
          {currentHousehold.name} ▾
        </div>
        {/* Avatars of members */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <UserAvatar name="Aman" avatar="avatar-aman" size={24} />
          <UserAvatar name="Riya" avatar="avatar-riya" size={24} />
          <UserAvatar name="You" avatar="avatar-you" size={24} />
          <span style={{ fontSize: '11px', color: '#B6F0D2', fontWeight: 700, marginLeft: '4px' }}>+1</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '9px 14px',
                borderRadius: '9999px',
                border: isActive ? '2px solid #30263E' : '2px solid transparent',
                backgroundColor: isActive ? 'var(--pixel-pink)' : 'transparent',
                color: isActive ? '#30263E' : '#B8C7C7',
                fontFamily: 'var(--font-body)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isActive ? '2px 2px 0px #30263E' : 'none',
                transition: 'all 0.1s ease'
              }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Demo Roommate Switcher Footer */}
      <div style={{ borderTop: '1px solid #2F3E3E', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: '#97A9A9', fontWeight: 700 }}>
          ACTIVE ROOMMATE:
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => switchUser(p.id)}
              style={{
                flex: 1,
                padding: '4px 6px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                border: currentUser.id === p.id ? '2px solid #FF9FBF' : '1px solid #3A4E4E',
                backgroundColor: currentUser.id === p.id ? '#FF9FBF' : '#263737',
                color: currentUser.id === p.id ? '#30263E' : '#FFFFFF',
                cursor: 'pointer'
              }}
              title={`Switch view to ${p.full_name}`}
            >
              {p.full_name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
