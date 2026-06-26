create extension if not exists pgcrypto;

create table if not exists public.system_settings (
  setting_key text primary key,
  setting_value text not null default '',
  description text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

create table if not exists public.issuers (
  issuer_id uuid primary key default gen_random_uuid(),
  status text not null default 'ACTIVE',
  issuer_name text not null,
  tax_id text not null,
  branch_type text not null default 'สำนักงานใหญ่',
  branch_no text not null default '',
  address text not null,
  phone text not null default '',
  email text not null default '',
  logo_file_id text not null default '',
  stamp_file_id text not null default '',
  created_at timestamptz not null default now(),
  created_by text not null default 'system',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

create table if not exists public.payees (
  payee_id uuid primary key default gen_random_uuid(),
  status text not null default 'ACTIVE',
  payee_type text not null,
  payee_name text not null,
  tax_id text not null,
  branch_type text not null default 'ไม่ระบุ',
  branch_no text not null default '',
  address text not null,
  phone text not null default '',
  email text not null default '',
  contact_name text not null default '',
  created_at timestamptz not null default now(),
  created_by text not null default 'system',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

create table if not exists public.signers (
  signer_id uuid primary key default gen_random_uuid(),
  status text not null default 'ACTIVE',
  signer_name text not null,
  signer_position text not null,
  signature_file_id text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  created_by text not null default 'system',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

create table if not exists public.income_types (
  income_type_id uuid primary key default gen_random_uuid(),
  status text not null default 'ACTIVE',
  income_type_name text not null,
  income_type_code text not null default '',
  withholding_rate numeric(7,2) not null default 0,
  filing_form text not null default 'กำหนดตามรายการ',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by text not null default 'system',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

create table if not exists public.certificates (
  certificate_id uuid primary key default gen_random_uuid(),
  status text not null default 'DRAFT',
  certificate_no text not null default '',
  issue_date date,
  payment_date date not null,
  tax_year integer not null,
  issuer_id uuid not null references public.issuers(issuer_id),
  issuer_snapshot jsonb not null default '{}'::jsonb,
  payee_id uuid not null references public.payees(payee_id),
  payee_snapshot jsonb not null default '{}'::jsonb,
  signer_id uuid not null references public.signers(signer_id),
  signer_snapshot jsonb not null default '{}'::jsonb,
  payer_condition text not null default 'หัก ณ ที่จ่าย',
  total_paid_amount numeric(14,2) not null default 0,
  total_withheld_tax numeric(14,2) not null default 0,
  net_paid_amount numeric(14,2) not null default 0,
  verification_code text not null default '',
  verification_url text not null default '',
  pdf_file_id text not null default '',
  pdf_url text not null default '',
  created_at timestamptz not null default now(),
  created_by text not null default 'system',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system',
  constraint certificates_status_check check (status in ('DRAFT','ISSUED','CANCELLED','REPLACED'))
);

create table if not exists public.certificate_items (
  item_id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.certificates(certificate_id) on delete cascade,
  income_type_id uuid references public.income_types(income_type_id),
  income_type_name text not null,
  description text not null default '',
  paid_amount numeric(14,2) not null default 0,
  withholding_rate numeric(7,2) not null default 0,
  withheld_tax numeric(14,2) not null default 0,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  created_by text not null default 'system'
);

create table if not exists public.document_numbering (
  numbering_id text primary key,
  status text not null default 'ACTIVE',
  prefix text not null default 'WHT',
  year_mode text not null default 'BE',
  digits integer not null default 4,
  current_year integer not null default 0,
  current_number integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system'
);

create table if not exists public.activity_log (
  log_id uuid primary key default gen_random_uuid(),
  action text not null,
  target_type text not null,
  target_id text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text not null default 'system'
);

create index if not exists idx_issuers_status on public.issuers(status);
create index if not exists idx_payees_status on public.payees(status);
create index if not exists idx_signers_status on public.signers(status);
create index if not exists idx_income_types_status on public.income_types(status);
create unique index if not exists idx_income_types_code_unique on public.income_types(income_type_code) where income_type_code <> '';
create index if not exists idx_certificates_status on public.certificates(status);
create index if not exists idx_certificates_payment_date on public.certificates(payment_date);
create unique index if not exists idx_certificates_certificate_no_unique on public.certificates(certificate_no) where certificate_no <> '';
create unique index if not exists idx_certificates_verification_code_unique on public.certificates(verification_code) where verification_code <> '';

alter table public.system_settings enable row level security;
alter table public.issuers enable row level security;
alter table public.payees enable row level security;
alter table public.signers enable row level security;
alter table public.income_types enable row level security;
alter table public.certificates enable row level security;
alter table public.certificate_items enable row level security;
alter table public.document_numbering enable row level security;
alter table public.activity_log enable row level security;

insert into public.document_numbering (
  numbering_id,
  status,
  prefix,
  year_mode,
  digits,
  current_year,
  current_number,
  updated_by
)
values (
  'WHT_CERTIFICATE',
  'ACTIVE',
  'WHT',
  'BE',
  4,
  extract(year from timezone('Asia/Bangkok', now()))::integer + 543,
  0,
  'system'
)
on conflict (numbering_id) do nothing;

insert into public.income_types (
  income_type_name,
  income_type_code,
  withholding_rate,
  filing_form,
  sort_order,
  created_by,
  updated_by
)
values
  ('ค่าบริการ', 'SERVICE', 3, 'ภ.ง.ด.53', 1, 'system', 'system'),
  ('ค่าจ้างทำของ', 'WORK', 3, 'ภ.ง.ด.53', 2, 'system', 'system'),
  ('ค่าเช่า', 'RENT', 5, 'ภ.ง.ด.53', 3, 'system', 'system'),
  ('ค่าโฆษณา', 'ADVERTISING', 2, 'ภ.ง.ด.53', 4, 'system', 'system'),
  ('ค่าขนส่ง', 'TRANSPORT', 1, 'ภ.ง.ด.53', 5, 'system', 'system'),
  ('เงินได้อื่น ๆ', 'OTHER', 0, 'กำหนดตามรายการ', 6, 'system', 'system')
on conflict do nothing;

insert into public.system_settings (
  setting_key,
  setting_value,
  description,
  updated_by
)
values
  ('app_name', 'ระบบออกหนังสือรับรองการหักภาษี ณ ที่จ่าย', 'ชื่อระบบ', 'system'),
  ('timezone', 'Asia/Bangkok', 'เขตเวลา', 'system')
on conflict (setting_key) do update set
  setting_value = excluded.setting_value,
  description = excluded.description,
  updated_at = now(),
  updated_by = excluded.updated_by;

create or replace function public.issue_certificate(
  p_certificate_id uuid,
  p_base_url text,
  p_actor text default 'system'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cert certificates%rowtype;
  v_numbering document_numbering%rowtype;
  v_year integer;
  v_next_number integer;
  v_certificate_no text;
  v_verification_code text;
  v_verification_url text;
  v_issuer jsonb;
  v_payee jsonb;
  v_signer jsonb;
begin
  select * into v_cert
  from public.certificates
  where certificate_id = p_certificate_id
  for update;

  if not found then
    raise exception 'ไม่พบข้อมูลหนังสือรับรอง';
  end if;

  if v_cert.status = 'ISSUED' then
    return to_jsonb(v_cert);
  end if;

  if v_cert.status <> 'DRAFT' then
    raise exception 'ไม่สามารถออกเลขหนังสือรับรองจากสถานะปัจจุบันได้';
  end if;

  select * into v_numbering
  from public.document_numbering
  where numbering_id = 'WHT_CERTIFICATE'
  for update;

  if not found then
    raise exception 'ไม่พบข้อมูลเลขรันเอกสาร';
  end if;

  v_year := extract(year from timezone('Asia/Bangkok', now()))::integer + 543;

  if v_numbering.current_year <> v_year then
    v_next_number := 1;
  else
    v_next_number := v_numbering.current_number + 1;
  end if;

  v_certificate_no := v_numbering.prefix || '-' || v_year || '-' || lpad(v_next_number::text, v_numbering.digits, '0');
  v_verification_code := encode(gen_random_bytes(24), 'hex');
  v_verification_url := trim(trailing '/' from coalesce(p_base_url, '')) || '/verify/' || v_verification_code;

  select to_jsonb(i) - 'created_by' - 'updated_by' into v_issuer
  from public.issuers i
  where i.issuer_id = v_cert.issuer_id;

  select to_jsonb(p) - 'created_by' - 'updated_by' into v_payee
  from public.payees p
  where p.payee_id = v_cert.payee_id;

  select to_jsonb(s) - 'created_by' - 'updated_by' into v_signer
  from public.signers s
  where s.signer_id = v_cert.signer_id;

  update public.document_numbering
  set current_year = v_year,
      current_number = v_next_number,
      updated_at = now(),
      updated_by = coalesce(p_actor, 'system')
  where numbering_id = 'WHT_CERTIFICATE';

  update public.certificates
  set status = 'ISSUED',
      certificate_no = v_certificate_no,
      issue_date = (timezone('Asia/Bangkok', now()))::date,
      issuer_snapshot = coalesce(v_issuer, '{}'::jsonb),
      payee_snapshot = coalesce(v_payee, '{}'::jsonb),
      signer_snapshot = coalesce(v_signer, '{}'::jsonb),
      verification_code = v_verification_code,
      verification_url = v_verification_url,
      updated_at = now(),
      updated_by = coalesce(p_actor, 'system')
  where certificate_id = p_certificate_id
  returning * into v_cert;

  insert into public.activity_log(action, target_type, target_id, detail, created_by)
  values (
    'ออกเลขหนังสือรับรอง',
    'certificate',
    p_certificate_id::text,
    jsonb_build_object('certificateNo', v_certificate_no),
    coalesce(p_actor, 'system')
  );

  return to_jsonb(v_cert);
end;
$$;
