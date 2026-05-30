import React, { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import {
  TrendingUp, AlertTriangle, CheckCircle, Info,
  Plus, Edit2, Trash2, Download, Printer,
  ChevronLeft, ChevronRight, X, Wallet
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatMoney, monthName, monthShort, getCurrentPeriod } from '../utils/helpers'

const Dash = () => <span style={{ color: 'var(--text-muted)' }}>—</span>

function fmt(v) {
  if (v == null) return '0'
  const a = Math.abs(v)
  if (a >= 1000000) return `${(v / 1000000).toFixed(1)}М`
  if (a >= 1000) return `${(v / 1000).toFixed(0)}К`
  return v.toLocaleString('ru-RU')
}

function fotColor(s) {
  if (s === 'ok') return '#059669'
  if (s === 'warning') return '#d97706'
  if (s === 'critical') return '#dc2626'
  return 'var(--text-muted)'
}
function fotBg(s) {
  if (s === 'ok') return '#ecfdf5'
  if (s === 'warning') return '#fffbeb'
  if (s === 'critical') return '#fef2f2'
  return '#f9fafb'
}
function fotLabel(s) {
  if (s === 'ok') return 'Норма'
  if (s === 'warning') return 'Внимание'
  if (s === 'critical') return 'Критично'
  return '—'
}
function fotBadge(s) {
  if (s === 'ok') return 'badge-success'
  if (s === 'warning') return 'badge-warning'
  if (s === 'critical') return 'badge-danger'
  return 'badge-neutral'
}

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color, marginTop: 2 }}>
          {p.name}: {p.unit === '%' ? `${Number(p.value).toFixed(1)}%` : formatMoney(p.value)}
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, children, height = 250 }) {
  return (
    <div className="chart-card">
      <div className="chart-title">{title}</div>
      <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>
    </div>
  )
}

function SCard({ label, value, sub, color = '#3b82f6', bg = '#eff6ff', icon: Icon, extra }) {
  return (
    <div className="stat-card" style={{ borderColor: extra ? '#fca5a5' : undefined }}>
      <div className="stat-icon" style={{ background: bg }}><Icon size={18} color={color} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color, fontSize: 17 }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {extra}
    </div>
  )
}

