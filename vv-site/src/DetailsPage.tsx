import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface FailureDetail {
  name: string;
  compilerResult: number;
  compilerReason: string;
  runtimeResult: number | string;
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
      const runArray = runs[testName];
      if (!Array.isArray(runArray) || runArray.length === 0) continue;
      const run = runArray[0];
      const ext = testName.split('.').pop()?.toLowerCase();
      let language = 'Other';
      if (ext === 'c') language = 'C';
      else if (ext === 'cpp') language = 'CPP';
      else if (ext === 'f90') language = 'F90';

      const compilerResult = run?.compilation?.result ?? -1;
      let compilerReason = compilerResult !== 0 ? run?.compilation?.stderr?.split('\n')[0] || 'Unknown compile error' : '';

      let runtimeResult: number | string = 'Unknown';
      let runtimeReason = 'Unknown (compiler failed)';

      if (compilerResult === 0) {
        if (run.execution && 'result' in run.execution) {
          const result = run.execution.result;
          runtimeResult = result;
          if (typeof result === 'number' && result > 0) {
            runtimeReason = run.execution.stderr?.split('\n')[0] || 'Unknown runtime error';
          } else if (typeof result === 'number' && result === 0) {
            runtimeReason = 'Pass';
          }
        } else {
          runtimeResult = 0;
          runtimeReason = 'Pass';
        }
      }

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
    const runtimeNumeric = typeof entry.runtimeResult === 'number' ? entry.runtimeResult : -1;
    if (filter === 'fail') return entry.compilerResult !== 0 || runtimeNumeric !== 0;
    if (filter === 'pass') return entry.compilerResult === 0 && runtimeNumeric === 0;
    return true;
  });

  const renderTable = (data: FailureDetail[], title: string, key: string) => (
    <div className="mt-8">
      <button
        onClick={() => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))}
        className="text-left w-full text-2xl font-semi-bold mb-2 focus:outline-none text-white bg-blue-300 px-4 py-2 rounded shadow hover:bg-gray-200"
      >
        {expandedSections[key] ? '▼' : '▶'} {title}
      </button>
      {expandedSections[key] && (
        <div className="overflow-x-auto border rounded shadow bg-gray-100">
          <table className="table-auto w-full text-sm">
            <thead className="bg-blue-200">
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
              {data.map((f, i) => {
                const isUnknown = f.runtimeResult === 'Unknown';
                const isFail = typeof f.runtimeResult === 'number' && f.runtimeResult > 0;
                const isPass = typeof f.runtimeResult === 'number' && f.runtimeResult === 0;
                const isCompilerPass = f.compilerResult === 0;
                return (
                  <tr key={i} className="even:bg-gray-200">
                    <td className="p-2 border text-center">{i + 1}</td>
                    <td className="p-2 border">{f.name}</td>
                    <td className="p-2 border text-center">{f.language}</td>
                    <td className={`p-2 border text-center font-semibold ${isCompilerPass ? 'text-green-600' : 'text-red-600'}`}>{f.compilerResult}</td>
                    <td className={`p-2 border ${isCompilerPass ? '' : 'text-red-600'}`}>{isCompilerPass ? '' : f.compilerReason}</td>
                    <td className={`p-2 border text-center font-semibold ${
                      isUnknown ? 'text-blue-600' : isFail ? 'text-yellow-600' : isPass ? 'text-green-600' : ''
                    }`}>
                      {f.runtimeResult}
                    </td>
                    <td className={`p-2 border ${
                      isUnknown ? 'text-blue-600' : isPass ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {f.runtimeReason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const compilerFails = failures.filter(f => f.compilerResult !== 0);
  const runtimeFails = failures.filter(f => typeof f.runtimeResult === 'number' && f.runtimeResult !== 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <button onClick={() => navigate(-1)} className="mb-4 text-blue-600 hover:underline">
        ← Back to Summary
      </button>

      <h1 className="text-3xl font-bold text-center text-blue-800 mb-4">Detailed Results</h1>

      <div className="text-center mb-4">
        <label htmlFor="filter" className="mr-2 font-medium">Filter:</label>
        <select
          id="filter"
          className="border p-2 rounded bg-white"
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
