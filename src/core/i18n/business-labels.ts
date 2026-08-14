export type Translate = (key: string, params?: Record<string, unknown>) => string;

const auditActionKeys: Record<string, string> = {
  'tenant.create': 'tenantCreate', 'tenant.update': 'tenantUpdate', 'tenant.status.update': 'tenantStatusUpdate',
  'identity-provider.create': 'identityProviderCreate', 'identity-provider.update': 'identityProviderUpdate',
  'identity-provider.sync.request': 'identityProviderSync', 'identity-provider.delete': 'identityProviderDelete',
  'system.parameter.update': 'parameterUpdate', 'system.parameter.reset': 'parameterReset',
  'role.create': 'roleCreate', 'role.update': 'roleUpdate', 'role.delete': 'roleDelete',
  'space.create': 'spaceCreate', 'space.update': 'spaceUpdate', 'space.delete': 'spaceDelete',
  'position.create': 'positionCreate', 'position.update': 'positionUpdate', 'position.delete': 'positionDelete',
  'organization.create': 'organizationCreate', 'organization.update': 'organizationUpdate', 'organization.delete': 'organizationDelete',
  'dictionary.type.create': 'dictionaryTypeCreate', 'dictionary.type.update': 'dictionaryTypeUpdate', 'dictionary.type.delete': 'dictionaryTypeDelete',
  'dictionary.item.create': 'dictionaryItemCreate', 'dictionary.item.update': 'dictionaryItemUpdate', 'dictionary.item.delete': 'dictionaryItemDelete',
  'dictionary.item.status.update': 'dictionaryItemStatus', 'dictionary.item.sort': 'dictionaryItemSort',
  'menu.create': 'menuCreate', 'menu.update': 'menuUpdate', 'menu.delete': 'menuDelete',
  'account.create': 'accountCreate', 'account.update': 'accountUpdate', 'account.status.update': 'accountStatus',
  'account.password.reset': 'accountPasswordReset', 'account.delete': 'accountDelete',
};

export function auditActionLabel(t: Translate, code?: string | null) {
  if (!code) return '-';
  const key = auditActionKeys[code];
  return key ? t(`business.auditAction.${key}`) : code;
}

export function loginFailureLabel(t: Translate, code?: string | null) {
  if (!code) return '-';
  const supported = ['BAD_CREDENTIALS', 'ACCOUNT_LOCKED', 'ACCOUNT_DISABLED', 'CAPTCHA_INVALID', 'CLIENT_NOT_FOUND', 'USERNAME_AMBIGUOUS'];
  return supported.includes(code) ? t(`business.loginFailure.${code}`) : code;
}

export function businessStatusLabel(t: Translate, group: string, value: string) {
  return t(`business.${group}.${value}`);
}
