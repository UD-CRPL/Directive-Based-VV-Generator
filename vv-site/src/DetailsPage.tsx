// DetailsPage.tsx

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCompilerStatus, getRuntimeStatus } from './errorParser';

interface FailureDetail {
  name: string;
  compilerResult: number;
  compilerReason: string;
  runtimeResult: number | string;
  runtimeReason: string;
  language: string;
  compilerStderr: string;
  compilerStdout: string;
  runtimeStderr: string;
  runtimeOutput: string;
}

interface Props {
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}

const DetailsPage: React.FC<Props> = ({ darkMode, setDarkMode }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [failures, setFailures] = useState<FailureDetail[]>([]);
  const [filter, setFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'C' | 'CPP' | 'F90'>('all');
  const [logModal, setLogModal] = useState<FailureDetail | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<'all' | 'compiler' | 'runtime', boolean>>({
    all: false,
    compiler: true,
    runtime: true,
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

      const compilerStatus = getCompilerStatus(run);
      const runtimeStatus = getRuntimeStatus(run);

      parsedFailures.push({
        name: testName,
        compilerResult: compilerStatus.result,
        compilerReason: compilerStatus.reason,
        runtimeResult: runtimeStatus.result,
        runtimeReason: runtimeStatus.reason,
        language,
        compilerStderr: compilerStatus.stderr,
        compilerStdout: compilerStatus.stdout,
        runtimeStderr: runtimeStatus.stderr,
        runtimeOutput: runtimeStatus.output
      });
    }

    setFailures(parsedFailures);
  }, [location.state]);

  const filteredData = failures.filter((entry) => {
    const runtimeNumeric = typeof entry.runtimeResult === 'number' ? entry.runtimeResult : -1;
    const filterPassFail = filter === 'fail' ? (entry.compilerResult !== 0 || runtimeNumeric !== 0)
                         : filter === 'pass' ? (entry.compilerResult === 0 && runtimeNumeric === 0)
                         : true;
    const filterLang = languageFilter === 'all' || entry.language === languageFilter;
    return filterPassFail && filterLang;
  });

  const compilerFails = filteredData.filter(f => f.compilerResult !== 0);
  const runtimeFails = filteredData.filter(f => {
    const result = f.runtimeResult;
    return (
      (typeof result === 'number' && result !== 0) ||
      (typeof result === 'string' && !['pass', 'unknown'].includes(result.toLowerCase()))
    );
  });

  const renderTable = (data: FailureDetail[], title: string, key: 'all' | 'compiler' | 'runtime') => (
    <div className="mt-8">
      <button
        onClick={() => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))}
        className="text-left w-full text-2xl font-bold mb-2 focus:outline-none bg-gradient-to-r from-blue-300 via-purple-400 to-indigo-400 text-white px-5 py-3 rounded-lg shadow hover:opacity-90 transition duration-300"
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
                <th className="p-3 border">Logs</th>
              </tr>
            </thead>
            <tbody>
              {data.map((f, i) => {
                const isUnknown = f.runtimeResult === 'Unknown';
                const isPass = typeof f.runtimeResult === 'number' && f.runtimeResult === 0;
                const isCompilerPass = f.compilerResult === 0;

                return (
                  <tr key={i} className={darkMode ? "even:bg-gray-800" : "even:bg-gray-100"}>
                    <td className="p-3 border text-center font-mono">{i + 1}</td>
                    <td className="p-3 border font-bold text-blue-800 dark:text-blue-400">{f.name}</td>
                    <td className="p-3 border text-center">{f.language}</td>
                    <td className={`p-3 border text-center font-semibold ${isCompilerPass ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{f.compilerResult}</td>
                    <td className={`p-3 border ${ f.compilerReason.toLowerCase() === 'pass' ? 'text-green-600 dark:text-green-500' : 'text-red-500 dark:text-red-500'}`}>{f.compilerReason}</td>
                    <td className={`p-3 border text-center font-semibold ${
                    isUnknown ? 'text-blue-500 dark:text-blue-400' : isPass ? 'text-green-600 dark:text-green-500' : 'text-yellow-600 dark:text-yellow-400'
                    }`}> {f.runtimeResult}</td>
                    <td className={`p-3 border ${
                      isUnknown ? 'text-blue-500 dark:text-blue-400' : isPass ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
                    }`}>
                      {f.runtimeReason}
                    </td>
                    <td className="p-3 border text-center">
                      <button
                        className="text-sm text-blue-600 dark:text-blue-400 underline hover:text-blue-800"
                        onClick={() => setLogModal(f)}
                      >
                        View Full Log
                      </button>
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
    <div className={`${darkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 text-white' : 'bg-white text-black'} min-h-screen p-8`}>
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

      <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-6">
        <div>
          <label htmlFor="filter" className="mr-2 font-medium">Result Filter:</label>
          <select
            id="filter"
            className={`border p-2 rounded ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'} hover:border-blue-400`}
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">All Tests</option>
            <option value="pass">Only Passing</option>
            <option value="fail">Only Failing</option>
          </select>
        </div>
        <div>
          <label htmlFor="languageFilter" className="mr-2 font-medium">Language:</label>
          <select
            id="languageFilter"
            className={`border p-2 rounded ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'} hover:border-blue-400`}
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="C">C</option>
            <option value="CPP">C++</option>
            <option value="F90">Fortran</option>
          </select>
        </div>
      </div>

      {renderTable(filteredData, 'All Tests', 'all')}
      {renderTable(compilerFails, 'Compiler Failures', 'compiler')}
      {renderTable(runtimeFails, 'Runtime Failures', 'runtime')}

      {logModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 text-white p-6 rounded-lg shadow-xl w-[90%] max-w-4xl max-h-[90%] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-2 text-indigo-600 dark:text-indigo-300">{logModal.name} – Full Log</h2>
            <div className="text-sm font-mono whitespace-pre-wrap">
              <h3 className="mt-4 font-bold text-blue-600 dark:text-blue-400">Compiler Stdout:</h3>
              <pre className="mb-4">{logModal.compilerStdout || '(none)'}</pre>
              <h3 className="mt-4 font-bold text-blue-600 dark:text-blue-400">Compiler Stderr:</h3>
              <pre className="mb-4">{logModal.compilerStderr || '(none)'}</pre>
              <h3 className="mt-4 font-bold text-green-600 dark:text-green-400">Runtime Output:</h3>
              <pre className="mb-4">{logModal.runtimeOutput || '(none)'}</pre>
              <h3 className="mt-4 font-bold text-red-600 dark:text-red-400">Runtime Stderr:</h3>
              <pre>{logModal.runtimeStderr || '(none)'}</pre>
            </div>
            <div className="mt-6 text-right">
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                onClick={() => setLogModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailsPage;
