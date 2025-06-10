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
  const [darkMode, setDarkMode] = useState(false);

  function extractReason(output?: string, error?: string): string {
    const errLine = error?.split('\n').find(line => line.trim()) ?? '';
    const outLine = output?.split('\n').find(line => line.trim()) ?? '';
    if (errLine && outLine) return `${errLine} | ${outLine}`;
    return errLine || outLine || 'Unknown error';
  }

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
      const compilerReason = compilerResult !== 0
        ? extractReason(run?.compilation?.output, run?.compilation?.stderr)
        : '';

      let runtimeResult: number | string = 0;
      let runtimeReason = 'Pass';

      if (compilerResult === 0 && run.execution) {
        const result = run.execution.result;
        const stderr = run.execution.stderr;
        const hasErrorOutput = stderr && stderr.trim().length > 0;

        if (typeof result === 'number') {
          runtimeResult = result;
          runtimeReason = result !== 0
            ? extractReason(run.execution.output, stderr)
            : (hasErrorOutput ? extractReason(run.execution.output, stderr) : 'Pass');
        } else if (hasErrorOutput) {
          runtimeResult = 'Runtime Failure';
          runtimeReason = extractReason(run.execution.output, stderr);
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

  const compilerFails = failures.filter(f => f.compilerResult !== 0);
  const runtimeFails = failures.filter(f => {
    const result = f.runtimeResult;
    return (
      (typeof result === 'number' && result !== 0) ||
      (typeof result === 'string' && !['pass', 'unknown'].includes(result.toLowerCase()))
    );
  });

  const renderTable = (data: FailureDetail[], title: string, key: string) => (
    <div className="mt-8">
      <button
        onClick={() => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))}
        className="text-left w-full text-2xl font-bold mb-2 focus:outline-none bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white px-5 py-3 rounded-lg shadow hover:opacity-90 transition duration-300"
      >
        {expandedSections[key] ? '▼' : '▶'} {title}
      </button>
      {expandedSections[key] && (
        <div className={`overflow-x-auto border rounded-lg shadow-xl ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
          <table className="table-auto w-full text-sm">
            <thead className={darkMode ? "bg-gradient-to-r from-indigo-700 via-purple-700 to-blue-700 text-white" : "bg-gray-200 text-gray-800"}>
              <tr>
                <th className="p-3 border">#</th>
                <th className="p-3 border">Test Name</th>
                <th className="p-3 border">Language</th>
                <th className="p-3 border">Compiler Result</th>
                <th className="p-3 border">Compiler Reason</th>
                <th className="p-3 border">Runtime Result</th>
                <th className="p-3 border">Runtime Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.map((f, i) => {
                const isUnknown = f.runtimeResult === 'Unknown';
                const isFail =
                  (typeof f.runtimeResult === 'number' && f.runtimeResult > 0) ||
                  (typeof f.runtimeResult === 'string' && !['pass', 'unknown'].includes(f.runtimeResult.toLowerCase()));
                const isPass = typeof f.runtimeResult === 'number' && f.runtimeResult === 0;
                const isCompilerPass = f.compilerResult === 0;
                return (
                  <tr key={i} className={darkMode ? "even:bg-gray-800" : "even:bg-gray-100"}>
                    <td className="p-3 border text-center font-mono">{i + 1}</td>
                    <td className="p-3 border font-semibold text-cyan-600 dark:text-cyan-400">{f.name}</td>
                    <td className="p-3 border text-center">{f.language}</td>
                    <td className={`p-3 border text-center font-semibold ${isCompilerPass ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{f.compilerResult}</td>
                    <td className={`p-3 border ${isCompilerPass ? 'text-gray-700 dark:text-gray-300' : 'text-red-500 dark:text-red-300'}`}>{f.compilerReason}</td>
                    <td className={`p-3 border text-center font-semi-bold ${
                      isUnknown ? 'text-blue-500 dark:text-blue-400' : isFail ? 'text-yellow-600 dark:text-yellow-400' : isPass ? 'text-green-600 dark:text-green-400' : 'text-black dark:text-white'
                    }`}>
                      {f.runtimeResult}
                    </td>
                    <td className={`p-3 border ${
                      isUnknown ? 'text-blue-500 dark:text-blue-400' : isPass ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
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

  return (
    <div className={`${darkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white' : 'bg-white text-black'} min-h-screen p-8`}>
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate(-1)} className="text-blue-600 dark:text-blue-400 hover:underline">
          ← Back to Summary
        </button>
        <button onClick={() => setDarkMode(prev => !prev)} className="px-4 py-2 bg-indigo-500 text-white rounded shadow hover:bg-indigo-600">
          Toggle {darkMode ? 'Light' : 'Dark'} Mode
        </button>
      </div>

      <h1 className="text-4xl font-extrabold text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">
        Detailed Test Results
      </h1>

      <div className="text-center mb-6">
        <label htmlFor="filter" className="mr-3 font-semi-bold text-lg">Filter:</label>
        <select
          id="filter"
          className="border p-2 rounded bg-gray-100 dark:bg-gray-900 dark:text-white hover:border-blue-400"
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
