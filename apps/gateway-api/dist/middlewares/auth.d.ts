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
export declare function hashApiKey(key: string): string;
export declare function validateApiKey(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function validateDashboardAuth(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=auth.d.ts.map