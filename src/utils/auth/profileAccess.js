const PRIVILEGED_BRANCH_ROLES = new Set(['superadmin', 'admin', 'manager']);
const PRIVILEGED_PERMISSIONS = new Set(['staff:edit', 'roles:manage']);

const BASE_SELF_EDITABLE_FIELDS = {
  name: true,
  phone: true,
  profileImageUrl: true,
  address: true,
  emergencyContactName: true,
  emergencyContactPhone: true
};

const canEditLockedIdentityFields = ({ role, branchRole, permissions = [] } = {}) => {
  const normalizedRole = `${role || ''}`.toLowerCase();
  const normalizedBranchRole = `${branchRole || ''}`.toLowerCase();
  const normalizedPermissions = permissions.map((permission) => `${permission || ''}`.toLowerCase());

  if (PRIVILEGED_BRANCH_ROLES.has(normalizedRole) || PRIVILEGED_BRANCH_ROLES.has(normalizedBranchRole)) {
    return true;
  }

  return normalizedPermissions.some((permission) => PRIVILEGED_PERMISSIONS.has(permission));
};

const buildSelfProfileEditPolicy = (user, context = {}) => {
  const identityAlreadySet = Boolean(user?.citizenshipNumber || user?.citizenshipImageUrl);
  const canManageLockedIdentity = canEditLockedIdentityFields({
    role: user?.role,
    branchRole: context.branchRole,
    permissions: context.permissions
  });
  const identityEditable = canManageLockedIdentity || !identityAlreadySet;

  return {
    editableFields: {
      ...BASE_SELF_EDITABLE_FIELDS,
      citizenshipNumber: identityEditable,
      citizenshipImageUrl: identityEditable
    },
    lockedFields: identityEditable ? [] : ['citizenshipNumber', 'citizenshipImageUrl'],
    notes: {
      citizenshipNumber: identityEditable
        ? 'Citizenship number can be updated before verification is locked.'
        : 'Citizenship number is locked after verification. Ask admin or superadmin for correction.',
      citizenshipImageUrl: identityEditable
        ? 'Citizenship image can be updated before verification is locked.'
        : 'Citizenship image is locked after verification. Ask admin or superadmin for correction.'
    }
  };
};

module.exports = {
  buildSelfProfileEditPolicy
};
