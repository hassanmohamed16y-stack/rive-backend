export type UserRole = 'ADMIN' | 'CUSTOMER';

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}
