import React, { useState } from 'react';
import './Folder.css';

export interface FolderProps {
  color?: string;
  size?: number;
  items?: React.ReactNode[];
  className?: string;
  name?: string;
  count?: number | string;
  isOpen?: boolean;
  isDropTarget?: boolean;
  isDropFull?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClick?: () => void;
  onItemClick?: (index: number, e: React.MouseEvent) => void;
  onItemPointerDown?: (index: number, e: React.PointerEvent) => void;
}

const darkenColor = (hex: string, percent: number): string => {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color
      .split('')
      .map(c => c + c)
      .join('');
  }
  const num = parseInt(color.slice(0, 6), 16);
  if (isNaN(num)) return '#3b19c4';
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

export const Folder: React.FC<FolderProps> = ({
  color = '#5227FF',
  size = 1,
  items = [],
  className = '',
  name,
  count,
  isOpen: externalOpen,
  isDropTarget = false,
  isDropFull = false,
  onOpenChange,
  onClick,
  onItemClick,
  onItemPointerDown,
}) => {
  const maxItems = 3;
  const papers = items.slice(0, maxItems);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;

  const [hoveredPaperIndex, setHoveredPaperIndex] = useState<number | null>(null);
  const [isFolderHovered, setIsFolderHovered] = useState(false);

  const [paperOffsets, setPaperOffsets] = useState<{ x: number; y: number }[]>(
    Array.from({ length: maxItems }, () => ({ x: 0, y: 0 }))
  );

  const folderBackColor = darkenColor(color, 0.2);
  const paper1 = darkenColor('#ffffff', 0.12);
  const paper2 = darkenColor('#ffffff', 0.05);
  const paper3 = '#ffffff';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !open;
    if (externalOpen === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
    onClick?.();
    if (open) {
      setPaperOffsets(Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })));
    }
  };

  const handlePaperMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, index: number) => {
    if (!open) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const offsetX = (e.clientX - centerX) * 0.15;
    const offsetY = (e.clientY - centerY) * 0.15;
    setPaperOffsets(prev => {
      const newOffsets = [...prev];
      newOffsets[index] = { x: offsetX, y: offsetY };
      return newOffsets;
    });
  };

  const handlePaperMouseLeave = (_e: React.MouseEvent<HTMLDivElement, MouseEvent>, index: number) => {
    setPaperOffsets(prev => {
      const newOffsets = [...prev];
      newOffsets[index] = { x: 0, y: 0 };
      return newOffsets;
    });
  };

  const folderStyle: React.CSSProperties = {
    '--folder-color': color,
    '--folder-back-color': folderBackColor,
    '--paper-1': paper1,
    '--paper-2': paper2,
    '--paper-3': paper3,
  } as React.CSSProperties;

  const folderClassName = `folder ${open ? 'open' : ''}`.trim();
  const scaleStyle = { transform: `scale(${size})` };

  const getPaperTransform = (i: number, total: number, isOpen: boolean, isPaperHovered: boolean, _isFolderHovered: boolean) => {
    if (!isOpen) {
      return 'translate(-50%, 0%)';
    }

    const ox = paperOffsets[i]?.x || 0;
    const oy = paperOffsets[i]?.y || 0;
    const scale = isPaperHovered ? 'scale(1.12)' : 'scale(1)';

    if (total === 1) {
      const ty = isPaperHovered ? -105 : -95;
      return `translate(calc(-50% + ${ox}px), calc(${ty}% + ${oy}px)) rotateZ(0deg) ${scale}`;
    }
    if (total === 2) {
      const tx = i === 0 ? '-90%' : '-10%';
      const ty = isPaperHovered ? -90 : -80;
      const rot = i === 0 ? '-10deg' : '10deg';
      return `translate(calc(${tx} + ${ox}px), calc(${ty}% + ${oy}px)) rotateZ(${rot}) ${scale}`;
    }

    // 3 cards: Left (-120%), Center (-50%), Right (20%)
    const tx = i === 0 ? '-120%' : i === 1 ? '-50%' : '20%';
    const baseTy = i === 1 ? -105 : -75;
    const ty = baseTy + (isPaperHovered ? -10 : 0);
    const rot = i === 0 ? '-12deg' : i === 1 ? '0deg' : '12deg';
    return `translate(calc(${tx} + ${ox}px), calc(${ty}% + ${oy}px)) rotateZ(${rot}) ${scale}`;
  };

  return (
    <div className={`folder-wrapper ${className}`} style={scaleStyle}>
      <div
        className={folderClassName}
        style={folderStyle}
        onMouseEnter={() => setIsFolderHovered(true)}
        onMouseLeave={() => setIsFolderHovered(false)}
        onClick={handleClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e as any);
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={open}
        aria-label={name ? `Folder ${name}` : (open ? 'Close folder' : 'Open folder')}
      >
        {isDropTarget && (
          <svg
            className={`folder-dashed-outline${isDropFull ? ' folder-dashed-outline--full' : ''}`}
            viewBox="0 0 84 74"
            aria-hidden="true"
          >
            <path
              d="M 6 4 H 28 A 4 4 0 0 1 32 8 L 36 12 H 78 A 6 6 0 0 1 84 18 V 66 A 6 6 0 0 1 78 72 H 6 A 6 6 0 0 1 0 66 V 10 A 6 6 0 0 1 6 4 Z"
              fill="none"
              stroke={isDropFull ? '#ef4444' : '#a78bfa'}
              strokeWidth="2.5"
              strokeDasharray="6 4"
            />
          </svg>
        )}
        <div className="folder__back">
          {papers.map((item, i) => (
            <div
              key={i}
              className={`paper paper-${i + 1}`}
              onMouseEnter={() => setHoveredPaperIndex(i)}
              onMouseMove={e => handlePaperMouseMove(e, i)}
              onMouseLeave={e => {
                handlePaperMouseLeave(e, i);
                setHoveredPaperIndex(null);
              }}
              onPointerDown={e => {
                if (open && item) {
                  // Allow parent to start a drag-out gesture
                  if (onItemPointerDown) {
                    onItemPointerDown(i, e);
                    // Don't stopPropagation here so the canvas pointer capture fires
                  } else {
                    e.stopPropagation();
                  }
                }
              }}
              onClick={e => {
                if (open && item) {
                  e.stopPropagation();
                  onItemClick?.(i, e);
                }
              }}
              style={{
                transform: getPaperTransform(i, papers.length, open, hoveredPaperIndex === i, isFolderHovered),
              }}
            >
              {item}
            </div>
          ))}
          <div className="folder__front">
            {name && (
              <div style={{
                position: 'absolute',
                bottom: 6,
                left: 8,
                right: 8,
                fontSize: 10,
                fontWeight: 700,
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span>{name}</span>
                {count !== undefined && <span style={{ opacity: 0.8, fontSize: 9 }}>{count}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Folder;
