import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            team_id?: string;
            api_key_id?: string;
            user_id?: string;
        }
    }
}
export declare function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=rateLimiter.d.ts.map