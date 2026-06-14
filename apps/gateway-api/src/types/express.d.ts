import { Express } from 'express-serve-static-core';

declare global {
  namespace Express {
    interface Request {
      team_id?: string;
      api_key_id?: string;
      user_id?: string;
    }
  }
}
