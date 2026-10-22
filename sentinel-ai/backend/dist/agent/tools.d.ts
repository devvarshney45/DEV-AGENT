import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
export declare const readFileTool: DynamicStructuredTool<z.ZodObject<{
    filePath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filePath: string;
}, {
    filePath: string;
}>, {
    filePath: string;
}, {
    filePath: string;
}, string>;
export declare const sendRequestTool: DynamicStructuredTool<z.ZodObject<{
    method: z.ZodEnum<["GET", "POST", "PUT", "DELETE", "PATCH"]>;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    body: z.ZodOptional<z.ZodUnknown>;
    timeoutMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url: string;
    timeoutMs: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
    timeoutMs?: number | undefined;
}>, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url: string;
    timeoutMs: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
    timeoutMs?: number | undefined;
}, string>;
export declare const createTestUserTool: DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    signupPath: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
    baseUrl: string;
    signupPath: string;
    email?: string | undefined;
    role?: string | undefined;
}, {
    username: string;
    password: string;
    baseUrl: string;
    signupPath: string;
    email?: string | undefined;
    role?: string | undefined;
}>, {
    username: string;
    password: string;
    baseUrl: string;
    signupPath: string;
    email?: string | undefined;
    role?: string | undefined;
}, {
    username: string;
    password: string;
    baseUrl: string;
    signupPath: string;
    email?: string | undefined;
    role?: string | undefined;
}, string>;
export declare const loginTestUserTool: DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    loginPath: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    baseUrl: string;
    loginPath: string;
    email?: string | undefined;
    username?: string | undefined;
}, {
    password: string;
    baseUrl: string;
    loginPath: string;
    email?: string | undefined;
    username?: string | undefined;
}>, {
    password: string;
    baseUrl: string;
    loginPath: string;
    email?: string | undefined;
    username?: string | undefined;
}, {
    password: string;
    baseUrl: string;
    loginPath: string;
    email?: string | undefined;
    username?: string | undefined;
}, string>;
export declare const testAuthenticationTool: DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: string;
    baseUrl: string;
}, {
    path: string;
    method: string;
    baseUrl: string;
}>, {
    path: string;
    method: string;
    baseUrl: string;
}, {
    path: string;
    method: string;
    baseUrl: string;
}, string>;
export declare const testAuthorizationTool: DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
    normalUserToken: z.ZodString;
    expectedStatus: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: string;
    baseUrl: string;
    normalUserToken: string;
    expectedStatus: number[];
}, {
    path: string;
    method: string;
    baseUrl: string;
    normalUserToken: string;
    expectedStatus: number[];
}>, {
    path: string;
    method: string;
    baseUrl: string;
    normalUserToken: string;
    expectedStatus: number[];
}, {
    path: string;
    method: string;
    baseUrl: string;
    normalUserToken: string;
    expectedStatus: number[];
}, string>;
export declare const testRateLimitTool: DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
    requests: z.ZodNumber;
    concurrency: z.ZodNumber;
    body: z.ZodOptional<z.ZodUnknown>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: string;
    requests: number;
    concurrency: number;
    baseUrl: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    path: string;
    method: string;
    requests: number;
    concurrency: number;
    baseUrl: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}>, {
    path: string;
    method: string;
    requests: number;
    concurrency: number;
    baseUrl: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    path: string;
    method: string;
    requests: number;
    concurrency: number;
    baseUrl: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, string>;
export declare const testInputValidationTool: DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
    testCases: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        body: z.ZodUnknown;
        expectedStatus: z.ZodArray<z.ZodNumber, "many">;
    }, "strip", z.ZodTypeAny, {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }, {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: string;
    baseUrl: string;
    testCases: {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }[];
}, {
    path: string;
    method: string;
    baseUrl: string;
    testCases: {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }[];
}>, {
    path: string;
    method: string;
    baseUrl: string;
    testCases: {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }[];
}, {
    path: string;
    method: string;
    baseUrl: string;
    testCases: {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }[];
}, string>;
export declare const testObjectAuthorizationTool: DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
    attackerToken: z.ZodString;
    victimResourceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: string;
    baseUrl: string;
    attackerToken: string;
    victimResourceId: string;
}, {
    path: string;
    method: string;
    baseUrl: string;
    attackerToken: string;
    victimResourceId: string;
}>, {
    path: string;
    method: string;
    baseUrl: string;
    attackerToken: string;
    victimResourceId: string;
}, {
    path: string;
    method: string;
    baseUrl: string;
    attackerToken: string;
    victimResourceId: string;
}, string>;
export declare const runK6LoadTestTool: DynamicStructuredTool<z.ZodObject<{
    target: z.ZodString;
    method: z.ZodEnum<["GET", "POST", "PUT", "DELETE", "PATCH"]>;
    vus: z.ZodNumber;
    durationSeconds: z.ZodNumber;
    body: z.ZodOptional<z.ZodUnknown>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    rampUp: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    approved: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    rampUp: boolean;
    approved: boolean;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    approved: boolean;
    headers?: Record<string, string> | undefined;
    body?: unknown;
    rampUp?: boolean | undefined;
}>, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    rampUp: boolean;
    approved: boolean;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    approved: boolean;
    headers?: Record<string, string> | undefined;
    body?: unknown;
    rampUp?: boolean | undefined;
}, string>;
export declare const generateK6ScriptTool: DynamicStructuredTool<z.ZodObject<{
    target: z.ZodString;
    method: z.ZodEnum<["GET", "POST", "PUT", "DELETE", "PATCH"]>;
    vus: z.ZodNumber;
    durationSeconds: z.ZodNumber;
    body: z.ZodOptional<z.ZodUnknown>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}>, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, string>;
