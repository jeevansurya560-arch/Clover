'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoomSync } from '../../lib/context.jsx';
import { fetchApi } from '../../lib/api.js';
import { PixelBasket, UserAvatar } from '../PixelIcons.jsx';
import { Plus, Check, ShoppingBag, X } from 'lucide-react';
import { toPaise } from '@roomsync/shared';

export function ShoppingView() {
  const { currentHousehold, currentUser, profiles } = useRoomSync();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'purchased'
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedItemForExpense, setSelectedItemForExpense] = useState(null);

  // Form states
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [assignedTo, setAssignedTo] = useState('');
  const [expenseRupees, setExpenseRupees] = useState('');

  // Queries
  const { data: shoppingData } = useQuery({
    queryKey: ['shopping', currentHousehold.id],
    queryFn: () => fetchApi('/api/shopping', { householdId: currentHousehold.id, userId: currentUser.id })
  });

  // Mutations
  const addItemMutation = useMutation({
    mutationFn: (body) => fetchApi('/api/shopping', {
      method: 'POST',
      body,
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowAddModal(false);
      setItemName('');
      setQuantity('1');
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }) => fetchApi(`/api/shopping/${id}`, {
      method: 'PATCH',
      body: { status },
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  const convertToExpenseMutation = useMutation({
    mutationFn: ({ id, amount_paise }) => fetchApi(`/api/shopping/${id}/convert-to-expense`, {
      method: 'POST',
      body: {
        amount_paise,
        participants: profiles.map(p => p.id)
      },
      householdId: currentHousehold.id,
      userId: currentUser.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowConvertModal(false);
      setSelectedItemForExpense(null);
      setExpenseRupees('');
    }
  });

  const allItems = shoppingData?.items || [];
  const pendingItems = allItems.filter(i => i.status === 'pending');
  const purchasedItems = allItems.filter(i => i.status === 'purchased');
  const displayedItems = activeTab === 'pending' ? pendingItems : purchasedItems;

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!itemName) return;
    addItemMutation.mutate({
      item_name: itemName,
      quantity,
      assigned_to: assignedTo || null
    });
  };

  const handleConvert = (e) => {
    e.preventDefault();
    if (!selectedItemForExpense || !expenseRupees) return;
    convertToExpenseMutation.mutate({
      id: selectedItemForExpense.id,
      amount_paise: toPaise(expenseRupees)
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800 }}>The apartment shopping list</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Buy together, live better.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="nb-btn nb-btn-primary">
          <Plus size={18} /> Add Item
        </button>
      </div>

      {/* Main Container */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left Column: Items Table */}
        <div className="nb-card" style={{ padding: '20px' }}>
          {/* Tabs: To Buy (N) vs Purchased (N) */}
          <div style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #30263E', paddingBottom: '12px', marginBottom: '16px' }}>
            <button
              onClick={() => setActiveTab('pending')}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                border: activeTab === 'pending' ? '2px solid #30263E' : '2px solid transparent',
                background: activeTab === 'pending' ? 'var(--arcade-lilac)' : 'transparent',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              To Buy ({pendingItems.length})
            </button>
            <button
              onClick={() => setActiveTab('purchased')}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                border: activeTab === 'purchased' ? '2px solid #30263E' : '2px solid transparent',
                background: activeTab === 'purchased' ? 'var(--arcade-lilac)' : 'transparent',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Purchased ({purchasedItems.length})
            </button>
          </div>

          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1.5fr 1fr 1fr 100px', padding: '8px 12px', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <span></span>
            <span>Item</span>
            <span>Qty</span>
            <span>Assigned</span>
            <span>Status</span>
          </div>

          {/* Table Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {displayedItems.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No items in this list. Add what needs to be bought!
              </div>
            ) : (
              displayedItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1.5fr 1fr 1fr 100px',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: '1.5px solid #30263E',
                    borderRadius: '8px',
                    background: item.status === 'purchased' ? '#F4FBF7' : '#FFFFFF'
                  }}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={item.status === 'purchased'}
                    onChange={() => toggleStatusMutation.mutate({
                      id: item.id,
                      status: item.status === 'purchased' ? 'pending' : 'purchased'
                    })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />

                  {/* Item Name */}
                  <div style={{ fontWeight: 700, fontSize: '14px', textDecoration: item.status === 'purchased' ? 'line-through' : 'none' }}>
                    {item.item_name}
                  </div>

                  {/* Quantity */}
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {item.quantity}
                  </div>

                  {/* Assigned Person */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                    <UserAvatar name={item.assigned_name} size={22} />
                    {item.assigned_name}
                  </div>

                  {/* Status / Convert Action */}
                  <div>
                    {item.status === 'purchased' ? (
                      item.linked_expense_id ? (
                        <span className="nb-badge" style={{ background: '#B6F0D2' }}>Converted</span>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedItemForExpense(item);
                            setShowConvertModal(true);
                          }}
                          className="nb-btn"
                          style={{ padding: '3px 8px', fontSize: '11px', background: 'var(--pixel-pink)' }}
                        >
                          → Expense
                        </button>
                      )
                    ) : (
                      <span className="nb-badge" style={{ background: '#FFE88A' }}>Pending</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Pixel Art Inspiration Card */}
        <div className="nb-card" style={{ padding: '24px', background: '#FFF9E6', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px', alignSelf: 'start' }}>
          <PixelBasket size={80} />
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Let's shop!</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Keep track of what the apartment needs. Check off items as you buy them and convert purchases directly into shared expenses.
          </p>
          <button onClick={() => setShowAddModal(true)} className="nb-btn nb-btn-primary" style={{ width: '100%' }}>
            Add Grocery Item
          </button>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="nb-card" style={{ width: '400px', padding: '24px', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Add Shopping Item</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Item Name</label>
                <input className="nb-input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Milk, Eggs, Dishwashing liquid" required />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Quantity</label>
                <input className="nb-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 2 packs, 1 loaf" />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Assign Purchaser (Optional)</label>
                <select className="nb-input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                  <option value="">Anyone</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <button type="submit" className="nb-btn nb-btn-primary" style={{ marginTop: '8px' }}>
                Add to List
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Convert to Expense Modal */}
      {showConvertModal && selectedItemForExpense && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="nb-card" style={{ width: '400px', padding: '24px', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Convert to Shared Expense</h2>
              <button onClick={() => setShowConvertModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleConvert} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: 600 }}>
                Converting <strong>{selectedItemForExpense.item_name}</strong> into a shared expense split equally among all roommates.
              </p>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700 }}>Total Paid (₹)</label>
                <input className="nb-input" type="number" step="0.01" value={expenseRupees} onChange={(e) => setExpenseRupees(e.target.value)} placeholder="e.g. 150" required />
              </div>
              <button type="submit" className="nb-btn nb-btn-primary" style={{ marginTop: '8px' }}>
                Confirm & Create Expense
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
