'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoomSync } from '../../lib/context.jsx';
import { fetchApi } from '../../lib/api.js';
import { UserAvatar } from '../PixelIcons.jsx';
import { Plus, Wallet, Sparkles, X, Check } from 'lucide-react';
import { formatINR, toPaise, calculateSplit, SPLIT_TYPES, EXPENSE_CATEGORIES } from '@roomsync/shared';

export function ExpensesView() {
  const { currentHousehold, currentUser, profiles } = useRoomSync();
  const queryClient = useQueryClient();

  const [activeSubTab, setActiveSubTab] = useState('all'); // 'all' | 'settlements' | 'balances'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleTarget, setSettleTarget] = useState(null);

  // Form State for Add Expense
  const [desc, setDesc] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [category, setCategory] = useState('groceries');
  const [splitType, setSplitType] = useState('equal');
  const [payerId, setPayerId] = useState(currentUser.id);
  const [selectedParticipants, setSelectedParticipants] = useState(profiles.map(p => p.id));
  const [customAmounts, setCustomAmounts] = useState({});

  // Queries
  const { data: expensesData } = useQuery({
    queryKey: ['expenses', currentHousehold.id],
    queryFn: () => fetchApi('/api/expenses', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: balanceData } = useQuery({
    queryKey: ['balances', currentHousehold.id],
    queryFn: () => fetchApi('/api/balances', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  const { data: settlementsData } = useQuery({
    queryKey: ['settlements', currentHousehold.id],
    queryFn: () => fetchApi('/api/settlements', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  // Mutations
  const addExpenseMutation = useMutation({
    mutationFn: (body) => fetchApi('/api/expenses', {
      method: 'POST',
      body,
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowAddModal(false);
      setDesc('');
      setAmountRupees('');
    }
  });

  const recordSettlementMutation = useMutation({
    mutationFn: (body) => fetchApi('/api/settlements', {
      method: 'POST',
      body,
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowSettleModal(false);
      setSettleTarget(null);
    }
  });

  // Calculate stats
  const totalHouseholdPaise = expensesData?.expenses?.reduce((sum, e) => sum + e.amount_paise, 0) || 0;
  const myNet = balanceData?.balances?.[currentUser.id]?.netPaise || 0;
  const youOwePaise = myNet < 0 ? Math.abs(myNet) : 0;
  const othersOweYouPaise = myNet > 0 ? myNet : 0;

  // Split Preview
  const totalPaiseCalc = amountRupees ? toPaise(amountRupees) : 0;
  let splitPreview = [];
  if (totalPaiseCalc > 0 && selectedParticipants.length > 0) {
    try {
      splitPreview = calculateSplit({
        totalPaise: totalPaiseCalc,
        splitType,
        participants: selectedParticipants,
        customAmounts
      });
    } catch {
      splitPreview = [];
    }
  }

  const handleCreateExpense = (e) => {
    e.preventDefault();
    if (!desc || !amountRupees || selectedParticipants.length === 0) return;
    addExpenseMutation.mutate({
      description: desc,
      amount_paise: toPaise(amountRupees),
      category,
      split_type: splitType,
      payer_id: payerId,
      participants: selectedParticipants,
      custom_amounts: customAmounts
    });
  };

  const handleRecordSettlement = (suggestion) => {
    recordSettlementMutation.mutate({
      sender_id: suggestion.fromUserId,
      recipient_id: suggestion.toUserId,
      amount_paise: suggestion.amountPaise,
      notes: 'Settled via RoomSync'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Money, sorted.</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Track, split and settle with ease.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="nb-btn nb-btn-primary">
          <Plus size={18} /> Add Expense
        </button>
      </div>

      {/* Top 3 Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div className="nb-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Total Expenses</div>
            <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px' }}>{formatINR(totalHouseholdPaise)}</div>
          </div>
          <Wallet size={32} color="#30263E" />
        </div>

        <div className="nb-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>You Owe</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#EF4444', marginTop: '2px' }}>{formatINR(youOwePaise)}</div>
          </div>
          <span style={{ fontSize: '28px' }}>👛</span>
        </div>

        <div className="nb-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Others Owe You</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>{formatINR(othersOweYouPaise)}</div>
          </div>
          <span style={{ fontSize: '28px' }}>🪙</span>
        </div>
      </div>

      {/* Main Grid: Tabs & Expenses Table on Left, Settlement Suggestions on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left Column: Tabs & Lists */}
        <div className="nb-card" style={{ padding: '20px' }}>
          {/* Sub tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #30263E', paddingBottom: '12px', marginBottom: '16px' }}>
            {['all', 'settlements', 'balances'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  border: activeSubTab === tab ? '2px solid #30263E' : '2px solid transparent',
                  background: activeSubTab === tab ? 'var(--arcade-lilac)' : 'transparent',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {tab === 'all' ? 'All Expenses' : tab}
              </button>
            ))}
          </div>

          {/* Tab 1: All Expenses */}
          {activeSubTab === 'all' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {expensesData?.expenses?.map((exp) => (
                <div
                  key={exp.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    border: '1.5px solid #30263E',
                    borderRadius: '8px',
                    background: '#FFFFFF'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>
                      {exp.category === 'food' ? '🍕' : exp.category === 'utilities' ? '⚡' : '🛍️'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '15px' }}>{exp.description}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Paid by {exp.payer_name} • Split: {exp.split_type}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '16px' }}>{formatINR(exp.amount_paise)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(exp.expense_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 2: Settlements History */}
          {activeSubTab === 'settlements' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {settlementsData?.settlements?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No recorded settlements yet.</p>
              ) : (
                settlementsData?.settlements?.map((set) => (
                  <div key={set.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', border: '1.5px solid #30263E', borderRadius: '8px', background: '#F5F0FF' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{set.sender_name} → {set.recipient_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{set.notes || 'Recorded Settlement'}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: '#10B981' }}>{formatINR(set.amount_paise)}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Balances Breakdown */}
          {activeSubTab === 'balances' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.values(balanceData?.balances || {}).map((b) => (
                <div key={b.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1.5px solid #30263E', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserAvatar name={b.user_name} avatar={b.avatar_url} size={30} />
                    <span style={{ fontWeight: 800 }}>{b.user_name}</span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: b.netPaise >= 0 ? '#10B981' : '#EF4444' }}>
                    {b.netPaise >= 0 ? `+${formatINR(b.netPaise)}` : formatINR(b.netPaise)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Settlement Suggestions Card */}
        <div className="nb-card" style={{ padding: '20px', background: '#FFF9E6', display: 'flex', flexDirection: 'column', gap: '14px', alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#30263E" />
            <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Settlement Suggestion</h3>
          </div>

          {balanceData?.suggestions?.length === 0 ? (
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              All household balances are completely settled! 🎉
            </div>
          ) : (
            balanceData?.suggestions?.map((sugg, idx) => (
              <div key={idx} style={{ padding: '12px', background: '#FFFFFF', border: '1.5px solid #30263E', borderRadius: '8px' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#30263E', marginBottom: '8px' }}>
                  <strong>{sugg.to_name}</strong> should receive <strong>{formatINR(sugg.amountPaise)}</strong> from <strong>{sugg.from_name}</strong>
                </p>
                <button
                  onClick={() => handleRecordSettlement(sugg)}
                  className="nb-btn nb-btn-primary"
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  Record Settlement
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="nb-card" style={{ width: '460px', padding: '24px', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Add New Expense</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Description</label>
                <input className="nb-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Pizza Night" required />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Amount (₹)</label>
                <input className="nb-input" type="number" step="0.01" value={amountRupees} onChange={(e) => setAmountRupees(e.target.value)} placeholder="1200" required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>Category</label>
                  <select className="nb-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700 }}>Payer</label>
                  <select className="nb-input" value={payerId} onChange={(e) => setPayerId(e.target.value)}>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Split Method</label>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  {['equal', 'custom'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSplitType(mode)}
                      style={{
                        flex: 1,
                        padding: '6px',
                        border: '2px solid #30263E',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '12px',
                        background: splitType === mode ? 'var(--pixel-pink)' : '#FFFFFF',
                        cursor: 'pointer'
                      }}
                    >
                      {mode.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time Split Preview */}
              {splitPreview.length > 0 && (
                <div style={{ padding: '10px', background: 'var(--canvas-bg)', border: '1.5px solid #30263E', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>Split Preview:</div>
                  {splitPreview.map((s) => {
                    const profile = profiles.find(p => p.id === s.userId);
                    return (
                      <div key={s.userId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span>{profile?.full_name || 'Member'}</span>
                        <strong>{formatINR(s.sharePaise)}</strong>
                      </div>
                    );
                  })}
                </div>
              )}

              <button type="submit" className="nb-btn nb-btn-primary" style={{ marginTop: '8px' }}>
                Save Expense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
