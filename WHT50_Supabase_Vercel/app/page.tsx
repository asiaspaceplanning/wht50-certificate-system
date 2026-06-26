'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Row = Record<string, any>;

type SystemData = {
  issuers: Row[];
  payees: Row[];
  signers: Row[];
  incomeTypes: Row[];
  certificates: Row[];
};

type Toast = {
  id: number;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
};

const initialData: SystemData = {
  issuers: [],
  payees: [],
  signers: [],
  incomeTypes: [],
  certificates: []
};

const pages: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'ภาพรวมระบบ', subtitle: 'แสดงภาพรวมข้อมูลและลำดับการใช้งานที่แนะนำ' },
  issuers: { title: 'ผู้มีหน้าที่หักภาษี', subtitle: 'บันทึกข้อมูลผู้ออกหนังสือรับรอง' },
  payees: { title: 'ผู้ถูกหักภาษี', subtitle: 'บันทึกข้อมูลผู้รับเงินและคู่ค้า' },
  signers: { title: 'ผู้ลงนาม', subtitle: 'กำหนดผู้ลงนามในหนังสือรับรอง' },
  incomeTypes: { title: 'ประเภทเงินได้', subtitle: 'ตั้งค่าประเภทเงินได้และอัตราหัก ณ ที่จ่าย' },
  certificates: { title: 'จัดทำหนังสือรับรอง', subtitle: 'บันทึกแบบร่างและออกเลขหนังสือรับรอง' },
  registry: { title: 'ทะเบียนหนังสือรับรอง', subtitle: 'ค้นหาและตรวจสอบสถานะเอกสาร' }
};

function money(value: unknown) {
  return Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusText(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'แบบร่าง',
    ISSUED: 'ออกเอกสารแล้ว',
    CANCELLED: 'ยกเลิกเอกสาร',
    REPLACED: 'ออกเอกสารแทนแล้ว'
  };
  return map[status] || status || '-';
}

