export type UserRole = 'ADMIN' | 'CUSTOMER';

export interface AuthenticatedUser {
  id: string;
  userId: string;
  fullName?: string;
  email: string;
  role: UserRole;
}
