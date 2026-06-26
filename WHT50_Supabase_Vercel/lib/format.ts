export function money(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function statusText(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'แบบร่าง',
    ISSUED: 'ออกเอกสารแล้ว',
    CANCELLED: 'ยกเลิกเอกสาร',
    REPLACED: 'ออกเอกสารแทนแล้ว'
  };
  return map[status] || status || '-';
}

export function safeText(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}
