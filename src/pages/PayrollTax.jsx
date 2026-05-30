import React, { useState, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, Settings2, Search, X, Upload, Check, AlertCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatMoney, monthName, monthShort, getCurrentPeriod, parseAmount } from '../utils/helpers'

// ── Ставки из настроек ────────────────────────────────────────────────────────
export function getRates(cooperationFormat, taxRates) {
  if (!taxRates) taxRates = {}
  const keys = Object.keys(taxRates).filter(k => k !== 'default')
  if (cooperationFormat) {
    for (const key of keys) {
      if (cooperationFormat.toLowerCase().includes(key.toLowerCase())) {
        const r = taxRates[key] || {}
        return {
          ndfl: (r.ndfl || 0) / 100,
          sv:   (r.sv   || 0) / 100,
          nsp:  (r.nsp  || 0) / 100,
          ndflLabel: `${r.ndfl || 0}%`,
          svLabel:   `${r.sv   || 0}%`,
          nspLabel:  `${r.nsp  || 0}%`,
        }
      }
    }
  }
  const def = taxRates['default'] || { ndfl: 13, sv: 30, nsp: 0.2 }
  return {
    ndfl: (def.ndfl || 0) / 100,
    sv:   (def.sv   || 0) / 100,
    nsp:  (def.nsp  || 0) / 100,
    ndflLabel: `${def.ndfl || 0}%`,
    svLabel:   `${def.sv   || 0}%`,
    nspLabel:  `${def.nsp  || 0}%`,
  }
}

export function calcTax(base, cooperationFormat, taxRates, overrides = {}) {
  const rates = getRates(cooperationFormat, taxRates)
  const ndfl = Math.round(overrides.ndfl != null ? overrides.ndfl : base * rates.ndfl)
  const sv   = parseFloat(((overrides.sv  != null ? overrides.sv  : base * rates.sv)).toFixed(2))
  const nsp  = parseFloat(((overrides.nsp != null ? overrides.nsp : base * rates.nsp)).toFixed(2))
  const total = parseFloat((ndfl + sv + nsp).toFixed(2))
  return { ndfl, sv, nsp, total, rates }
}

// ── Бейдж формата ─────────────────────────────────────────────────────────────
const FORMAT_COLORS = {
  'ТК':          { bg: '#dbeafe', text: '#1d4ed8' },
  'ГПХ':         { bg: '#fef9c3', text: '#a16207' },
  'Самозанятый': { bg: '#dcfce7', text: '#15803d' },
  'ИП':          { bg: '#f3e8ff', text: '#7c3aed' },
}
export function getFormatColors(fmt) {
  if (!fmt) return { bg: '#f3f4f6', text: '#374151' }
  for (const key of Object.keys(FORMAT_COLORS)) {
    if (fmt.includes(key)) return FORMAT_COLORS[key]
  }
  return { bg: '#f3f4f6', text: '#374151' }
}
function FormatBadge({ fmt }) {
  const c = getFormatColors(fmt)
  return fmt
    ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.text, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt}</span>
    : <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>
}

// ── Редактируемая ячейка ──────────────────────────────────────────────────────
function EditCell({ value, onSave, highlight, color, zeroLabel, decimals = 2 }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef(null)
  function start() {
    const v = decimals > 0
      ? String(parseFloat(Number(value).toFixed(decimals)))
      : String(Math.round(value))
    setDraft(value > 0 ? v : '')
    setEditing(true)
    setTimeout(() => ref.current?.select(), 0)
  }
  function commit() {
    const v = parseAmount(draft)
    onSave(decimals > 0 ? parseFloat(v.toFixed(decimals)) : Math.round(v))
    setEditing(false)
  }
  function onKey(e) { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }
  if (editing) return (
    <input ref={ref} type="number" step={decimals > 0 ? '0.01' : '1'} value={draft}
      onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey}
      style={{ width: '100%', minWidth: 80, padding: '4px 6px', border: '2px solid #3b82f6', borderRadius: 6, fontSize: 13, fontWeight: 600, textAlign: 'right', outline: 'none', background: '#eff6ff' }} />
  )
  return (
    <div onClick={start} title="Нажмите для редактирования" style={{
      cursor: 'pointer', padding: '4px 8px', borderRadius: 6, textAlign: 'right',
      background: highlight ? '#fef9c3' : 'transparent', border: '1px dashed #d1d5db',
      color: color || '#111827', fontWeight: 600, fontSize: 13, minWidth: 80, userSelect: 'none'
    }}>
      {value > 0 ? formatMoney(value, false, decimals) : <span style={{ color: '#d1d5db', fontSize: 11 }}>{zeroLabel || '0 ₽'}</span>}
    </div>
  )
}

