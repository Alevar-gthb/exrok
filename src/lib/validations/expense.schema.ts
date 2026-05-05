import { z } from 'zod'

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf']

/** Opsi metode pembayaran di form expense & filter laporan. */
export const PAYMENT_METHODS = ['Petty Cash', 'BCA', 'UOB Credit Card', 'Panin Credit Card', 'Paper Pioneer Card', 'Payroll Transfer'] as const
const dec = (label: string) => z.string().min(1, `${label} wajib diisi`)
  .refine(v => !isNaN(Number(v)) && Number(v) >= 0, { message: `${label} harus angka positif` })
const optDec = z.string()
  .refine(v => v === '' || (!isNaN(Number(v)) && Number(v) >= 0), { message: 'Harus angka positif' })
  .default('0')

export const expenseSchema = z.object({
  submission_date: z.string().min(1, 'Tanggal pengajuan wajib diisi').regex(/^\d{4}-\d{2}-\d{2}$/, 'Format salah'),
  transaction_date: z.string().min(1, 'Tanggal transaksi wajib diisi').regex(/^\d{4}-\d{2}-\d{2}$/, 'Format salah'),
  type: z.enum(['PO', 'Reimburse', 'Salary'], { required_error: 'Tipe wajib dipilih' }),
  description: z.string().min(3, 'Min 3 karakter').max(500, 'Max 500 karakter'),
  project_id: z.string().optional().or(z.literal('')),
  employee_id: z.string().optional().or(z.literal('')),
  // Breakdown biaya
  amount: dec('DPP (Amount)'),
  vat: optDec,
  admin_fee: optDec,
  service_fee: optDec,
  // Field baru dari Excel
  category_id: z.string().optional().or(z.literal('')),
  subcategory_id: z.string().optional().or(z.literal('')),
  vendor_id: z.string().optional().or(z.literal('')),
  business_unit: z.enum(['RKT', 'SPH']).optional().or(z.literal('')),
  department: z.enum(['Technology', 'Operation', 'Sales', 'Human Capital']).optional().or(z.literal('')),
  payment_method: z
    .string({ required_error: 'Metode pembayaran wajib dipilih' })
    .min(1, 'Metode pembayaran wajib dipilih')
    .refine((v) => (PAYMENT_METHODS as readonly string[]).includes(v), {
      message: 'Pilih metode pembayaran yang valid',
    }),
  due_date: z.string().optional().or(z.literal('')),
  /** Checkbox: PPN diisi manual / dari OCR, bukan dihitung otomatis. */
  has_vat: z.boolean().default(false),
  /** Metadata OCR — tidak ditampilkan sebagai field biasa. */
  ocr_scanned: z.boolean().default(false),
  ocr_confidence: z.number().min(0).max(1).nullable().optional(),
  /** URL dokumen yang sudah ada (mode edit), untuk validasi petty cash. */
  document_url: z.string().optional().or(z.literal('')),
  // Dokumen
  document: z.custom<File>().optional().nullable()
    .refine(f => !f || f.size <= MAX_BYTES, 'Maks 2MB')
    .refine(f => !f || ACCEPTED.includes(f.type), 'Format harus JPG, PNG, atau PDF'),
}).superRefine((val, ctx) => {
  if (val.payment_method === 'Petty Cash' && !val.document && !val.document_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['document'],
      message: 'Untuk Petty Cash, receipt/dokumen wajib diunggah',
    })
  }
})

export type ExpenseFormValues = z.infer<typeof expenseSchema>

export const expenseDefaultValues: Partial<ExpenseFormValues> = {
  submission_date: new Date().toISOString().split('T')[0],
  transaction_date: new Date().toISOString().split('T')[0],
  type: 'PO', description: '', project_id: '', employee_id: '',
  amount: '', vat: '0', admin_fee: '0', service_fee: '0',
  category_id: '', subcategory_id: '', vendor_id: '',
  business_unit: '', department: '', payment_method: '', due_date: '',
  has_vat: false,
  ocr_scanned: false,
  ocr_confidence: null,
  document: null,
}
