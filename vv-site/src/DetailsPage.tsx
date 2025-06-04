import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface FailureDetail {
  name: string;
  compilerResult: number;
  compilerReason: string;
  runtimeResult: number;
  runtimeReason: string;
  language: string;
}

const DetailsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [failures, setFailures] = useState<FailureDetail[]>([]);
  const [filter, setFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    all: false,
    compiler: true,
    runtime: true
  });

  useEffect(() => {
    const state = location.state as { rawJson: string };
    if (!state?.rawJson) return;

    const jsonText = state.rawJson.trim().replace(/^var jsonResults\s*=\s*/, '');
    const data = JSON.parse(jsonText);
    const runs = data.runs;

    const parsedFailures: FailureDetail[] = [];

    for (const testName in runs) {
      const run = runs[testName][0];
      const ext = testName.split('.').pop()?.toLowerCase();
      let language = 'Other';
      if (ext === 'c') language = 'C';
      else if (ext === 'cpp') language = 'CPP';
      else if (ext === 'f90') language = 'F90';

      const compilerResult = run?.compilation?.result ?? -1;
      const compilerReason = compilerResult !== 0 ? run?.compilation?.stderr?.split('\n')[0] || 'Unknown compile error' : '';

      const runtimeResult = run?.execution?.result ?? -1;
      const runtimeReason = runtimeResult !== 0 ? run?.execution?.stderr?.split('\n')[0] || 'Unknown runtime error' : '';

      parsedFailures.push({
        name: testName,
        compilerResult,
        compilerReason,
        runtimeResult,
        runtimeReason,
        language
      });
    }

    setFailures(parsedFailures);
  }, [location.state]);

  const filteredData = failures.filter((entry) => {
    if (filter === 'fail') return entry.compilerResult !== 0 || entry.runtimeResult !== 0;
    if (filter === 'pass') return entry.compilerResult === 0 && entry.runtimeResult === 0;
    return true;
  });

  const renderTable = (data: FailureDetail[], title: string, key: string) => (
    <div className="mt-8">
      <button
        onClick={() => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))}
        className="text-left w-full text-2xl font-semibold mb-2 focus:outline-none"
      >
        {expandedSections[key] ? '▼' : '▶'} {title}
      </button>
      {expandedSections[key] && (
        <div className="overflow-x-auto border rounded shadow">
          <table className="table-auto w-full text-sm">
            <thead className="bg-blue-100">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">Test Name</th>
                <th className="p-2 border">Language</th>
                <th className="p-2 border">Compiler Result</th>
                <th className="p-2 border">Compiler Reason</th>
                <th className="p-2 border">Runtime Result</th>
                <th className="p-2 border">Runtime Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.map((f, i) => (
                <tr key={i} className="even:bg-gray-50">
                  <td className="p-2 border text-center">{i + 1}</td>
                  <td className="p-2 border">{f.name}</td>
                  <td className="p-2 border text-center">{f.language}</td>
                  <td className="p-2 border text-center">{f.compilerResult}</td>
                  <td className="p-2 border">{f.compilerReason}</td>
                  <td className="p-2 border text-center">{f.runtimeResult}</td>
                  <td className="p-2 border">{f.runtimeReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const compilerFails = failures.filter(f => f.compilerResult !== 0);
  const runtimeFails = failures.filter(f => f.runtimeResult !== 0);

  return (
    <div className="min-h-screen bg-white p-6">
      <button onClick={() => navigate(-1)} className="mb-4 text-blue-600 hover:underline">
        ← Back to Summary
      </button>

      <h1 className="text-3xl font-bold text-center text-blue-800 mb-4">Detailed Results</h1>

      <div className="text-center mb-4">
        <label htmlFor="filter" className="mr-2 font-medium">Filter:</label>
        <select
          id="filter"
          className="border p-2 rounded"
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
        >
          <option value="all">All Tests</option>
          <option value="pass">Only Passing</option>
          <option value="fail">Only Failing</option>
        </select>
      </div>

      {renderTable(filteredData, 'All Tests', 'all')}
      {renderTable(compilerFails, 'Compiler Failures', 'compiler')}
      {renderTable(runtimeFails, 'Runtime Failures', 'runtime')}
    </div>
  );
};

export default DetailsPage;
