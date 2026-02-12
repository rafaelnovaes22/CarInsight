import { spawn } from 'child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

type AdminTaskName = 'seedRenatinhu' | 'seedRobustcar' | 'generateEmbeddings' | 'schemaPush';

type TaskDefinition = {
  command: string;
  args: string[];
};

const TASKS: Record<AdminTaskName, TaskDefinition> = {
  seedRenatinhu: {
    command: npmCommand,
    args: ['run', 'db:seed'],
  },
  seedRobustcar: {
    command: npmCommand,
    args: ['run', 'db:seed:robustcar'],
  },
  generateEmbeddings: {
    command: npmCommand,
    args: ['run', 'embeddings:generate'],
  },
  schemaPush: {
    command: npxCommand,
    args: ['prisma', 'db', 'push', '--accept-data-loss', '--skip-generate'],
  },
};

export type AdminTaskResult = {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
};

export class AdminTaskExecutionError extends Error {
  readonly command: string;
  readonly args: string[];
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;

  constructor(message: string, result: AdminTaskResult) {
    super(message);
    this.name = 'AdminTaskExecutionError';
    this.command = result.command;
    this.args = result.args;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
    this.exitCode = result.exitCode;
  }
}

export async function runAdminTask(taskName: AdminTaskName): Promise<AdminTaskResult> {
  const task = TASKS[taskName];

  return new Promise((resolve, reject) => {
    const child = spawn(task.command, task.args, {
      cwd: process.cwd(),
      env: { ...process.env },
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      const result: AdminTaskResult = {
        command: task.command,
        args: task.args,
        stdout,
        stderr: stderr || error.message,
        exitCode: -1,
      };
      reject(new AdminTaskExecutionError(error.message, result));
    });

    child.on('close', code => {
      const result: AdminTaskResult = {
        command: task.command,
        args: task.args,
        stdout,
        stderr,
        exitCode: code ?? -1,
      };

      if (result.exitCode === 0) {
        resolve(result);
        return;
      }

      reject(
        new AdminTaskExecutionError(
          `Admin task failed: ${taskName} (exit code ${result.exitCode})`,
          result
        )
      );
    });
  });
}

