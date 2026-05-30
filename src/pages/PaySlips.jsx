import React, { useState, useMemo } from 'react'
import { FileText, Download, Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatMoney, monthName, getCurrentPeriod, BONUS_TYPE_LABELS, getEmpPaymentSettings } from '../utils/helpers'
import { calcTax } from './PayrollTax'

const SCHEME_LABELS = {
  advance_and_salary: 'Аванс + зарплата',
  single_payment: 'Вся зарплата одним платежом',
  custom: 'Индивидуальная схема'
}

function fmt2(v) {
  if (!v && v !== 0) return '—'
  return Number(v).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₽'
}

function generatePayslipHTML(emp, p, companyName, globalSettings, taxRecord, taxRates) {
  const ps = getEmpPaymentSettings(emp, globalSettings)
  const statusLabel = { unpaid: 'Не выплачено', partial: 'Частично выплачено', paid: 'Выплачено' }

  // Налоги
  const officialBase = taxRecord?.officialBase != null ? taxRecord.officialBase : (p.totalEarned || 0)
  const tax = calcTax(officialBase, emp?.cooperationFormat, taxRates, {
    ndfl: taxRecord?.ndflOverride != null ? taxRecord.ndflOverride : undefined,
    sv:   taxRecord?.svOverride   != null ? taxRecord.svOverride   : undefined,
    nsp:  taxRecord?.nspOverride  != null ? taxRecord.nspOverride  : undefined,
  })
  const employerCost = parseFloat((( p.totalEarned || 0) + tax.ndfl + tax.sv + tax.nsp).toFixed(2))

  const advClass  = p.advanceStatus  === 'paid' ? 'status-paid' : p.advanceStatus  === 'partial' ? 'status-partial' : 'status-unpaid'
  const salClass  = p.salaryStatus   === 'paid' ? 'status-paid' : p.salaryStatus   === 'partial' ? 'status-partial' : 'status-unpaid'

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; max-width: 680px; margin: 0 auto; padding: 36px 40px; font-size: 14px; background: #fff; }
  h1 { font-size: 26px; font-weight: 800; margin: 4px 0 2px; letter-spacing: -0.5px; }
  .company { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px; }
  .month  { font-size: 13px; color: #555; margin-bottom: 0; }
  .header { border-bottom: 1.5px solid #111; padding-bottom: 14px; margin-bottom: 20px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 20px; }
  .info-item label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #999; display: block; margin-bottom: 1px; }
  .info-item span  { font-size: 13px; font-weight: 500; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin-bottom: 6px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; font-size: 13px; vertical-align: middle; }
  td:last-child { text-align: right; font-family: 'Consolas', monospace; font-weight: 600; white-space: nowrap; }
  .sub-row td { color: #666; padding-left: 16px; font-size: 12.5px; }
  .total-row td { font-size: 14.5px; font-weight: 800; border-top: 1.5px solid #111; padding-top: 8px; margin-top: 4px; }
  .info-note { display: flex; align-items: flex-start; gap: 6px; margin-top: 10px; background: #f8f9fb; border-radius: 6px; padding: 8px 10px; font-size: 11px; color: #666; line-height: 1.5; }
  .info-note-icon { color: #9ca3af; flex-shrink: 0; font-size: 13px; }
  .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
  .card-payout { background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 16px 18px; }
  .card-company { background: #f8f9fb; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; }
  .card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 4px; }
  .card-amount-green { font-size: 28px; font-weight: 800; color: #059669; font-family: 'Consolas', monospace; line-height: 1.1; }
  .card-amount-dark  { font-size: 28px; font-weight: 800; color: #111; font-family: 'Consolas', monospace; line-height: 1.1; }
  .card-sub { font-size: 11px; color: #6b7280; margin-top: 6px; }
  .status-row { display: flex; align-items: center; gap: 8px; margin-top: 5px; font-size: 11.5px; color: #555; }
  .status-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .status-paid    { background: #dcfce7; color: #15803d; }
  .status-partial { background: #fef9c3; color: #a16207; }
  .status-unpaid  { background: #fee2e2; color: #b91c1c; }
  .comment { font-size: 11.5px; color: #666; font-style: italic; margin-top: 8px; }
  .footer { margin-top: 28px; font-size: 10px; color: #bbb; text-align: center; border-top: 1px solid #f0f0f0; padding-top: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">${companyName || 'Компания'}</div>
    <h1>Расчётный листок</h1>
    <div class="month">${monthName(p.month)} ${p.year}</div>
  </div>

  <div class="info-grid">
    <div class="info-item"><label>ФИО</label><span><strong>${emp?.fullName || '—'}</strong></span></div>
    <div class="info-item"><label>Должность</label><span>${p.position || emp?.position || '—'}</span></div>
    <div class="info-item"><label>Отдел</label><span>${p.department || emp?.department || '—'}</span></div>
    <div class="info-item"><label>Руководитель</label><span>${p.manager || emp?.manager || '—'}</span></div>
    <div class="info-item"><label>Схема выплаты</label><span>${SCHEME_LABELS[ps.paymentScheme] || 'Аванс + зарплата'}</span></div>
    <div class="info-item"><label>День выплаты зарплаты</label><span>${ps.salaryDay}-е число</span></div>
  </div>

  <!-- НАЧИСЛЕНО -->
  <div class="section">
    <div class="section-title">Начислено</div>
    <table>
      ${p.salaryAmount > 0 ? `<tr><td>Оклад</td><td>${formatMoney(p.salaryAmount)}</td></tr>` : ''}
      ${p.bonus > 0 ? `<tr><td>Премия (${BONUS_TYPE_LABELS[p.bonusType] || 'обычная'})</td><td>${formatMoney(p.bonus)}</td></tr>` : ''}
      ${p.additionalEarnings > 0 ? `<tr><td>Дополнительное начисление</td><td>${formatMoney(p.additionalEarnings)}</td></tr>` : ''}
      ${p.vacationPay > 0 ? `<tr><td>Отпускные</td><td>${formatMoney(p.vacationPay)}</td></tr>` : ''}
      <tr class="total-row"><td>Итого начислено <span style="font-size:12px;font-weight:600;color:#555">(за вычетом НДФЛ)</span></td><td>${formatMoney(p.totalEarned)}</td></tr>
    </table>
  </div>

  <!-- УДЕРЖАНО / ВЫПЛАЧЕНО РАНЕЕ -->
  <div class="section">
    <div class="section-title">Удержано / Выплачено ранее</div>
    <table>
      ${!ps.hasAdvance
        ? '<tr><td colspan="2" style="color:#aaa;font-size:12px;font-style:italic">Аванс не предусмотрен схемой выплаты</td></tr>'
        : (p.totalAdvance > 0
            ? `<tr><td><strong>Итоговый аванс</strong></td><td><strong>${formatMoney(p.totalAdvance)}</strong></td></tr>
               ${p.officialAdvance > 0 ? `<tr class="sub-row"><td>— Официальный аванс</td><td>${formatMoney(p.officialAdvance)}</td></tr>` : ''}
               ${p.unofficialAdvance > 0 ? `<tr class="sub-row"><td>— Второй аванс</td><td>${formatMoney(p.unofficialAdvance)}</td></tr>` : ''}`
            : '<tr><td colspan="2" style="color:#aaa;font-size:12px;font-style:italic">Аванс не выплачивался</td></tr>'
          )
      }
      ${p.officialSalaryPart > 0 ? `<tr><td>Официальная часть зарплаты</td><td>${formatMoney(p.officialSalaryPart)}</td></tr>` : ''}
      ${p.salaryOnAccount > 0 ? `<tr><td>Деньги в счёт зарплаты</td><td>${formatMoney(p.salaryOnAccount)}</td></tr>` : ''}
      ${p.fine > 0 ? `<tr><td>Штраф</td><td style="color:#dc2626">${formatMoney(p.fine)}</td></tr>` : ''}
      ${p.otherDeductions > 0 ? `<tr><td>Прочие удержания</td><td style="color:#dc2626">${formatMoney(p.otherDeductions)}</td></tr>` : ''}
      ${p.totalDeducted > 0
        ? `<tr class="total-row"><td>Итого выдано</td><td>${formatMoney(p.totalDeducted)}</td></tr>`
        : '<tr><td colspan="2" style="color:#aaa;font-size:12px">Нет выплат</td></tr>'
      }
    </table>
  </div>

  <!-- ПОЛНАЯ СТОИМОСТЬ ДЛЯ КОМПАНИИ -->
  <div class="section">
    <div class="section-title">Полная стоимость сотрудника для компании</div>
    <table>
      <tr><td>Начислено сотруднику (за вычетом НДФЛ)</td><td>${formatMoney(p.totalEarned)}</td></tr>
      ${tax.ndfl > 0 ? `<tr><td>НДФЛ (удерживается из зарплаты)</td><td>${formatMoney(tax.ndfl)}</td></tr>` : ''}
      ${tax.sv > 0 ? `<tr><td>Страховые взносы работодателя (${tax.rates.svLabel})</td><td>${fmt2(tax.sv)}</td></tr>` : ''}
      ${tax.nsp > 0 ? `<tr><td>НСП — несчастные случаи (${tax.rates.nspLabel})</td><td>${fmt2(tax.nsp)}</td></tr>` : ''}
      <tr class="total-row"><td>Полная стоимость для компании</td><td>${fmt2(employerCost)}</td></tr>
    </table>
    <div class="info-note">
      <span class="info-note-icon">ⓘ</span>
      <span>НДФЛ удерживается из зарплаты сотрудника и уплачивается работодателем в бюджет. Страховые взносы и НСП компания оплачивает сверх начислений.</span>
    </div>
  </div>

  <!-- НИЖНИЕ КАРТОЧКИ -->
  <div class="bottom-grid">
    <div class="card-payout">
      <div class="card-label">К выплате</div>
      <div class="card-amount-green">${formatMoney(p.remaining)}</div>
      <div class="status-row">Статус аванса: <span class="status-badge ${advClass}">${statusLabel[p.advanceStatus] || 'Не выплачено'}</span></div>
      <div class="status-row">Статус зарплаты: <span class="status-badge ${salClass}">${statusLabel[p.salaryStatus] || 'Не выплачено'}</span></div>
      ${p.comment ? `<div class="comment">Примечание: ${p.comment}</div>` : ''}
    </div>
    <div class="card-company">
      <div class="card-label">Для компании</div>
      <div class="card-amount-dark">${fmt2(employerCost)}</div>
      <div class="card-sub">Зарплата + НДФЛ + страховые взносы${tax.nsp > 0 ? ' + НСП' : ''}</div>
    </div>
  </div>

  <div class="footer">Сформировано ${new Date().toLocaleDateString('ru-RU')} · Учет выплат</div>
</body>
</html>`
}

export default function PaySlips() {
  const { state } = useApp()
  const now = getCurrentPeriod()
  const [month, setMonth] = useState(now.month)
  const [year, setYear] = useState(now.year)
  const [selectedEmpId, setSelectedEmpId] = useState('')
  const [preview, setPreview] = useState(false)

  const payrolls = useMemo(() =>
    state.payrolls.filter(p => p.month === month && p.year === year),
    [state.payrolls, month, year]
  )

  const employeesWithPayroll = useMemo(() =>
    payrolls
      .map(p => {
        const emp = state.employees.find(e => e.id === p.employeeId)
        return emp ? { ...p, emp } : null
      })
      .filter(Boolean),
    [payrolls, state.employees]
  )

  const selected = selectedEmpId
    ? employeesWithPayroll.find(r => r.employeeId === selectedEmpId)
    : null

  const taxRecord = useMemo(() =>
    selected
      ? (state.taxRecords?.find(r => r.employeeId === selected.employeeId && r.month === month && r.year === year) || null)
      : null,
    [selected, state.taxRecords, month, year]
  )

  const taxRates = state.settings?.taxRates || {}

  const html = selected
    ? generatePayslipHTML(selected.emp, selected, state.settings?.companyName, state.settings, taxRecord, taxRates)
    : ''

  async function handleExportPDF() {
    if (!selected || !window.electronAPI) return
    const filename = `payslip_${selected.emp.fullName.replace(/\s+/g, '_')}_${month}_${year}.pdf`
    await window.electronAPI.exportPDF({ html, filename })
  }

  async function handlePrint() {
    if (!selected || !window.electronAPI) return
    await window.electronAPI.printPayslip({ html })
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="page-title">Расчётные листки</div>
          <div className="page-subtitle">Просмотр и экспорт</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left panel - selection */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={prevMonth}><ChevronLeft size={13} /></button>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{monthName(month)} {year}</span>
            <button className="btn btn-secondary btn-sm" onClick={nextMonth}><ChevronRight size={13} /></button>
          </div>

          <div className="section-title">Сотрудник</div>
          {employeesWithPayroll.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
              Нет данных за {monthName(month)} {year}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {employeesWithPayroll.map(r => (
                <button
                  key={r.employeeId}
                  onClick={() => setSelectedEmpId(r.employeeId)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: selectedEmpId === r.employeeId ? '#eff6ff' : 'transparent',
                    color: selectedEmpId === r.employeeId ? '#1d4ed8' : 'var(--text-primary)',
                    fontWeight: selectedEmpId === r.employeeId ? 600 : 400,
                    fontSize: 13
                  }}
                >
                  <div>{r.emp?.fullName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {formatMoney(r.remaining)} к выплате
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right panel - preview + actions */}
        {selected ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: '#f8f9fb' }}>
              <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
                <Printer size={13} /> Печать
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleExportPDF}>
                <Download size={13} /> Экспорт PDF
              </button>
            </div>
            <div style={{ padding: 0 }}>
              <iframe
                srcDoc={html}
                style={{ width: '100%', height: 'calc(100vh - 240px)', border: 'none', minHeight: 500 }}
                title="Расчётный листок"
              />
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon"><FileText size={48} /></div>
              <h3>Выберите сотрудника</h3>
              <p>Расчётный листок сформируется автоматически</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
