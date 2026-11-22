'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoomSync } from '../../lib/context.jsx';
import { fetchApi } from '../../lib/api.js';
import { UserAvatar } from '../PixelIcons.jsx';
import { Plus, Wifi, Zap, Home, Vote, X } from 'lucide-react';
import { formatINR, toPaise } from '@roomsync/shared';

export function BillsPollsActivityView() {
  const { currentHousehold, currentUser, profiles } = useRoomSync();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'bills' | 'polls' | 'activity'
  const [showPollModal, setShowPollModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);

  // Poll Form
  const [pollQuestion, setPollQuestion] = useState('');
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');

  // Bill Form
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');

  // Queries
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
    queryFn: () => fetchApi('/api/activity', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  // Mutations
  const voteMutation = useMutation({
    mutationFn: ({ pollId, optionId }) => fetchApi(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      body: { optionId },
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  const payBillMutation = useMutation({
    mutationFn: (billId) => fetchApi(`/api/bills/${billId}/pay`, {
      method: 'POST',
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  const createPollMutation = useMutation({
    mutationFn: (body) => fetchApi('/api/polls', {
      method: 'POST',
      body,
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowPollModal(false);
      setPollQuestion('');
      setOpt1('');
      setOpt2('');
    }
  });

  const createBillMutation = useMutation({
    mutationFn: (body) => fetchApi('/api/bills', {
      method: 'POST',
      body,
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowBillModal(false);
      setBillTitle('');
      setBillAmount('');
    }
  });

  const bills = billsData?.bills || [];
  const polls = pollsData?.polls || [];
  const activities = activityData?.activity || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Segmented Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--arcade-lilac)', padding: '4px', borderRadius: '9999px', border: '2px solid #30263E' }}>
          <span style={{ padding: '6px 14px', borderRadius: '9999px', background: '#FFFFFF', fontWeight: 800, fontSize: '13px' }}>
            Bills • Polls • Activity
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowBillModal(true)} className="nb-btn nb-btn-lilac">
            <Plus size={16} /> Add Bill
          </button>
          <button onClick={() => setShowPollModal(true)} className="nb-btn nb-btn-primary">
            <Plus size={16} /> Create Poll
          </button>
        </div>
      </div>

      {/* 3 Column Layout matching Mockup Screen 5 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '18px' }}>
        {/* Column 1: Upcoming Bills */}
        <div className="nb-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Upcoming Bills</h3>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>View All →</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {bills.map((bill) => (
              <div key={bill.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1.5px solid #30263E', borderRadius: '8px', background: '#FFFFFF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {bill.title.toLowerCase().includes('internet') ? <Wifi size={20} /> : bill.title.toLowerCase().includes('electricity') ? <Zap size={20} color="#EAB308" /> : <Home size={20} />}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '14px' }}>{bill.title}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{formatINR(bill.amount_paise)}</div>
                  </div>
                </div>

                {bill.status === 'paid' ? (
                  <span className="nb-badge" style={{ background: '#B6F0D2' }}>Paid</span>
                ) : (
                  <button
                    onClick={() => payBillMutation.mutate(bill.id)}
                    className="nb-btn nb-btn-mint"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    Pay
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Active Poll */}
        <div className="nb-card" style={{ padding: '20px', background: '#F5F0FF', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="nb-badge" style={{ background: '#FFE88A' }}>Active Poll</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>2 days left</span>
          </div>

          {polls.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No active polls right now.</p>
          ) : (
            polls.map((poll) => (
              <div key={poll.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800 }}>{poll.question}</h3>

                {poll.options.map((opt) => {
                  const pct = poll.totalVotes > 0 ? Math.round((opt.votes_count / poll.totalVotes) * 100) : 0;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => voteMutation.mutate({ pollId: poll.id, optionId: opt.id })}
                      style={{
                        padding: '10px 14px',
                        border: '2px solid #30263E',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          bottom: 0,
                          width: `${pct}%`,
                          background: 'var(--pixel-mint)',
                          opacity: 0.6,
                          zIndex: 0
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1, fontWeight: 700, fontSize: '14px' }}>
                        <span>{opt.text}</span>
                        <span>{pct}% ({opt.votes_count})</span>
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{poll.totalVotes} votes</span>
                  <button className="nb-btn nb-btn-primary" style={{ padding: '4px 14px', fontSize: '12px' }}>
                    Vote
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Column 3: Recent Activity */}
        <div className="nb-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Recent Activity</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activities.slice(0, 5).map((act) => (
              <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12px' }}>
                <UserAvatar name={act.actor_name} avatar={act.actor_avatar} size={24} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{act.description}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Poll Modal */}
      {showPollModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="nb-card" style={{ width: '400px', padding: '24px', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Create Household Poll</h2>
              <button onClick={() => setShowPollModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!pollQuestion || !opt1 || !opt2) return;
                createPollMutation.mutate({
                  question: pollQuestion,
                  options: [opt1, opt2]
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Question</label>
                <input className="nb-input" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="e.g. Which WiFi plan should we pick?" required />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Option 1</label>
                <input className="nb-input" value={opt1} onChange={(e) => setOpt1(e.target.value)} placeholder="Option 1" required />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Option 2</label>
                <input className="nb-input" value={opt2} onChange={(e) => setOpt2(e.target.value)} placeholder="Option 2" required />
              </div>
              <button type="submit" className="nb-btn nb-btn-primary" style={{ marginTop: '8px' }}>
                Launch Poll
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Bill Modal */}
      {showBillModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="nb-card" style={{ width: '400px', padding: '24px', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Add Upcoming Bill</h2>
              <button onClick={() => setShowBillModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!billTitle || !billAmount) return;
                createBillMutation.mutate({
                  title: billTitle,
                  amount_paise: toPaise(billAmount),
                  due_date: new Date(Date.now() + 7 * 86400000).toISOString()
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Bill Title</label>
                <input className="nb-input" value={billTitle} onChange={(e) => setBillTitle(e.target.value)} placeholder="e.g. Water Bill, Netflix" required />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Amount (₹)</label>
                <input className="nb-input" type="number" step="0.01" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} placeholder="e.g. 800" required />
              </div>
              <button type="submit" className="nb-btn nb-btn-primary" style={{ marginTop: '8px' }}>
                Add Bill
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