function clean(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default function HomePage() {
  const [page, setPage] = useState('dashboard');
  const [data, setData] = useState<SystemData>(initialData);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('กำลังดำเนินการ');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [accessCode, setAccessCode] = useState('');
  const [accessReady, setAccessReady] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; message: string; run: () => Promise<void> }>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [certificateItems, setCertificateItems] = useState<Row[]>([]);
  const [draftCertificate, setDraftCertificate] = useState<Row | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('wht50_access_code') || '';
    setAccessCode(saved);
    loadSystem(saved);
  }, []);

  async function api(action: string, payload: Row = {}, code = accessCode) {
    const res = await fetch('/api/app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-access-code': code
      },
      body: JSON.stringify({ action, payload })
    });

    const json = await res.json();
    if (!json.ok) throw new Error(json.message || 'ไม่สามารถดำเนินการได้');
    return json.data;
  }

  async function loadSystem(code = accessCode) {
    try {
      setLoadingText('กำลังโหลดข้อมูลระบบ');
      setLoading(true);
      const loaded = await api('loadSystem', {}, code);
      setData(loaded || initialData);
      setAccessReady(true);
      if (code) localStorage.setItem('wht50_access_code', code);
      showToast('success', 'โหลดข้อมูลระบบสำเร็จ', 'ระบบพร้อมสำหรับการดำเนินงาน');
    } catch (err: any) {
      setAccessReady(false);
      showToast('error', 'ไม่สามารถโหลดข้อมูลระบบได้', err.message);
    } finally {
      setLoading(false);
    }
  }

  function showToast(type: Toast['type'], title: string, message: string) {
    const item = { id: Date.now() + Math.random(), type, title, message };
    setToasts((prev) => [...prev, item]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== item.id)), 4200);
  }

  function openConfirm(title: string, message: string, run: () => Promise<void>) {
    setConfirm({ title, message, run });
  }

  async function runConfirm() {
    if (!confirm) return;
    try {
      setConfirmBusy(true);
      await confirm.run();
      setConfirm(null);
    } catch (err: any) {
      showToast('error', 'ไม่สามารถดำเนินการได้', err.message || 'กรุณาตรวจสอบข้อมูลที่จำเป็น แล้วดำเนินการอีกครั้ง');
    } finally {
      setConfirmBusy(false);
    }
  }

  function formValues(form: HTMLFormElement) {
    const fd = new FormData(form);
    const values: Row = {};
    fd.forEach((value, key) => values[key] = clean(value));
    return values;
  }

  async function handleSubmit(formId: string, action: string, success: string, after?: () => void) {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const payload = formValues(form);

    openConfirm('ยืนยันการบันทึกข้อมูล', 'กรุณาตรวจสอบความถูกต้องของข้อมูลก่อนยืนยันการบันทึก', async () => {
      setLoadingText('กำลังบันทึกข้อมูล');
      setLoading(true);
      await api(action, payload);
      await loadSystem();
      form.reset();
      after?.();
      showToast('success', 'บันทึกข้อมูลสำเร็จ', success);
      setLoading(false);
    });
  }

  const activePage = pages[page];

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            ระบบออกหนังสือรับรองการหักภาษี ณ ที่จ่าย
            <div className="brand-sub">มาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
          </div>
          <NavButton page="dashboard" current={page} setPage={setPage}>ภาพรวมระบบ</NavButton>
          <NavButton page="issuers" current={page} setPage={setPage}>ผู้มีหน้าที่หักภาษี</NavButton>
          <NavButton page="payees" current={page} setPage={setPage}>ผู้ถูกหักภาษี</NavButton>
          <NavButton page="signers" current={page} setPage={setPage}>ผู้ลงนาม</NavButton>
          <NavButton page="incomeTypes" current={page} setPage={setPage}>ประเภทเงินได้</NavButton>
          <NavButton page="certificates" current={page} setPage={setPage}>จัดทำหนังสือรับรอง</NavButton>
          <NavButton page="registry" current={page} setPage={setPage}>ทะเบียนหนังสือรับรอง</NavButton>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <h1 className="page-title">{activePage.title}</h1>
              <p className="page-subtitle">{activePage.subtitle}</p>
            </div>
            <div className="status-pill"><span className="status-dot" />พร้อมใช้งาน</div>
          </div>

          {!accessReady ? (
            <AccessPanel
              accessCode={accessCode}
              setAccessCode={setAccessCode}
              onSubmit={() => loadSystem(accessCode)}
            />
          ) : (
            <>
              {page === 'dashboard' && <Dashboard data={data} setPage={setPage} />}
              {page === 'issuers' && <Issuers data={data} handleSubmit={handleSubmit} />}
              {page === 'payees' && <Payees data={data} handleSubmit={handleSubmit} />}
              {page === 'signers' && <Signers data={data} handleSubmit={handleSubmit} />}
              {page === 'incomeTypes' && <IncomeTypes data={data} handleSubmit={handleSubmit} />}
              {page === 'certificates' && (
                <Certificates
                  data={data}
                  items={certificateItems}
                  setItems={setCertificateItems}
                  draft={draftCertificate}
                  setDraft={setDraftCertificate}
                  api={api}
                  loadSystem={loadSystem}
                  showToast={showToast}
                  openConfirm={openConfirm}
                  setLoading={setLoading}
                  setLoadingText={setLoadingText}
                />
              )}
              {page === 'registry' && <Registry data={data} />}
            </>
          )}
        </main>
      </div>

      {confirm && (
        <div className="modal-backdrop show">
          <div className="modal">
            <div className="modal-body">
              <div className="modal-icon">✓</div>
              <h3 className="modal-title">{confirm.title}</h3>
              <p className="modal-message">{confirm.message}</p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" disabled={confirmBusy} onClick={() => setConfirm(null)}>ยกเลิก</button>
              <button className="btn btn-primary" disabled={confirmBusy} onClick={runConfirm}>{confirmBusy ? 'กำลังดำเนินการ' : 'ยืนยัน'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <div className="toast-icon">{toast.type === 'error' ? '×' : toast.type === 'warning' ? '!' : '✓'}</div>
            <div>
              <p className="toast-title">{toast.title}</p>
              <p className="toast-message">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="loading-backdrop show">
          <div className="loading-box"><span className="spinner" /><span>{loadingText}</span></div>
        </div>
      )}
    </>
  );
}

