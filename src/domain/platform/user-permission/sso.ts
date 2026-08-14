export type SsoProviderProtocol = 'oauth2' | 'oidc' | 'saml' | 'ldap';
export type SsoProviderStatus = 'enabled' | 'disabled' | 'draft';
export type SsoAccountMatchField = 'email' | 'phone' | 'employeeNo';
export type SsoUnmatchedPolicy = 'create' | 'disable' | 'reject';

export interface SsoProviderRecord {
  id: string;
  /** 所属管理方 ID（平台方三层模型关键字段） */
  clientId: number;
  code: string;
  name: string;
  vendor: string;
  protocol: SsoProviderProtocol;
  status: SsoProviderStatus;
  /** SSO 提供方的 OAuth Client ID */
  appClientId: string;
  clientSecret: string;
  issuer: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  callbackUrl: string;
  matchField: SsoAccountMatchField;
  defaultRole: string;
  unmatchedPolicy: SsoUnmatchedPolicy;
  autoCreateAccount: boolean;
  syncEnabled: boolean;
  boundAccounts: number;
  lastSyncAt: string;
  createdAt: string;
  updatedAt: string;
}

export type SsoProviderDraft = Omit<
  SsoProviderRecord,
  'id' | 'clientId' | 'boundAccounts' | 'lastSyncAt' | 'createdAt' | 'updatedAt'
>;

export const ssoProviderProtocolLabels: Record<SsoProviderProtocol, string> = {
  oauth2: 'OAuth2',
  oidc: 'OIDC',
  saml: 'SAML',
  ldap: 'LDAP / AD',
};

export const ssoProviderStatusLabels: Record<SsoProviderStatus, string> = {
  enabled: 'Enabled',
  disabled: 'Disabled',
  draft: 'Draft',
};

export const ssoAccountMatchFieldLabels: Record<SsoAccountMatchField, string> = {
  email: 'Email',
  phone: 'Phone',
  employeeNo: 'Employee No.',
};

export const ssoUnmatchedPolicyLabels: Record<SsoUnmatchedPolicy, string> = {
  create: 'Auto-create account',
  disable: 'Create as disabled',
  reject: 'Reject login',
};
