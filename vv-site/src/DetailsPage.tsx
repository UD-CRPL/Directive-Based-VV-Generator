import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCompilerStatus, getRuntimeStatus } from './errorParser';
import * as XLSX from 'xlsx-js-style';

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
  const exportToExcel = (data: FailureDetail[], fileName: string) => {
  const header = [
    "Test Name",
    "Language",
    "Compiler Result",
    "Compiler Reason",
    "Runtime Result",
    "Runtime Reason",
    "Compiler Stderr",
    "Compiler Stdout",
    "Runtime Stderr",
    "Runtime Output"
  ];

  const body = data.map(d => [
    d.name,
    d.language,
    d.compilerResult,
    d.compilerReason,
    d.runtimeResult,
    d.runtimeReason,
    d.compilerStderr,
    d.compilerStdout,
    d.runtimeStderr,
    d.runtimeOutput
  ]);

  const worksheetData = [header, ...body];
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  const colWidths = [25, 10, 15, 25, 15, 25, 30, 30, 30, 30];
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  // Set row heights (starting from row 1, header is 0)
  ws['!rows'] = worksheetData.map((_, i) => ({ hpt: i === 0 ? 24 : 28 }));

  // Style headers
  header.forEach((_, colIndex) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIndex });
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
      fill: { fgColor: { rgb: "4F46E5" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "CCCCCC" } },
        bottom: { style: "thin", color: { rgb: "CCCCCC" } }
      }
    };
  });

  // Style data rows
  for (let r = 1; r < worksheetData.length; r++) {
    const row = worksheetData[r];
    for (let c = 0; c < row.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      const cell = ws[cellRef];

      const val = row[c];

      // Default styling
      cell.s = {
        font: { name: "Calibri", sz: 11 },
        alignment: { vertical: "top", wrapText: true },
      };

      // Apply color to result/reason cells (text only)
      if ([2, 3, 4, 5].includes(c)) {
        // const failKeywords = ["fail", "error", "segmentation", "undefined", "aborted"];
        const valStr = String(val).toLowerCase();
        const isPass = valStr === '0' || valStr === 'pass';
        const isUnknown = valStr === 'unknown';
        const isFail = !(valStr === '0' || valStr === 'unknown');
        cell.s.font = {
          ...cell.s.font,
          bold: true,
          color: {
            rgb: isPass ? "22C55E" : isUnknown ? "3B82F6" : isFail ? "EF4444" : "000000"
          }
        };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Details");

  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

useEffect(() => {
  const state = location.state as { rawJson: string };
  if (!state?.rawJson) return;

  const jsonText = state.rawJson.trim().replace(/^var jsonResults\s*=\s*/, '');
  const data = JSON.parse(jsonText);
  const runs = data.runs;

  const sortTestNames = (names: string[]) => {
    const langOrder: { [key: string]: number } = { c: 0, cpp: 1, f90: 2 };
    return names.sort((a, b) => {
      const [baseA, extA] = a.toLowerCase().split(/\.(?=[^.]+$)/);
      const [baseB, extB] = b.toLowerCase().split(/\.(?=[^.]+$)/);
      if (baseA < baseB) return -1;
      if (baseA > baseB) return 1;
      return (langOrder[extA] ?? 3) - (langOrder[extB] ?? 3);
    });
  };

  const parsedFailures: FailureDetail[] = [];
  const sortedNames = sortTestNames(Object.keys(runs));

  for (const testName of sortedNames) {
    const runArray = runs[testName];
    if (!Array.isArray(runArray) || runArray.length === 0) continue;

    const ext = testName.split('.').pop()?.toLowerCase();
    let language = 'Other';
    if (ext === 'c') language = 'C';
    else if (ext === 'cpp') language = 'CPP';
    else if (ext === 'f90') language = 'F90';

    let compilerStatusFinal = { result: 0, reason: 'Pass', stderr: '', stdout: '' };
    let runtimeStatusFinal: { result: number | string, reason: string, stderr: string, output: string } =
      { result: 0, reason: 'Pass', stderr: '', output: '' };

    for (const run of runArray) {
      const cStatus = getCompilerStatus(run);
      const rStatus = getRuntimeStatus(run);

      if (cStatus.result !== 0) {
        compilerStatusFinal.result = cStatus.result;
        compilerStatusFinal.reason = cStatus.reason;
        compilerStatusFinal.stderr ||= cStatus.stderr;
        compilerStatusFinal.stdout ||= cStatus.stdout;
      }

      const isRuntimeFail = typeof rStatus.result === 'number'
        ? rStatus.result !== 0
        : typeof rStatus.result === 'string'
          ? rStatus.result.toLowerCase() !== 'pass'
          : false;

      if (isRuntimeFail) {
        runtimeStatusFinal.result = rStatus.result;
        runtimeStatusFinal.reason = rStatus.reason;
        runtimeStatusFinal.stderr ||= rStatus.stderr;
        runtimeStatusFinal.output ||= rStatus.output;
      }
    }

    parsedFailures.push({
      name: testName,
      language,
      compilerResult: compilerStatusFinal.result,
      compilerReason: compilerStatusFinal.reason || 'Pass',
      runtimeResult: runtimeStatusFinal.result,
      runtimeReason: runtimeStatusFinal.reason || 'Pass',
      compilerStderr: compilerStatusFinal.stderr,
      compilerStdout: compilerStatusFinal.stdout,
      runtimeStderr: runtimeStatusFinal.stderr,
      runtimeOutput: runtimeStatusFinal.output,
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
      <span className="inline-block w-5 text-xl transform transition-transform duration-300">
        {expandedSections[key] ? '▼' : '►'}
      </span>
      <span className="ml-1">{title}</span>
      </button>
      {expandedSections[key] && (
        <><div className="text-right mb-2">
          <button
            onClick={() => exportToExcel(data, `${title.replace(/\s+/g, '_')}_Report`)}
            className="backdrop-blur-md bg-green-400/10 hover:bg-green-400/20 text-green-500 font-semibold px-6 py-2 rounded-xl border border-green-500 shadow-md hover:shadow-lg transition-all duration-300"
          >
            Download Excel
          </button>
        </div><div className={`overflow-x-auto border rounded-lg shadow-xl ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
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
                      <td className={`p-3 border ${f.compilerReason.toLowerCase() === 'pass' ? 'text-green-600 dark:text-green-500' : 'text-red-500 dark:text-red-500'}`}>{f.compilerReason}</td>
                      <td className={`p-3 border text-center font-semibold ${isUnknown ? 'text-blue-500 dark:text-blue-400' : isPass ? 'text-green-600 dark:text-green-500' : 'text-yellow-600 dark:text-yellow-400'}`}> {f.runtimeResult}</td>
                      <td className={`p-3 border ${isUnknown ? 'text-blue-500 dark:text-blue-400' : isPass ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
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
          </div></>
      )}
    </div>
  );

  return (
    <div className={`${darkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 text-white' : 'bg-white text-black'} min-h-screen p-8`}>
        <div
          className={`w-full h-20 shadow-lg absolute top-0 left-0 z-0 pointer-events-none
            ${darkMode
              ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 border-b border-gray-700'
              : 'bg-gradient-to-r from-neutral-100 via-white to-neutral-100 border-b border-gray-200'}
          `}
        ></div>
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-blue-500 text-blue-500 hover:bg-blue-500/10 transition duration-300 backdrop-blur-sm shadow-sm hover:shadow-md"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Summary
        </button>
        <button onClick={() => setDarkMode(prev => !prev)} 
        className="relative z-10 px-4 py-2 bg-indigo-500 text-white rounded shadow hover:bg-indigo-700">
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
