const normalizeMemberships = (memberships = []) =>
  (Array.isArray(memberships) ? memberships : []).filter(
    (m) => m && (m.active === true || m.status === 'active')
  );

const pickActiveMembership = ({ memberships = [], requestedBranchId }) => {
  const activeMemberships = normalizeMemberships(memberships);
  if (!activeMemberships.length) {
    return { error: 'No branch memberships. Contact admin.' };
  }

  if (requestedBranchId) {
    const active = activeMemberships.find((m) => String(m.branchId) === String(requestedBranchId));
    if (!active) {
      return { error: 'Branch access denied' };
    }
    return { active, memberships: activeMemberships };
  }

  if (activeMemberships.length === 1) {
    return { active: activeMemberships[0], memberships: activeMemberships };
  }

  return {
    error: 'Select a branch',
    branches: activeMemberships.map((m) => ({ branchId: m.branchId, role: m.role }))
  };
};

module.exports = {
  normalizeMemberships,
  pickActiveMembership
};
