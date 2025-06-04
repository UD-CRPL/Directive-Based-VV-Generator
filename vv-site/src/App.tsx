import React, { useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Routes, Route, useNavigate } from 'react-router-dom';
import DetailsPage from './DetailsPage';

interface Summary {
  C: { total: number; pass: number; fail: number };
  CPP: { total: number; pass: number; fail: number };
  F90: { total: number; pass: number; fail: number };
  failures: { name: string; reason: string }[];
}

function HomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [comparisonFiles, setComparisonFiles] = useState<File[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const navigate = useNavigate();

  function parseJSONResults(fileText: string) {
    const sanitized = fileText.trim().replace(/^var jsonResults\s*=\s*/, '');
    const data = JSON.parse(sanitized);
    const runs = data.runs;

    const summaryCounts: Summary = {
      C: { total: 0, pass: 0, fail: 0 },
      CPP: { total: 0, pass: 0, fail: 0 },
      F90: { total: 0, pass: 0, fail: 0 },
      failures: [],
    };

    for (const testName in runs) {
      const ext = testName.split('.').pop()?.toLowerCase();
      const lang = ext === 'c' ? 'C' : ext === 'cpp' ? 'CPP' : ext === 'f90' ? 'F90' : null;
      if (!lang) continue;

      const testEntry = runs[testName][0];
      const compileResult = testEntry?.compilation?.result;

      summaryCounts[lang].total++;

      if (compileResult === 0) {
        summaryCounts[lang].pass++;
      } else {
        summaryCounts[lang].fail++;
        const reason = testEntry?.compilation?.stderr?.split('\n')[0] || 'Unknown compile error';
        summaryCounts.failures.push({ name: testName, reason });
      }
    }

    setSummary(summaryCounts);
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

    const readers = [new FileReader(), new FileReader()];
    const summaries: any[] = [];

    readers.forEach((reader, index) => {
      reader.onload = (e) => {
        const fileText = (e.target?.result as string).trim().replace(/^var jsonResults\s*=\s*/, '');
        const data = JSON.parse(fileText);
        const runs = data.runs;

        const summaryCounts = {
          C: { total: 0, pass: 0, fail: 0 },
          CPP: { total: 0, pass: 0, fail: 0 },
          F90: { total: 0, pass: 0, fail: 0 },
        };

        for (const test in runs) {
          const ext = test.split('.').pop()?.toLowerCase();
          const lang = ext === 'c' ? 'C' : ext === 'cpp' ? 'CPP' : ext === 'f90' ? 'F90' : null;
          if (!lang) continue;

          summaryCounts[lang].total++;
          const passed = runs[test][0]?.compilation?.result === 0;
          if (passed) summaryCounts[lang].pass++;
          else summaryCounts[lang].fail++;
        }

        summaries[index] = summaryCounts;

        if (summaries.filter(Boolean).length === 2) {
          const chartData = ['C', 'CPP', 'F90'].map((lang) => ({
            language: lang,
            version1: summaries[0][lang].pass,
            version2: summaries[1][lang].pass,
          }));
          setComparisonData(chartData);
        }
      };
      reader.readAsText(comparisonFiles[index]);
    });
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-800">OpenACC V&V Results Generator</h1>

      <div className="max-w-2xl mx-auto mb-10 bg-white shadow-md rounded-lg p-6 border border-blue-200">
        <h2 className="text-2xl font-semibold text-blue-700 mb-2 text-center">Upload Single Version Results</h2>
        <p className="text-gray-600 mb-4 text-center">Upload a single JSON file to generate test results for one compiler version.</p>

        <div className="flex flex-col items-center">
          <input type="file" accept=".json" onChange={handleFileUpload} className="mb-2" />
          {uploadedFileName && <p className="text-sm text-green-500">{uploadedFileName} has been successfully uploaded</p>}
        </div>

        {summary && (
          <div className="bg-gray-50 border border-gray-200 rounded p-4 mt-4">
            <h3 className="text-xl font-semibold mb-4">Test Summary</h3>

            {['C', 'CPP', 'F90'].map((lang) => (
              <div key={lang} className="mb-4 border-b pb-2">
                <p className="font-medium text-lg">{lang}</p>
                <p>Total: {summary[lang as 'C' | 'CPP' | 'F90'].total}</p>
                <p>Passing: {summary[lang as 'C' | 'CPP' | 'F90'].pass}</p>
                <p>Failing: {summary[lang as 'C' | 'CPP' | 'F90'].fail}</p>

                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600 hover:underline">
                    Show failing tests
                  </summary>
                  <ul className="list-disc list-inside text-sm text-red-700 mt-2 max-h-48 overflow-y-auto">
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

            <button
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              onClick={() => navigate('/details')}
            >
              View Details
            </button>
            <p className="text-sm text-gray-600 mt-1">Click to see detailed test breakdowns and download Excel summaries.</p>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto bg-white shadow-md rounded-lg p-6 border border-green-200">
        <h2 className="text-2xl font-semibold text-green-700 mb-2 text-center">Compare Two Versions</h2>
        <p className="text-gray-600 mb-4 text-center">Select exactly two JSON files to compare the passing test results across compilers.</p>

        <div className="flex gap-4 mb-4">
          <input
            type="file"
            accept=".json"
            onChange={(e) => setComparisonFiles(prev => [e.target.files?.[0]!, prev[1]])}
            className="flex-1 border border-green-400 p-2 rounded"
          />
          <input
            type="file"
            accept=".json"
            onChange={(e) => setComparisonFiles(prev => [prev[0], e.target.files?.[0]!])}
            className="flex-1 border border-green-400 p-2 rounded"
          />
        </div>

        {comparisonFiles.filter(Boolean).length === 2 && (
          <div className="text-center mb-4">
            <p className="text-green-700 text-sm mb-2">✅ Both files ready:</p>
            <ul className="text-sm text-gray-700 list-disc pl-5 text-left">
              {comparisonFiles.map((file, i) => (
                file && <li key={i}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-center gap-4">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={generateComparisonGraph}
          >
            Generate Graph
          </button>
          <button
            className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400"
            onClick={clearFiles}
          >
            Clear Files
          </button>
        </div>

        {comparisonData.length > 0 && (
          <div className="h-96 mt-6 bg-gray-50 p-4 rounded border">
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
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/details" element={<DetailsPage />} />
    </Routes>
  );
}
