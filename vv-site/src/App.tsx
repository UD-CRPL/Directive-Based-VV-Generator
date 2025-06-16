import React, { useRef, useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Routes, Route, useNavigate } from 'react-router-dom';
import DetailsPage from './DetailsPage';
import { getCompilerStatus, getRuntimeStatus } from './errorParser';

interface Summary {
  C: { total: number; pass: number; fail: number };
  CPP: { total: number; pass: number; fail: number };
  F90: { total: number; pass: number; fail: number };
  failures: { name: string; reason: string }[];
}

interface HomePageProps {
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
}

function parseJSONResultsHelper(
  fileText: string,
  mode: 'compiler' | 'runtime',
  setSummary: React.Dispatch<React.SetStateAction<Summary | null>>,
  sortTestNames: (testNames: string[]) => string[]
) {
  const sanitized = fileText.trim().replace(/^var jsonResults\s*=\s*/, '');
  const data = JSON.parse(sanitized);
  const runs = data.runs;

  const summaryCounts: Summary = {
    C: { total: 0, pass: 0, fail: 0 },
    CPP: { total: 0, pass: 0, fail: 0 },
    F90: { total: 0, pass: 0, fail: 0 },
    failures: [],
  };

  const sortedNames = sortTestNames(Object.keys(runs));

  for (const testName of sortedNames) {
    const runArray = runs[testName];
    if (!Array.isArray(runArray) || runArray.length === 0) continue;

    const ext = testName.split('.').pop()?.toLowerCase();
    let lang: 'C' | 'CPP' | 'F90' | null = null;
    if (ext === 'c') lang = 'C';
    else if (ext === 'cpp') lang = 'CPP';
    else if (ext === 'f90') lang = 'F90';
    if (!lang) continue;

    summaryCounts[lang].total++;

    const firstCompilerFail = runArray.find((run) => getCompilerStatus(run).result !== 0);
    const firstRuntimeFail = runArray.find((run) => {
      const result = getRuntimeStatus(run).result;
      return typeof result === 'number' ? result !== 0 : result.toLowerCase() !== 'pass';
    });

    if (mode === 'compiler') {
      if (!firstCompilerFail) {
        summaryCounts[lang].pass++;
      } else {
        summaryCounts[lang].fail++;
        const reason = getCompilerStatus(firstCompilerFail).reason || 'Unknown';
        summaryCounts.failures.push({ name: testName, reason });
      }
    } else {
      if (firstCompilerFail) continue;
      if (!firstRuntimeFail) {
        summaryCounts[lang].pass++;
      } else {
        summaryCounts[lang].fail++;
        const reason = getRuntimeStatus(firstRuntimeFail).reason || 'Unknown';
        summaryCounts.failures.push({ name: testName, reason });
      }
    }
  }

  setSummary(summaryCounts);
}

