'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoomSync } from '../../lib/context.jsx';
import { fetchApi } from '../../lib/api.js';
import {
  PixelClover,
  PixelHouse,
  PixelCat,
  PixelCoins,
  PixelBroom,
  PixelBasket,
  PixelTrophy,
  PixelSparkle,
  PixelHeart,
  UserAvatar
} from '../PixelIcons.jsx';
import {
  Plus,
  ArrowRight,
  Bell,
  Wifi,
  Zap,
  Check,
  X,
  Vote,
  Sparkles,
  ShoppingBag,
  Receipt,
  RotateCcw
} from 'lucide-react';
import { formatINR, toPaise, calculateSplit, SPLIT_TYPES } from '@roomsync/shared';

export function MasterBoardView() {
  const { currentHousehold, currentUser, profiles, switchUser, syncStatus, lastSyncTime } = useRoomSync();
  const queryClient = useQueryClient();

  // Modals state
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showRecordSettlement, setShowRecordSettlement] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddChore, setShowAddChore] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  // Filter states
  const [expenseFilter, setExpenseFilter] = useState('all'); // all, settlements, balances
  const [shoppingTab, setShoppingTab] = useState('to_buy'); // to_buy, purchased
  const [choreFilter, setChoreFilter] = useState('today'); // today, week, all, rotation
  const [votedOption, setVotedOption] = useState(null);

  // Forms
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPayer, setExpPayer] = useState(currentUser.id);
  const [settlePayer, setSettlePayer] = useState('00000000-0000-0000-0000-000000000001'); // Aman
  const [settleRecipient, setSettleRecipient] = useState('00000000-0000-0000-0000-000000000002'); // Riya
  const [settleAmount, setSettleAmount] = useState('620');
  const [shoppingItemName, setShoppingItemName] = useState('');
  const [shoppingQty, setShoppingQty] = useState('1');
  const [choreTitle, setChoreTitle] = useState('');
  const [choreAssignee, setChoreAssignee] = useState(currentUser.id);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');

  // Queries
  const { data: balanceData } = useQuery({
    queryKey: ['balances', currentHousehold.id],
    queryFn: () => fetchApi('/api/balances', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: expensesData } = useQuery({
    queryKey: ['expenses', currentHousehold.id],
    queryFn: () => fetchApi('/api/expenses', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: settlementsData } = useQuery({
    queryKey: ['settlements', currentHousehold.id],
    queryFn: () => fetchApi('/api/settlements', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: shoppingData } = useQuery({
    queryKey: ['shopping', currentHousehold.id],
    queryFn: () => fetchApi('/api/shopping', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: choresData } = useQuery({
    queryKey: ['chores', currentHousehold.id],
    queryFn: () => fetchApi('/api/chores', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: billsData } = useQuery({
    queryKey: ['bills', currentHousehold.id],
    queryFn: () => fetchApi('/api/bills', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: pollsData } = useQuery({
    queryKey: ['polls', currentHousehold.id],
    queryFn: () => fetchApi('/api/polls', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: activityData } = useQuery({
    queryKey: ['activity', currentHousehold.id],
    queryFn: () => fetchApi('/api/activity?limit=6', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  // Mutations
  const addExpenseMutation = useMutation({
    mutationFn: (body) => fetchApi('/api/expenses', { method: 'POST', body, householdId: currentHousehold.id, userId: currentUser.id }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowAddExpense(false);
      setExpDesc('');
      setExpAmount('');
    }
  });

  const recordSettlementMutation = useMutation({
    mutationFn: (body) => fetchApi('/api/settlements', { method: 'POST', body, householdId: currentHousehold.id, userId: currentUser.id }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowRecordSettlement(false);
    }
  });

  const addShoppingMutation = useMutation({
    mutationFn: (body) => fetchApi('/api/shopping', { method: 'POST', body, householdId: currentHousehold.id, userId: currentUser.id }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowAddItem(false);
      setShoppingItemName('');
      setShoppingQty('1');
    }
  });

  const toggleShoppingStatus = useMutation({
    mutationFn: ({ id, status }) => fetchApi(`/api/shopping/${id}`, { method: 'PATCH', body: { status }, householdId: currentHousehold.id, userId: currentUser.id }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  const completeChoreMutation = useMutation({
    mutationFn: (id) => fetchApi(`/api/chores/${id}/complete`, { method: 'POST', householdId: currentHousehold.id, userId: currentUser.id }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  const addChoreMutation = useMutation({
    mutationFn: (body) => fetchApi('/api/chores', { method: 'POST', body, householdId: currentHousehold.id, userId: currentUser.id }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowAddChore(false);
      setChoreTitle('');
    }
  });

  const voteMutation = useMutation({
    mutationFn: ({ pollId, optionId }) => fetchApi(`/api/polls/${pollId}/vote`, { method: 'POST', body: { optionId }, householdId: currentHousehold.id, userId: currentUser.id }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  const myNet = balanceData?.balances?.[currentUser.id]?.netPaise || 0;
  const owes = myNet < 0;
  const isOwed = myNet > 0;

  const allShopping = shoppingData?.items || [];
  const toBuyItems = allShopping.filter(i => i.status === 'pending');
  const purchasedItems = allShopping.filter(i => i.status === 'purchased');
  const displayedShopping = shoppingTab === 'to_buy' ? toBuyItems : purchasedItems;

  const allChores = choresData?.chores || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '40px' }}>
      
      {/* ========================================================
          MASTER TOP BANNER (Clover Title & Subtitle)
         ======================================================== */}
      <header
        className="nb-glass"
        style={{
          borderRadius: '16px',
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--shadow-hard-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <PixelClover size={34} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '28px', fontWeight: 800, color: '#30263E', letterSpacing: '-0.03em' }}>
              Clover 🍀
            </span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
              One household. One shared workspace. Everything synchronized.
            </span>
          </div>
        </div>

        {/* Live Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--surface-card)',
            border: '2px solid #30263E',
            padding: '6px 14px',
            borderRadius: '9999px',
            boxShadow: '2px 2px 0px #30263E',
            fontSize: '12px',
            fontWeight: 800,
            color: '#30263E'
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
          Live · Collaborate · Organize
        </div>
      </header>

      {/* ========================================================
          SECTION 1: DASHBOARD
         ======================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="nb-view-tag">
            🏠 1. Dashboard
          </span>
        </div>

        {/* Good morning banner with sleeping pixel cat */}
        <div
          className="nb-glass-card"
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
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#30263E', marginBottom: '4px' }}>
              Good morning, roommates!
            </h1>
            <p style={{ fontSize: '15px', color: '#30263E', fontWeight: 600 }}>
              Your household, in sync.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <PixelCat width={84} height={48} />

            {/* Sync Status Badge with Profile Switcher */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(8px)',
                padding: '6px 14px',
                borderRadius: '9999px',
                border: '2px solid #30263E',
                boxShadow: '2px 2px 0px #30263E'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#30263E' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                {syncStatus} · {lastSyncTime}
              </span>
              <Bell size={16} strokeWidth={2.5} color="#30263E" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserAvatar name={currentUser.full_name} avatar={currentUser.avatar_url} size={28} />
                <select
                  value={currentUser.id}
                  onChange={(e) => switchUser(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: '#30263E',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  title="Switch Active Roommate"
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.id === currentUser.id ? 'You' : 'Roommate'})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Rule of 3: Core Dashboard Metrics Grid */}
        <div className="rule-of-three">
          {/* 1. Household Balance */}
          <div className="nb-glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Household Balance</span>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#30263E', margin: '4px 0' }}>
                  ₹2,480
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: owes ? '#EF4444' : '#10B981' }}>
                  {owes ? `You owe ${formatINR(Math.abs(myNet))}` : isOwed ? `You are owed ${formatINR(myNet)}` : 'You are all settled up'}
                </div>
              </div>
              <PixelCoins size={44} />
            </div>
            <button
              onClick={() => setShowRecordSettlement(true)}
              className="nb-btn nb-btn-primary"
              style={{ marginTop: '16px', width: 'fit-content', padding: '6px 14px', fontSize: '13px' }}
            >
              Settle Up <ArrowRight size={14} />
            </button>
          </div>

          {/* 2. Monthly Spending with Mini Bar Chart */}
          <div className="nb-glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Monthly Spending</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#30263E' }}>₹12,450</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#10B981', background: '#E6FDF0', padding: '2px 6px', borderRadius: '4px', border: '1px solid #10B981' }}>
                  ↑ 12%
                </span>
              </div>
            </div>
            {/* Visual mini bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '48px', paddingTop: '10px' }}>
              {[35, 45, 30, 60, 80, 50, 95].map((h, idx) => (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    height: `${h}%`,
                    background: idx === 6 ? 'var(--pixel-mint)' : 'var(--arcade-lilac)',
                    border: '1.5px solid #30263E',
                    borderRadius: '3px 3px 0 0'
                  }}
                  title={`Day ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* 3. Upcoming Bills */}
          <div className="nb-glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>Upcoming Bills</span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#30263E', cursor: 'pointer', textDecoration: 'underline' }}>
                View All →
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--surface-muted)', borderRadius: '8px', border: '1.5px solid #30263E' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wifi size={16} color="#30263E" />
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Internet</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>₹899 <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· Apr 25</span></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--surface-muted)', borderRadius: '8px', border: '1.5px solid #30263E' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={16} color="#30263E" />
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Electricity</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 800 }}>₹1,200 <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· Apr 28</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Rule of 3: Secondary Action Row (Chores, Shopping, Activity) */}
        <div className="rule-of-three">
          {/* Today's Chores */}
          <div className="nb-glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Today's Chores</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <Check size={16} color="#10B981" strokeWidth={3} />
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#30263E' }}>Clean Kitchen</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>by 8 PM</span>
              </div>
            </div>
            <PixelBroom size={36} />
          </div>

          {/* Shopping List */}
          <div className="nb-glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Shopping List</span>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#30263E', marginTop: '4px' }}>
                Milk, Bread, Eggs <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--pixel-pink)' }}>+2 more</span>
              </div>
            </div>
            <ShoppingBag size={28} color="#30263E" />
          </div>

          {/* Recent Activity */}
          <div className="nb-glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Recent Activity</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserAvatar name="Riya" avatar="avatar-riya" size={20} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#30263E' }}>
                Riya added ₹1,200 expense <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>2m ago</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 2: EXPENSES & SETTLEMENTS
         ======================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="nb-view-tag" style={{ background: 'var(--pixel-pink)' }}>
              💸 2. Expenses & Settlements
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#30263E' }}>
              Money, sorted.
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Track, split and settle with ease.</span>
          </div>

          <button onClick={() => setShowAddExpense(true)} className="nb-btn nb-btn-primary">
            <Plus size={16} /> Add Expense
          </button>
        </div>

        {/* Rule of 3: Financial Summary Stat Cards */}
        <div className="rule-of-three">
          <div className="nb-glass-card" style={{ padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Total Expenses</span>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#30263E' }}>₹24,860</div>
            </div>
            <div style={{ padding: '8px', background: 'var(--arcade-lilac)', border: '1.5px solid #30263E', borderRadius: '10px' }}>
              <Receipt size={24} color="#30263E" />
            </div>
          </div>

          <div className="nb-glass-card" style={{ padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>You Owe</span>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#EF4444' }}>₹620</div>
            </div>
            <div style={{ padding: '8px', background: 'var(--soft-glitch)', border: '1.5px solid #30263E', borderRadius: '10px' }}>
              <ShoppingBag size={24} color="#30263E" />
            </div>
          </div>

          <div className="nb-glass-card" style={{ padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Others Owe You</span>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#10B981' }}>₹890</div>
            </div>
            <PixelCoins size={36} />
          </div>
        </div>

        {/* Split Grid: Expenses Table on Left (2fr), Settlement Suggestion on Right (1fr) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '18px' }}>
          {/* Left Table / Transaction List */}
          <div className="nb-glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['all', 'settlements', 'balances'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setExpenseFilter(tab)}
                    className="nb-btn"
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      background: expenseFilter === tab ? 'var(--arcade-lilac)' : 'transparent',
                      borderColor: expenseFilter === tab ? '#30263E' : 'transparent',
                      boxShadow: expenseFilter === tab ? 'var(--shadow-hard-sm)' : 'none'
                    }}
                  >
                    {tab === 'all' ? 'All Expenses' : tab === 'settlements' ? 'Settlements' : 'Balances'}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}>
                This Month ▾
              </span>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { desc: 'Pizza Night', amount: '₹1,200', paidBy: 'Aman', split: 'Equal', date: 'Apr 20', icon: '🍕' },
                { desc: 'Groceries', amount: '₹850', paidBy: 'Riya', split: 'Equal', date: 'Apr 18', icon: '🧺' },
                { desc: 'Electricity Bill', amount: '₹1,200', paidBy: 'Alex', split: 'Equal', date: 'Apr 15', icon: '⚡' }
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--canvas-bg)',
                    border: '1.5px solid #30263E',
                    borderRadius: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#30263E' }}>{item.desc}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.split} Split · {item.date}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: '#30263E' }}>{item.amount}</span>
                    <UserAvatar name={item.paidBy} avatar={`avatar-${item.paidBy.toLowerCase()}`} size={24} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Settlement Suggestion Card */}
          <div
            className="nb-glass-card"
            style={{
              padding: '20px',
              background: 'linear-gradient(145deg, #F5F0FF 0%, #C5B2FF 100%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#30263E' }}>Settlement Suggestion</span>
                <PixelSparkle size={16} />
              </div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#30263E', lineHeight: '1.4', margin: '10px 0' }}>
                Riya should receive <strong style={{ color: '#30263E', textDecoration: 'underline' }}>₹620</strong> from Aman
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Greedy debt simplification: 1 direct peer transaction clears all pending household balances.
              </p>
            </div>

            <button
              onClick={() => setShowRecordSettlement(true)}
              className="nb-btn nb-btn-primary"
              style={{ width: '100%', marginTop: '16px' }}
            >
              Record Settlement
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 3: SHARED SHOPPING
         ======================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="nb-view-tag" style={{ background: 'var(--arcade-lilac)' }}>
              🛒 3. Shared Shopping
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#30263E' }}>
              The apartment shopping list
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Buy together, live better.</span>
          </div>

          <button onClick={() => setShowAddItem(true)} className="nb-btn nb-btn-primary">
            <Plus size={16} /> Add Item
          </button>
        </div>

        {/* 2-Column Layout: Table (2.2fr) + Pixel Basket Illustration (1fr) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '18px' }}>
          {/* Table Container */}
          <div className="nb-glass-card" style={{ padding: '20px' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <button
                onClick={() => setShoppingTab('to_buy')}
                className="nb-btn"
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  background: shoppingTab === 'to_buy' ? 'var(--pixel-pink)' : 'transparent',
                  borderColor: shoppingTab === 'to_buy' ? '#30263E' : 'transparent',
                  boxShadow: shoppingTab === 'to_buy' ? 'var(--shadow-hard-sm)' : 'none'
                }}
              >
                To Buy ({toBuyItems.length || 4})
              </button>
              <button
                onClick={() => setShoppingTab('purchased')}
                className="nb-btn"
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  background: shoppingTab === 'purchased' ? 'var(--pixel-mint)' : 'transparent',
                  borderColor: shoppingTab === 'purchased' ? '#30263E' : 'transparent',
                  boxShadow: shoppingTab === 'purchased' ? 'var(--shadow-hard-sm)' : 'none'
                }}
              >
                Purchased ({purchasedItems.length || 2})
              </button>
            </div>

            {/* Structured Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #30263E', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 10px' }}>Item</th>
                  <th style={{ padding: '8px 10px' }}>Qty</th>
                  <th style={{ padding: '8px 10px' }}>Assigned</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Milk', qty: '2 packs', assigned: 'Aman', status: 'Pending' },
                  { name: 'Bread', qty: '1 loaf', assigned: 'Riya', status: 'Pending' },
                  { name: 'Eggs', qty: '12 pcs', assigned: 'You', status: 'Pending' },
                  { name: 'Vegetables', qty: '1 kg', assigned: 'Aman', status: 'Pending' }
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--surface-muted)' }}>
                    <td style={{ padding: '10px', fontWeight: 800, color: '#30263E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '12px', height: '12px', border: '2px solid #30263E', borderRadius: '3px', display: 'inline-block' }} />
                      {row.name}
                    </td>
                    <td style={{ padding: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>{row.qty}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <UserAvatar name={row.assigned} avatar={`avatar-${row.assigned.toLowerCase()}`} size={20} />
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>{row.assigned}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span className="nb-badge" style={{ background: row.status === 'Pending' ? 'var(--soft-glitch)' : 'var(--pixel-mint)' }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: Illustration Basket */}
          <div
            className="nb-glass-card"
            style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #FFF9E6 0%, #E6FDF0 100%)'
            }}
          >
            <PixelBasket size={80} />
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, margin: '14px 0 4px', color: '#30263E' }}>
              Let's shop!
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Mark items bought to auto-split their expense.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 4: CHORES & HOUSEHOLD ROUTINE
         ======================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="nb-view-tag" style={{ background: 'var(--pixel-mint)' }}>
              🧹 4. Chores & Routine
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#30263E' }}>
              Keeping the place together.
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Shared chores, fair rotation.</span>
          </div>

          <button onClick={() => setShowAddChore(true)} className="nb-btn nb-btn-primary">
            <Plus size={16} /> Add Chore
          </button>
        </div>

        {/* 2-Column Layout: Left Chore Cards (2fr) + Right Weekly Rotation (1fr) */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '18px' }}>
          {/* Left Chores */}
          <div className="nb-glass-card" style={{ padding: '20px' }}>
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[
                { id: 'today', label: 'Today (2)' },
                { id: 'week', label: 'This Week (5)' },
                { id: 'all', label: 'All Chores' },
                { id: 'rotation', label: 'Rotation' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setChoreFilter(f.id)}
                  className="nb-btn"
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    background: choreFilter === f.id ? 'var(--pixel-mint)' : 'transparent',
                    borderColor: choreFilter === f.id ? '#30263E' : 'transparent',
                    boxShadow: choreFilter === f.id ? 'var(--shadow-hard-sm)' : 'none'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Chore list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { title: 'Clean Kitchen', due: 'Due Today · 8 PM', assigned: 'Riya' },
                { title: 'Take Out Garbage', due: 'Due Today · 9 PM', assigned: 'Aman' }
              ].map((c, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'var(--canvas-bg)',
                    border: '1.5px solid #30263E',
                    borderRadius: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'var(--pixel-mint)', border: '2px solid #30263E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#30263E" strokeWidth={3} />
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#30263E' }}>{c.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.due}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserAvatar name={c.assigned} avatar={`avatar-${c.assigned.toLowerCase()}`} size={24} />
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>{c.assigned}</span>
                    </div>
                    <button
                      className="nb-btn"
                      style={{ padding: '5px 10px', fontSize: '12px', background: 'var(--surface-card)' }}
                    >
                      Complete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Weekly Rotation Card */}
          <div
            className="nb-glass-card"
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #F5F0FF 0%, #FFE88A 100%)'
            }}
          >
            <div>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#30263E' }}>Weekly Rotation</span>
              
              {/* Connected Avatar Stepper */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', margin: '20px 0' }}>
                <UserAvatar name="Aman" avatar="avatar-aman" size={32} />
                <ArrowRight size={16} strokeWidth={2.5} color="#30263E" />
                <UserAvatar name="Riya" avatar="avatar-riya" size={36} />
                <ArrowRight size={16} strokeWidth={2.5} color="#30263E" />
                <UserAvatar name="You" avatar="avatar-you" size={32} />
              </div>

              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.85)', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #30263E' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Next in line: </span>
                <strong style={{ fontSize: '13px', color: '#30263E' }}>Riya (Mon, Apr 21)</strong>
              </div>
            </div>

            <button className="nb-btn" style={{ width: '100%', marginTop: '16px', background: 'var(--surface-card)' }}>
              <RotateCcw size={14} /> Rotate Now
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          SECTION 5: BILLS, POLLS & ACTIVITY (Rule of 3 Columns)
         ======================================================== */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="nb-view-tag" style={{ background: 'var(--dream-sky)' }}>
              📅 5. Bills, Polls & Activity
            </span>
            <div style={{ display: 'flex', gap: '6px', fontSize: '15px', fontWeight: 800 }}>
              <span>Bills</span> · <span>Polls</span> · <span>Activity</span>
            </div>
          </div>

          <button onClick={() => setShowCreatePoll(true)} className="nb-btn nb-btn-primary">
            <Plus size={16} /> Create Poll
          </button>
        </div>

        {/* Rule of 3: Triadic Columns (Bills, Polls, Activity) */}
        <div className="rule-of-three">
          {/* Column 1: Upcoming Bills */}
          <div className="nb-glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#30263E' }}>Upcoming Bills</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}>View All →</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { title: 'Internet', cost: '₹899', date: 'Apr 25', tag: 'Upcoming', color: 'var(--soft-glitch)' },
                { title: 'Electricity', cost: '₹1,200', date: 'Apr 28', tag: 'Upcoming', color: 'var(--soft-glitch)' },
                { title: 'Rent', cost: '₹9,000', date: 'May 1', tag: 'Important', color: 'var(--pixel-pink)' }
              ].map((b, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'var(--canvas-bg)',
                    border: '1.5px solid #30263E',
                    borderRadius: '8px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800 }}>{b.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{b.cost} · {b.date}</div>
                  </div>
                  <span className="nb-badge" style={{ background: b.color }}>
                    {b.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Active Poll */}
          <div className="nb-glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="nb-badge" style={{ background: 'var(--pixel-pink)' }}>Active Poll</span>
                <PixelSparkle size={16} />
              </div>

              <h4 style={{ fontSize: '15px', fontWeight: 800, color: '#30263E', margin: '6px 0 14px' }}>
                What should we buy next?
              </h4>

              {/* Vote options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  onClick={() => setVotedOption('sofa')}
                  style={{
                    padding: '8px 12px',
                    background: votedOption === 'sofa' ? 'var(--pixel-mint)' : 'var(--canvas-bg)',
                    border: '1.5px solid #30263E',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800 }}>
                    <span>New Sofa</span>
                    <span>60%</span>
                  </div>
                  <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '60%', height: '100%', background: 'var(--pixel-mint)' }} />
                  </div>
                </div>

                <div
                  onClick={() => setVotedOption('chair')}
                  style={{
                    padding: '8px 12px',
                    background: votedOption === 'chair' ? 'var(--pixel-mint)' : 'var(--canvas-bg)',
                    border: '1.5px solid #30263E',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800 }}>
                    <span>Gaming Chair</span>
                    <span>40%</span>
                  </div>
                  <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '40%', height: '100%', background: 'var(--arcade-lilac)' }} />
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                2 days left · 3 votes recorded
              </div>
            </div>

            <button
              onClick={() => alert('Vote recorded!')}
              className="nb-btn nb-btn-primary"
              style={{ width: '100%', marginTop: '14px' }}
            >
              <Vote size={14} /> Vote
            </button>
          </div>

          {/* Column 3: Recent Activity Stream */}
          <div className="nb-glass-card" style={{ padding: '20px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#30263E', display: 'block', marginBottom: '12px' }}>
              Recent Activity
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { actor: 'Riya', action: 'added a shopping item', time: '2m ago' },
                { actor: 'Aman', action: 'completed a chore', time: '5m ago' },
                { actor: 'You', action: 'recorded a settlement', time: '10m ago' }
              ].map((act, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                  <UserAvatar name={act.actor} avatar={`avatar-${act.actor.toLowerCase()}`} size={26} />
                  <div>
                    <div><strong>{act.actor}</strong> {act.action}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{act.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          DESIGN SYSTEM LEGEND FOOTER (from design reference)
         ======================================================== */}
      <footer
        className="nb-glass-card"
        style={{
          padding: '20px 24px',
          background: 'var(--surface-card)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}
      >
        {/* Left: Design System Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>⭐</span>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 800 }}>
              Design System
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Dreamhouse Arcade
            </div>
          </div>
        </div>

        {/* Color Palette Chips */}
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            Color Palette
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { color: '#F5F0FF', name: 'Cloud Lavender' },
              { color: '#30263E', name: 'Ink Plum' },
              { color: '#FF9FBF', name: 'Pixel Pink' },
              { color: '#C5B2FF', name: 'Arcade Lilac' },
              { color: '#B6F0D2', name: 'Pixel Mint' },
              { color: '#FFE88A', name: 'Soft Glitch' },
              { color: '#A9E4F2', name: 'Dream Sky' },
              { color: '#F3C5A7', name: 'Apricot' }
            ].map(swatch => (
              <div
                key={swatch.color}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: swatch.color,
                  border: '1.5px solid #30263E',
                  boxShadow: '1px 1px 0px #30263E'
                }}
                title={`${swatch.name} (${swatch.color})`}
              />
            ))}
          </div>
        </div>

        {/* Typography Chips */}
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            Typography
          </span>
          <div style={{ display: 'flex', gap: '10px', fontSize: '12px', fontWeight: 700 }}>
            <span><strong>Aa</strong> Space Grotesk</span>
            <span><strong>Aa</strong> Manrope</span>
            <span className="font-pixel">Aa Silkscreen</span>
          </div>
        </div>

        {/* Pixel Component Icons */}
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
            Components
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <PixelHouse size={20} />
            <PixelBasket size={20} />
            <PixelBroom size={20} />
            <PixelCoins size={20} />
            <PixelTrophy size={20} />
          </div>
        </div>

        {/* Warm Mascot Motto */}
        <div
          style={{
            background: 'var(--pixel-pink)',
            border: '2px solid #30263E',
            padding: '6px 14px',
            borderRadius: '10px',
            boxShadow: '2px 2px 0px #30263E',
            fontSize: '12px',
            fontWeight: 800,
            color: '#30263E'
          }}
        >
          A more organized home, together. 🐱💖
        </div>
      </footer>

      {/* ========================================================
          INTERACTIVE MODAL: ADD EXPENSE (With Blur Backdrop)
         ======================================================== */}
      {showAddExpense && (
        <div className="nb-modal-backdrop" onClick={() => setShowAddExpense(false)}>
          <div className="nb-card nb-modal-content" style={{ width: '100%', maxWidth: '440px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>+ Add Expense</h3>
              <button onClick={() => setShowAddExpense(false)} className="nb-btn" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!expDesc || !expAmount) return;
                addExpenseMutation.mutate({
                  description: expDesc,
                  amount_paise: toPaise(expAmount),
                  payer_id: expPayer,
                  category: 'groceries',
                  split_type: 'equal',
                  participants: profiles.map(p => p.id)
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Description</label>
                <input
                  type="text"
                  className="nb-input"
                  placeholder="e.g. Pizza Night, Groceries"
                  value={expDesc}
                  onChange={e => setExpDesc(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Amount (₹ Rupees)</label>
                <input
                  type="number"
                  step="0.01"
                  className="nb-input"
                  placeholder="e.g. 1200"
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Paid By</label>
                <select className="nb-input" value={expPayer} onChange={e => setExpPayer(e.target.value)}>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="nb-btn nb-btn-primary" style={{ marginTop: '8px' }}>
                Save & Split Equally
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          INTERACTIVE MODAL: RECORD SETTLEMENT (With Blur Backdrop)
         ======================================================== */}
      {showRecordSettlement && (
        <div className="nb-modal-backdrop" onClick={() => setShowRecordSettlement(false)}>
          <div className="nb-card nb-modal-content" style={{ width: '100%', maxWidth: '440px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>Record Settlement</h3>
              <button onClick={() => setShowRecordSettlement(false)} className="nb-btn" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordSettlementMutation.mutate({
                  sender_id: settlePayer,
                  recipient_id: settleRecipient,
                  amount_paise: toPaise(settleAmount),
                  notes: 'Peer repayment via UPI/Cash'
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Who Paid?</label>
                <select className="nb-input" value={settlePayer} onChange={e => setSettlePayer(e.target.value)}>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>To Whom?</label>
                <select className="nb-input" value={settleRecipient} onChange={e => setSettleRecipient(e.target.value)}>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Amount (₹ Rupees)</label>
                <input
                  type="number"
                  className="nb-input"
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  required
                />
              </div>

              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ℹ️ Note: This records an agreed peer ledger settlement (e.g. UPI or cash) to update household balances.
              </p>

              <button type="submit" className="nb-btn nb-btn-mint" style={{ marginTop: '4px' }}>
                Confirm Settlement
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          INTERACTIVE MODAL: ADD SHOPPING ITEM
         ======================================================== */}
      {showAddItem && (
        <div className="nb-modal-backdrop" onClick={() => setShowAddItem(false)}>
          <div className="nb-card nb-modal-content" style={{ width: '100%', maxWidth: '400px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>+ Add Shopping Item</h3>
              <button onClick={() => setShowAddItem(false)} className="nb-btn" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!shoppingItemName) return;
                addShoppingMutation.mutate({
                  item_name: shoppingItemName,
                  quantity: shoppingQty,
                  category: 'groceries'
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Item Name</label>
                <input
                  type="text"
                  className="nb-input"
                  placeholder="e.g. Oat Milk, Coffee beans"
                  value={shoppingItemName}
                  onChange={e => setShoppingItemName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Quantity</label>
                <input
                  type="text"
                  className="nb-input"
                  placeholder="e.g. 2 cartons"
                  value={shoppingQty}
                  onChange={e => setShoppingQty(e.target.value)}
                />
              </div>

              <button type="submit" className="nb-btn nb-btn-primary" style={{ marginTop: '8px' }}>
                Add to List
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          INTERACTIVE MODAL: ADD CHORE
         ======================================================== */}
      {showAddChore && (
        <div className="nb-modal-backdrop" onClick={() => setShowAddChore(false)}>
          <div className="nb-card nb-modal-content" style={{ width: '100%', maxWidth: '400px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>+ Add Chore</h3>
              <button onClick={() => setShowAddChore(false)} className="nb-btn" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!choreTitle) return;
                addChoreMutation.mutate({
                  title: choreTitle,
                  assigned_to: choreAssignee,
                  recurrence: 'daily'
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Chore Title</label>
                <input
                  type="text"
                  className="nb-input"
                  placeholder="e.g. Water plants, Vacuum hallway"
                  value={choreTitle}
                  onChange={e => setChoreTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Assignee</label>
                <select className="nb-input" value={choreAssignee} onChange={e => setChoreAssignee(e.target.value)}>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="nb-btn nb-btn-primary" style={{ marginTop: '8px' }}>
                Create Chore
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