export declare const allTools: (DynamicStructuredTool<z.ZodObject<{
    filePath: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filePath: string;
}, {
    filePath: string;
}>, {
    filePath: string;
}, {
    filePath: string;
}, string> | DynamicStructuredTool<z.ZodObject<{
    method: z.ZodEnum<["GET", "POST", "PUT", "DELETE", "PATCH"]>;
    url: z.ZodString;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    body: z.ZodOptional<z.ZodUnknown>;
    timeoutMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url: string;
    timeoutMs: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
    timeoutMs?: number | undefined;
}>, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url: string;
    timeoutMs: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    url: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
    timeoutMs?: number | undefined;
}, string> | DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    signupPath: z.ZodString;
    username: z.ZodString;
    password: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
    baseUrl: string;
    signupPath: string;
    email?: string | undefined;
    role?: string | undefined;
}, {
    username: string;
    password: string;
    baseUrl: string;
    signupPath: string;
    email?: string | undefined;
    role?: string | undefined;
}>, {
    username: string;
    password: string;
    baseUrl: string;
    signupPath: string;
    email?: string | undefined;
    role?: string | undefined;
}, {
    username: string;
    password: string;
    baseUrl: string;
    signupPath: string;
    email?: string | undefined;
    role?: string | undefined;
}, string> | DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    loginPath: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    baseUrl: string;
    loginPath: string;
    email?: string | undefined;
    username?: string | undefined;
}, {
    password: string;
    baseUrl: string;
    loginPath: string;
    email?: string | undefined;
    username?: string | undefined;
}>, {
    password: string;
    baseUrl: string;
    loginPath: string;
    email?: string | undefined;
    username?: string | undefined;
}, {
    password: string;
    baseUrl: string;
    loginPath: string;
    email?: string | undefined;
    username?: string | undefined;
}, string> | DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: string;
    baseUrl: string;
}, {
    path: string;
    method: string;
    baseUrl: string;
}>, {
    path: string;
    method: string;
    baseUrl: string;
}, {
    path: string;
    method: string;
    baseUrl: string;
}, string> | DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
    normalUserToken: z.ZodString;
    expectedStatus: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: string;
    baseUrl: string;
    normalUserToken: string;
    expectedStatus: number[];
}, {
    path: string;
    method: string;
    baseUrl: string;
    normalUserToken: string;
    expectedStatus: number[];
}>, {
    path: string;
    method: string;
    baseUrl: string;
    normalUserToken: string;
    expectedStatus: number[];
}, {
    path: string;
    method: string;
    baseUrl: string;
    normalUserToken: string;
    expectedStatus: number[];
}, string> | DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
    requests: z.ZodNumber;
    concurrency: z.ZodNumber;
    body: z.ZodOptional<z.ZodUnknown>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: string;
    requests: number;
    concurrency: number;
    baseUrl: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    path: string;
    method: string;
    requests: number;
    concurrency: number;
    baseUrl: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}>, {
    path: string;
    method: string;
    requests: number;
    concurrency: number;
    baseUrl: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    path: string;
    method: string;
    requests: number;
    concurrency: number;
    baseUrl: string;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, string> | DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
    testCases: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        body: z.ZodUnknown;
        expectedStatus: z.ZodArray<z.ZodNumber, "many">;
    }, "strip", z.ZodTypeAny, {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }, {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: string;
    baseUrl: string;
    testCases: {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }[];
}, {
    path: string;
    method: string;
    baseUrl: string;
    testCases: {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }[];
}>, {
    path: string;
    method: string;
    baseUrl: string;
    testCases: {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }[];
}, {
    path: string;
    method: string;
    baseUrl: string;
    testCases: {
        expectedStatus: number[];
        label: string;
        body?: unknown;
    }[];
}, string> | DynamicStructuredTool<z.ZodObject<{
    baseUrl: z.ZodString;
    method: z.ZodString;
    path: z.ZodString;
    attackerToken: z.ZodString;
    victimResourceId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: string;
    baseUrl: string;
    attackerToken: string;
    victimResourceId: string;
}, {
    path: string;
    method: string;
    baseUrl: string;
    attackerToken: string;
    victimResourceId: string;
}>, {
    path: string;
    method: string;
    baseUrl: string;
    attackerToken: string;
    victimResourceId: string;
}, {
    path: string;
    method: string;
    baseUrl: string;
    attackerToken: string;
    victimResourceId: string;
}, string> | DynamicStructuredTool<z.ZodObject<{
    target: z.ZodString;
    method: z.ZodEnum<["GET", "POST", "PUT", "DELETE", "PATCH"]>;
    vus: z.ZodNumber;
    durationSeconds: z.ZodNumber;
    body: z.ZodOptional<z.ZodUnknown>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    rampUp: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    approved: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    rampUp: boolean;
    approved: boolean;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    approved: boolean;
    headers?: Record<string, string> | undefined;
    body?: unknown;
    rampUp?: boolean | undefined;
}>, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    rampUp: boolean;
    approved: boolean;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    approved: boolean;
    headers?: Record<string, string> | undefined;
    body?: unknown;
    rampUp?: boolean | undefined;
}, string> | DynamicStructuredTool<z.ZodObject<{
    target: z.ZodString;
    method: z.ZodEnum<["GET", "POST", "PUT", "DELETE", "PATCH"]>;
    vus: z.ZodNumber;
    durationSeconds: z.ZodNumber;
    body: z.ZodOptional<z.ZodUnknown>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}>, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    target: string;
    vus: number;
    durationSeconds: number;
    headers?: Record<string, string> | undefined;
    body?: unknown;
}, string>)[];
//# sourceMappingURL=tools.d.ts.map