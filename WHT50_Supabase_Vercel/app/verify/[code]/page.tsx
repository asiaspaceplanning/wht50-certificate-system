import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { money, safeText, statusText } from '@/lib/format';

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const result = await supabaseAdmin
    .from('certificates')
    .select('*')
    .eq('verification_code', code)
    .maybeSingle();

  const certificate = result.data;

  if (!certificate) {
    return (
      <main className="main" style={{ maxWidth: 920, margin: '0 auto' }}>
        <div className="topbar">
          <div>
            <h1 className="page-title">ตรวจสอบหนังสือรับรอง</h1>
            <p className="page-subtitle">ผลการตรวจสอบเอกสาร</p>
          </div>
          <div className="status-pill"><span className="status-dot" />พร้อมใช้งาน</div>
        </div>
        <div className="card">
          <div className="card-header"><div><h2 className="card-title">ไม่พบข้อมูลหนังสือรับรอง</h2><p className="card-description">กรุณาตรวจสอบลิงก์ตรวจสอบเอกสารอีกครั้ง</p></div></div>
        </div>
      </main>
    );
  }

  const issuer = certificate.issuer_snapshot || {};
  const payee = certificate.payee_snapshot || {};
  const checkedAt = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  return (
    <main className="main" style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="topbar">
        <div>
          <h1 className="page-title">ตรวจสอบหนังสือรับรอง</h1>
          <p className="page-subtitle">ผลการตรวจสอบเอกสารจากระบบ</p>
        </div>
        <div className="status-pill"><span className="status-dot" />พร้อมใช้งาน</div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">ข้อมูลหนังสือรับรอง</h2>
            <p className="card-description">รายละเอียดเอกสารที่ได้รับการบันทึกในระบบ</p>
          </div>
        </div>
        <div className="card-body">
          <div className="table-wrap">
            <table className="table">
              <tbody>
                <tr><th>สถานะเอกสาร</th><td>{statusText(certificate.status)}</td></tr>
                <tr><th>เลขที่หนังสือรับรอง</th><td>{safeText(certificate.certificate_no)}</td></tr>
                <tr><th>วันที่ออกเอกสาร</th><td>{safeText(certificate.issue_date)}</td></tr>
                <tr><th>วันที่จ่ายเงิน</th><td>{safeText(certificate.payment_date)}</td></tr>
                <tr><th>ผู้มีหน้าที่หักภาษี</th><td>{safeText(issuer.issuer_name)}</td></tr>
                <tr><th>ผู้ถูกหักภาษี</th><td>{safeText(payee.payee_name)}</td></tr>
                <tr><th>จำนวนเงินที่จ่าย</th><td>{money(certificate.total_paid_amount)} บาท</td></tr>
                <tr><th>ภาษีที่หัก</th><td>{money(certificate.total_withheld_tax)} บาท</td></tr>
                <tr><th>วันและเวลาที่ตรวจสอบ</th><td>{checkedAt}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
