export interface ApiResponse<T> {
  code: string;
  message: string;
  data: T;
  timestamp: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
