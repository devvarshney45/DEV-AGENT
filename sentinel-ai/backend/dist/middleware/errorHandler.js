"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createError = createError;
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
function createError(message, statusCode = 500) {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.isOperational = true;
    return err;
}
function errorHandler(err, _req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    const statusCode = err.statusCode ?? 500;
    const message = err.isOperational ? err.message : 'Internal server error';
    if (statusCode >= 500) {
        console.error('[ErrorHandler]', err);
    }
    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
//# sourceMappingURL=errorHandler.js.map