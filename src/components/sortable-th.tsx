'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { SortDir } from '@/lib/table-sort'
import { sortHint } from '@/lib/table-sort'

type SortableKind = 'text' | 'number'

export function SortableTh({
  label,
  columnKey,
  activeKey,
  direction,
  onToggle,
  kind,
  align = 'left',
  compact,
}: {
  label: string
  columnKey: string
  activeKey: string | null
  direction: SortDir
  onToggle: (columnKey: string) => void
  kind: SortableKind
  align?: 'left' | 'right'
  /** Smaller padding for dense tables (reimburse, reports). */
  compact?: boolean
}) {
  const active = activeKey === columnKey
  const thPad = compact ? '8px 6px' : '10px 14px'
  const baseTh: CSSProperties = {
    padding: thPad,
    textAlign: align,
    fontSize: compact ? '12px' : '11px',
    fontWeight: '600',
    color: '#475569',
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }

  return (
    <th style={baseTh}>
      <button
        type="button"
        title={sortHint(kind, active, direction)}
        onClick={() => onToggle(columnKey)}
        style={{
          background: active ? '#E0E7FF' : 'transparent',
          border: '1px solid transparent',
          borderRadius: '6px',
          padding: compact ? '2px 4px' : '2px 6px',
          margin: compact ? '-2px -4px' : '-2px -6px',
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
          letterSpacing: 'inherit',
          textTransform: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          width: align === 'right' ? '100%' : undefined,
          justifyContent: align === 'right' ? 'flex-end' : undefined,
        }}
      >
        {label}
        {active ? (
          <span aria-hidden>{direction === 'asc' ? '↑' : '↓'}</span>
        ) : (
          <span style={{ opacity: 0.35 }} aria-hidden>
            ⇅
          </span>
        )}
      </button>
    </th>
  )
}

/** Non-interactive header cell (e.g. checkbox, actions). */
export function StaticTh({
  children = null,
  align = 'left',
  compact,
  width,
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  compact?: boolean
  width?: number | string
}) {
  const thPad = compact ? '8px 6px' : '10px 14px'
  return (
    <th
      style={{
        padding: thPad,
        textAlign: align,
        fontSize: compact ? '12px' : '11px',
        fontWeight: '600',
        color: '#475569',
        letterSpacing: '.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        width,
      }}
    >
      {children}
    </th>
  )
}
