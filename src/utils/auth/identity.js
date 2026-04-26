const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const normalizePhone = (value = '') => String(value || '').replace(/\s+/g, '').replace(/^\+/, '').trim();

const resolveLoginIdentifier = ({ email, phone, identifier }) => {
  const raw = email || phone || identifier || '';
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return { raw: '', type: 'unknown', lookup: [] };
  }

  const isEmail = trimmed.includes('@');
  if (isEmail) {
    const normalized = normalizeEmail(trimmed);
    return {
      raw: trimmed,
      type: 'email',
      lookup: [{ email: normalized }]
    };
  }

  const normalizedPhone = normalizePhone(trimmed);
  return {
    raw: trimmed,
    type: 'phone',
    lookup: [{ phone: trimmed }, { phone: normalizedPhone }]
  };
};

module.exports = {
  normalizeEmail,
  normalizePhone,
  resolveLoginIdentifier
};
