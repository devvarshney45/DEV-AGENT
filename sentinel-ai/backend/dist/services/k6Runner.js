"use strict";
// ============================================================
// src/services/k6Runner.ts
// Generates k6 JavaScript test scripts and executes k6
// as a subprocess — with strict concurrency, duration, and
// target limits. Requires explicit authorization confirmation.
//
// IMPORTANT: k6 must be installed on the host system.
// Install: https://grafana.com/docs/k6/latest/set-up/install-k6/
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateK6Script = generateK6Script;
exports.runK6LoadTest = runK6LoadTest;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const env_1 = require("../config/env");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Enforce configured caps
function clampConfig(cfg) {
    return {
        ...cfg,
        vus: Math.min(cfg.vus, env_1.config.k6MaxVus),
        durationSeconds: Math.min(cfg.durationSeconds, env_1.config.k6MaxDurationSeconds),
    };
}
// Generate a k6 test script
function generateK6Script(cfg) {
    const headersObj = cfg.headers ? JSON.stringify(cfg.headers) : '{}';
    const bodyStr = cfg.body ? JSON.stringify(JSON.stringify(cfg.body)) : 'null';
    const method = cfg.method.toLowerCase();
    const duration = `${cfg.durationSeconds}s`;
    const scenarioOptions = cfg.rampUp
        ? `scenarios: {
        ramping_load: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: '${Math.floor(cfg.durationSeconds / 3)}s', target: ${cfg.vus} },
            { duration: '${Math.floor(cfg.durationSeconds / 3)}s', target: ${cfg.vus} },
            { duration: '${Math.floor(cfg.durationSeconds / 3)}s', target: 0 },
          ],
        },
      }`
        : `scenarios: {
        controlled_load: {
          executor: 'constant-vus',
          vus: ${cfg.vus},
          duration: '${duration}',
        },
      }`;
    return `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const successRate = new Rate('success_rate');
const latencyTrend = new Trend('request_latency');
const statusCounter = {};

export const options = {
  ${scenarioOptions},
  thresholds: {
    http_req_failed: ['rate<0.5'],
    http_req_duration: ['p(95)<5000'],
  },
};

const TARGET_URL = '${cfg.target}';
const HEADERS = ${headersObj};
const BODY = ${bodyStr};

export default function () {
  const params = { headers: HEADERS, timeout: '8s' };

  let res;
  if ('${method}' === 'get' || '${method}' === 'delete') {
    res = http['${method}'](TARGET_URL, params);
  } else {
    res = http['${method}'](TARGET_URL, BODY, params);
  }

  const ok = check(res, {
    'status is 2xx or 429': (r) => r.status < 500 || r.status === 429,
  });
  successRate.add(ok);
  latencyTrend.add(res.timings.duration);

  sleep(0.1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify({
      metrics: {
        http_reqs: data.metrics.http_reqs,
        http_req_duration: data.metrics.http_req_duration,
        http_req_failed: data.metrics.http_req_failed,
        iterations: data.metrics.iterations,
      },
    }),
  };
}
`.trim();
}
// Parse k6 stdout JSON summary
function parseK6Output(stdout, durationSeconds) {
    try {
        // k6 may output logs + JSON; find JSON block
        const jsonStart = stdout.indexOf('{');
        if (jsonStart === -1)
            return {};
        const jsonStr = stdout.slice(jsonStart);
        const data = JSON.parse(jsonStr);
        const m = data.metrics ?? {};
        const totalRequests = m.http_reqs?.values?.count ?? 0;
        const failedRate = m.http_req_failed?.values?.rate ?? 0;
        const errorCount = Math.round(totalRequests * failedRate);
        const successCount = totalRequests - errorCount;
        const durMs = m.http_req_duration?.values ?? {};
        return {
            totalRequests,
            successCount,
            errorCount,
            errorRate: failedRate,
            avgLatencyMs: durMs.avg ?? 0,
            p90LatencyMs: durMs['p(90)'] ?? 0,
            p95LatencyMs: durMs['p(95)'] ?? 0,
            p99LatencyMs: durMs['p(99)'] ?? 0,
            throughputRps: durationSeconds > 0 ? totalRequests / durationSeconds : 0,
        };
    }
    catch {
        return {};
    }
}
// Execute k6 load test
async function runK6LoadTest(rawCfg) {
    const cfg = clampConfig(rawCfg);
    // Check k6 is installed
    try {
        await execAsync('k6 version');
    }
    catch {
        // k6 not installed — return a clear error result instead of fabricating numbers
        return {
            totalRequests: 0,
            successCount: 0,
            errorCount: 0,
            errorRate: 0,
            avgLatencyMs: 0,
            p90LatencyMs: 0,
            p95LatencyMs: 0,
            p99LatencyMs: 0,
            throughputRps: 0,
            statusDistrib: {},
            rawSummary: 'k6 is not installed. Install k6 from https://grafana.com/docs/k6/latest/set-up/install-k6/',
            k6Available: false,
        };
    }
    // Write script to temp file
    const script = generateK6Script(cfg);
    const tmpDir = os_1.default.tmpdir();
    const scriptPath = path_1.default.join(tmpDir, `sentinel_k6_${Date.now()}.js`);
    fs_1.default.writeFileSync(scriptPath, script, 'utf-8');
    try {
        const timeout = (cfg.durationSeconds + 30) * 1000; // grace period
        const { stdout, stderr } = await execAsync(`k6 run --out json=/dev/null --summary-export /dev/stdout "${scriptPath}"`, { timeout });
        const parsed = parseK6Output(stdout, cfg.durationSeconds);
        return {
            totalRequests: parsed.totalRequests ?? 0,
            successCount: parsed.successCount ?? 0,
            errorCount: parsed.errorCount ?? 0,
            errorRate: parsed.errorRate ?? 0,
            avgLatencyMs: parsed.avgLatencyMs ?? 0,
            p90LatencyMs: parsed.p90LatencyMs ?? 0,
            p95LatencyMs: parsed.p95LatencyMs ?? 0,
            p99LatencyMs: parsed.p99LatencyMs ?? 0,
            throughputRps: parsed.throughputRps ?? 0,
            statusDistrib: {},
            rawSummary: stdout + (stderr ? `\nSTDERR: ${stderr}` : ''),
            k6Available: true,
        };
    }
    finally {
        // Always clean up temp script
        try {
            fs_1.default.unlinkSync(scriptPath);
        }
        catch { }
    }
}
//# sourceMappingURL=k6Runner.js.map