// ── Модальное окно настройки ставок ──────────────────────────────────────────
function RatesModal({ taxRates, cooperationFormats, onSave, onClose }) {
  const ALL = [...(cooperationFormats || []), 'default'].filter((v, i, a) => a.indexOf(v) === i)
  const [draft, setDraft] = useState(() => {
    const d = {}
    ALL.forEach(fmt => {
      const r = taxRates?.[fmt] || { ndfl: 13, sv: 30, nsp: 0.2 }
      d[fmt] = { ndfl: r.ndfl ?? 0, sv: r.sv ?? 0, nsp: r.nsp ?? 0 }
    })
    return d
  })
  function set(fmt, field, val) { setDraft(d => ({ ...d, [fmt]: { ...d[fmt], [field]: parseFloat(val) || 0 } })) }
  const LABELS = { 'ТК': 'Трудовой договор (ТК)', 'ГПХ': 'Гражданско-правовой (ГПХ)', 'Самозанятый': 'Самозанятый', 'ИП': 'ИП', 'Прочее': 'Прочее', 'default': 'По умолчанию (остальные)' }
  const inp = (fmt, field, clr) => (
    <input type="number" step="0.1" min="0" max="100" value={draft[fmt]?.[field] ?? ''}
      onChange={e => set(fmt, field, e.target.value)}
      style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, textAlign: 'center', fontSize: 14, fontWeight: 600, color: clr, outline: 'none' }} />
  )
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 12, width: 620, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Налоговые ставки</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14, background: '#f8f9fb', padding: '8px 12px', borderRadius: 8 }}>
          Значения в процентах. НДФЛ — удерживается из зарплаты. СВ — страховые взносы (ПФР+ОМС+ФСС). НСП — несчастные случаи и проф. заболевания.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>Формат</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 12, color: '#dc2626', borderBottom: '1px solid #e5e7eb', width: 120 }}>НДФЛ, %</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 12, color: '#7c3aed', borderBottom: '1px solid #e5e7eb', width: 120 }}>СВ, %</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 12, color: '#0891b2', borderBottom: '1px solid #e5e7eb', width: 120 }}>НСП, %</th>
            </tr>
          </thead>
          <tbody>
            {ALL.map(fmt => {
              const c = fmt === 'default' ? { bg: '#f3f4f6', text: '#374151' } : getFormatColors(fmt)
              return (
                <tr key={fmt} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, background: c.bg, color: c.text, fontWeight: 700 }}>
                      {LABELS[fmt] || fmt}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px' }}>{inp(fmt, 'ndfl', '#dc2626')}</td>
                  <td style={{ padding: '6px 8px' }}>{inp(fmt, 'sv',   '#7c3aed')}</td>
                  <td style={{ padding: '6px 8px' }}>{inp(fmt, 'nsp',  '#0891b2')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af' }}>
          * СВ: ТК — ПФР 22% + ОМС 5.1% + ФСС 2.9% = 30% · ГПХ — без ФСС = 27.1% · НСП по умолчанию 0.2%
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={() => { onSave(draft); onClose() }}>Сохранить ставки</button>
        </div>
      </div>
    </div>
  )
}

// ── Вид: месяц ───────────────────────────────────────────────────────────────
function MonthView({ rows, totals, onSaveBase, onSaveNdfl, onSaveSv, onSaveNsp, onReset }) {
  const topRef = useRef(null), tblRef = useRef(null)
  const syncTop = e => { if (tblRef.current) tblRef.current.scrollLeft = e.target.scrollLeft }
  const syncTbl = e => { if (topRef.current) topRef.current.scrollLeft = e.target.scrollLeft }

  const TH = ({ ch, style = {}, left }) => (
    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f8f9fb', padding: '9px 8px', textAlign: left ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', ...style }}>{ch}</th>
  )

  return (
    <>
      <div ref={topRef} onScroll={syncTop} style={{ overflowX: 'auto', overflowY: 'hidden', height: 8 }}>
        <div style={{ minWidth: 1100, height: 1 }} />
      </div>
      <div ref={tblRef} onScroll={syncTbl} style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
        <table className="table" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <TH left ch="Сотрудник" style={{ position: 'sticky', left: 0, zIndex: 3, minWidth: 180 }} />
              <TH left ch="Формат" style={{ minWidth: 110 }} />
              <TH ch="Начислено" style={{ minWidth: 110 }} />
              <TH ch={<>Офиц. зарплата<br/><span style={{ fontSize: 9, fontWeight: 400, color: '#9ca3af' }}>(база для налогов)</span></>} style={{ minWidth: 125, color: '#1d4ed8' }} />
              <TH ch="НДФЛ" style={{ minWidth: 100, color: '#dc2626' }} />
              <TH ch="СВ" style={{ minWidth: 105, color: '#7c3aed' }} />
              <TH ch="НСП" style={{ minWidth: 95, color: '#0891b2' }} />
              <TH ch="Итого налогов" style={{ minWidth: 115 }} />
              <TH ch="На руки" style={{ minWidth: 110, color: '#059669' }} />
              <TH ch="" style={{ minWidth: 32 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.emp.id} style={{ background: i % 2 === 0 ? 'white' : '#fafbff' }}>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: i % 2 === 0 ? 'white' : '#fafbff', fontWeight: 600, fontSize: 13, padding: '7px 12px', borderRight: '1px solid #f3f4f6' }}>
                  {row.emp.fullName}
                  {row.emp.position && <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{row.emp.position}</div>}
                </td>
                <td style={{ padding: '7px 8px' }}>
                  <FormatBadge fmt={row.emp.cooperationFormat} />
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                    НДФЛ {row.tax.rates.ndflLabel} · СВ {row.tax.rates.svLabel} · НСП {row.tax.rates.nspLabel}
                  </div>
                </td>
                <td style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 600, color: '#374151' }}>
                  {row.totalEarned > 0 ? formatMoney(row.totalEarned) : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>
                <td style={{ padding: '3px 5px' }}>
                  <EditCell value={row.officialBase} highlight={row.isBaseOverridden} color="#1d4ed8" decimals={2} onSave={v => onSaveBase(row.emp.id, row.totalEarned, v)} />
                  {row.isBaseOverridden && <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'right', paddingRight: 6 }}>изменено</div>}
                </td>
                <td style={{ padding: '3px 5px' }}>
                  <EditCell value={row.tax.ndfl} highlight={row.isNdflOverridden} color="#dc2626" decimals={0} zeroLabel={row.tax.rates.ndfl === 0 ? 'не удерж.' : '0 ₽'} onSave={v => onSaveNdfl(row.emp.id, v)} />
                  {row.isNdflOverridden && <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'right', paddingRight: 6 }}>изменено</div>}
                </td>
                <td style={{ padding: '3px 5px' }}>
                  <EditCell value={row.tax.sv} highlight={row.isSvOverridden} color="#7c3aed" decimals={2} zeroLabel={row.tax.rates.sv === 0 ? 'не уплач.' : '0 ₽'} onSave={v => onSaveSv(row.emp.id, v)} />
                  {row.isSvOverridden && <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'right', paddingRight: 6 }}>изменено</div>}
                </td>
                <td style={{ padding: '3px 5px' }}>
                  <EditCell value={row.tax.nsp} highlight={row.isNspOverridden} color="#0891b2" decimals={2} zeroLabel={row.tax.rates.nsp === 0 ? 'не уплач.' : '0 ₽'} onSave={v => onSaveNsp(row.emp.id, v)} />
                  {row.isNspOverridden && <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'right', paddingRight: 6 }}>изменено</div>}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 8px' }}>
                  {row.tax.total > 0
                    ? <span style={{ fontWeight: 700, color: '#dc2626' }}>{formatMoney(row.tax.total, false, 2)}</span>
                    : <span style={{ color: '#d1d5db' }}>0 ₽</span>}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 8px' }}>
                  <span style={{ fontWeight: 700, color: '#059669' }}>{formatMoney(row.totalEarned)}</span>
                </td>
                <td style={{ padding: '3px 3px', textAlign: 'center' }}>
                  {(row.isBaseOverridden || row.isNdflOverridden || row.isSvOverridden || row.isNspOverridden) && (
                    <button onClick={() => onReset(row.emp.id)} title="Сбросить" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 3, borderRadius: 4 }}>
                      <RotateCcw size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Нет начислений за этот период</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f0f4ff', fontWeight: 700 }}>
                <td colSpan={2} style={{ position: 'sticky', left: 0, background: '#f0f4ff', padding: '11px 12px', fontWeight: 700, fontSize: 13, borderTop: '2px solid #e5e7eb' }}>
                  Итого · {rows.length} сотр.
                </td>
                <td style={{ textAlign: 'right', padding: '11px 8px', borderTop: '2px solid #e5e7eb', fontWeight: 800 }}>{formatMoney(totals.earned)}</td>
                <td style={{ textAlign: 'right', padding: '11px 8px', borderTop: '2px solid #e5e7eb', color: '#1d4ed8', fontWeight: 800 }}>{formatMoney(totals.officialBase, false, 2)}</td>
                <td style={{ textAlign: 'right', padding: '11px 8px', borderTop: '2px solid #e5e7eb', color: '#dc2626', fontWeight: 800, fontSize: 14 }}>{formatMoney(totals.ndfl)}</td>
                <td style={{ textAlign: 'right', padding: '11px 8px', borderTop: '2px solid #e5e7eb', color: '#7c3aed', fontWeight: 800, fontSize: 14 }}>{formatMoney(totals.sv, false, 2)}</td>
                <td style={{ textAlign: 'right', padding: '11px 8px', borderTop: '2px solid #e5e7eb', color: '#0891b2', fontWeight: 800, fontSize: 14 }}>{formatMoney(totals.nsp, false, 2)}</td>
                <td style={{ textAlign: 'right', padding: '11px 8px', borderTop: '2px solid #e5e7eb', color: '#dc2626', fontWeight: 800, fontSize: 15 }}>{formatMoney(totals.total, false, 2)}</td>
                <td style={{ textAlign: 'right', padding: '11px 8px', borderTop: '2px solid #e5e7eb', color: '#059669', fontWeight: 800, fontSize: 14 }}>{formatMoney(totals.earned)}</td>
                <td style={{ borderTop: '2px solid #e5e7eb' }} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  )
}

