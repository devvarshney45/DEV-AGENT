import { Request, Response, NextFunction } from 'express';
export interface AuthPayload {
    userId: string;
    email: string;
    role: string;
}
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                username: string;
                role: string;
            };
        }
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requireRole(role: string): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map