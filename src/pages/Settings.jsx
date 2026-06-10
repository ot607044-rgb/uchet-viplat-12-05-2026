import { useState } from 'react';
import { Settings as SettingsIcon, Save, Upload, Download, FolderOpen, Bell, Palette, Calendar, TrendingUp, Users, X, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';

const PALETTE = [
  { label: 'Белый', value: '#ffffff' },
  { label: 'Светло-серый', value: '#f8fafc' },
  { label: 'Тёплый белый', value: '#fefce8' },
  { label: 'Голубоватый', value: '#f0f9ff' },
  { label: 'Мятный', value: '#f0fdf4' },
  { label: 'Лавандовый', value: '#faf5ff' },
  { label: 'Персиковый', value: '#fff7ed' },
  { label: 'Розовый', value: '#fdf2f8' },
];

function VacationOverlapRules() {
  const { state, dispatch } = useApp();
  const rules = state.settings.vacationOverlapRules || [];
  const employees = state.employees.filter(e => !e.dismissDate);
  const depts = [...new Set(state.employees.map(e => e.department).filter(Boolean))].sort();

  const [tab, setTab] = useState('dept'); // 'dept' | 'pair'
  const [dept, setDept] = useState('');
  const [empA, setEmpA] = useState('');
  const [empB, setEmpB] = useState('');

  function saveRules(newRules) {
    dispatch({ type: 'UPDATE_SETTINGS', payload: { ...state.settings, vacationOverlapRules: newRules } });
  }

  function addDeptRule() {
    if (!dept) return;
    if (rules.some(r => r.type === 'dept' && r.dept === dept)) return;
    saveRules([...rules, { id: Date.now().toString(36), type: 'dept', dept }]);
    setDept('');
  }

  function addPairRule() {
    if (!empA || !empB || empA === empB) return;
    if (rules.some(r => r.type === 'pair' && (
      (r.empAId === empA && r.empBId === empB) || (r.empAId === empB && r.empBId === empA)
    ))) return;
    saveRules([...rules, { id: Date.now().toString(36), type: 'pair', empAId: empA, empBId: empB }]);
    setEmpA(''); setEmpB('');
  }

  function removeRule(id) {
    saveRules(rules.filter(r => r.id !== id));
  }

  function empName(id) {
    return employees.find(e => e.id === id)?.fullName || '—';
  }

  const deptRules = rules.filter(r => r.type === 'dept');
  const pairRules = rules.filter(r => r.type === 'pair');

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-header">
        <Users size={18} style={{ color: 'var(--accent)' }} />
        <span className="card-title">Правила пересечения отпусков</span>
      </div>
      <div className="card-body">
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Настройте у кого с кем не должны пересекаться отпуска. В аналитике будут отображаться только нарушения этих правил.
        </div>

        {/* Табы */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
          {[{ key: 'dept', label: '🏢 По отделу' }, { key: 'pair', label: '👥 По паре' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: tab === t.key ? 'var(--accent)' : 'white',
              color: tab === t.key ? 'white' : 'var(--text-secondary)',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Форма по отделу */}
        {tab === 'dept' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Все сотрудники отдела не могут уходить в отпуск одновременно друг с другом.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="select input-sm" value={dept} onChange={e => setDept(e.target.value)} style={{ minWidth: 240 }}>
                <option value="">— Выберите отдел —</option>
                {depts.filter(d => !rules.some(r => r.type === 'dept' && r.dept === d)).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={addDeptRule} disabled={!dept} style={{ whiteSpace: 'nowrap' }}>
                <Plus size={13} /> Добавить
              </button>
            </div>
          </div>
        )}

        {/* Форма по паре */}
        {tab === 'pair' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Конкретная пара сотрудников не может быть в отпуске одновременно.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 8, alignItems: 'center' }}>
              <select className="select input-sm" value={empA} onChange={e => setEmpA(e.target.value)}>
                <option value="">— Сотрудник 1 —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', padding: '0 4px' }}>↔</span>
              <select className="select input-sm" value={empB} onChange={e => setEmpB(e.target.value)}>
                <option value="">— Сотрудник 2 —</option>
                {employees.filter(e => e.id !== empA).map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={addPairRule} disabled={!empA || !empB} style={{ whiteSpace: 'nowrap' }}>
                <Plus size={13} /> Добавить
              </button>
            </div>
          </div>
        )}

        {/* Список правил */}
        {rules.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-secondary)', borderRadius: 8 }}>
            Правила не заданы — в аналитике отображаются все пересечения
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {deptRules.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 13 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '2px 7px', borderRadius: 4 }}>ОТДЕЛ</span>
                <span style={{ fontWeight: 600 }}>🏢 {r.dept}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>— все сотрудники не пересекаются между собой</span>
                <button onClick={() => removeRule(r.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 4px', borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
            {pairRules.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 7px', borderRadius: 4 }}>ПАРА</span>
                <span style={{ fontWeight: 600 }}>{empName(r.empAId)}</span>
                <span style={{ color: 'var(--text-muted)' }}>↔</span>
                <span style={{ fontWeight: 600 }}>{empName(r.empBId)}</span>
                <button onClick={() => removeRule(r.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px 4px', borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { state, dispatch, importJSON } = useApp();
  const { settings } = state;

  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [dataPath, setDataPath] = useState('');
  const [importMsg, setImportMsg] = useState('');

  const handleSave = () => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: local });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = async () => {
    const data = {
      employees: state.employees,
      payrolls: state.payrolls,
      departments: state.departments,
      managers: state.managers,
      financeByMonth: state.financeByMonth,
      settings: state.settings,
    };
    if (window.electronAPI) {
      await window.electronAPI.exportJSON(data);
    } else {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    }
  };

  const handleImport = async () => {
    if (window.electronAPI) {
      const ok = await importJSON();
      if (ok) {
        setImportMsg('Данные успешно импортированы!');
        setTimeout(() => setImportMsg(''), 3000);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            dispatch({ type: 'LOAD', payload: data });
            setImportMsg('Данные успешно импортированы!');
            setTimeout(() => setImportMsg(''), 3000);
          } catch {
            setImportMsg('Ошибка: некорректный файл JSON');
            setTimeout(() => setImportMsg(''), 3000);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
  };

  const handleGetPath = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.getDataPath();
      setDataPath(path);
    } else {
      setDataPath('localStorage (браузерный режим)');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          <SettingsIcon size={24} /> Настройки
        </h1>
      </div>

      {saved && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          ✓ Настройки сохранены
        </div>
      )}
      {importMsg && (
        <div className={`alert ${importMsg.includes('Ошибка') ? 'alert-danger' : 'alert-success'}`} style={{ marginBottom: 16 }}>
          {importMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Даты выплат */}
        <div className="card">
          <div className="card-header">
            <Calendar size={18} style={{ color: 'var(--accent)' }} />
            <span className="card-title">Даты выплат</span>
          </div>
          <div className="card-body">
            <div style={{ padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#1d4ed8' }}>
              Эти даты применяются ко всем сотрудникам, если в карточке сотрудника не включены индивидуальные настройки выплат.
            </div>
            <div className="form-group">
              <label className="form-label">День выплаты аванса (по умолчанию)</label>
              <input
                type="number"
                className="form-input"
                min={1} max={31}
                value={local.advanceDay}
                onChange={e => setLocal(p => ({ ...p, advanceDay: +e.target.value }))}
              />
              <small style={{ color: 'var(--text-secondary)' }}>Число месяца (1–31). По умолчанию: 30</small>
            </div>
            <div className="form-group">
              <label className="form-label">День выплаты зарплаты (по умолчанию)</label>
              <input
                type="number"
                className="form-input"
                min={1} max={31}
                value={local.salaryDay}
                onChange={e => setLocal(p => ({ ...p, salaryDay: +e.target.value }))}
              />
              <small style={{ color: 'var(--text-secondary)' }}>Число месяца (1–31). По умолчанию: 15</small>
            </div>
          </div>
        </div>

        {/* Напоминания */}
        <div className="card">
          <div className="card-header">
            <Bell size={18} style={{ color: 'var(--accent)' }} />
            <span className="card-title">Напоминания</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Напоминать за N дней до выплаты</label>
              <input
                type="number"
                className="form-input"
                min={0} max={14}
                value={local.reminderDaysBefore}
                onChange={e => setLocal(p => ({ ...p, reminderDaysBefore: +e.target.value }))}
              />
              <small style={{ color: 'var(--text-secondary)' }}>По умолчанию: 3 дня</small>
            </div>
            <div className="form-group">
              <label className="form-label">Название компании</label>
              <input
                type="text"
                className="form-input"
                placeholder="Моя компания"
                value={local.companyName || ''}
                onChange={e => setLocal(p => ({ ...p, companyName: e.target.value }))}
              />
              <small style={{ color: 'var(--text-secondary)' }}>Отображается в расчётных листках</small>
            </div>
          </div>
        </div>

        {/* Финансовый контроль */}
        <div className="card">
          <div className="card-header">
            <TrendingUp size={18} style={{ color: 'var(--accent)' }} />
            <span className="card-title">Финансовый контроль ФОТ</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Допустимый % ФОТ от выручки (норма)</label>
              <input type="number" className="form-input" min={1} max={100}
                value={local.maxFotPct ?? 35}
                onChange={e => setLocal(p => ({ ...p, maxFotPct: +e.target.value }))} />
              <small style={{ color: 'var(--text-secondary)' }}>По умолчанию: 35%. Жёлтый статус при превышении.</small>
            </div>
            <div className="form-group">
              <label className="form-label">Критический % ФОТ от выручки</label>
              <input type="number" className="form-input" min={1} max={100}
                value={local.criticalFotPct ?? 45}
                onChange={e => setLocal(p => ({ ...p, criticalFotPct: +e.target.value }))} />
              <small style={{ color: 'var(--text-secondary)' }}>По умолчанию: 45%. Красный статус при превышении.</small>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[
                { label: `До ${local.maxFotPct ?? 35}%`, color: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
                { label: `${local.maxFotPct ?? 35}–${local.criticalFotPct ?? 45}%`, color: '#fffbeb', border: '#fde68a', text: '#92400e' },
                { label: `>${local.criticalFotPct ?? 45}%`, color: '#fef2f2', border: '#fecaca', text: '#991b1b' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, padding: '8px 12px', background: s.color, border: `1px solid ${s.border}`, borderRadius: 6, textAlign: 'center', fontSize: 12, fontWeight: 700, color: s.text }}>
                  {s.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Цвет фона */}
        <div className="card">
          <div className="card-header">
            <Palette size={18} style={{ color: 'var(--accent)' }} />
            <span className="card-title">Цвет фона</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {PALETTE.map(p => (
                <button
                  key={p.value}
                  onClick={() => setLocal(prev => ({ ...prev, backgroundColor: p.value }))}
                  style={{
                    background: p.value,
                    border: local.backgroundColor === p.value ? '3px solid var(--accent)' : '2px solid var(--border)',
                    borderRadius: 8,
                    height: 52,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: 4,
                    fontSize: 10,
                    color: '#555',
                    fontWeight: 500,
                  }}
                  title={p.label}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">Произвольный цвет</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="color"
                  value={local.backgroundColor || '#ffffff'}
                  onChange={e => setLocal(p => ({ ...p, backgroundColor: e.target.value }))}
                  style={{ width: 48, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={local.backgroundColor || '#ffffff'}
                  onChange={e => setLocal(p => ({ ...p, backgroundColor: e.target.value }))}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            </div>
            <div style={{ marginTop: 8, padding: 12, borderRadius: 8, background: local.backgroundColor, border: '1px solid var(--border)', textAlign: 'center', color: '#555', fontSize: 13 }}>
              Предпросмотр фона
            </div>
          </div>
        </div>

        {/* Правила пересечения отпусков */}
        <VacationOverlapRules />

        {/* Данные */}
        <div className="card">
          <div className="card-header">
            <Download size={18} style={{ color: 'var(--accent)' }} />
            <span className="card-title">Управление данными</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="btn btn-primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Download size={16} /> Экспорт данных в JSON
            </button>
            <button className="btn btn-secondary" onClick={handleImport} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload size={16} /> Импорт данных из JSON
            </button>
            <hr style={{ margin: '4px 0', borderColor: 'var(--border)' }} />
            <button className="btn btn-secondary" onClick={handleGetPath} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderOpen size={16} /> Показать путь к файлу данных
            </button>
            {dataPath && (
              <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                {dataPath}
              </div>
            )}
            <div style={{ marginTop: 8, padding: 12, background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, fontSize: 12, color: '#795548' }}>
              <strong>⚠ Внимание при импорте:</strong> все текущие данные будут заменены данными из файла. Сделайте резервную копию перед импортом.
            </div>
          </div>
        </div>

      </div>

      {/* Статистика */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <span className="card-title">Статистика базы данных</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            {[
              { label: 'Сотрудников', value: state.employees.length },
              { label: 'Начислений', value: state.payrolls.length },
              { label: 'Отделов', value: state.departments.length },
              { label: 'Руководителей', value: state.managers.length },
              { label: 'Фин. записей', value: state.financeByMonth.length },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center', padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{item.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Кнопка сохранить */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 28px', fontSize: 15 }}>
          <Save size={18} /> Сохранить настройки
        </button>
      </div>
    </div>
  );
}
