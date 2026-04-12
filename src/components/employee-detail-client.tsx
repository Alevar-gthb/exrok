'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/supabase/client'
import { CrudTable } from '@/components/crud-table'
import { formatIDR } from '@/lib/decimal'
import { summarizeCompensationRows } from '@/lib/compensation-summary'
import type {
  Employee,
  EmployeeContract,
  EmployeeProjectAssignment,
  Project,
  SalaryComponentTemplate,
  EmployeeSalaryComponentAmount,
} from '@/types/database.types'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E2E8F0',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        marginBottom: '20px',
      }}
    >
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{title}</span>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%',
  maxWidth: '280px',
  padding: '8px 12px',
  fontSize: '13px',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  outline: 'none',
  color: '#0F172A',
  background: '#fff',
  fontFamily: 'inherit',
}

type TemplateRef = Pick<SalaryComponentTemplate, 'code' | 'label' | 'kind'>

type AmountRow = EmployeeSalaryComponentAmount & {
  salary_component_templates: TemplateRef | TemplateRef[] | null
}

function templateFromRow(r: AmountRow): TemplateRef | null {
  const t = r.salary_component_templates
  if (!t) return null
  return Array.isArray(t) ? t[0] ?? null : t
}

type AssignmentRow = EmployeeProjectAssignment & { project?: { name: string } | null }

function parseAmountInput(raw: string): string {
  const cleaned = raw.replace(/\./g, '').replace(',', '.').trim()
  const n = parseFloat(cleaned || '0')
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}

function kindLabel(kind: string) {
  return kind === 'deduction' ? 'Potongan' : 'Pemasukan'
}