function FinModal({ month, year, fin, pd, onClose, onSave }) {
  const [form, setForm] = useState({
    revenue: fin?.revenue ?? '',
    fixedExpenses: fin?.fixedExpenses ?? '',
    otherExpenses: fin?.otherExpenses ?? '',
    comment: fin?.comment ?? ''
  })
  const s = (f, v) => setForm(x => ({ ...x, [f]: v }))
  const rev = parseFloat(form.revenue) || 0
  const fix = parseFloat(form.fixedExpenses) || 0
  const oth = parseFloat(form.otherExpenses) || 0
  const profBefore = rev - fix - oth
  const profAfter = profBefore - pd.fot
  const fotPct = rev > 0 ? (pd.fot / rev * 100) : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{monthName(month)} {year}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Финансовые данные за месяц</div>
          </div>
          <button className="btn btn-icon btn-secondary" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ background: '#f8f9fb', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>
              Из начислений (автоматически)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                ['ФОТ (начислено)', formatMoney(pd.fot)],
                ['Авансы выплачены', formatMoney(pd.advances)],
                ['Остаток к выплате', formatMoney(pd.remaining)],
                ['Премии', formatMoney(pd.bonuses)],
                ['Штрафы/удержания', formatMoney(pd.deductions)],
                ['Сотрудников', String(pd.count)],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[['revenue','Выручка ₽'],['fixedExpenses','Постоянные расходы ₽'],['otherExpenses','Прочие расходы ₽']].map(([f, lbl]) => (
              <div className="form-group" key={f}>
                <label className="form-label">{lbl}</label>
                <input type="number" min="0" className="input input-mono" placeholder="0"
                  value={form[f]} onChange={e => s(f, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Комментарий собственника</label>
            <textarea className="textarea" rows={2} placeholder="Заметки, пояснения..."
              value={form.comment} onChange={e => s('comment', e.target.value)} />
          </div>

          {(rev > 0 || pd.fot > 0) && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#0369a1', letterSpacing: '0.05em', marginBottom: 10 }}>Предварительный расчёт</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  ['Прибыль до з/п', formatMoney(profBefore), profBefore >= 0 ? '#059669' : '#dc2626'],
                  ['Прибыль после з/п', formatMoney(profAfter), profAfter >= 0 ? '#059669' : '#dc2626'],
                  ['% ФОТ от выручки', rev > 0 ? `${fotPct.toFixed(1)}%` : '—', fotPct > 45 ? '#dc2626' : fotPct > 35 ? '#d97706' : '#059669'],
                  ['Чистый остаток', formatMoney(profAfter), profAfter >= 0 ? '#059669' : '#dc2626'],
                ].map(([l, v, c]) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 13, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={() => onSave({
            revenue: parseFloat(form.revenue) || 0,
            fixedExpenses: parseFloat(form.fixedExpenses) || 0,
            otherExpenses: parseFloat(form.otherExpenses) || 0,
            comment: form.comment
          })}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}

export default function FinancialPicture() {
  const { state, dispatch } = useApp()
  const { month: curMonth, year: curYear } = getCurrentPeriod()
  const [year, setYear] = useState(curYear)
  const [selMonth, setSelMonth] = useState(curMonth)
  const [editMonth, setEditMonth] = useState(null)

  const maxFot = state.settings?.maxFotPct ?? 35
  const critFot = state.settings?.criticalFotPct ?? 45

  function getStatus(fotPct, hasRev) {
    if (!hasRev) return 'none'
    if (fotPct >= critFot) return 'critical'
    if (fotPct >= maxFot) return 'warning'
    return 'ok'
  }

  const data = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const pr = state.payrolls.filter(p => p.month === m && p.year === year)
    const fot = pr.reduce((s, p) => s + (p.totalEarned || 0), 0)
    const advances = pr.reduce((s, p) => s + (p.officialAdvance || 0) + (p.unofficialAdvance || 0) + (p.salaryOnAccount || 0), 0)
    const deductions = pr.reduce((s, p) => s + (p.fine || 0) + (p.otherDeductions || 0), 0)
    const bonuses = pr.reduce((s, p) => s + (p.bonus || 0), 0)
    const remaining = pr.reduce((s, p) => s + (p.remaining || 0), 0)
    const fin = state.financeByMonth.find(f => f.month === m && f.year === year) || {}
    const revenue = fin.revenue || 0
    const fixedExpenses = fin.fixedExpenses || 0
    const otherExpenses = fin.otherExpenses || 0
    const comment = fin.comment || ''
    const fotPct = revenue > 0 ? fot / revenue * 100 : 0
    const totalExp = fot + fixedExpenses + otherExpenses
    const fotInExp = totalExp > 0 ? fot / totalExp * 100 : 0
    const profitBefore = revenue - fixedExpenses - otherExpenses
    const profitAfter = profitBefore - fot
    const status = getStatus(fotPct, revenue > 0)
    return {
      m, name: monthShort(m), fullName: monthName(m),
      fot, advances, deductions, bonuses, remaining, count: pr.length,
      revenue, fixedExpenses, otherExpenses, comment,
      fotPct: +fotPct.toFixed(2), fotInExp: +fotInExp.toFixed(2),
      profitBefore, profitAfter, status,
      hasFin: revenue > 0 || fixedExpenses > 0 || otherExpenses > 0
    }
  }), [state.payrolls, state.financeByMonth, year, maxFot, critFot])

  const cur = data[selMonth - 1]

  const prev = useMemo(() => {
    if (selMonth === 1) {
      const m = 12, y = year - 1
      const pr = state.payrolls.filter(p => p.month === m && p.year === y)
      const fot = pr.reduce((s, p) => s + (p.totalEarned || 0), 0)
      const fin = state.financeByMonth.find(f => f.month === m && f.year === y) || {}
      const revenue = fin.revenue || 0
      return { fot, revenue, profitAfter: revenue - (fin.fixedExpenses || 0) - (fin.otherExpenses || 0) - fot }
    }
    const d = data[selMonth - 2]
    return { fot: d.fot, revenue: d.revenue, profitAfter: d.profitAfter }
  }, [state, selMonth, year, data])

  const totals = useMemo(() => data.reduce((a, m) => ({
    revenue: a.revenue + m.revenue,
    fixedExpenses: a.fixedExpenses + m.fixedExpenses,
    otherExpenses: a.otherExpenses + m.otherExpenses,
    fot: a.fot + m.fot,
    bonuses: a.bonuses + m.bonuses,
    advances: a.advances + m.advances,
    deductions: a.deductions + m.deductions,
    profitAfter: a.profitAfter + m.profitAfter
  }), { revenue: 0, fixedExpenses: 0, otherExpenses: 0, fot: 0, bonuses: 0, advances: 0, deductions: 0, profitAfter: 0 }), [data])

  function handleSave(month, payload) {
    const existing = state.financeByMonth.find(f => f.month === month && f.year === year) || {}
    dispatch({ type: 'UPSERT_FINANCE', payload: { ...existing, ...payload, month, year } })
    setEditMonth(null)
  }

  function handleDelete(month) {
    if (!confirm('Удалить финансовые данные за этот месяц?')) return
    dispatch({ type: 'DELETE_FINANCE', payload: { month, year } })
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify({ year, exportedAt: new Date().toISOString(), months: data, totals }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `finance-${year}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  function pctChange(curr, p) {
    if (!p || p === 0) return null
    const d = (curr - p) / Math.abs(p) * 100
    return { v: Math.abs(d).toFixed(1), up: d >= 0 }
  }

  const prevMLabel = selMonth === 1 ? `${monthName(12)} ${year - 1}` : `${monthName(selMonth - 1)} ${year}`
  const editData = editMonth ? data[editMonth - 1] : null

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">Финансовая картина</div>
          <div className="page-subtitle">Управленческий учёт · {year}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}><Download size={14} /> Экспорт</button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={14} /> Печать</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y - 1)}><ChevronLeft size={14} /></button>
          <span style={{ fontWeight: 700, minWidth: 48, textAlign: 'center' }}>{year}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setYear(y => y + 1)}><ChevronRight size={14} /></button>
        </div>
      </div>

      {/* Month pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {data.map(d => (
          <button key={d.m} onClick={() => setSelMonth(d.m)} style={{
            position: 'relative', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
            border: `1px solid ${selMonth === d.m ? '#3b82f6' : 'var(--border)'}`,
            background: selMonth === d.m ? '#eff6ff' : 'white',
            color: selMonth === d.m ? '#2563eb' : 'var(--text-secondary)',
            fontWeight: selMonth === d.m ? 700 : 400,
          }}>
            {d.name}
            {d.status !== 'none' && (
              <span style={{
                position: 'absolute', top: -3, right: -3, width: 7, height: 7, borderRadius: '50%',
                background: d.status === 'critical' ? '#dc2626' : '#f59e0b', border: '1px solid white'
              }} />
            )}
          </button>
        ))}
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}
          onClick={() => setEditMonth(selMonth)}>
          <Plus size={14} /> {cur.hasFin ? 'Редактировать' : 'Добавить данные'}
        </button>
      </div>

      {/* Month label + status */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        {cur.fullName} {year}
        {cur.status !== 'none' && <span className={`badge ${fotBadge(cur.status)}`}>{fotLabel(cur.status)}</span>}
      </div>

      {/* Stat cards row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
        <SCard label="Выручка за месяц" value={formatMoney(cur.revenue)}
          sub={!cur.revenue ? 'Данные не внесены' : undefined}
          color="#3b82f6" bg="#eff6ff" icon={TrendingUp} />
        <SCard label="Постоянные расходы" value={formatMoney(cur.fixedExpenses)}
          color="#6b7280" bg="#f9fafb" icon={Wallet} />
        <SCard label="ФОТ (начислено)" value={formatMoney(cur.fot)}
          sub={`${cur.count} сотр. · Авансы: ${formatMoney(cur.advances)}`}
          color="#8b5cf6" bg="#f5f3ff" icon={TrendingUp} />
      </div>

      {/* Stat cards row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <SCard label="Прибыль после зарплаты" value={formatMoney(cur.profitAfter)}
          sub={cur.revenue > 0 ? `До з/п: ${formatMoney(cur.profitBefore)}` : 'Нет данных о выручке'}
          color={cur.profitAfter >= 0 ? '#059669' : '#dc2626'}
          bg={cur.profitAfter >= 0 ? '#ecfdf5' : '#fef2f2'} icon={TrendingUp} />
        <SCard label="Доля ФОТ от выручки"
          value={cur.revenue > 0 ? `${cur.fotPct.toFixed(1)}%` : '—'}
          sub={cur.revenue > 0 ? `От расходов: ${cur.fotInExp.toFixed(1)}%` : 'Введите выручку'}
          color={fotColor(cur.status)} bg={fotBg(cur.status)} icon={TrendingUp} />
        {/* Risk card */}
        <div className="stat-card" style={{ borderColor: cur.status === 'critical' ? '#fca5a5' : cur.status === 'warning' ? '#fcd34d' : 'var(--border)' }}>
          <div className="stat-icon" style={{ background: fotBg(cur.status) }}>
            {cur.status === 'ok' ? <CheckCircle size={18} color="#059669" /> :
             cur.status !== 'none' ? <AlertTriangle size={18} color={fotColor(cur.status)} /> :
             <Info size={18} color="var(--text-muted)" />}
          </div>
          <div className="stat-label">Финансовый риск</div>
          <div className="stat-value" style={{ fontSize: 14, color: fotColor(cur.status) }}>
            {cur.status === 'none' && 'Нет данных'}
            {cur.status === 'ok' && 'ФОТ в норме'}
            {cur.status === 'warning' && 'Повышенная нагрузка'}
            {cur.status === 'critical' && 'ФОТ превышает норму!'}
          </div>
          {cur.status === 'critical' && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>ФОТ превышает допустимую нагрузку ({critFot}%) на бизнес</div>}
          {cur.status === 'warning' && <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>ФОТ выше {maxFot}% — рекомендуется оптимизация</div>}
        </div>
      </div>

      {/* Comparison */}
      {(cur.revenue > 0 || prev.revenue > 0 || cur.fot > 0) && (
        <div className="card" style={{ padding: '14px 20px', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Сравнение с {prevMLabel}
          </div>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            {[
              ['Выручка', cur.revenue, prev.revenue],
              ['ФОТ', cur.fot, prev.fot],
              ['Прибыль после з/п', cur.profitAfter, prev.profitAfter],
            ].map(([label, curr, p]) => {
              const ch = pctChange(curr, p)
              return (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>{formatMoney(curr)}</div>
                  {ch && <div style={{ fontSize: 11, color: ch.up ? '#059669' : '#dc2626', marginTop: 2 }}>{ch.up ? '↑' : '↓'} {ch.v}%</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Charts 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <ChartCard title="Выручка и ФОТ по месяцам">
          <LineChart data={data} margin={{ top: 4, right: 20, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
            <Tooltip content={<Tip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="revenue" name="Выручка" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="fot" name="ФОТ" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 4" />
          </LineChart>
        </ChartCard>

        <ChartCard title="Прибыль после зарплаты по месяцам">
          <AreaChart data={data} margin={{ top: 4, right: 20, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
            <Tooltip content={<Tip />} />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Area type="monotone" dataKey="profitAfter" name="Прибыль" stroke="#10b981" fill="#d1fae5" strokeWidth={2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title={`Доля ФОТ от выручки (норма ≤${maxFot}%, критично ≥${critFot}%)`}>
          <LineChart data={data} margin={{ top: 4, right: 40, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis unit="%" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
            <Tooltip formatter={v => [`${Number(v).toFixed(1)}%`, '% ФОТ']} />
            <ReferenceLine y={maxFot} stroke="#f59e0b" strokeDasharray="5 3"
              label={{ value: `${maxFot}%`, position: 'insideTopRight', fontSize: 10, fill: '#d97706' }} />
            <ReferenceLine y={critFot} stroke="#ef4444" strokeDasharray="5 3"
              label={{ value: `${critFot}%`, position: 'insideTopRight', fontSize: 10, fill: '#dc2626' }} />
            <Line type="monotone" dataKey="fotPct" name="% ФОТ" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Структура расходов по месяцам">
          <BarChart data={data} margin={{ top: 4, right: 20, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
            <Tooltip content={<Tip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="fot" name="ФОТ" fill="#8b5cf6" stackId="a" />
            <Bar dataKey="fixedExpenses" name="Пост. расходы" fill="#3b82f6" stackId="a" />
            <Bar dataKey="otherExpenses" name="Проч. расходы" fill="#10b981" stackId="a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      {/* Annual table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Годовая финансовая таблица — {year}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Выручка: {formatMoney(totals.revenue)} · ФОТ: {formatMoney(totals.fot)} · Прибыль: {formatMoney(totals.profitAfter)}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 1350 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#f8f9fb', zIndex: 2 }}>Месяц</th>
                <th>Выручка</th>
                <th>Пост. расходы</th>
                <th>Проч. расходы</th>
                <th>ФОТ</th>
                <th>Премии</th>
                <th>Авансы</th>
                <th>Удержания</th>
                <th>Прибыль</th>
                <th>% ФОТ</th>
                <th>Статус</th>
                <th>Комментарий</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.m} style={{ background: row.m === selMonth ? '#fafbff' : undefined }}>
                  <td style={{
                    fontWeight: 600, position: 'sticky', left: 0, zIndex: 1,
                    background: row.m === selMonth ? '#fafbff' : 'white',
                    borderRight: '1px solid var(--border)'
                  }}>
                    {row.fullName}
                    {row.m === curMonth && year === curYear && <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--accent)' }}>●</span>}
                  </td>
                  <td className="money">{row.revenue > 0 ? formatMoney(row.revenue) : <Dash />}</td>
                  <td className="money">{row.fixedExpenses > 0 ? formatMoney(row.fixedExpenses) : <Dash />}</td>
                  <td className="money">{row.otherExpenses > 0 ? formatMoney(row.otherExpenses) : <Dash />}</td>
                  <td className="money">{row.fot > 0 ? formatMoney(row.fot) : <Dash />}</td>
                  <td className="money">{row.bonuses > 0 ? formatMoney(row.bonuses) : <Dash />}</td>
                  <td className="money">{row.advances > 0 ? formatMoney(row.advances) : <Dash />}</td>
                  <td className="money">{row.deductions > 0 ? <span style={{ color: 'var(--danger)' }}>{formatMoney(row.deductions)}</span> : <Dash />}</td>
                  <td className="money">
                    {row.revenue > 0
                      ? <span style={{ fontWeight: 700, color: row.profitAfter >= 0 ? '#059669' : '#dc2626' }}>{formatMoney(row.profitAfter)}</span>
                      : <Dash />}
                  </td>
                  <td>{row.status !== 'none' ? <span style={{ fontWeight: 700, color: fotColor(row.status) }}>{row.fotPct.toFixed(1)}%</span> : <Dash />}</td>
                  <td>{row.status !== 'none' ? <span className={`badge ${fotBadge(row.status)}`}>{fotLabel(row.status)}</span> : <Dash />}</td>
                  <td style={{ maxWidth: 140, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.comment || <Dash />}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-icon btn-secondary" onClick={() => { setSelMonth(row.m); setEditMonth(row.m) }}><Edit2 size={13} /></button>
                      {row.hasFin && <button className="btn btn-icon btn-danger" onClick={() => handleDelete(row.m)}><Trash2 size={13} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="table-footer">
                <td>Итого</td>
                <td className="money">{formatMoney(totals.revenue)}</td>
                <td className="money">{formatMoney(totals.fixedExpenses)}</td>
                <td className="money">{formatMoney(totals.otherExpenses)}</td>
                <td className="money">{formatMoney(totals.fot)}</td>
                <td className="money">{formatMoney(totals.bonuses)}</td>
                <td className="money">{formatMoney(totals.advances)}</td>
                <td className="money">{formatMoney(totals.deductions)}</td>
                <td className="money" style={{ color: totals.profitAfter >= 0 ? '#059669' : '#dc2626', fontWeight: 800 }}>{formatMoney(totals.profitAfter)}</td>
                <td><Dash /></td><td><Dash /></td><td></td><td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {editMonth && editData && (
        <FinModal
          month={editMonth} year={year}
          fin={state.financeByMonth.find(f => f.month === editMonth && f.year === year)}
          pd={editData}
          onClose={() => setEditMonth(null)}
          onSave={d => handleSave(editMonth, d)}
        />
      )}
    </div>
  )
}
