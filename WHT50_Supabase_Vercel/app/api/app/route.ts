import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type JsonObject = Record<string, any>;

function jsonOk(data: unknown, message = 'ดำเนินการสำเร็จ') {
  return NextResponse.json({ ok: true, message, data });
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function clean(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function num(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function requireFields(payload: JsonObject, fields: Record<string, string>) {
  for (const key of Object.keys(fields)) {
    if (!clean(payload[key])) {
      throw new Error('กรุณาระบุ' + fields[key]);
    }
  }
}

function getBaseUrl(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('host') || '';
  return `${proto}://${host}`.replace(/\/$/, '');
}

function ensureAccess(req: NextRequest) {
  const required = process.env.APP_ACCESS_CODE;
  if (!required) return;

  const provided = req.headers.get('x-app-access-code') || '';
  if (provided !== required) {
    throw new Error('ไม่สามารถยืนยันสิทธิ์การเข้าใช้งานระบบได้');
  }
}

async function recordLog(action: string, targetType: string, targetId: string, detail: JsonObject = {}) {
  await supabaseAdmin.from('activity_log').insert({
    action,
    target_type: targetType,
    target_id: targetId,
    detail,
    created_by: 'system'
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action);
    const payload = body.payload || {};

    const publicActions = ['verifyCertificate'];
    if (!publicActions.includes(action)) {
      ensureAccess(req);
    }

    if (action === 'loadSystem') return jsonOk(await loadSystem());
    if (action === 'saveIssuer') return jsonOk(await saveIssuer(payload), 'ระบบบันทึกข้อมูลผู้มีหน้าที่หักภาษีเรียบร้อยแล้ว');
    if (action === 'savePayee') return jsonOk(await savePayee(payload), 'ระบบบันทึกข้อมูลผู้ถูกหักภาษีเรียบร้อยแล้ว');
    if (action === 'saveSigner') return jsonOk(await saveSigner(payload), 'ระบบบันทึกข้อมูลผู้ลงนามเรียบร้อยแล้ว');
    if (action === 'saveIncomeType') return jsonOk(await saveIncomeType(payload), 'ระบบบันทึกข้อมูลประเภทเงินได้เรียบร้อยแล้ว');
    if (action === 'createCertificateDraft') return jsonOk(await createCertificateDraft(payload), 'ระบบบันทึกแบบร่างหนังสือรับรองเรียบร้อยแล้ว');
    if (action === 'issueCertificate') return jsonOk(await issueCertificate(req, payload), 'ระบบออกเลขหนังสือรับรองเรียบร้อยแล้ว');
    if (action === 'listCertificates') return jsonOk(await listCertificates(payload));
    if (action === 'verifyCertificate') return jsonOk(await verifyCertificate(payload));

    return jsonError('ไม่พบคำสั่งที่ต้องการดำเนินการ');
  } catch (err: any) {
    return jsonError(err?.message || 'ไม่สามารถดำเนินการได้');
  }
}

async function loadSystem() {
  const [issuers, payees, signers, incomeTypes, certificates] = await Promise.all([
    supabaseAdmin.from('issuers').select('*').eq('status', 'ACTIVE').order('created_at', { ascending: false }),
    supabaseAdmin.from('payees').select('*').eq('status', 'ACTIVE').order('created_at', { ascending: false }),
    supabaseAdmin.from('signers').select('*').eq('status', 'ACTIVE').order('is_primary', { ascending: false }).order('created_at', { ascending: false }),
    supabaseAdmin.from('income_types').select('*').eq('status', 'ACTIVE').order('sort_order', { ascending: true }),
    supabaseAdmin.from('certificates').select('*').order('created_at', { ascending: false }).limit(200)
  ]);

  for (const result of [issuers, payees, signers, incomeTypes, certificates]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    issuers: issuers.data || [],
    payees: payees.data || [],
    signers: signers.data || [],
    incomeTypes: incomeTypes.data || [],
    certificates: certificates.data || []
  };
}

async function saveIssuer(payload: JsonObject) {
  requireFields(payload, {
    issuerName: 'ชื่อผู้มีหน้าที่หักภาษี',
    taxId: 'เลขประจำตัวผู้เสียภาษี',
    address: 'ที่อยู่'
  });

  const row = {
    issuer_name: clean(payload.issuerName),
    tax_id: clean(payload.taxId),
    branch_type: clean(payload.branchType) || 'สำนักงานใหญ่',
    branch_no: clean(payload.branchNo),
    address: clean(payload.address),
    phone: clean(payload.phone),
    email: clean(payload.email),
    logo_file_id: clean(payload.logoFileId),
    stamp_file_id: clean(payload.stampFileId),
    updated_at: new Date().toISOString(),
    updated_by: 'system'
  };

  const result = await supabaseAdmin.from('issuers').insert(row).select('*').single();
  if (result.error) throw new Error(result.error.message);

  await recordLog('บันทึกข้อมูลผู้มีหน้าที่หักภาษี', 'issuer', result.data.issuer_id, { issuerName: row.issuer_name });
  return result.data;
}

async function savePayee(payload: JsonObject) {
  requireFields(payload, {
    payeeType: 'ประเภทผู้ถูกหักภาษี',
    payeeName: 'ชื่อผู้ถูกหักภาษี',
    taxId: 'เลขประจำตัวผู้เสียภาษี',
    address: 'ที่อยู่'
  });

  const row = {
    payee_type: clean(payload.payeeType),
    payee_name: clean(payload.payeeName),
    tax_id: clean(payload.taxId),
    branch_type: clean(payload.branchType) || 'ไม่ระบุ',
    branch_no: clean(payload.branchNo),
    address: clean(payload.address),
    phone: clean(payload.phone),
    email: clean(payload.email),
    contact_name: clean(payload.contactName),
    updated_at: new Date().toISOString(),
    updated_by: 'system'
  };

  const result = await supabaseAdmin.from('payees').insert(row).select('*').single();
  if (result.error) throw new Error(result.error.message);

  await recordLog('บันทึกข้อมูลผู้ถูกหักภาษี', 'payee', result.data.payee_id, { payeeName: row.payee_name });
  return result.data;
}

async function saveSigner(payload: JsonObject) {
  requireFields(payload, {
    signerName: 'ชื่อผู้ลงนาม',
    signerPosition: 'ตำแหน่ง'
  });

  const isPrimary = payload.isPrimary === true || clean(payload.isPrimary) === 'true' || clean(payload.isPrimary) === 'ใช่';

  if (isPrimary) {
    const clear = await supabaseAdmin.from('signers').update({ is_primary: false }).eq('status', 'ACTIVE');
    if (clear.error) throw new Error(clear.error.message);
  }

  const row = {
    signer_name: clean(payload.signerName),
    signer_position: clean(payload.signerPosition),
    signature_file_id: clean(payload.signatureFileId),
    is_primary: isPrimary,
    updated_at: new Date().toISOString(),
    updated_by: 'system'
  };

  const result = await supabaseAdmin.from('signers').insert(row).select('*').single();
  if (result.error) throw new Error(result.error.message);

  await recordLog('บันทึกข้อมูลผู้ลงนาม', 'signer', result.data.signer_id, { signerName: row.signer_name });
  return result.data;
}

async function saveIncomeType(payload: JsonObject) {
  requireFields(payload, {
    incomeTypeName: 'ชื่อประเภทเงินได้',
    withholdingRate: 'อัตราหัก ณ ที่จ่าย'
  });

  const rate = num(payload.withholdingRate);
  if (rate < 0) throw new Error('กรุณาระบุอัตราหัก ณ ที่จ่ายให้ถูกต้อง');

  const row = {
    income_type_name: clean(payload.incomeTypeName),
    income_type_code: clean(payload.incomeTypeCode),
    withholding_rate: rate,
    filing_form: clean(payload.filingForm) || 'กำหนดตามรายการ',
    sort_order: num(payload.sortOrder),
    updated_at: new Date().toISOString(),
    updated_by: 'system'
  };

  const result = await supabaseAdmin.from('income_types').insert(row).select('*').single();
  if (result.error) throw new Error(result.error.message);

  await recordLog('บันทึกข้อมูลประเภทเงินได้', 'incomeType', result.data.income_type_id, { incomeTypeName: row.income_type_name });
  return result.data;
}

async function createCertificateDraft(payload: JsonObject) {
  requireFields(payload, {
    issuerId: 'ผู้มีหน้าที่หักภาษี',
    payeeId: 'ผู้ถูกหักภาษี',
    signerId: 'ผู้ลงนาม',
    paymentDate: 'วันที่จ่ายเงิน'
  });

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length < 1) throw new Error('กรุณาเพิ่มรายการเงินได้อย่างน้อย 1 รายการ');

  let totalPaid = 0;
  let totalTax = 0;

  const cleanItems = items.map((item: JsonObject, index: number) => {
    const paidAmount = num(item.paidAmount);
    const withholdingRate = num(item.withholdingRate);

    if (paidAmount <= 0) throw new Error('กรุณาระบุจำนวนเงินที่จ่ายให้ถูกต้อง');
    if (withholdingRate < 0) throw new Error('กรุณาระบุอัตราหัก ณ ที่จ่ายให้ถูกต้อง');

    const withheldTax = round2(paidAmount * withholdingRate / 100);
    totalPaid += paidAmount;
    totalTax += withheldTax;

    return {
      income_type_id: clean(item.incomeTypeId) || null,
      income_type_name: clean(item.incomeTypeName),
      description: clean(item.description),
      paid_amount: round2(paidAmount),
      withholding_rate: withholdingRate,
      withheld_tax: withheldTax,
      sort_order: index + 1,
      created_by: 'system'
    };
  });

  const paymentDate = new Date(clean(payload.paymentDate));
  const taxYear = paymentDate.getFullYear() + 543;

  const certResult = await supabaseAdmin.from('certificates').insert({
    status: 'DRAFT',
    payment_date: clean(payload.paymentDate),
    tax_year: taxYear,
    issuer_id: clean(payload.issuerId),
    payee_id: clean(payload.payeeId),
    signer_id: clean(payload.signerId),
    payer_condition: clean(payload.payerCondition) || 'หัก ณ ที่จ่าย',
    total_paid_amount: round2(totalPaid),
    total_withheld_tax: round2(totalTax),
    net_paid_amount: round2(totalPaid - totalTax),
    created_by: 'system',
    updated_by: 'system'
  }).select('*').single();

  if (certResult.error) throw new Error(certResult.error.message);

  const certificateId = certResult.data.certificate_id;
  const itemRows = cleanItems.map((item) => ({ ...item, certificate_id: certificateId }));

  const itemResult = await supabaseAdmin.from('certificate_items').insert(itemRows);
  if (itemResult.error) throw new Error(itemResult.error.message);

  await recordLog('บันทึกแบบร่างหนังสือรับรอง', 'certificate', certificateId, {
    totalPaidAmount: round2(totalPaid),
    totalWithheldTax: round2(totalTax)
  });

  return certResult.data;
}

async function issueCertificate(req: NextRequest, payload: JsonObject) {
  requireFields(payload, { certificateId: 'รหัสหนังสือรับรอง' });

  const result = await supabaseAdmin.rpc('issue_certificate', {
    p_certificate_id: clean(payload.certificateId),
    p_base_url: getBaseUrl(req),
    p_actor: 'system'
  });

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function listCertificates(payload: JsonObject) {
  let query = supabaseAdmin.from('certificates').select('*').order('created_at', { ascending: false });

  const status = clean(payload.status);
  const month = clean(payload.month);
  const keyword = clean(payload.keyword);

  if (status && status !== 'ALL') query = query.eq('status', status);
  if (month) {
    query = query.gte('payment_date', `${month}-01`).lt('payment_date', nextMonth(month));
  }
  if (keyword) {
    query = query.or(`certificate_no.ilike.%${keyword}%,verification_url.ilike.%${keyword}%`);
  }

  const result = await query.limit(300);
  if (result.error) throw new Error(result.error.message);
  return result.data || [];
}

function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

async function verifyCertificate(payload: JsonObject) {
  const verificationCode = clean(payload.verificationCode);
  if (!verificationCode) return null;

  const result = await supabaseAdmin
    .from('certificates')
    .select('*')
    .eq('verification_code', verificationCode)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return result.data;
}
