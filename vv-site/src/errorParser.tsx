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

  // Support `result`, `return_code`, or fallback to `success`
  let resultRaw = section.result ?? section.return_code;
  let result: number;

  if (typeof resultRaw === 'number') {
    result = resultRaw;
  } else if (typeof resultRaw === 'string' && !isNaN(Number(resultRaw))) {
    result = Number(resultRaw);
  } else if ('success' in section) {
    result = section.success === true ? 0 : 1;
  } else {
    result = -1; // fallback if everything is missing
  }

  const reason =
    result === 0
      ? 'Pass'
      : result === -1
        ? 'No compilation result'
        : getResultReason(run, 'compiler');

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

  // Correctly pull result from either `result` or `return_code`
  let resultRaw = section.result ?? section.return_code;
  let result: number | string;

  if (typeof resultRaw === 'number') {
    result = resultRaw;
  } else if (typeof resultRaw === 'string' && !isNaN(Number(resultRaw))) {
    result = Number(resultRaw);
  } else if ('success' in section) {
    result = section.success === true ? 0 : 1;
  } else {
    result = 'Unknown';
  }

  const stderr = section.errors || section.stderr || '';
  const output = section.output || '';

  const reason =
    result === 0
      ? 'Pass'
      : result === 'Unknown'
        ? 'No execution result'
        : getResultReason(run, 'runtime');

  return {
    result,
    reason,
    stderr,
    output,
  };
}