// ── Вид: год ─────────────────────────────────────────────────────────────────
function YearView({ yearRows, year }) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const thS = { position: 'sticky', top: 0, zIndex: 2, background: '#f8f9fb', padding: '7px 5px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: '#6b7280', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }
  const grand = yearRows.reduce(
    (a, r) => ({ earned: a.earned + r.annualEarned, ob: a.ob + r.annualOB, ndfl: a.ndfl + r.annualNdfl, sv: a.sv + r.annualSv, nsp: a.nsp + r.annualNsp, total: a.total + r.annualTotal }),
    { earned: 0, ob: 0, ndfl: 0, sv: 0, nsp: 0, total: 0 }
  )
  return (
    <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
      <table className="table" style={{ minWidth: 1700 }}>
        <thead>
          <tr>
            <th style={{ ...thS, textAlign: 'left', position: 'sticky', left: 0, zIndex: 3, minWidth: 180 }}>Сотрудник</th>
            <th style={{ ...thS, textAlign: 'left', minWidth: 100 }}>Формат</th>
            {months.map(m => <th key={m} colSpan={4} style={{ ...thS, textAlign: 'center', minWidth: 240, borderLeft: '1px solid #e5e7eb' }}>{monthShort(m)}</th>)}
            <th style={{ ...thS, minWidth: 90, background: '#fef2f2', color: '#dc2626', borderLeft: '2px solid #e5e7eb' }}>НДФЛ год</th>
            <th style={{ ...thS, minWidth: 90, background: '#f5f3ff', color: '#7c3aed' }}>СВ год</th>
            <th style={{ ...thS, minWidth: 80, background: '#ecfeff', color: '#0891b2' }}>НСП год</th>
            <th style={{ ...thS, minWidth: 100, background: '#f0f4ff' }}>Итого год</th>
          </tr>
          <tr>
            <th style={{ ...thS, top: 36, position: 'sticky', left: 0, zIndex: 3, textAlign: 'left' }} />
            <th style={{ ...thS, top: 36 }} />
            {months.map(m => (
              <React.Fragment key={m}>
                <th style={{ ...thS, top: 36, fontSize: 9, color: '#1d4ed8', borderLeft: '1px solid #e5e7eb' }}>Офиц.</th>
                <th style={{ ...thS, top: 36, fontSize: 9, color: '#dc2626' }}>НДФЛ</th>
                <th style={{ ...thS, top: 36, fontSize: 9, color: '#7c3aed' }}>СВ</th>
                <th style={{ ...thS, top: 36, fontSize: 9, color: '#0891b2' }}>НСП</th>
              </React.Fragment>
            ))}
            <th style={{ ...thS, top: 36, background: '#fef2f2', borderLeft: '2px solid #e5e7eb' }} />
            <th style={{ ...thS, top: 36, background: '#f5f3ff' }} />
            <th style={{ ...thS, top: 36, background: '#ecfeff' }} />
            <th style={{ ...thS, top: 36, background: '#f0f4ff' }} />
          </tr>
        </thead>
        <tbody>
          {yearRows.map((row, i) => (
            <tr key={row.emp.id} style={{ background: i % 2 === 0 ? 'white' : '#fafbff' }}>
              <td style={{ position: 'sticky', left: 0, zIndex: 1, background: i % 2 === 0 ? 'white' : '#fafbff', fontWeight: 600, fontSize: 12, padding: '6px 12px', borderRight: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{row.emp.fullName}</td>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}><FormatBadge fmt={row.emp.cooperationFormat} /></td>
              {months.map(m => {
                const md = row.months[m]
                const cs = { textAlign: 'right', padding: '6px 4px', borderBottom: '1px solid #f3f4f6', fontSize: 11 }
                const dash = <span style={{ color: '#e5e7eb' }}>—</span>
                return (
                  <React.Fragment key={m}>
                    <td style={{ ...cs, color: '#1d4ed8', borderLeft: '1px solid #e5e7eb' }}>{md.ob > 0 ? formatMoney(md.ob, false, 2) : dash}</td>
                    <td style={{ ...cs, color: '#dc2626' }}>{md.ndfl > 0 ? formatMoney(md.ndfl) : dash}</td>
                    <td style={{ ...cs, color: '#7c3aed' }}>{md.sv > 0 ? formatMoney(md.sv, false, 2) : dash}</td>
                    <td style={{ ...cs, color: '#0891b2' }}>{md.nsp > 0 ? formatMoney(md.nsp, false, 2) : dash}</td>
                  </React.Fragment>
                )
              })}
              <td style={{ textAlign: 'right', padding: '6px 7px', fontWeight: 700, color: '#dc2626', background: '#fef2f2', borderLeft: '2px solid #e5e7eb', borderBottom: '1px solid #f3f4f6' }}>{row.annualNdfl > 0 ? formatMoney(row.annualNdfl) : '—'}</td>
              <td style={{ textAlign: 'right', padding: '6px 7px', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', borderBottom: '1px solid #f3f4f6' }}>{row.annualSv > 0 ? formatMoney(row.annualSv, false, 2) : '—'}</td>
              <td style={{ textAlign: 'right', padding: '6px 7px', fontWeight: 700, color: '#0891b2', background: '#ecfeff', borderBottom: '1px solid #f3f4f6' }}>{row.annualNsp > 0 ? formatMoney(row.annualNsp, false, 2) : '—'}</td>
              <td style={{ textAlign: 'right', padding: '6px 7px', fontWeight: 800, fontSize: 13, background: '#f0f4ff', borderBottom: '1px solid #f3f4f6' }}>{row.annualTotal > 0 ? formatMoney(row.annualTotal, false, 2) : '—'}</td>
            </tr>
          ))}
          {yearRows.length === 0 && (
            <tr><td colSpan={3 + 12 * 4 + 4} style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>Нет данных за {year} год</td></tr>
          )}
        </tbody>
        {yearRows.length > 0 && (
          <tfoot>
            <tr style={{ background: '#e8eeff', fontWeight: 700 }}>
              <td colSpan={2} style={{ position: 'sticky', left: 0, background: '#e8eeff', padding: '9px 12px', fontWeight: 700, fontSize: 13, borderTop: '2px solid #c7d2fe' }}>Итого {year}</td>
              {months.map(m => {
                const mOB  = yearRows.reduce((s, r) => s + (r.months[m].ob   || 0), 0)
                const mN   = yearRows.reduce((s, r) => s + (r.months[m].ndfl || 0), 0)
                const mSV  = yearRows.reduce((s, r) => s + (r.months[m].sv   || 0), 0)
                const mNSP = yearRows.reduce((s, r) => s + (r.months[m].nsp  || 0), 0)
                return (
                  <React.Fragment key={m}>
                    <td style={{ textAlign: 'right', padding: '9px 4px', borderTop: '2px solid #c7d2fe', fontSize: 11, color: '#1d4ed8', borderLeft: '1px solid #c7d2fe' }}>{mOB > 0 ? formatMoney(mOB, false, 2) : '—'}</td>
                    <td style={{ textAlign: 'right', padding: '9px 4px', borderTop: '2px solid #c7d2fe', fontSize: 11, color: '#dc2626' }}>{mN > 0 ? formatMoney(mN) : '—'}</td>
                    <td style={{ textAlign: 'right', padding: '9px 4px', borderTop: '2px solid #c7d2fe', fontSize: 11, color: '#7c3aed' }}>{mSV > 0 ? formatMoney(mSV, false, 2) : '—'}</td>
                    <td style={{ textAlign: 'right', padding: '9px 4px', borderTop: '2px solid #c7d2fe', fontSize: 11, color: '#0891b2' }}>{mNSP > 0 ? formatMoney(mNSP, false, 2) : '—'}</td>
                  </React.Fragment>
                )
              })}
              <td style={{ textAlign: 'right', padding: '9px 7px', borderTop: '2px solid #c7d2fe', color: '#dc2626', fontWeight: 800, fontSize: 14, background: '#fef2f2', borderLeft: '2px solid #c7d2fe' }}>{formatMoney(grand.ndfl)}</td>
              <td style={{ textAlign: 'right', padding: '9px 7px', borderTop: '2px solid #c7d2fe', color: '#7c3aed', fontWeight: 800, fontSize: 14, background: '#f5f3ff' }}>{formatMoney(grand.sv, false, 2)}</td>
              <td style={{ textAlign: 'right', padding: '9px 7px', borderTop: '2px solid #c7d2fe', color: '#0891b2', fontWeight: 800, fontSize: 14, background: '#ecfeff' }}>{formatMoney(grand.nsp, false, 2)}</td>
              <td style={{ textAlign: 'right', padding: '9px 7px', borderTop: '2px solid #c7d2fe', fontWeight: 800, fontSize: 15, background: '#e8eeff' }}>{formatMoney(grand.total, false, 2)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// ── Главная страница ──────────────────────────────────────────────────────────
export default function PayrollTax() {
  const { state, dispatch } = useApp()
  const { month: curMonth, year: curYear } = getCurrentPeriod()
  const [view, setView]       = useState('month')
  const [month, setMonth]     = useState(curMonth)
  const [year, setYear]       = useState(curYear)
  const [showRates, setShowRates] = useState(false)
  const [search, setSearch]   = useState('')
  const [importModal, setImportModal] = useState(null) // { rows, month, year, filename, matches }
  const [fmtFilter, setFmtFilter] = useState('all')

  const taxRates = state.settings?.taxRates || {}
  const cooperationFormats = state.settings?.cooperationFormats || ['ТК', 'ГПХ', 'Самозанятый', 'ИП', 'Прочее']

  function prevMonth() { month === 1 ? (setMonth(12), setYear(y => y - 1)) : setMonth(m => m - 1) }
  function nextMonth() { month === 12 ? (setMonth(1), setYear(y => y + 1)) : setMonth(m => m + 1) }

  function saveRates(draft) { dispatch({ type: 'UPDATE_SETTINGS', payload: { taxRates: draft } }) }

  function getTaxRec(empId) {
    return state.taxRecords.find(r => r.employeeId === empId && r.month === month && r.year === year) || null
  }
  function saveTaxField(empId, field, value) {
    const existing = getTaxRec(empId) || { employeeId: empId, month, year }
    dispatch({ type: 'UPSERT_TAX_RECORD', payload: { ...existing, [field]: value } })
  }
  function resetTaxRec(empId) {
    dispatch({ type: 'UPSERT_TAX_RECORD', payload: { employeeId: empId, month, year, officialBase: null, ndflOverride: null, svOverride: null, nspOverride: null } })
  }

  // ── Строки месяца ──────────────────────────────────────────────────────────
  const allMonthRows = useMemo(() => {
    return state.payrolls
      .filter(p => p.month === month && p.year === year)
      .map(p => {
        const emp = state.employees.find(e => e.id === p.employeeId)
        if (!emp) return null
        const totalEarned = p.totalEarned || 0
        const rec = state.taxRecords.find(r => r.employeeId === emp.id && r.month === month && r.year === year)
        const officialBase     = rec?.officialBase != null ? rec.officialBase : totalEarned
        const isBaseOverridden = rec?.officialBase != null && rec.officialBase !== totalEarned
        const isNdflOverridden = rec?.ndflOverride != null
        const isSvOverridden   = rec?.svOverride   != null
        const isNspOverridden  = rec?.nspOverride  != null
        const overrides = {
          ndfl: isNdflOverridden ? rec.ndflOverride : undefined,
          sv:   isSvOverridden   ? rec.svOverride   : undefined,
          nsp:  isNspOverridden  ? rec.nspOverride  : undefined,
        }
        const tax = calcTax(officialBase, emp.cooperationFormat, taxRates, overrides)
        return { emp, payroll: p, totalEarned, officialBase, tax, isBaseOverridden, isNdflOverridden, isSvOverridden, isNspOverridden }
      })
      .filter(Boolean)
      .sort((a, b) => a.emp.fullName.localeCompare(b.emp.fullName, 'ru'))
  }, [state.payrolls, state.employees, state.taxRecords, month, year, taxRates])

  const monthRows = useMemo(() => allMonthRows.filter(row => {
    const matchName = !search || row.emp.fullName.toLowerCase().includes(search.toLowerCase())
    const matchFmt  = fmtFilter === 'all' || (row.emp.cooperationFormat || 'Прочее').includes(fmtFilter)
    return matchName && matchFmt
  }), [allMonthRows, search, fmtFilter])

  const monthTotals = useMemo(() => monthRows.reduce(
    (a, r) => ({ earned: a.earned + r.totalEarned, officialBase: a.officialBase + r.officialBase, ndfl: a.ndfl + r.tax.ndfl, sv: a.sv + r.tax.sv, nsp: a.nsp + r.tax.nsp, total: a.total + r.tax.total, net: a.net + r.totalEarned }),
    { earned: 0, officialBase: 0, ndfl: 0, sv: 0, nsp: 0, total: 0, net: 0 }
  ), [monthRows])

  // ── Строки года ───────────────────────────────────────────────────────────
  const allYearRows = useMemo(() => {
    const empIds = new Set(state.payrolls.filter(p => p.year === year).map(p => p.employeeId))
    return [...empIds].map(empId => {
      const emp = state.employees.find(e => e.id === empId)
      if (!emp) return null
      const months = {}
      for (let m = 1; m <= 12; m++) {
        const p   = state.payrolls.find(x => x.employeeId === empId && x.month === m && x.year === year)
        const rec = state.taxRecords.find(r => r.employeeId === empId && r.month === m && r.year === year)
        if (p) {
          const base = rec?.officialBase != null ? rec.officialBase : (p.totalEarned || 0)
          const ov   = { ndfl: rec?.ndflOverride ?? undefined, sv: rec?.svOverride ?? undefined, nsp: rec?.nspOverride ?? undefined }
          const tax  = calcTax(base, emp.cooperationFormat, taxRates, ov)
          months[m]  = { ob: base, ndfl: tax.ndfl, sv: tax.sv, nsp: tax.nsp }
        } else {
          months[m] = { ob: 0, ndfl: 0, sv: 0, nsp: 0 }
        }
      }
      const annualEarned = state.payrolls.filter(p => p.employeeId === empId && p.year === year).reduce((s, p) => s + (p.totalEarned || 0), 0)
      const annualOB   = Object.values(months).reduce((s, m) => s + m.ob,   0)
      const annualNdfl = Object.values(months).reduce((s, m) => s + m.ndfl, 0)
      const annualSv   = Object.values(months).reduce((s, m) => s + m.sv,   0)
      const annualNsp  = Object.values(months).reduce((s, m) => s + m.nsp,  0)
      return { emp, months, annualEarned, annualOB, annualNdfl, annualSv, annualNsp, annualTotal: annualNdfl + annualSv + annualNsp }
    }).filter(Boolean).sort((a, b) => a.emp.fullName.localeCompare(b.emp.fullName, 'ru'))
  }, [state.payrolls, state.employees, state.taxRecords, year, taxRates])

  const yearRows = useMemo(() => allYearRows.filter(row => {
    const matchName = !search || row.emp.fullName.toLowerCase().includes(search.toLowerCase())
    const matchFmt  = fmtFilter === 'all' || (row.emp.cooperationFormat || 'Прочее').includes(fmtFilter)
    return matchName && matchFmt
  }), [allYearRows, search, fmtFilter])

  const formats = useMemo(() => [...new Set(allMonthRows.map(r => r.emp.cooperationFormat || 'Прочее'))].sort(), [allMonthRows])

  // ── Импорт из ЗУП PDF ─────────────────────────────────────────────────────
  async function handleImportPdf() {
    if (!window.electronAPI) return
    const result = await window.electronAPI.readPdfTaxes()
    if (!result.ok) return

    const employees = state.employees.filter(e => e.status === 'active')

    const matches = result.rows.map(row => {
      const pdfLow = row.name.toLowerCase()
      let matchedEmp = null
      let bestScore = 0
      for (const emp of employees) {
        const parts = emp.fullName.toLowerCase().split(/\s+/).filter(p => p.length > 1)
        const hits = parts.filter(p => pdfLow.includes(p)).length
        const score = parts.length > 0 ? hits / parts.length : 0
        if (score > bestScore && hits >= 1) { bestScore = score; matchedEmp = emp }
      }
      return { ...row, matchedEmpId: matchedEmp?.id || '', included: !!matchedEmp }
    })

    setImportModal({
      month: result.month || month,
      year:  result.year  || year,
      filename: result.filename,
      matches
    })
  }

  function applyImport() {
    if (!importModal) return
    const { matches, month: m, year: y } = importModal
    matches.forEach(row => {
      if (!row.included || !row.matchedEmpId) return
      const existing = state.taxRecords.find(r => r.employeeId === row.matchedEmpId && r.month === m && r.year === y)
        || { employeeId: row.matchedEmpId, month: m, year: y }
      dispatch({ type: 'UPSERT_TAX_RECORD', payload: {
        ...existing,
        officialBase:  row.officialBase,
        ndflOverride:  row.ndfl,
        svOverride:    row.sv,
        nspOverride:   row.nsp,
      }})
    })
    setImportModal(null)
  }

  const handlers = {
    onSaveBase: useCallback((empId, te, v) => saveTaxField(empId, 'officialBase', Math.abs(v - te) < 1 ? null : v), [month, year, state.taxRecords]),
    onSaveNdfl: useCallback((empId, v) => saveTaxField(empId, 'ndflOverride', v), [month, year, state.taxRecords]),
    onSaveSv:   useCallback((empId, v) => saveTaxField(empId, 'svOverride', v), [month, year, state.taxRecords]),
    onSaveNsp:  useCallback((empId, v) => saveTaxField(empId, 'nspOverride', v), [month, year, state.taxRecords]),
    onReset:    useCallback((empId) => resetTaxRec(empId), [month, year, state.taxRecords]),
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">Налоги ФОТ</div>
          <div className="page-subtitle">НДФЛ · Страховые взносы · НСП · нажмите на ячейку чтобы изменить</div>
        </div>
      </div>

      {/* Плашка ставок */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, padding: '10px 14px', background: '#f0f4ff', borderRadius: 10, border: '1px solid #c7d2fe', fontSize: 12, alignItems: 'center' }}>
        <span style={{ color: '#4f46e5', fontWeight: 700, flexShrink: 0 }}>Ставки:</span>
        {[...cooperationFormats, 'default'].map(fmt => {
          const r = taxRates[fmt] || (fmt === 'default' ? { ndfl: 13, sv: 30, nsp: 0.2 } : { ndfl: 13, sv: 30, nsp: 0.2 })
          const c = fmt === 'default' ? { bg: '#e0e7ff', text: '#3730a3' } : getFormatColors(fmt)
          return (
            <span key={fmt} style={{ padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.text, fontWeight: 600 }}>
              {fmt === 'default' ? 'Прочее' : fmt} — НДФЛ {r.ndfl}% · СВ {r.sv}% · НСП {r.nsp ?? 0}%
            </span>
          )
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setShowRates(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 8, border: '1px solid #6366f1', background: 'white', color: '#4f46e5', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            <Settings2 size={13} /> Настроить ставки
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <button onClick={handleImportPdf} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 8, border: '1px solid #059669', background: '#ecfdf5', color: '#059669', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              <Upload size={13} /> Загрузить из ЗУП
            </button>
            <span style={{ fontSize: 11, color: '#dc2626', lineHeight: 1.4 }}>
              загружайте отчёт «Налоги и взносы (кратко)» из 1С ЗУП (PDF)
            </span>
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input type="text" placeholder="Поиск по имени..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '7px 28px 7px 32px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', background: 'white' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}><X size={13} /></button>}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => setFmtFilter('all')} className={fmtFilter === 'all' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
            Все ({allMonthRows.length})
          </button>
          {formats.map(fmt => {
            const cnt = allMonthRows.filter(r => (r.emp.cooperationFormat || 'Прочее') === fmt).length
            const c = getFormatColors(fmt)
            return (
              <button key={fmt} onClick={() => setFmtFilter(fmtFilter === fmt ? 'all' : fmt)} style={{
                padding: '4px 12px', borderRadius: 20, border: '2px solid',
                borderColor: fmtFilter === fmt ? c.text : '#e5e7eb',
                background: fmtFilter === fmt ? c.bg : 'white',
                color: fmtFilter === fmt ? c.text : '#374151',
                fontWeight: fmtFilter === fmt ? 700 : 400, fontSize: 12, cursor: 'pointer'
              }}>
                {fmt} ({cnt})
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ id: 'month', label: 'По месяцу' }, { id: 'year', label: 'По году' }].map(t => (
              <button key={t.id} onClick={() => setView(t.id)} className={view === t.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>{t.label}</button>
            ))}
          </div>
          {view === 'month' && <>
            <button className="btn btn-secondary btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 130, textAlign: 'center' }}>{monthName(month)} {year}</span>
            <button className="btn btn-secondary btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
          </>}
          {view === 'year' && <>
            <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y - 1)}><ChevronLeft size={14} /></button>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 50, textAlign: 'center' }}>{year}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y + 1)}><ChevronRight size={14} /></button>
          </>}
        </div>
      </div>

      {/* Карточки */}
      {view === 'month' && monthRows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Начислено',          value: monthTotals.earned,       color: '#374151', bg: '#f9fafb' },
            { label: 'Офиц. зарплата',     value: monthTotals.officialBase, color: '#1d4ed8', bg: '#eff6ff' },
            { label: 'НДФЛ к уплате',      value: monthTotals.ndfl,         color: '#dc2626', bg: '#fef2f2' },
            { label: 'Страховые взносы',   value: monthTotals.sv,           color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'НСП',                value: monthTotals.nsp,          color: '#0891b2', bg: '#ecfeff' },
            { label: 'На руки сотрудникам',value: monthTotals.earned,       color: '#059669', bg: '#ecfdf5' },
          ].map(c => (
            <div key={c.label} className="stat-card" style={{ background: c.bg, padding: '11px 13px' }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: c.color }}>{formatMoney(c.value)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {view === 'month' && <MonthView rows={monthRows} totals={monthTotals} {...handlers} />}
        {view === 'year'  && <YearView yearRows={yearRows} year={year} />}
      </div>

      {showRates && (
        <RatesModal taxRates={taxRates} cooperationFormats={cooperationFormats} onSave={saveRates} onClose={() => setShowRates(false)} />
      )}

      {/* ── Модальное окно импорта из ЗУП ─────────────────────────────────── */}
      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 14, width: '92vw', maxWidth: 920, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

            {/* Заголовок */}
            <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Upload size={16} color="#059669" /> Импорт «Налоги и взносы» из ЗУП
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{importModal.filename}</div>
                </div>
                <button onClick={() => setImportModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Загрузить в период:</span>
                <select value={importModal.month} onChange={e => setImportModal(d => ({ ...d, month: parseInt(e.target.value) }))}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
                  ))}
                </select>
                <input type="number" min="2020" max="2035" value={importModal.year}
                  onChange={e => setImportModal(d => ({ ...d, year: parseInt(e.target.value) }))}
                  style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  ({importModal.matches.filter(m => m.included && m.matchedEmpId).length} из {importModal.matches.length} строк будут импортированы)
                </span>
              </div>
            </div>

            {/* Таблица */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#f8f9fb', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '9px 10px', width: 36, textAlign: 'center' }}>
                      <input type="checkbox"
                        checked={importModal.matches.every(m => m.included)}
                        onChange={e => setImportModal(d => ({ ...d, matches: d.matches.map(m => ({ ...m, included: e.target.checked })) }))} />
                    </th>
                    <th style={{ padding: '9px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 11 }}>Имя в PDF</th>
                    <th style={{ padding: '9px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 11 }}>Сотрудник в системе</th>
                    <th style={{ padding: '9px 8px', textAlign: 'right', color: '#1d4ed8', fontWeight: 600, fontSize: 11 }}>База</th>
                    <th style={{ padding: '9px 8px', textAlign: 'right', color: '#dc2626', fontWeight: 600, fontSize: 11 }}>НДФЛ</th>
                    <th style={{ padding: '9px 8px', textAlign: 'right', color: '#7c3aed', fontWeight: 600, fontSize: 11 }}>СВ</th>
                    <th style={{ padding: '9px 8px', textAlign: 'right', color: '#0891b2', fontWeight: 600, fontSize: 11 }}>НСП</th>
                    <th style={{ padding: '9px 8px', width: 30 }} />
                  </tr>
                </thead>
                <tbody>
                  {importModal.matches.map((row, idx) => {
                    const matched = !!row.matchedEmpId
                    const fmt = (n, dec = 2) => n > 0 ? n.toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' ₽' : '—'
                    return (
                      <tr key={idx} style={{ borderTop: '1px solid #f3f4f6', background: row.included ? 'white' : '#fafafa', opacity: row.included ? 1 : 0.55, transition: 'opacity 0.15s' }}>
                        <td style={{ textAlign: 'center', padding: '6px 10px' }}>
                          <input type="checkbox" checked={row.included}
                            onChange={e => setImportModal(d => ({ ...d, matches: d.matches.map((m, i) => i === idx ? { ...m, included: e.target.checked } : m) }))} />
                        </td>
                        <td style={{ padding: '6px 8px', color: '#374151', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.name}>
                          {row.name}
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <select value={row.matchedEmpId}
                            onChange={e => setImportModal(d => ({ ...d, matches: d.matches.map((m, i) => i === idx ? { ...m, matchedEmpId: e.target.value, included: !!e.target.value } : m) }))}
                            style={{ width: '100%', padding: '3px 6px', borderRadius: 6, border: `1px solid ${matched ? '#d1d5db' : '#fca5a5'}`, fontSize: 12, background: matched ? 'white' : '#fef2f2' }}>
                            <option value="">— не выбран —</option>
                            {state.employees.filter(e => e.status === 'active').map(e => (
                              <option key={e.id} value={e.id}>{e.fullName}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#1d4ed8', fontFamily: 'monospace', fontSize: 12 }}>{fmt(row.officialBase)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#dc2626', fontFamily: 'monospace', fontSize: 12 }}>{fmt(row.ndfl, 0)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#7c3aed', fontFamily: 'monospace', fontSize: 12 }}>{fmt(row.sv)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#0891b2', fontFamily: 'monospace', fontSize: 12 }}>{fmt(row.nsp)}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          {matched
                            ? <Check size={13} color="#059669" />
                            : <AlertCircle size={13} color="#f59e0b" title="Сотрудник не найден — выберите вручную" />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Подвал */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fafafa', borderRadius: '0 0 14px 14px' }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Значения будут записаны как ручные переопределения (подсветятся жёлтым)
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setImportModal(null)}>Отмена</button>
                <button className="btn btn-primary" onClick={applyImport}
                  disabled={importModal.matches.filter(m => m.included && m.matchedEmpId).length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} /> Применить импорт
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
