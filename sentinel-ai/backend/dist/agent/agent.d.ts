import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
export interface AgentState {
    agentRunId: string;
    projectId: string;
    instruction: string;
    mode: 'custom' | 'full_scan';
    targetUrl?: string;
    repositoryPath?: string;
    analysisContext?: string;
    messages: Array<HumanMessage | SystemMessage | AIMessage | ToolMessage>;
    iterationCount: number;
    toolCallCount: number;
    findings: AgentFinding[];
    testResults: AgentTestResult[];
    report?: string;
    status: 'running' | 'done' | 'failed';
    error?: string;
    progressCallback?: (step: string, progress: number) => void;
}
export interface AgentFinding {
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    category: string;
    title: string;
    description: string;
    evidence?: unknown;
    recommendation?: string;
    owaspRef?: string;
}
export interface AgentTestResult {
    type: string;
    name: string;
    target: string;
    status: 'passed' | 'failed' | 'error';
    request?: unknown;
    response?: unknown;
    notes?: string;
}
export declare function runAgent(state: AgentState): Promise<AgentState>;
export declare function extractFindings(reportText: string): AgentFinding[];
//# sourceMappingURL=agent.d.ts.map