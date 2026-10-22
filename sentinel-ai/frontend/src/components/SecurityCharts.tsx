// src/components/SecurityCharts.tsx
'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Finding } from '../lib/api';

interface SecurityChartsProps {
  findings: Finding[];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#f43f5e',
  high: '#f97316',
  medium: '#eab308',
  low: '#10b981',
  info: '#22c55e',
};

export function SecurityCharts({ findings }: SecurityChartsProps) {
  const severityMap: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const categoryMap: Record<string, number> = {};

  findings.forEach((f) => {
    const sev = f.severity.toLowerCase();
    severityMap[sev] = (severityMap[sev] || 0) + 1;

    const cat = f.category || 'General';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });

  const pieData = Object.entries(severityMap)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
      color: SEVERITY_COLORS[name] || '#10b981',
    }));

  const barData = Object.entries(categoryMap)
    .map(([name, count]) => ({
      category: name.length > 18 ? name.substring(0, 16) + '..' : name,
      fullCategory: name,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  if (findings.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Severity Breakdown Donut */}
      <div className="rounded-xl border border-emerald-900/50 bg-[#06140b]/70 p-5 shadow-lg backdrop-blur-sm">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
          Vulnerability Severity Distribution
        </h3>
        <div className="mt-4 flex flex-col items-center justify-between sm:flex-row">
          <div className="h-48 w-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#040d07',
                    borderColor: '#10b981',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#e2f5e8',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-0 sm:flex sm:flex-col sm:space-y-1.5">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center space-x-2 text-xs">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-mono text-emerald-300">{item.name}:</span>
                <span className="font-mono font-bold text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Attack Vectors / Categories */}
      <div className="rounded-xl border border-emerald-900/50 bg-[#06140b]/70 p-5 shadow-lg backdrop-blur-sm">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
          Discovered Vulnerability Vectors
        </h3>
        <div className="mt-4 h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis
                dataKey="category"
                stroke="#10b981"
                fontSize={10}
                tickLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis stroke="#10b981" fontSize={10} tickLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(val) => [val, 'Occurrences']}
                contentStyle={{
                  backgroundColor: '#040d07',
                  borderColor: '#10b981',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#e2f5e8',
                }}
              />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