function NavButton({ page, current, setPage, children }: { page: string; current: string; setPage: (page: string) => void; children: React.ReactNode }) {
  return <button className={`nav-btn ${current === page ? 'active' : ''}`} onClick={() => setPage(page)}>{children}</button>;
}

function AccessPanel({ accessCode, setAccessCode, onSubmit }: { accessCode: string; setAccessCode: (v: string) => void; onSubmit: () => void }) {
  return (
    <div className="card">
      <div className="card-header"><div><h2 className="card-title">ยืนยันสิทธิ์การเข้าใช้งาน</h2><p className="card-description">กรุณาระบุรหัสเข้าใช้งานระบบที่กำหนดไว้บน Vercel</p></div></div>
      <div className="card-body">
        <div className="form-grid">
          <div className="form-group"><label className="form-label">รหัสเข้าใช้งานระบบ</label><input className="form-control" type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} /></div>
        </div>
        <div className="action-bar"><button className="btn btn-primary" onClick={onSubmit}>เข้าสู่ระบบ</button></div>
      </div>
    </div>
  );
}

function Dashboard({ data, setPage }: { data: SystemData; setPage: (page: string) => void }) {
  return (
    <>
      <div className="summary-grid">
        <SummaryCard label="จำนวนผู้มีหน้าที่หักภาษี" value={data.issuers.length} />
        <SummaryCard label="จำนวนผู้ถูกหักภาษี" value={data.payees.length} />
        <SummaryCard label="จำนวนหนังสือรับรอง" value={data.certificates.length} />
        <SummaryCard label="จำนวนประเภทเงินได้" value={data.incomeTypes.length} />
      </div>
      <div className="card mt-4">
        <div className="card-header"><div><h2 className="card-title">ลำดับการใช้งานที่แนะนำ</h2><p className="card-description">เริ่มต้นจากข้อมูลหลักก่อนจัดทำหนังสือรับรอง</p></div></div>
        <div className="card-body">
          <div className="notice">
            1. บันทึกข้อมูลผู้มีหน้าที่หักภาษี<br />
            2. บันทึกข้อมูลผู้ถูกหักภาษี<br />
            3. กำหนดผู้ลงนาม<br />
            4. ตรวจสอบประเภทเงินได้<br />
            5. จัดทำหนังสือรับรอง<br />
            6. ตรวจสอบทะเบียนหนังสือรับรอง
          </div>
          <div className="action-bar"><button className="btn btn-primary" onClick={() => setPage('certificates')}>จัดทำหนังสือรับรอง</button></div>
        </div>
      </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="summary-card"><div className="summary-label">{label}</div><div className="summary-value">{value.toLocaleString('th-TH')}</div></div>;
}

function Issuers({ data, handleSubmit }: any) {
  return <Card title="ข้อมูลผู้มีหน้าที่หักภาษี" description="ข้อมูลที่มีเครื่องหมาย * เป็นข้อมูลที่จำเป็นต้องระบุ">
    <form id="issuerForm" onSubmit={(e) => e.preventDefault()}>
      <div className="form-grid">
        <Input name="issuerName" label="ชื่อผู้มีหน้าที่หักภาษี" required />
        <Input name="taxId" label="เลขประจำตัวผู้เสียภาษี" required />
        <Select name="branchType" label="ประเภทสาขา" options={['สำนักงานใหญ่', 'สาขา']} />
        <Input name="branchNo" label="เลขที่สาขา" />
        <Textarea name="address" label="ที่อยู่" required />
        <Input name="phone" label="โทรศัพท์" />
        <Input name="email" label="อีเมล" />
        <Input name="logoFileId" label="รหัสไฟล์โลโก้" />
        <Input name="stampFileId" label="รหัสไฟล์ตราประทับ" />
      </div>
      <div className="action-bar"><button type="reset" className="btn btn-secondary">ล้างข้อมูล</button><button type="button" className="btn btn-primary" onClick={() => handleSubmit('issuerForm', 'saveIssuer', 'ระบบบันทึกข้อมูลผู้มีหน้าที่หักภาษีเรียบร้อยแล้ว')}>บันทึกข้อมูล</button></div>
    </form>
    <h3 className="card-title mt-6 mb-3">รายการผู้มีหน้าที่หักภาษี</h3>
    <SimpleTable rows={data.issuers} columns={[['issuer_name', 'ชื่อผู้มีหน้าที่หักภาษี'], ['tax_id', 'เลขประจำตัวผู้เสียภาษี'], ['branch_type', 'ประเภทสาขา']]} />
  </Card>;
}

function Payees({ data, handleSubmit }: any) {
  return <Card title="ข้อมูลผู้ถูกหักภาษี" description="บันทึกข้อมูลผู้รับเงิน คู่ค้า บุคคลธรรมดา หรือนิติบุคคล">
    <form id="payeeForm" onSubmit={(e) => e.preventDefault()}>
      <div className="form-grid">
        <Select name="payeeType" label="ประเภทผู้ถูกหักภาษี" options={['นิติบุคคล', 'บุคคลธรรมดา', 'คณะบุคคล', 'อื่น ๆ']} required />
        <Input name="payeeName" label="ชื่อผู้ถูกหักภาษี" required />
        <Input name="taxId" label="เลขประจำตัวผู้เสียภาษี" required />
        <Select name="branchType" label="ประเภทสาขา" options={['ไม่ระบุ', 'สำนักงานใหญ่', 'สาขา']} />
        <Input name="branchNo" label="เลขที่สาขา" />
        <Textarea name="address" label="ที่อยู่" required />
        <Input name="phone" label="โทรศัพท์" />
        <Input name="email" label="อีเมล" />
        <Input name="contactName" label="ผู้ติดต่อ" />
      </div>
      <div className="action-bar"><button type="reset" className="btn btn-secondary">ล้างข้อมูล</button><button type="button" className="btn btn-primary" onClick={() => handleSubmit('payeeForm', 'savePayee', 'ระบบบันทึกข้อมูลผู้ถูกหักภาษีเรียบร้อยแล้ว')}>บันทึกข้อมูล</button></div>
    </form>
    <h3 className="card-title mt-6 mb-3">รายการผู้ถูกหักภาษี</h3>
    <SimpleTable rows={data.payees} columns={[['payee_name', 'ชื่อผู้ถูกหักภาษี'], ['tax_id', 'เลขประจำตัวผู้เสียภาษี'], ['payee_type', 'ประเภท']]} />
  </Card>;
}

function Signers({ data, handleSubmit }: any) {
  return <Card title="ข้อมูลผู้ลงนาม" description="ระบบกำหนดผู้ลงนามหลักได้เพียงหนึ่งรายการ">
    <form id="signerForm" onSubmit={(e) => e.preventDefault()}>
      <div className="form-grid">
        <Input name="signerName" label="ชื่อผู้ลงนาม" required />
        <Input name="signerPosition" label="ตำแหน่ง" required />
        <Input name="signatureFileId" label="รหัสไฟล์ลายมือชื่อ" />
        <Select name="isPrimary" label="กำหนดเป็นผู้ลงนามหลัก" options={[['false', 'ไม่ใช่'], ['true', 'ใช่']]} />
      </div>
      <div className="action-bar"><button type="reset" className="btn btn-secondary">ล้างข้อมูล</button><button type="button" className="btn btn-primary" onClick={() => handleSubmit('signerForm', 'saveSigner', 'ระบบบันทึกข้อมูลผู้ลงนามเรียบร้อยแล้ว')}>บันทึกข้อมูล</button></div>
    </form>
    <h3 className="card-title mt-6 mb-3">รายการผู้ลงนาม</h3>
    <SimpleTable rows={data.signers.map((x: Row) => ({ ...x, is_primary_text: x.is_primary ? 'ใช่' : 'ไม่ใช่' }))} columns={[['signer_name', 'ชื่อผู้ลงนาม'], ['signer_position', 'ตำแหน่ง'], ['is_primary_text', 'ผู้ลงนามหลัก']]} />
  </Card>;
}

function IncomeTypes({ data, handleSubmit }: any) {
  return <Card title="ข้อมูลประเภทเงินได้" description="ตั้งค่าประเภทเงินได้และอัตราหัก ณ ที่จ่าย">
    <form id="incomeTypeForm" onSubmit={(e) => e.preventDefault()}>
      <div className="form-grid">
        <Input name="incomeTypeName" label="ชื่อประเภทเงินได้" required />
        <Input name="incomeTypeCode" label="รหัสประเภทเงินได้" />
        <Input name="withholdingRate" label="อัตราหัก ณ ที่จ่าย" type="number" step="0.01" required />
        <Select name="filingForm" label="แบบนำส่ง" options={['ภ.ง.ด.3', 'ภ.ง.ด.53', 'กำหนดตามรายการ']} />
        <Input name="sortOrder" label="ลำดับการแสดงผล" type="number" />
      </div>
      <div className="action-bar"><button type="reset" className="btn btn-secondary">ล้างข้อมูล</button><button type="button" className="btn btn-primary" onClick={() => handleSubmit('incomeTypeForm', 'saveIncomeType', 'ระบบบันทึกข้อมูลประเภทเงินได้เรียบร้อยแล้ว')}>บันทึกข้อมูล</button></div>
    </form>
    <h3 className="card-title mt-6 mb-3">รายการประเภทเงินได้</h3>
    <SimpleTable rows={data.incomeTypes} columns={[['income_type_name', 'ชื่อประเภทเงินได้'], ['withholding_rate', 'อัตรา'], ['filing_form', 'แบบนำส่ง']]} />
  </Card>;
}

function Certificates(props: any) {
  const { data, items, setItems, draft, setDraft, api, loadSystem, showToast, openConfirm, setLoading, setLoadingText } = props;

  const totals = useMemo(() => {
    const paid = items.reduce((sum: number, item: Row) => sum + Number(item.paidAmount || 0), 0);
    const tax = items.reduce((sum: number, item: Row) => sum + Number(item.withheldTax || 0), 0);
    return { paid: round2(paid), tax: round2(tax), net: round2(paid - tax) };
  }, [items]);

  function addItem() {
    const incomeTypeId = (document.getElementById('incomeTypeId') as HTMLSelectElement)?.value || '';
    const income = data.incomeTypes.find((x: Row) => x.income_type_id === incomeTypeId);
    const paidAmount = Number((document.getElementById('paidAmount') as HTMLInputElement)?.value || 0);
    const withholdingRate = Number((document.getElementById('withholdingRate') as HTMLInputElement)?.value || 0);
    const description = (document.getElementById('description') as HTMLTextAreaElement)?.value || '';

    if (!income) { showToast('warning', 'กรุณาตรวจสอบข้อมูล', 'กรุณาเลือกประเภทเงินได้'); return; }
    if (!paidAmount || paidAmount <= 0) { showToast('warning', 'กรุณาตรวจสอบข้อมูล', 'กรุณาระบุจำนวนเงินที่จ่ายให้ถูกต้อง'); return; }
    if (withholdingRate < 0) { showToast('warning', 'กรุณาตรวจสอบข้อมูล', 'กรุณาระบุอัตราหัก ณ ที่จ่ายให้ถูกต้อง'); return; }

    const withheldTax = round2(paidAmount * withholdingRate / 100);
    setItems([...items, {
      incomeTypeId,
      incomeTypeName: income.income_type_name,
      description,
      paidAmount: round2(paidAmount),
      withholdingRate,
      withheldTax
    }]);

    (document.getElementById('paidAmount') as HTMLInputElement).value = '';
    (document.getElementById('description') as HTMLTextAreaElement).value = '';
  }

  function changeIncomeType() {
    const incomeTypeId = (document.getElementById('incomeTypeId') as HTMLSelectElement)?.value || '';
    const income = data.incomeTypes.find((x: Row) => x.income_type_id === incomeTypeId);
    const input = document.getElementById('withholdingRate') as HTMLInputElement | null;
    if (income && input) input.value = income.withholding_rate;
  }

  async function saveDraft() {
    const payload = {
      issuerId: (document.getElementById('issuerId') as HTMLSelectElement)?.value || '',
      payeeId: (document.getElementById('payeeId') as HTMLSelectElement)?.value || '',
      signerId: (document.getElementById('signerId') as HTMLSelectElement)?.value || '',
      paymentDate: (document.getElementById('paymentDate') as HTMLInputElement)?.value || '',
      payerCondition: (document.getElementById('payerCondition') as HTMLSelectElement)?.value || 'หัก ณ ที่จ่าย',
      items
    };

    openConfirm('ยืนยันการบันทึกแบบร่าง', 'กรุณาตรวจสอบข้อมูลหัวเอกสารและรายการเงินได้ก่อนยืนยันการบันทึก', async () => {
      setLoadingText('กำลังบันทึกแบบร่าง');
      setLoading(true);
      const cert = await api('createCertificateDraft', payload);
      setDraft(cert);
      await loadSystem();
      showToast('success', 'บันทึกข้อมูลสำเร็จ', 'ระบบบันทึกแบบร่างหนังสือรับรองเรียบร้อยแล้ว');
      setLoading(false);
    });
  }

  async function issueDraft() {
    if (!draft?.certificate_id) {
      showToast('warning', 'ไม่สามารถดำเนินการได้', 'กรุณาบันทึกแบบร่างก่อนออกเลขหนังสือรับรอง');
      return;
    }

    openConfirm('ยืนยันการออกเลขหนังสือรับรอง', 'เมื่อออกเลขหนังสือรับรองแล้ว ระบบจะบันทึกเลขเอกสารและลิงก์ตรวจสอบเอกสาร', async () => {
      setLoadingText('กำลังออกเลขหนังสือรับรอง');
      setLoading(true);
      const cert = await api('issueCertificate', { certificateId: draft.certificate_id });
      setDraft(cert);
      setItems([]);
      await loadSystem();
      showToast('success', 'ดำเนินการสำเร็จ', `ระบบออกเลขหนังสือรับรอง ${cert.certificate_no} เรียบร้อยแล้ว`);
      setLoading(false);
    });
  }

  return <Card title="จัดทำหนังสือรับรอง" description="กรอกข้อมูลหัวเอกสาร เพิ่มรายการเงินได้ และบันทึกแบบร่าง">
    <div className="form-grid">
      <SelectData id="issuerId" label="ผู้มีหน้าที่หักภาษี" rows={data.issuers} valueKey="issuer_id" labelKey="issuer_name" required />
      <SelectData id="payeeId" label="ผู้ถูกหักภาษี" rows={data.payees} valueKey="payee_id" labelKey="payee_name" required />
      <SelectData id="signerId" label="ผู้ลงนาม" rows={data.signers} valueKey="signer_id" labelKey="signer_name" required />
      <Input id="paymentDate" name="paymentDate" label="วันที่จ่ายเงิน" type="date" required />
      <Select id="payerCondition" name="payerCondition" label="เงื่อนไขผู้จ่ายเงิน" options={['หัก ณ ที่จ่าย', 'ออกให้ตลอดไป', 'ออกให้ครั้งเดียว', 'อื่น ๆ']} />
    </div>

    <h3 className="card-title mt-6 mb-3">รายการเงินได้</h3>
    <div className="form-grid">
      <SelectData id="incomeTypeId" label="ประเภทเงินได้" rows={data.incomeTypes} valueKey="income_type_id" labelKey="income_type_name" onChange={changeIncomeType} />
      <Input id="paidAmount" name="paidAmount" label="จำนวนเงินที่จ่าย" type="number" step="0.01" />
      <Input id="withholdingRate" name="withholdingRate" label="อัตราหัก ณ ที่จ่าย" type="number" step="0.01" />
      <Textarea id="description" name="description" label="รายละเอียดรายการ" />
    </div>
    <div className="action-bar"><button className="btn btn-soft" type="button" onClick={addItem}>เพิ่มรายการเงินได้</button></div>

    <h3 className="card-title mt-6 mb-3">รายการในเอกสาร</h3>
    <ItemsTable items={items} setItems={setItems} />

    <div className="notice mt-4">
      รวมจำนวนเงินที่จ่าย: {money(totals.paid)} บาท<br />
      รวมภาษีที่หัก: {money(totals.tax)} บาท<br />
      จำนวนเงินสุทธิ: {money(totals.net)} บาท
    </div>

    {draft?.certificate_no && <div className="notice mt-4">เลขที่หนังสือรับรอง: {draft.certificate_no}<br />ลิงก์ตรวจสอบเอกสาร: {draft.verification_url}</div>}

    <div className="action-bar"><button className="btn btn-secondary" onClick={saveDraft}>บันทึกแบบร่าง</button><button className="btn btn-primary" onClick={issueDraft}>ออกเลขหนังสือรับรอง</button></div>
  </Card>;
}

function Registry({ data }: { data: SystemData }) {
  return <Card title="ทะเบียนหนังสือรับรอง" description="แสดงรายการหนังสือรับรองทั้งหมดในระบบ">
    <SimpleTable rows={data.certificates.map((x) => ({ ...x, status_text: statusText(x.status), total_paid_amount_text: money(x.total_paid_amount), total_withheld_tax_text: money(x.total_withheld_tax), verification_link: x.verification_url || '-' }))} columns={[
      ['certificate_no', 'เลขที่หนังสือรับรอง'],
      ['status_text', 'สถานะ'],
      ['payment_date', 'วันที่จ่ายเงิน'],
      ['total_paid_amount_text', 'จำนวนเงินที่จ่าย'],
      ['total_withheld_tax_text', 'ภาษีที่หัก'],
      ['verification_link', 'ลิงก์ตรวจสอบเอกสาร']
    ]} linkColumn="verification_link" />
  </Card>;
}

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="card"><div className="card-header"><div><h2 className="card-title">{title}</h2><p className="card-description">{description}</p></div></div><div className="card-body">{children}</div></div>;
}

