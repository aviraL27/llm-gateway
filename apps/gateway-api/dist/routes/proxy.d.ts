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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=proxy.d.ts.map