export function EmployeeDetailClient({
  employeeId,
  initialEmployee,
  initialGrossSalary,
  initialSalaryPaidFromExpenses,
  myRole,
  initialProjects,
}: {
  employeeId: string
  initialEmployee: Pick<Employee, 'id' | 'full_name' | 'status' | 'nip' | 'job_title' | 'is_permanent'>
  initialGrossSalary: string
  initialSalaryPaidFromExpenses: string
  myRole: string
  initialProjects: Pick<Project, 'id' | 'name'>[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const [emp, setEmp] = useState(initialEmployee)
  const [grossSalary, setGrossSalary] = useState(initialGrossSalary)
  const [salaryPaidFromExpenses, setSalaryPaidFromExpenses] = useState(initialSalaryPaidFromExpenses)
  const [contracts, setContracts] = useState<EmployeeContract[]>([])
  const [templates, setTemplates] = useState<SalaryComponentTemplate[]>([])
  const [amountRows, setAmountRows] = useState<AmountRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [profileForm, setProfileForm] = useState({
    full_name: emp.full_name,
    status: emp.status,
    job_title: emp.job_title ?? '',
    is_permanent: emp.is_permanent ?? false,
  })
  const [savingProfile, setSavingProfile] = useState(false)
  const [assignForm, setAssignForm] = useState({
    project_id: '',
    is_primary: false,
    started_on: new Date().toISOString().split('T')[0],
    ended_on: '',
  })
  const [addTemplateId, setAddTemplateId] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [savingAmountId, setSavingAmountId] = useState<string | null>(null)

  const recomputeGross = useCallback((rows: AmountRow[]) => {
    const comp = rows.map(r => {
      const t = templateFromRow(r)
      return { kind: t?.kind ?? 'earning', amount: r.amount }
    })
    const { gross } = summarizeCompensationRows(comp)
    setGrossSalary(gross.toFixed(2))
  }, [])

  const load = useCallback(async () => {
    const sb = createClient()
    const [{ data: c }, { data: tmpl }, { data: am }, { data: asn }, { data: sal }] = await Promise.all([
      sb.from('employee_contracts').select('*').eq('employee_id', employeeId).order('start_date', { ascending: false }),
      sb.from('salary_component_templates').select('*').eq('is_active', true).order('code'),
      sb
        .from('employee_salary_component_amounts')
        .select('*, salary_component_templates(code,label,kind)')
        .eq('employee_id', employeeId),
      sb
        .from('employee_project_assignments')
        .select('*, project:projects(name)')
        .eq('employee_id', employeeId)
        .order('started_on', { ascending: false }),
      sb
        .from('expenses')
        .select('total_payment')
        .eq('employee_id', employeeId)
        .eq('type', 'Salary')
        .in('status', ['Submitted', 'Pending Approval', 'Approved', 'Paid']),
    ])
    setContracts(
      ((c as EmployeeContract[]) ?? []).map(x => ({
        ...x,
        start_date: String(x.start_date).slice(0, 10),
        end_date: String(x.end_date).slice(0, 10),
      }))
    )
    setTemplates((tmpl as SalaryComponentTemplate[]) ?? [])
    const rows = (am as AmountRow[]) ?? []
    setAmountRows(rows)
    recomputeGross(rows)
    setAssignments((asn as AssignmentRow[]) ?? [])
    const sum = (sal ?? []).reduce((a, row: { total_payment: string | number }) => {
      const v = typeof row.total_payment === 'string' ? parseFloat(row.total_payment) : row.total_payment
      return a + (Number.isFinite(v) ? v : 0)
    }, 0)
    setSalaryPaidFromExpenses(sum.toFixed(2))
  }, [employeeId, recomputeGross])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setEmp(initialEmployee)
    setProfileForm({
      full_name: initialEmployee.full_name,
      status: initialEmployee.status,
      job_title: initialEmployee.job_title ?? '',
      is_permanent: initialEmployee.is_permanent ?? false,
    })
    setGrossSalary(initialGrossSalary)
    setSalaryPaidFromExpenses(initialSalaryPaidFromExpenses)
  }, [initialEmployee, initialGrossSalary, initialSalaryPaidFromExpenses])

  const availableTemplates = useMemo(
    () => templates.filter(t => !amountRows.some(r => r.template_id === t.id)),
    [templates, amountRows]
  )

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!['owner', 'finance'].includes(myRole)) return
    setSavingProfile(true)
    const { error } = await supabase
      .from('employees')
      .update({
        full_name: profileForm.full_name,
        status: profileForm.status as Employee['status'],
        job_title: profileForm.job_title?.trim() || null,
        is_permanent: profileForm.is_permanent,
      })
      .eq('id', employeeId)
    setSavingProfile(false)
    if (!error) {
      setEmp({
        ...emp,
        full_name: profileForm.full_name,
        status: profileForm.status as Employee['status'],
        job_title: profileForm.job_title?.trim() || null,
        is_permanent: profileForm.is_permanent,
      })
      router.refresh()
    }
  }

  async function onSaveContract(values: Record<string, string>) {
    const payload = {
      employee_id: employeeId,
      start_date: values.start_date,
      end_date: values.end_date,
      notes: values.notes || null,
    }
    const { error } = values.id
      ? await supabase.from('employee_contracts').update(payload).eq('id', values.id)
      : await supabase.from('employee_contracts').insert(payload)
    if (!error) load()
    return { error: error?.message }
  }

  async function onDeleteContract(id: string) {
    const { error } = await supabase.from('employee_contracts').delete().eq('id', id)
    if (!error) load()
    return { error: error?.message }
  }

  async function addComponentAmount(e: React.FormEvent) {
    e.preventDefault()
    if (!addTemplateId || !addAmount.trim()) return
    setAdding(true)
    const amount = parseAmountInput(addAmount)
    const { error } = await supabase.from('employee_salary_component_amounts').insert({
      employee_id: employeeId,
      template_id: addTemplateId,
      amount,
    })
    setAdding(false)
    if (!error) {
      setAddTemplateId('')
      setAddAmount('')
      load()
    }
  }

  async function saveEditedAmount() {
    if (!editingId) return
    setSavingAmountId(editingId)
    const amount = parseAmountInput(editAmount)
    const { error } = await supabase.from('employee_salary_component_amounts').update({ amount }).eq('id', editingId)
    setSavingAmountId(null)
    if (!error) {
      setEditingId(null)
      load()
    }
  }

  async function deleteAmountRow(id: string) {
    const { error } = await supabase.from('employee_salary_component_amounts').delete().eq('id', id)
    if (!error) load()
  }

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault()
    if (!assignForm.project_id) return
    const { error } = await supabase.from('employee_project_assignments').insert({
      employee_id: employeeId,
      project_id: assignForm.project_id,
      is_primary: assignForm.is_primary,
      started_on: assignForm.started_on,
      ended_on: assignForm.ended_on || null,
    })
    if (!error) {
      setAssignForm({
        project_id: '',
        is_primary: false,
        started_on: new Date().toISOString().split('T')[0],
        ended_on: '',
      })
      load()
    }
  }

  async function endAssignment(id: string) {
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('employee_project_assignments').update({ ended_on: today }).eq('id', id)
    if (!error) load()
  }

  const showContracts = !profileForm.is_permanent

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/employees" style={{ fontSize: '12px', color: '#64748B', textDecoration: 'none' }}>
          ← Kembali ke daftar
        </Link>
      </div>
      <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#0F172A', marginBottom: '4px' }}>{emp.full_name}</h1>
      <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
        <strong>NIP</strong> {emp.nip ?? '—'}
        {emp.job_title ? (
          <>
            {' '}
            · <strong>Jabatan</strong> {emp.job_title}
          </>
        ) : null}
        {profileForm.is_permanent ? (
          <>
            {' '}
            · <span style={{ color: '#166534' }}>Karyawan tetap</span>
          </>
        ) : null}
      </p>

      <Section title="Ringkasan pembayaran gaji (perusahaan)">
        <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          Gaji kotor (bruto) dari komponen
        </p>
        <p style={{ fontSize: '24px', fontWeight: '600', color: '#0F172A', margin: '0 0 16px' }}>{formatIDR(grossSalary)}</p>
        <p style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
          Total terbayar lewat expense Salary
        </p>
        <p style={{ fontSize: '18px', fontWeight: '600', color: '#334155', margin: '0 0 8px' }}>{formatIDR(salaryPaidFromExpenses)}</p>
        <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
          Bruto = jumlah komponen jenis pemasukan. Nominal di bawah memakai master komponen gaji. Terbayar = akumulasi expense tipe Salary (selain Draft & Rejected).
        </p>
      </Section>

      {['owner', 'finance'].includes(myRole) && (
        <Section title="Data karyawan">
          <p style={{ fontSize: '12px', color: '#64748B', marginTop: 0, marginBottom: '14px' }}>
            NIP tidak dapat diubah. Email dan role akun di <strong>Pengaturan → User</strong> (owner).
          </p>
          <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '360px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
                NIP
              </label>
              <input style={{ ...inp, background: '#F8FAFC', color: '#64748B' }} readOnly value={emp.nip ?? '—'} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
                Nama
              </label>
              <input
                style={inp}
                value={profileForm.full_name}
                onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
                Jabatan
              </label>
              <input
                style={inp}
                value={profileForm.job_title}
                onChange={e => setProfileForm(f => ({ ...f, job_title: e.target.value }))}
                placeholder="Contoh: Staff Accounting"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
                Status
              </label>
              <select
                style={inp}
                value={profileForm.status}
                onChange={e =>
                  setProfileForm(f => ({ ...f, status: e.target.value as Employee['status'] }))
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={profileForm.is_permanent}
                onChange={e => setProfileForm(f => ({ ...f, is_permanent: e.target.checked }))}
                style={{ marginTop: '2px' }}
              />
              <span>
                <strong>Karyawan tetap</strong> — tidak perlu riwayat kontrak / perpanjangan di sistem.
              </span>
            </label>
            <button
              type="submit"
              disabled={savingProfile}
              style={{
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#fff',
                background: '#0F172A',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                width: 'fit-content',
              }}
            >
              {savingProfile ? 'Menyimpan…' : 'Simpan'}
            </button>
          </form>
        </Section>
      )}

      {showContracts && (
        <Section title="Kontrak & perpanjangan">
          <CrudTable
            title="kontrak"
            data={contracts}
            fields={[
              { key: 'start_date', label: 'Mulai', required: true, type: 'date' },
              { key: 'end_date', label: 'Berakhir', required: true, type: 'date' },
              { key: 'notes', label: 'Catatan', placeholder: 'Perpanjangan ke-2' },
            ]}
            displayCols={[
              { key: 'start_date', label: 'Mulai', render: r => String(r.start_date).slice(0, 10) },
              { key: 'end_date', label: 'Berakhir', render: r => String(r.end_date).slice(0, 10) },
              { key: 'notes', label: 'Catatan' },
            ]}
            onSave={onSaveContract}
            onDelete={onDeleteContract}
            emptyText="Belum ada kontrak. Tambah baris untuk riwayat kontrak / perpanjangan."
          />
        </Section>
      )}

      {profileForm.is_permanent && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#166534',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '10px',
          }}
        >
          Karyawan tetap: bagian kontrak disembunyikan. Aktifkan master komponen gaji di <strong>Pengaturan → Komponen gaji</strong>, lalu pilih komponen dan nominal di bawah.
        </div>
      )}

      <Section title="Komponen gaji (dari master)">
        <p style={{ fontSize: '12px', color: '#64748B', marginTop: 0, marginBottom: '16px' }}>
          Pilih komponen yang sudah didefinisikan di master, lalu isi nominal. Kode dan jenis mengikuti master.
        </p>
        {['owner', 'finance'].includes(myRole) && (
          <form
            onSubmit={addComponentAmount}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
                Komponen
              </label>
              <select
                style={{ ...inp, minWidth: '220px' }}
                value={addTemplateId}
                onChange={e => setAddTemplateId(e.target.value)}
              >
                <option value="">— Pilih —</option>
                {availableTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.label} ({kindLabel(t.kind)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
                Nominal (Rp)
              </label>
              <input
                style={inp}
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
                placeholder="5000000"
              />
            </div>
            <button
              type="submit"
              disabled={adding || !addTemplateId || !addAmount.trim()}
              style={{
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#fff',
                background: '#2563EB',
                border: 'none',
                borderRadius: '8px',
                cursor: adding ? 'wait' : 'pointer',
              }}
            >
              {adding ? 'Menambah…' : 'Tambah'}
            </button>
          </form>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
              <th style={{ textAlign: 'left', padding: '8px 0' }}>Kode</th>
              <th style={{ textAlign: 'left', padding: '8px 0' }}>Label</th>
              <th style={{ textAlign: 'left', padding: '8px 0' }}>Jenis</th>
              <th style={{ textAlign: 'right', padding: '8px 0' }}>Nominal</th>
              {['owner', 'finance'].includes(myRole) && <th style={{ textAlign: 'right', padding: '8px 0' }}></th>}
            </tr>
          </thead>
          <tbody>
            {amountRows.length === 0 ? (
              <tr>
                <td
                  colSpan={['owner', 'finance'].includes(myRole) ? 5 : 4}
                  style={{ padding: '12px 0', color: '#94A3B8' }}
                >
                  Belum ada komponen. Tambahkan dari master (mis. BASE untuk gaji pokok).
                </td>
              </tr>
            ) : (
              amountRows.map(row => {
                const t = templateFromRow(row)
                const isEditing = editingId === row.id
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 0', color: '#0F172A', fontWeight: '500' }}>{t?.code ?? '—'}</td>
                    <td style={{ padding: '10px 0', color: '#334155' }}>{t?.label ?? '—'}</td>
                    <td style={{ padding: '10px 0', color: '#64748B' }}>{t ? kindLabel(t.kind) : '—'}</td>
                    <td style={{ padding: '10px 0', textAlign: 'right' }}>
                      {isEditing ? (
                        <input
                          style={{ ...inp, maxWidth: '160px', marginLeft: 'auto', display: 'block' }}
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                        />
                      ) : (
                        <span style={{ color: '#0F172A' }}>{formatIDR(String(row.amount))}</span>
                      )}
                    </td>
                    {['owner', 'finance'].includes(myRole) && (
                      <td style={{ padding: '10px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null)
                              }}
                              style={{
                                fontSize: '12px',
                                marginRight: '8px',
                                color: '#64748B',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={savingAmountId === row.id}
                              onClick={saveEditedAmount}
                              style={{
                                fontSize: '12px',
                                fontWeight: '500',
                                color: '#2563EB',
                                background: 'none',
                                border: 'none',
                                cursor: savingAmountId === row.id ? 'wait' : 'pointer',
                              }}
                            >
                              Simpan
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(row.id)
                                setEditAmount(String(row.amount))
                              }}
                              style={{
                                fontSize: '12px',
                                marginRight: '8px',
                                color: '#2563EB',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              Ubah
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAmountRow(row.id)}
                              style={{
                                fontSize: '12px',
                                color: '#DC2626',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              Hapus
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </Section>

      <Section title="Penugasan proyek">
        <form onSubmit={addAssignment} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
              Proyek
            </label>
            <select
              style={inp}
              value={assignForm.project_id}
              onChange={e => setAssignForm(f => ({ ...f, project_id: e.target.value }))}
            >
              <option value="">— Pilih —</option>
              {initialProjects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
              Mulai
            </label>
            <input
              type="date"
              style={inp}
              value={assignForm.started_on}
              onChange={e => setAssignForm(f => ({ ...f, started_on: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#475569', marginBottom: '4px' }}>
              Selesai (opsional)
            </label>
            <input
              type="date"
              style={inp}
              value={assignForm.ended_on}
              onChange={e => setAssignForm(f => ({ ...f, ended_on: e.target.value }))}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
            <input
              type="checkbox"
              checked={assignForm.is_primary}
              onChange={e => setAssignForm(f => ({ ...f, is_primary: e.target.checked }))}
            />
            Utama
          </label>
          <button
            type="submit"
            style={{
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#fff',
              background: '#2563EB',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Tambah
          </button>
        </form>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
              <th style={{ textAlign: 'left', padding: '8px 0' }}>Proyek</th>
              <th style={{ textAlign: 'left', padding: '8px 0' }}>Utama</th>
              <th style={{ textAlign: 'left', padding: '8px 0' }}>Mulai</th>
              <th style={{ textAlign: 'left', padding: '8px 0' }}>Selesai</th>
              <th style={{ textAlign: 'right', padding: '8px 0' }}></th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '12px 0', color: '#94A3B8' }}>
                  Belum ada penugasan.
                </td>
              </tr>
            ) : (
              assignments.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 0', color: '#0F172A' }}>{a.project?.name ?? a.project_id}</td>
                  <td style={{ padding: '10px 0' }}>{a.is_primary ? 'Ya' : '—'}</td>
                  <td style={{ padding: '10px 0', color: '#64748B' }}>{a.started_on}</td>
                  <td style={{ padding: '10px 0', color: '#64748B' }}>{a.ended_on ?? '—'}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    {!a.ended_on && (
                      <button
                        type="button"
                        onClick={() => endAssignment(a.id)}
                        style={{
                          fontSize: '12px',
                          color: '#DC2626',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Tutup penugasan
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Section>
    </div>
  )
}