function Input({ id, name, label, required, type = 'text', step }: any) {
  return <div className="form-group"><label className="form-label">{label} {required && <span className="required">*</span>}</label><input id={id || name} name={name} type={type} step={step} className="form-control" /></div>;
}

function Textarea({ id, name, label, required }: any) {
  return <div className="form-group full"><label className="form-label">{label} {required && <span className="required">*</span>}</label><textarea id={id || name} name={name} className="form-textarea" /></div>;
}

function Select({ id, name, label, options, required }: any) {
  return <div className="form-group"><label className="form-label">{label} {required && <span className="required">*</span>}</label><select id={id || name} name={name} className="form-select">{options.map((opt: any) => Array.isArray(opt) ? <option key={opt[0]} value={opt[0]}>{opt[1]}</option> : <option key={opt} value={opt}>{opt}</option>)}</select></div>;
}

function SelectData({ id, label, rows, valueKey, labelKey, required, onChange }: any) {
  return <div className="form-group"><label className="form-label">{label} {required && <span className="required">*</span>}</label><select id={id} className="form-select" onChange={onChange}><option value="">กรุณาเลือกข้อมูล</option>{rows.map((row: Row) => <option key={row[valueKey]} value={row[valueKey]}>{row[labelKey]}</option>)}</select></div>;
}

