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
export declare function spendGuard(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=spendGuard.d.ts.map