export interface LoginCredentials {
  username: string;
  password: string;
  captchaId?: string;
  captchaCode?: string;
}

export interface LoginPolicy {
  captchaRequired: boolean;
  showForgotPassword: boolean;
  showSmsLogin: boolean;
  showWechat: boolean;
  showAlipay: boolean;
  showTrialRegistration: boolean;
  showExperience: boolean;
  experienceUsername: string;
}

export interface CaptchaChallenge {
  captchaId: string;
  imageDataUrl: string;
  expiresAt: string;
}

export interface TrialRegistrationInput {
  username: string;
  password: string;
  email?: string;
  captchaId: string;
  captchaCode: string;
  agreementAccepted: boolean;
}

export interface AuthUserContext {
  accountId: number;
  clientId: number;
  clientCode: string;
  tenantId: number | null;
  tenantIds: number[];
  username: string;
  displayName: string;
  roles: string[];
  forceChangePassword: boolean;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: AuthUserContext;
}

export interface CurrentAccount {
  id: number;
  clientId: number;
  defaultTenantId: number | null;
  username: string;
  email: string | null;
  displayName: string;
  status: string;
  forceChangePassword: boolean;
  roles: Array<{ code: string; name: string }>;
}

export interface CurrentClient {
  id: number;
  clientCode: string;
  clientName: string;
  clientType: string;
  deployType: string;
  status: string;
}

export interface GrantedMenuNode {
  id: number;
  code: string;
  name: string;
  type: 'CATALOG' | 'MENU';
  path: string;
  component?: string;
  icon?: string;
  keepAlive: boolean;
  children: GrantedMenuNode[];
}

export interface NavigationGrant {
  menus: GrantedMenuNode[];
  permissions: string[];
  dataScopes: string[];
}
