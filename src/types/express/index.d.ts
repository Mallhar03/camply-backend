export {};

declare global {
  namespace Express {
    interface User {
      id?: string;
      userId: string;
      username: string;
      email?: string;
      [key: string]: any;
    }
  }
}
