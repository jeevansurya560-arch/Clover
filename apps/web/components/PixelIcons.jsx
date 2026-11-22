import React from 'react';

export function PixelHouse({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 9V21H21V9L12 2Z" fill="#FF9FBF" stroke="#30263E" strokeWidth="2" strokeLinejoin="miter" />
      <rect x="9" y="13" width="6" height="8" fill="#FFE88A" stroke="#30263E" strokeWidth="1.5" />
      <rect x="6" y="10" width="3" height="3" fill="#A9E4F2" stroke="#30263E" strokeWidth="1.5" />
      <rect x="15" y="10" width="3" height="3" fill="#A9E4F2" stroke="#30263E" strokeWidth="1.5" />
      <rect x="16" y="4" width="2" height="4" fill="#C5B2FF" stroke="#30263E" strokeWidth="1.5" />
    </svg>
  );
}

export function PixelCat({ width = 70, height = 40, className = '' }) {
  return (
    <svg width={width} height={height} viewBox="0 0 48 28" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Pixel Cat Body */}
      <rect x="12" y="8" width="24" height="14" rx="3" fill="#FFFFFF" stroke="#30263E" strokeWidth="1.5" />
      {/* Ears */}
      <polygon points="14,8 18,2 20,8" fill="#FF9FBF" stroke="#30263E" strokeWidth="1.5" />
      <polygon points="26,8 28,2 32,8" fill="#FF9FBF" stroke="#30263E" strokeWidth="1.5" />
      {/* Eyes & Sleeping Lines */}
      <line x1="16" y1="13" x2="20" y2="13" stroke="#30263E" strokeWidth="2" strokeLinecap="round" />
      <line x1="26" y1="13" x2="30" y2="13" stroke="#30263E" strokeWidth="2" strokeLinecap="round" />
      {/* Nose */}
      <polygon points="23,15 22,17 24,17" fill="#FF9FBF" />
      {/* Tail */}
      <path d="M36 18C40 18 42 14 42 10" stroke="#30263E" strokeWidth="2" strokeLinecap="round" />
      {/* Whiskers */}
      <line x1="10" y1="15" x2="14" y2="15" stroke="#30263E" strokeWidth="1" />
      <line x1="32" y1="15" x2="36" y2="15" stroke="#30263E" strokeWidth="1" />
    </svg>
  );
}

export function PixelCoins({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="18" rx="8" ry="3" fill="#FFE88A" stroke="#30263E" strokeWidth="1.5" />
      <path d="M4 15C4 16.66 7.58 18 12 18C16.42 18 20 16.66 20 15" stroke="#30263E" strokeWidth="1.5" />
      <ellipse cx="12" cy="14" rx="8" ry="3" fill="#FFE88A" stroke="#30263E" strokeWidth="1.5" />
      <path d="M4 11C4 12.66 7.58 14 12 14C16.42 14 20 12.66 20 11" stroke="#30263E" strokeWidth="1.5" />
      <ellipse cx="12" cy="10" rx="8" ry="3" fill="#FFE88A" stroke="#30263E" strokeWidth="1.5" />
      <ellipse cx="12" cy="6" rx="8" ry="3" fill="#FFE88A" stroke="#30263E" strokeWidth="1.5" />
    </svg>
  );
}

export function PixelBasket({ size = 64, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Handle */}
      <path d="M10 14C10 8 22 8 22 14" stroke="#30263E" strokeWidth="2" strokeLinecap="round" />
      {/* Basket */}
      <path d="M6 14L8 26H24L26 14H6Z" fill="#C5B2FF" stroke="#30263E" strokeWidth="2" />
      <line x1="8" y1="18" x2="24" y2="18" stroke="#30263E" strokeWidth="1.5" />
      <line x1="10" y1="22" x2="22" y2="22" stroke="#30263E" strokeWidth="1.5" />
      {/* Groceries inside */}
      <circle cx="12" cy="11" r="3" fill="#FF9FBF" stroke="#30263E" strokeWidth="1.5" />
      <circle cx="18" cy="10" r="3.5" fill="#B6F0D2" stroke="#30263E" strokeWidth="1.5" />
      <rect x="15" y="6" width="3" height="6" fill="#FFE88A" stroke="#30263E" strokeWidth="1.5" />
    </svg>
  );
}

export function PixelBroom({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <line x1="6" y1="4" x2="16" y2="14" stroke="#F3C5A7" strokeWidth="3" strokeLinecap="round" />
      <line x1="6" y1="4" x2="16" y2="14" stroke="#30263E" strokeWidth="1.5" />
      <path d="M14 12L20 18L18 20L12 14Z" fill="#FFE88A" stroke="#30263E" strokeWidth="1.5" />
      <path d="M17 17L21 21L19 22L15 18Z" fill="#FFE88A" stroke="#30263E" strokeWidth="1.5" />
    </svg>
  );
}

export function UserAvatar({ name = 'User', avatar = 'avatar-you', size = 32 }) {
  const getInitials = (n) => n.substring(0, 2).toUpperCase();
  const getBg = () => {
    if (avatar.includes('aman')) return '#A9E4F2';
    if (avatar.includes('riya')) return '#FF9FBF';
    return '#B6F0D2';
  };

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: getBg(),
        border: '2px solid #30263E',
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: `${Math.round(size * 0.42)}px`,
        color: '#30263E',
        boxShadow: '1px 1px 0px #30263E',
        userSelect: 'none',
        flexShrink: 0
      }}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

export function PixelTrophy({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M7 4H17V9C17 11.76 14.76 14 12 14C9.24 14 7 11.76 7 9V4Z" fill="#FFE88A" stroke="#30263E" strokeWidth="1.8" />
      <path d="M7 6H4C4 8.5 6 10 7 10V6Z" fill="#FFE88A" stroke="#30263E" strokeWidth="1.5" />
      <path d="M17 6H20C20 8.5 18 10 17 10V6Z" fill="#FFE88A" stroke="#30263E" strokeWidth="1.5" />
      <rect x="11" y="14" width="2" height="4" fill="#30263E" />
      <rect x="8" y="18" width="8" height="3" fill="#C5B2FF" stroke="#30263E" strokeWidth="1.5" />
    </svg>
  );
}

export function PixelSparkle({ size = 18, color = '#FFE88A' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 0L9.5 6.5L16 8L9.5 9.5L8 16L6.5 9.5L0 8L6.5 6.5L8 0Z" fill={color} stroke="#30263E" strokeWidth="1" />
    </svg>
  );
}

export function PixelHeart({ size = 18, color = '#FF9FBF' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 14L2 8C0 6 1 2 4 2C6 2 7.5 4 8 5C8.5 4 10 2 12 2C15 2 16 6 14 8L8 14Z" fill={color} stroke="#30263E" strokeWidth="1.2" />
    </svg>
  );
}
