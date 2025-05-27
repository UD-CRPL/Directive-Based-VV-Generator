import React, { useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// Types
type Summary = {
  total: number;
  pass: number;
  fail: number;
  failures: { name: string; reason: string }[];
};

function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [comparisonFiles, setComparisonFiles] = useState<File[]>([]);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showFailures, setShowFailures] = useState(false);

  function parseJSONResults(fileText: string) {
    const data = JSON.parse(fileText);
    const runs = data.runs;

    let total = 0;
    let pass = 0;
    let fail = 0;
    const failures: { name: string; reason: string }[] = [];

    for (const test in runs) {
      total++;
      const result = runs[test][0]?.runtime?.result;
      if (result === 0) {
        pass++;
      } else {
        fail++;
        const reason = runs[test][0]?.runtime?.stderr?.split('\n')[0] || 'Unknown error';
        failures.push({ name: test, reason });
      }
    }

    setSummary({ total, pass, fail, failures });
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => parseJSONResults(e.target?.result as string);
      reader.readAsText(file);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files).filter(file => file.name.endsWith('.json'));
    if (files.length === 2) {
      setComparisonFiles(files);
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleClickDropZone() {
    fileInputRef.current?.click();
  }

  function handleFileDialogChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (files && files.length === 2) {
      setComparisonFiles([files[0], files[1]]);
    }
  }

  function clearFiles() {
    setComparisonFiles([]);
    setComparisonData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function generateComparisonGraph() {
    if (comparisonFiles.length !== 2 || !comparisonFiles[0] || !comparisonFiles[1]) return;

    const readers = [new FileReader(), new FileReader()];
    const summaries: any[] = [];

    readers.forEach((reader, index) => {
      reader.onload = (e) => {
        const fileText = e.target?.result as string;
        const data = JSON.parse(fileText);
        const runs = data.runs;

        const summaryCounts = {
          C: { total: 0, pass: 0, fail: 0 },
          CPP: { total: 0, pass: 0, fail: 0 },
          F90: { total: 0, pass: 0, fail: 0 },
        };

        for (const test in runs) {
          const ext = test.split('.').pop();
          const lang = ext === 'c' ? 'C' : ext === 'cpp' ? 'CPP' : ext === 'F90' ? 'F90' : null;
          if (!lang) continue;

          summaryCounts[lang].total++;
          const passed = runs[test][0]?.runtime?.result === 0;
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
        <h2 className="text-2xl font-semibold text-blue-700 mb-2">Upload Single Version Results</h2>
        <p className="text-gray-600 mb-4">Upload a single JSON file to generate test results for one compiler version.</p>
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="block mb-6"
        />

        {summary && (
          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <h3 className="text-xl font-semibold mb-4">Test Summary</h3>
            <p>Total Tests: {summary.total}</p>
            <p>Passing: {summary.pass}</p>
            <p>Failing: {summary.fail}</p>
            <button
              className="mt-4 text-blue-600 underline"
              onClick={() => setShowFailures(!showFailures)}
            >
              {showFailures ? 'Hide' : 'Show'} Failing Test Details
            </button>
            {showFailures && (
              <ul className="mt-4 list-disc list-inside text-sm text-red-700">
                {summary.failures.map((f, i) => (
                  <li key={i}><strong>{f.name}</strong>: {f.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto bg-white shadow-md rounded-lg p-6 border border-green-200">
        <h2 className="text-2xl font-semibold text-green-700 mb-2">Compare Two Versions</h2>
        <p className="text-gray-600 mb-4">Select exactly two JSON files to compare the passing test results across compilers.</p>

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
              <BarChart data={comparisonData}>
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

export default App;