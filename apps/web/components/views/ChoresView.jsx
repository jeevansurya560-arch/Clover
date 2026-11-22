'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoomSync } from '../../lib/context.jsx';
import { fetchApi } from '../../lib/api.js';
import { UserAvatar, PixelBroom } from '../PixelIcons.jsx';
import { Plus, Check, ArrowRight, X } from 'lucide-react';

export function ChoresView() {
  const { currentHousehold, currentUser, profiles } = useRoomSync();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'all' | 'rotation'
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [assignedTo, setAssignedTo] = useState(currentUser.id);
  const [recurrence, setRecurrence] = useState('daily');

  // Queries
  const { data: choresData } = useQuery({
    queryKey: ['chores', currentHousehold.id],
    queryFn: () => fetchApi('/api/chores', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  // Mutations
  const addChoreMutation = useMutation({
    mutationFn: (body) => fetchApi('/api/chores', {
      method: 'POST',
      body,
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowAddModal(false);
      setTitle('');
      setDesc('');
    }
  });

  const completeChoreMutation = useMutation({
    mutationFn: (id) => fetchApi(`/api/chores/${id}/complete`, {
      method: 'POST',
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  const chores = choresData?.chores || [];

  const handleAddChore = (e) => {
    e.preventDefault();
    if (!title) return;
    addChoreMutation.mutate({
      title,
      description: desc,
      assigned_to: assignedTo,
      recurrence
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Keeping the place together.</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Shared chores, fair rotation.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="nb-btn nb-btn-primary">
          <Plus size={18} /> Add Chore
        </button>
      </div>

      {/* Grid: Chores List on Left, Weekly Rotation on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left Column: Chores List */}
        <div className="nb-card" style={{ padding: '20px' }}>
          {/* Sub tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #30263E', paddingBottom: '12px', marginBottom: '16px' }}>
            {['today', 'all'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  border: activeTab === tab ? '2px solid #30263E' : '2px solid transparent',
                  background: activeTab === tab ? 'var(--arcade-lilac)' : 'transparent',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {tab === 'today' ? `Today (${chores.length})` : 'All Chores'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chores.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No chores due! Enjoy the clean house.</p>
            ) : (
              chores.map((chore) => (
                <div
                  key={chore.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px',
                    border: '2px solid #30263E',
                    borderRadius: '10px',
                    background: chore.status === 'completed' ? '#F4FBF7' : '#FFFFFF',
                    boxShadow: '2px 2px 0px #30263E'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', border: '2px solid #30263E', background: chore.status === 'completed' ? '#B6F0D2' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {chore.status === 'completed' && <Check size={16} strokeWidth={3} color="#30263E" />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '15px' }}>{chore.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Due Today • {chore.description || 'Routine'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserAvatar name={chore.assigned_name} avatar={chore.assigned_avatar} size={26} />
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>{chore.assigned_name}</span>
                    </div>

                    <button
                      onClick={() => completeChoreMutation.mutate(chore.id)}
                      className="nb-btn nb-btn-mint"
                      style={{ padding: '6px 14px', fontSize: '12px' }}
                    >
                      Complete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Weekly Rotation Card */}
        <div className="nb-card" style={{ padding: '20px', background: '#F5F0FF', display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'start' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Weekly Rotation</h3>

          {/* Linked Avatars with arrows matching mockup */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <UserAvatar name="Aman" avatar="avatar-aman" size={40} />
              <span style={{ fontSize: '11px', fontWeight: 700 }}>Aman</span>
            </div>
            <ArrowRight size={20} color="#30263E" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <UserAvatar name="Riya" avatar="avatar-riya" size={40} />
              <span style={{ fontSize: '11px', fontWeight: 700 }}>Riya</span>
            </div>
            <ArrowRight size={20} color="#30263E" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <UserAvatar name="You" avatar="avatar-you" size={40} />
              <span style={{ fontSize: '11px', fontWeight: 700 }}>You</span>
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: '#FFFFFF', border: '1.5px solid #30263E', borderRadius: '8px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Up Next:</span>
            <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '2px' }}>Riya (Kitchen & Trash)</div>
          </div>
        </div>
      </div>

      {/* Add Chore Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="nb-card" style={{ width: '400px', padding: '24px', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Add New Chore</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddChore} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Title</label>
                <input className="nb-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mop Living Room" required />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Details</label>
                <input className="nb-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Vacuum rugs and wipe glass table" />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Assignee</label>
                <select className="nb-input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Recurrence</label>
                <select className="nb-input" value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="none">One-time</option>
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
