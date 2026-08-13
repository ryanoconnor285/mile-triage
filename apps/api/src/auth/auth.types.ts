export type AuthUser = {
  id: string;
  teslaUserId: string;
  email: string | null;
  displayName: string | null;
};

declare global {
  // Augmenting Express's Request requires matching its namespace declaration.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