function SimpleTable({ rows, columns, linkColumn }: { rows: Row[]; columns: [string, string][]; linkColumn?: string }) {
  if (!rows.length) return <div className="notice">ยังไม่มีข้อมูลในระบบ</div>;
  return <div className="table-wrap"><table className="table"><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, idx) => <tr key={idx}>{columns.map(([key]) => <td key={key}>{linkColumn === key && row[key] && row[key] !== '-' ? <a href={row[key]} target="_blank" rel="noreferrer">เปิดหน้าตรวจสอบเอกสาร</a> : clean(row[key]) || '-'}</td>)}</tr>)}</tbody></table></div>;
}

function ItemsTable({ items, setItems }: { items: Row[]; setItems: (items: Row[]) => void }) {
  if (!items.length) return <div className="notice">ยังไม่มีรายการเงินได้</div>;
  return <div className="table-wrap"><table className="table"><thead><tr><th>ประเภทเงินได้</th><th>รายละเอียด</th><th>จำนวนเงิน</th><th>อัตรา</th><th>ภาษีที่หัก</th><th>จัดการ</th></tr></thead><tbody>{items.map((item, idx) => <tr key={idx}><td>{item.incomeTypeName}</td><td>{item.description || '-'}</td><td>{money(item.paidAmount)}</td><td>{item.withholdingRate}%</td><td>{money(item.withheldTax)}</td><td><button className="btn btn-danger" onClick={() => setItems(items.filter((_, i) => i !== idx))}>ลบรายการ</button></td></tr>)}</tbody></table></div>;
}
