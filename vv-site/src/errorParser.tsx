// errorParser.ts

export function getResultReason(run: any, type: 'compiler' | 'runtime'): string {
  const section = type === 'compiler' ? run?.compilation : run?.runtime;
  if (!section) return 'N/A';

  const stderr = section.errors?.trim() || section.stderr?.trim() || '';
  const stdout = section.stdout?.trim() || '';
  const output = section.output?.trim() || '';
  const msg = `${stderr}
${stdout}
${output}`.trim();

  if (!msg) return 'Unknown';

  const lines = msg.split('\n').map(l => l.trim()).filter(Boolean);

  const errorLine = lines.find(line =>
    /error|compilation aborted|undefined|invalid|fatal|segmentation|core dumped|not found|missing/i.test(line)
  );

  return errorLine || lines.slice(0, 3).join(' | ') || 'Unknown';
}

export function getCompilerStatus(run: any): {
  result: number;
  reason: string;
  stderr: string;
  stdout: string;
} {
  const section = run.compilation || {};
  const result = section.result ?? -1;
  const reason = result === 0 ? 'Pass' : getResultReason(run, 'compiler');

  return {
    result,
    reason,
    stderr: section.errors || section.stderr || '',
    stdout: section.output || section.stdout || ''
  };
}

export function getRuntimeStatus(run: any): {
  result: number | string;
  reason: string;
  stderr: string;
  output: string;
} {
  const section = run.runtime || run.execution || {};
  const result = section.result;
  const isNumber = typeof result === 'number';

  const stderr = section.errors || section.stderr || '';
  const output = section.output || '';

  const reason = !isNumber
    ? 'No execution result'
    : result !== 0 || stderr.trim() || output.trim()
    ? getResultReason(run, 'runtime')
    : 'Pass';

  return {
    result: isNumber ? result : 'Unknown',
    reason,
    stderr,
    output
  };
}
