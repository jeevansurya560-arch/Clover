'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoomSync } from '../../lib/context.jsx';
import { fetchApi } from '../../lib/api.js';
import { PixelCat, PixelCoins, PixelBroom, UserAvatar } from '../PixelIcons.jsx';
import { Wifi, Zap, ArrowRight, Bell, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { formatINR } from '@roomsync/shared';

export function DashboardView() {
  const { currentHousehold, currentUser, setActiveTab, syncStatus, lastSyncTime } = useRoomSync();

  const { data: balanceData } = useQuery({
    queryKey: ['balances', currentHousehold.id],
    queryFn: () => fetchApi('/api/balances', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: billsData } = useQuery({
    queryKey: ['bills', currentHousehold.id],
    queryFn: () => fetchApi('/api/bills', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: choresData } = useQuery({
    queryKey: ['chores', currentHousehold.id],
    queryFn: () => fetchApi('/api/chores', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: shoppingData } = useQuery({
    queryKey: ['shopping', currentHousehold.id],
    queryFn: () => fetchApi('/api/shopping?status=pending', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: activityData } = useQuery({
    queryKey: ['activity', currentHousehold.id],
    queryFn: () => fetchApi('/api/activity?limit=5', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const myBalance = balanceData?.balances?.[currentUser.id]?.netPaise || 0;
  const isOwed = myBalance > 0;
  const owes = myBalance < 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner with Ethereal Gradient & Pixel Cat */}
      <div
        className="nb-card"
        style={{
          background: 'linear-gradient(135deg, #F3C5A7 0%, #FF9FBF 40%, #C5B2FF 100%)',
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#30263E', marginBottom: '6px' }}>
            Good morning, roommates!
          </h1>
          <p style={{ fontSize: '15px', color: '#30263E', fontWeight: 600 }}>
            Your household, in sync.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Sleeping Pixel Cat */}
          <PixelCat width={75} height={42} />

          {/* Sync status and User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.7)', padding: '6px 12px', borderRadius: '9999px', border: '2px solid #30263E' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#30263E' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
              {syncStatus} • {lastSyncTime}
            </span>
            <Bell size={16} strokeWidth={2.5} color="#30263E" />
            <UserAvatar name={currentUser.full_name} avatar={currentUser.avatar_url} size={28} />
          </div>
        </div>
      </div>

      {/* Row 1: Core Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '18px' }}>
        {/* Household Balance Card */}
        <div className="nb-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Household Balance</span>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#30263E', margin: '4px 0' }}>
                  ₹2,480
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: owes ? '#EF4444' : '#10B981' }}>
                  {owes ? `You owe ${formatINR(Math.abs(myBalance))}` : isOwed ? `You are owed ${formatINR(myBalance)}` : 'You are all settled up'}
                </div>
              </div>
              <PixelCoins size={44} />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => setActiveTab('expenses')}
              className="nb-btn nb-btn-primary"
              style={{ width: '100%' }}
            >
              Settle Up <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Monthly Spending Card */}
        <div className="nb-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Monthly Spending</span>
            <span className="nb-badge" style={{ background: '#B6F0D2' }}>↑ 12%</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#30263E', margin: '4px 0 16px' }}>
            ₹12,450
          </div>
          {/* Pixel bar chart preview */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '60px' }}>
            {[30, 45, 25, 60, 50, 40, 75, 90].map((h, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  background: idx === 7 ? 'var(--pixel-pink)' : 'var(--pixel-mint)',
                  border: '1.5px solid #30263E',
                  borderRadius: '4px 4px 0 0'
                }}
              />
            ))}
          </div>
        </div>

        {/* Upcoming Bills Card */}
        <div className="nb-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Upcoming Bills</span>
            <button onClick={() => setActiveTab('bills')} style={{ fontSize: '12px', fontWeight: 700, color: '#30263E', background: 'none', border: 'none', cursor: 'pointer' }}>
              View All →
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {billsData?.bills?.slice(0, 2).map((bill) => (
              <div key={bill.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#F9F6FE', border: '1.5px solid #30263E', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {bill.title.toLowerCase().includes('internet') ? <Wifi size={18} color="#30263E" /> : <Zap size={18} color="#EAB308" />}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{bill.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Apr 25</div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 800 }}>{formatINR(bill.amount_paise)}</div>
              </div>
            )) || <div>No upcoming bills</div>}
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Content (Chores, Shopping, Activity) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '18px' }}>
        {/* Today's Chores */}
        <div className="nb-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Today's Chores</span>
            <button onClick={() => setActiveTab('chores')} style={{ fontSize: '12px', fontWeight: 700, color: '#30263E', background: 'none', border: 'none', cursor: 'pointer' }}>
              View All →
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--pixel-mint)', border: '2px solid #30263E', borderRadius: '10px', boxShadow: '2px 2px 0px #30263E' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={20} color="#10B981" />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800 }}>Clean Kitchen</div>
                <div style={{ fontSize: '11px', color: '#30263E' }}>by 8 PM</div>
              </div>
            </div>
            <PixelBroom size={26} />
          </div>
        </div>

        {/* Shopping List Preview */}
        <div className="nb-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Shopping List</span>
            <button onClick={() => setActiveTab('shopping')} style={{ fontSize: '12px', fontWeight: 700, color: '#30263E', background: 'none', border: 'none', cursor: 'pointer' }}>
              Manage →
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F5F0FF', border: '2px solid #30263E', borderRadius: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>
              Milk, Bread, Eggs <span style={{ color: 'var(--text-muted)' }}>+2 more</span>
            </div>
            <ShoppingCart size={20} color="#30263E" />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="nb-card" style={{ padding: '20px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '12px' }}>
            Recent Activity
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activityData?.activity?.slice(0, 2).map((act) => (
              <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <UserAvatar name={act.actor_name} avatar={act.actor_avatar} size={22} />
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 700 }}>{act.description}</span>
                </div>
              </div>
            )) || <div>No recent activity</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
