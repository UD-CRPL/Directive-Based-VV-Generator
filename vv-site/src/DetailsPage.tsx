import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface Failure {
  name: string;
  reason: string;
}

interface SummaryDetails {
  C: { total: number; pass: number; fail: number };
  CPP: { total: number; pass: number; fail: number };
  F90: { total: number; pass: number; fail: number };
  failures: Failure[];
}

export default function DetailsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { summary: SummaryDetails | null };
  const summary = state?.summary;

  return (
    <div className="min-h-screen bg-white p-6">
      <button onClick={() => navigate(-1)} className="mb-4 text-blue-600 hover:underline">
        ← Back to Summary
      </button>

      <h1 className="text-3xl font-bold mb-6 text-center text-blue-800">Detailed Failing Test Results</h1>

      {summary ? (
        ['C', 'CPP', 'F90'].map((lang) => (
          <div key={lang} className="mb-6 border-b pb-4">
            <h2 className="text-xl font-semibold text-gray-800">{lang} Tests</h2>
            <p>Total: {summary[lang as 'C' | 'CPP' | 'F90'].total}</p>
            <p>Passing: {summary[lang as 'C' | 'CPP' | 'F90'].pass}</p>
            <p>Failing: {summary[lang as 'C' | 'CPP' | 'F90'].fail}</p>

            <ul className="list-disc list-inside mt-2 text-red-700">
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
          </div>
        ))
      ) : (
        <p className="text-center text-gray-600">No data available.</p>
      )}
    </div>
  );
}
