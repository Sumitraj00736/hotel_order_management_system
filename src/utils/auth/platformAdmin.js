const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const getPlatformAdminEmails = () =>
  String(process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);

const isPlatformAdminUser = (user) => {
  if (!user) return false;
  if (user.isPlatformAdmin === true) return true;

  const email = normalizeEmail(user.email);
  if (!email) return false;

  return getPlatformAdminEmails().includes(email);
};

module.exports = {
  getPlatformAdminEmails,
  isPlatformAdminUser
};
