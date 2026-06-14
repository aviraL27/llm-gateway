import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            team_id?: string;
            api_key_id?: string;
            user_id?: string;
            pii_detected?: boolean;
        }
    }
}
export declare function piiRedactor(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=piiRedactor.d.ts.map