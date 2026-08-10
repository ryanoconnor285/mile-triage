export type AuthUser = {
  id: string;
  teslaUserId: string;
  email: string | null;
  displayName: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
