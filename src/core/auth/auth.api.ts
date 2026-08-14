import { fetchApi } from '@/core/api/base-client';
import { request } from '@/core/api/http-client';
import type {
  AuthTokenResponse,
  CurrentAccount,
  CurrentClient,
  LoginCredentials,
  LoginPolicy,
  CaptchaChallenge,
  TrialRegistrationInput,
  NavigationGrant,
} from './auth.types';

export const authApi = {
  loginPolicy: () => fetchApi<LoginPolicy>('/api/v1/settings/parameters/login-policy'),
  login(credentials: LoginCredentials) {
    return fetchApi<AuthTokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },
  captcha: () => fetchApi<CaptchaChallenge>('/api/v1/auth/captcha'),
  registerTrial: (input: TrialRegistrationInput) => fetchApi<{
    username: string;
    status: string;
    roleCode: string;
    authentication: AuthTokenResponse;
  }>('/api/v1/auth/trial-registrations', {
    method: 'POST', body: JSON.stringify(input),
  }),
  currentAccount: () => request<CurrentAccount>('/api/v1/accounts/current'),
  currentClient: () => request<CurrentClient>('/api/v1/clients/current'),
  navigation: (background = false) => request<NavigationGrant>(
    '/api/v1/navigation',
    {},
    { trackRouteLoading: !background },
  ),
};
