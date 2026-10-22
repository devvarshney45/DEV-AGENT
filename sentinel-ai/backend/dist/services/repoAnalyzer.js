"use strict";
// ============================================================
// src/services/repoAnalyzer.ts
// Clones or reads a repository, detects its framework,
// parses routes/middleware/auth using regex + AST heuristics,
// and returns a structured API map.
//
// SAFETY: Never executes repo scripts. Never exposes .env.
// Reads files only. Runs in isolated workspace directory.
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloneRepository = cloneRepository;
exports.listRepoFiles = listRepoFiles;
exports.safeReadFile = safeReadFile;
exports.analyzeRepository = analyzeRepository;
const simple_git_1 = __importDefault(require("simple-git"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
// Ensure workspace directory exists and is safe
function ensureWorkspace() {
    const dir = env_1.config.workspaceDir;
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
// Sanitize repo name to prevent path traversal
function safeRepoName(url) {
    return url
        .replace(/^https?:\/\//i, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80);
}
// Clone a GitHub repo into workspace. Returns cloned path.
async function cloneRepository(githubUrl) {
    const workspace = ensureWorkspace();
    const repoName = safeRepoName(githubUrl);
    const clonedPath = path_1.default.join(workspace, repoName);
    if (fs_1.default.existsSync(clonedPath)) {
        // Update existing clone
        const git = (0, simple_git_1.default)(clonedPath);
        await git.pull();
        return clonedPath;
    }
    const git = (0, simple_git_1.default)();
    // Add token to URL for private repos if available
    let cloneUrl = githubUrl;
    if (env_1.config.githubToken && githubUrl.startsWith('https://github.com/')) {
        cloneUrl = githubUrl.replace('https://github.com/', `https://${env_1.config.githubToken}@github.com/`);
    }
    await git.clone(cloneUrl, clonedPath, ['--depth', '1']);
    return clonedPath;
}
// List all text files in a repo, skipping binary/irrelevant paths
function listRepoFiles(repoPath) {
    const SKIP_DIRS = new Set([
        'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
        '.nyc_output', 'vendor', 'target', '__pycache__', '.gradle',
    ]);
    const files = [];
    function walk(dir) {
        const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name))
                continue;
            const full = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            }
            else if (entry.isFile()) {
                const ext = path_1.default.extname(entry.name).toLowerCase();
                if (['.js', '.ts', '.mjs', '.cjs', '.json', '.yaml', '.yml'].includes(ext)) {
                    files.push(full);
                }
            }
        }
    }
    walk(repoPath);
    return files;
}
// Read a file safely — never reads .env files
function safeReadFile(filePath) {
    const basename = path_1.default.basename(filePath);
    // Block .env files and secret-looking files
    if (/^\.env/.test(basename) || /secret|credential/i.test(basename)) {
        return null;
    }
    try {
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        // Truncate very large files
        return content.slice(0, 100000);
    }
    catch {
        return null;
    }
}
// Detect framework from package.json
function detectFramework(pkgJson) {
    const deps = {
        ...(pkgJson.dependencies ?? {}),
        ...(pkgJson.devDependencies ?? {}),
    };
    if (deps['@nestjs/core'])
        return 'NestJS';
    if (deps['fastify'])
        return 'Fastify';
    if (deps['express'])
        return 'Express';
    if (deps['koa'])
        return 'Koa';
    if (deps['hapi'] || deps['@hapi/hapi'])
        return 'Hapi';
    return 'unknown';
}
// Detect auth libraries
function detectAuth(deps) {
    const found = [];
    if (deps['jsonwebtoken'] || deps['jose'])
        found.push('JWT');
    if (deps['passport'] || deps['passport-jwt'])
        found.push('Passport');
    if (deps['express-session'])
        found.push('Sessions');
    if (deps['next-auth'])
        found.push('NextAuth');
    return found;
}
// Detect validation libraries
function detectValidation(deps) {
    if (deps['zod'])
        return 'Zod';
    if (deps['joi'])
        return 'Joi';
    if (deps['yup'])
        return 'Yup';
    if (deps['express-validator'])
        return 'express-validator';
    if (deps['class-validator'])
        return 'class-validator';
    return undefined;
}
// Detect rate limiting
function detectRateLimit(deps, fileContents) {
    const hasPkg = !!(deps['express-rate-limit'] || deps['rate-limiter-flexible'] || deps['bottleneck']);
    if (!hasPkg) {
        // Scan for inline rate limit patterns
        const inlinePattern = /rateLimit|rate_limit|throttle|limiter/i;
        const found = fileContents.some((c) => inlinePattern.test(c));
        return { detected: found };
    }
    // Try to extract config values from file content
    const maxPattern = /max\s*[:=]\s*(\d+)/;
    const windowPattern = /windowMs\s*[:=]\s*(\d+)/;
    let max;
    let windowMs;
    for (const content of fileContents) {
        if (!maxPattern.test(content) && !windowPattern.test(content))
            continue;
        const m = content.match(maxPattern);
        const w = content.match(windowPattern);
        if (m)
            max = parseInt(m[1], 10);
        if (w)
            windowMs = parseInt(w[1], 10);
        if (max && windowMs)
            break;
    }
    return {
        detected: true,
        config: { max, windowMs, library: 'express-rate-limit' },
    };
}
// Parse Express-style routes from a JS/TS file
function parseExpressRoutes(content, filePath, relPath) {
    const endpoints = [];
    const lines = content.split('\n');
    // Matches: router.get('/path', ...) or app.post('/path', ...)
    const routePattern = /(?:router|app|server)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
    // Auth middleware detection
    const authMiddlewareNames = [
        'authenticate', 'auth', 'requireAuth', 'verifyToken', 'isAuthenticated',
        'protect', 'ensureAuth', 'authMiddleware', 'jwtAuth', 'passport',
    ];
    const adminMiddlewareNames = ['admin', 'isAdmin', 'requireAdmin', 'adminOnly', 'adminMiddleware'];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const lineNum = lineIndex + 1;
        // Reset regex lastIndex each iteration
        routePattern.lastIndex = 0;
        const match = routePattern.exec(line);
        if (!match)
            continue;
        const method = match[1].toUpperCase();
        const routePath = match[2];
        // Look at surrounding lines for middleware names
        const context = lines
            .slice(Math.max(0, lineIndex - 2), Math.min(lines.length, lineIndex + 5))
            .join(' ');
        const authRequired = authMiddlewareNames.some((m) => new RegExp(`\\b${m}\\b`, 'i').test(context));
        const roles = [];
        if (adminMiddlewareNames.some((m) => new RegExp(`\\b${m}\\b`, 'i').test(context))) {
            roles.push('admin');
        }
        // Collect middleware names
        const middlewareMatches = context.match(/\b([a-zA-Z_][a-zA-Z0-9_]*Middleware|[a-zA-Z_][a-zA-Z0-9_]*Guard|authenticate|protect)\b/g);
        const middleware = [...new Set(middlewareMatches ?? [])];
        // Extract body and parameters from handler context
        const handlerBlock = lines.slice(lineIndex, Math.min(lines.length, lineIndex + 25)).join('\n');
        const bodyDestructMatch = handlerBlock.match(/(?:const|let|var)\s*\{\s*([^}]+)\}\s*=\s*req\.body/);
        const bodyKeys = bodyDestructMatch
            ? bodyDestructMatch[1].split(',').map((k) => k.trim().split(':')[0].trim()).filter(Boolean)
            : [];
        let requestBodySchema;
        if (bodyKeys.length > 0) {
            const schema = {};
            bodyKeys.forEach((key) => {
                schema[key] = key.toLowerCase().includes('id') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('count') ? 'number' : 'string';
            });
            requestBodySchema = schema;
        }
        // Heuristic Break Point Detection: e.g. admin signup endpoint vulnerability
        let description;
        const lowerPath = routePath.toLowerCase();
        if (lowerPath.includes('signup') || lowerPath.includes('register')) {
            if (lowerPath.includes('admin') || handlerBlock.includes("role || 'user'") || handlerBlock.includes("role: role") || handlerBlock.includes("role: 'admin'")) {
                description = '🚨 ARCHITECTURAL BREAKPOINT: Admin/privilege signup detected. Admins should only be seeded or invited via secure login, not self-signed up!';
            }
        }
        else if (lowerPath.includes('admin') && !authRequired) {
            description = '⚠️ SENSITIVE ENDPOINT: Admin route detected without explicit authentication middleware.';
        }
        endpoints.push({
            method,
            path: routePath,
            sourceFile: relPath,
            sourceLine: lineNum,
            authRequired,
            roles,
            middleware,
            requestBodySchema,
            description,
        });
    }
    return endpoints;
}
// Parse Next.js App Router API Routes (e.g. app/api/auth/register/route.ts)
function parseNextApiRoutes(content, filePath, relPath) {
    const endpoints = [];
    const match = relPath.match(/(?:^|[\\/])api[\\/](.*?)[\\/]route\.(?:ts|js|mjs)$/i);
    if (!match)
        return endpoints;
    const apiSubPath = match[1].replace(/\\/g, '/');
    const routePath = `/api/${apiSubPath}`;
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const lines = content.split('\n');
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        for (const method of methods) {
            if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`).test(line)) {
                const handlerBlock = lines.slice(lineIndex, Math.min(lines.length, lineIndex + 35)).join('\n');
                const bodyMatch = handlerBlock.match(/(?:const|let|var)\s*\{\s*([^}]+)\}\s*=\s*(?:await\s+)?(?:req\.json\(\)|request\.json\(\))/);
                const bodyKeys = bodyMatch
                    ? bodyMatch[1].split(',').map((k) => k.trim().split(':')[0].trim()).filter(Boolean)
                    : [];
                let requestBodySchema;
                if (bodyKeys.length > 0) {
                    const schema = {};
                    bodyKeys.forEach((key) => {
                        schema[key] = key.toLowerCase().includes('id') || key.toLowerCase().includes('amount') ? 'number' : 'string';
                    });
                    requestBodySchema = schema;
                }
                const lowerPath = routePath.toLowerCase();
                let description;
                if (lowerPath.includes('signup') || lowerPath.includes('register')) {
                    if (lowerPath.includes('admin') || handlerBlock.includes("role: 'admin'") || handlerBlock.includes('role === "admin"')) {
                        description = '🚨 ARCHITECTURAL BREAKPOINT: Admin/privilege signup detected. Admins should only be seeded or invited via secure login, not self-signed up!';
                    }
                }
                endpoints.push({
                    method,
                    path: routePath,
                    sourceFile: relPath,
                    sourceLine: lineIndex + 1,
                    authRequired: handlerBlock.includes('auth') || handlerBlock.includes('session') || handlerBlock.includes('token'),
                    roles: lowerPath.includes('admin') ? ['admin'] : [],
                    middleware: [],
                    requestBodySchema,
                    description,
                });
            }
        }
    }
    return endpoints;
}
// Main analysis function
async function analyzeRepository(repoPath) {
    const warnings = [];
    const files = listRepoFiles(repoPath);
    const fileContents = [];
    // Read all files
    for (const f of files) {
        const content = safeReadFile(f);
        if (content !== null) {
            fileContents.push({ path: f, content });
        }
    }
    // Parse package.json (in monorepos with frontend + backend, prioritize backend/server/api)
    const pkgFiles = fileContents.filter((f) => path_1.default.basename(f.path) === 'package.json');
    const backendPkg = pkgFiles.find((f) => /(?:backend|server|api|services)[\\/]package\.json$/i.test(f.path));
    const rootPkg = pkgFiles.find((f) => path_1.default.relative(repoPath, f.path) === 'package.json');
    const pkgFile = backendPkg || rootPkg || pkgFiles[0];
    let pkgJson = {};
    if (pkgFile) {
        try {
            pkgJson = JSON.parse(pkgFile.content);
        }
        catch {
            warnings.push('Could not parse package.json');
        }
    }
    // Merge dependencies across all package.json files so backend packages are never lost in monorepos
    const allDeps = {};
    for (const p of pkgFiles) {
        try {
            const parsed = JSON.parse(p.content);
            Object.assign(allDeps, parsed.dependencies || {}, parsed.devDependencies || {});
        }
        catch {
            // ignore
        }
    }
    const framework = detectFramework(pkgJson) !== 'unknown' ? detectFramework(pkgJson) : detectFramework({ dependencies: allDeps });
    const language = files.some((f) => f.endsWith('.ts')) ? 'TypeScript' : 'JavaScript';
    const packageManager = fs_1.default.existsSync(path_1.default.join(repoPath, 'yarn.lock'))
        ? 'yarn'
        : fs_1.default.existsSync(path_1.default.join(repoPath, 'pnpm-lock.yaml'))
            ? 'pnpm'
            : 'npm';
    // Detect DB libraries
    const dbLibraries = [];
    if (allDeps['mongoose'] || allDeps['mongodb'])
        dbLibraries.push('MongoDB/Mongoose');
    if (allDeps['prisma'] || allDeps['@prisma/client'])
        dbLibraries.push('Prisma');
    if (allDeps['sequelize'])
        dbLibraries.push('Sequelize');
    if (allDeps['typeorm'])
        dbLibraries.push('TypeORM');
    if (allDeps['pg'] || allDeps['postgres'])
        dbLibraries.push('PostgreSQL');
    // Extract all file content strings for pattern matching
    const allContents = fileContents.map((f) => f.content);
    const authMechanism = detectAuth(allDeps);
    const validationLibrary = detectValidation(allDeps);
    const rateLimitInfo = detectRateLimit(allDeps, allContents);
    // Parse routes from JS/TS source files
    const endpoints = [];
    for (const { path: filePath, content } of fileContents) {
        if (!/\.(js|ts|mjs|cjs)$/.test(filePath))
            continue;
        if (/node_modules|dist|build|\.next/.test(filePath))
            continue;
        const relPath = path_1.default.relative(repoPath, filePath);
        const parsedExpress = parseExpressRoutes(content, filePath, relPath);
        const parsedNext = parseNextApiRoutes(content, filePath, relPath);
        endpoints.push(...parsedExpress, ...parsedNext);
    }
    // Deduplicate endpoints by method+path
    const seen = new Set();
    const uniqueEndpoints = endpoints.filter((ep) => {
        const key = `${ep.method}:${ep.path}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    if (uniqueEndpoints.length === 0) {
        warnings.push('No routes detected. Repository may use dynamic route registration or an unsupported framework.');
    }
    return {
        framework,
        language,
        packageManager,
        endpoints: uniqueEndpoints,
        authMechanism,
        rateLimitDetected: rateLimitInfo.detected,
        rateLimitConfig: rateLimitInfo.config,
        validationLibrary,
        dbLibraries,
        totalFilesScanned: fileContents.length,
        warnings,
    };
}
//# sourceMappingURL=repoAnalyzer.js.map