function HomePage({ darkMode, setDarkMode }: HomePageProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rawJsonText, setRawJsonText] = useState<string | null>(null);
  const [comparisonFiles, setComparisonFiles] = useState<File[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [mode, setMode] = useState<'compiler' | 'runtime'>('compiler');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [graphGenerated, setGraphGenerated] = useState(false);
  const [graphMode, setGraphMode] = useState<'compiler' | 'runtime'>('compiler');
  const navigate = useNavigate();

useEffect(() => {
  if (rawJsonText) {
    parseJSONResultsHelper(rawJsonText, mode, setSummary, sortTestNames);
  }
}, [mode, rawJsonText]);

useEffect(() => {
  if (graphGenerated && comparisonFiles.length === 2) {
    generateComparisonGraph();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [graphMode]);

  function sortTestNames(testNames: string[]): string[] {
    const langOrder: { [key: string]: number } = { c: 0, cpp: 1, f90: 2 };
    return testNames.sort((a, b) => {
      const [baseA, extA] = a.toLowerCase().split(/\.(?=[^.]+$)/);
      const [baseB, extB] = b.toLowerCase().split(/\.(?=[^.]+$)/);
      if (baseA < baseB) return -1;
      if (baseA > baseB) return 1;
      return (langOrder[extA] ?? 3) - (langOrder[extB] ?? 3);
    });
  }

  function parseJSONResults(fileText: string) {
    setRawJsonText(fileText);
    parseJSONResultsHelper(fileText, mode, setSummary, sortTestNames);
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => parseJSONResults(e.target?.result as string);
      reader.readAsText(file);
    }
  }

  function clearFiles() {
    setComparisonFiles([]);
    setComparisonData([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    document.querySelectorAll("input[type='file']").forEach((input) => ((input as HTMLInputElement).value = ''));
  }

  function generateComparisonGraph() {
  if (comparisonFiles.length !== 2 || !comparisonFiles[0] || !comparisonFiles[1]) return;

  const summaries: any[] = [];

  const processFile = (file: File, index: number) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawText = (e.target?.result as string)?.trim().replace(/^var jsonResults\s*=\s*/, '');
      const data = JSON.parse(rawText);
      const runs = data.runs;

      const counts = { C: 0, CPP: 0, F90: 0 };

      for (const testName of Object.keys(runs)) {
        const runArray = runs[testName];
        if (!Array.isArray(runArray) || runArray.length === 0) continue;

        const ext = testName.split('.').pop()?.toLowerCase();
        let lang: 'C' | 'CPP' | 'F90' | null = null;
        if (ext === 'c') lang = 'C';
        else if (ext === 'cpp') lang = 'CPP';
        else if (ext === 'f90') lang = 'F90';
        if (!lang) continue;

        let compilerPass = true;
        let runtimePass = true;

        for (const run of runArray) {
          const cStatus = getCompilerStatus(run);
          const rStatus = getRuntimeStatus(run);

          if (cStatus.result !== 0) compilerPass = false;

          const isRuntimeFail = typeof rStatus.result === 'number'
            ? rStatus.result !== 0
            : typeof rStatus.result === 'string'
              ? rStatus.result.toLowerCase() !== 'pass'
              : false;

          if (isRuntimeFail) runtimePass = false;
        }

        if (graphMode === 'compiler' && compilerPass) counts[lang]++;
        if (graphMode === 'runtime' && compilerPass && runtimePass) counts[lang]++;
      }

      summaries[index] = counts;

      if (summaries.filter(Boolean).length === 2) {
        const chartData = ['C', 'CPP', 'F90'].map((lang) => ({
          language: lang,
          version1: summaries[0][lang],
          version2: summaries[1][lang],
        }));
        setComparisonData(chartData);
      }
    };
    reader.readAsText(file);
  };

  processFile(comparisonFiles[0], 0);
  processFile(comparisonFiles[1], 1);
}
 
  return (
    <div className={`${darkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white' : 'bg-gradient-to-br from-gray-100 via-white to-gray-200 text-black'} min-h-screen p-8`}>
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setDarkMode(prev => !prev)}
          className="px-4 py-2 bg-indigo-500 text-white rounded shadow hover:bg-indigo-600"
        >
          Toggle {darkMode ? 'Light' : 'Dark'} Mode
        </button>
      </div>

      <h1 className="text-4xl font-extrabold text-center mb-10 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">
        OpenACC V&V Results Generator
      </h1>

      <div className={`max-w-3xl mx-auto mb-12 border rounded-lg shadow-xl p-6 ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <h2 className="text-2xl font-bold text-center text-blue-700 dark:text-blue-300 mb-2">Upload Single Version Results</h2>
        <p className="text-center text-sm mb-4 text-gray-700 dark:text-gray-400">Upload a single JSON file to generate summary statistics and access detailed results.</p>

        <div className="flex flex-col items-center">
          <input type="file" accept=".json" onChange={handleFileUpload} className="mb-3" />
          {uploadedFileName && <p className="text-green-500 text-sm">{uploadedFileName} has been uploaded</p>}
        </div>

        {summary && (
            <><div className="flex items-center justify-end mb-4">
              <span className="mr-2 font-semibold text-sm text-gray-700 dark:text-gray-300">
                {mode === 'compiler' ? 'Compiler' : 'Runtime'}
              </span>
              <button
                onClick={() => setMode(mode === 'compiler' ? 'runtime' : 'compiler')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  mode === 'compiler' ? 'bg-blue-500' : 'bg-green-500'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    mode === 'compiler' ? 'translate-x-1' : 'translate-x-6'
                  }`}
                />
              </button>
            </div><div className={`mt-6 p-4 rounded border ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}>
              <h3 className="text-xl font-semibold mb-4 text-center">Test Summary</h3>
              {['C', 'CPP', 'F90'].map((lang) => (
                <div key={lang} className="mb-4 border-b pb-2">
                  <p className="text-lg font-medium">{lang}</p>
                  <p>Total: {summary[lang as 'C' | 'CPP' | 'F90'].total}</p>
                  <p>Passing: {summary[lang as 'C' | 'CPP' | 'F90'].pass}</p>
                  <p>Failing: {summary[lang as 'C' | 'CPP' | 'F90'].fail}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-500 dark:text-blue-300 hover:underline">
                      Show failing tests
                    </summary>
                    <ul className="list-disc pl-5 text-sm text-red-600 dark:text-red-400 mt-2 max-h-48 overflow-y-auto">
                      {summary.failures
                        .filter((f) => {
                          const ext = f.name.split('.').pop();
                          return (
                            (lang === 'C' && ext === 'c') ||
                            (lang === 'CPP' && ext === 'cpp') ||
                            (lang === 'F90' && ext?.toLowerCase() === 'f90')
                          );
                        })
                        .map((f, i) => (
                          <li key={i}><strong>{f.name}</strong>: {f.reason}</li>
                        ))}
                    </ul>
                  </details>
                </div>
              ))}

              <div className="flex flex-col items-center mt-4">
                <button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2 rounded shadow"
                  onClick={() => {
                    const input = document.querySelector("input[type='file']") as HTMLInputElement | null;
                    const file = input?.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      const rawJson = e.target?.result as string;
                      navigate('/details', { state: { rawJson } });
                    };
                    reader.readAsText(file);
                  } }
                >
                  View Details
                </button>
                <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">Click to see detailed breakdown and generate Excel export</p>
              </div>
            </div></>
        )}
      </div>

      <div className={`max-w-3xl mx-auto border rounded-lg shadow-xl p-6 ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
        <h2 className="text-2xl font-bold text-center text-green-700 dark:text-green-500 mb-2">Compare Two Versions</h2>
        <p className="text-center text-sm mb-4 text-gray-700 dark:text-gray-400">Upload two JSON files to compare the number of passing tests.</p>

        <div className="flex gap-4 mb-4">
          <input type="file" accept=".json" onChange={(e) => setComparisonFiles(prev => [e.target.files?.[0]!, prev[1]])}
            className={`flex-1 p-2 rounded ${darkMode ? 'bg-gray-800 text-white border border-green-400' : 'bg-white text-black border border-green-600'}`} />
          <input type="file" accept=".json" onChange={(e) => setComparisonFiles(prev => [prev[0], e.target.files?.[0]!])}
            className={`flex-1 p-2 rounded ${darkMode ? 'bg-gray-800 text-white border border-green-400' : 'bg-white text-black border border-green-600'}`} />
        </div>

        {comparisonFiles.filter(Boolean).length === 2 && (
          <div className="text-center mb-4">
            <p className="text-green-600 dark:text-green-300 text-sm mb-2">✅ Both files ready:</p>
            <ul className="text-sm list-disc text-left pl-5 text-gray-800 dark:text-gray-200">
              {comparisonFiles.map((file, i) => (
                file && <li key={i}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
            onClick={() => {
              generateComparisonGraph();
              setGraphGenerated(true);
            }}
          >
            Generate Graph
          </button>
          <button
            className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded shadow"
            onClick={clearFiles}
          >
            Clear Files
          </button>
        </div>
        {comparisonFiles.filter(Boolean).length === 2 && (
          <div className="flex justify-end items-center mb-4">
            <span className="mr-2 font-semibold text-sm text-gray-700 dark:text-gray-300">
              {graphMode === 'compiler' ? 'Compiler' : 'Runtime'}
            </span>
            <button
              onClick={() => setGraphMode(prev => prev === 'compiler' ? 'runtime' : 'compiler')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                graphMode === 'compiler' ? 'bg-blue-500' : 'bg-green-500'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  graphMode === 'compiler' ? 'translate-x-1' : 'translate-x-6'
                }`}
              />
            </button>
          </div>
        )}
        {comparisonData.length > 0 && (
          <div className={`h-96 mt-6 p-4 rounded border ${darkMode ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <XAxis dataKey="language" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="version1" fill="#3b82f6" name="Version 1" />
                <Bar dataKey="version2" fill="#10b981" name="Version 2" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode');
    return stored ? stored === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  return (
    <Routes>
      <Route path="/" element={<HomePage darkMode={darkMode} setDarkMode={setDarkMode} />} />
      <Route path="/details" element={<DetailsPage darkMode={darkMode} setDarkMode={setDarkMode} />} />
    </Routes>
  );
}
