import { storageService } from '../../../services/storageService';

export interface ProjectTestDefinition {
  id: string;
  filePatterns: string[];
  command: string;
  args: string[];
  kind: 'REGRESSION' | 'BUILD' | 'UNIT';
  requiresDependencies: boolean;
  timeoutMs: number;
}

const KEY = 'miki_project_test_registry_v1';

export class ProjectTestRegistryService {
  private tests: ProjectTestDefinition[] = [];

  constructor() {
    this.load();
    if (!this.tests.length) this.seed();
  }

  public select(files: string[]): ProjectTestDefinition[] {
    return this.tests.filter((t) =>
      t.filePatterns.some((p) => files.some((f) => new RegExp(p).test(f)))
    );
  }

  public list(): ProjectTestDefinition[] {
    return this.tests.map((t) => ({ ...t, filePatterns: [...t.filePatterns], args: [...t.args] }));
  }

  private seed(): void {
    this.tests = [
      {
        id: 'typescript-typecheck',
        filePatterns: ['\\.tsx?$'],
        command: 'npm',
        args: ['run', 'lint'],
        kind: 'REGRESSION',
        requiresDependencies: true,
        timeoutMs: 180000,
      },
      {
        id: 'vite-server-build',
        filePatterns: ['^(src/|server\\.ts$|vite\\.config\\.ts$)'],
        command: 'npm',
        args: ['run', 'build'],
        kind: 'BUILD',
        requiresDependencies: true,
        timeoutMs: 300000,
      },
    ];
    this.save();
  }

  private load(): void {
    try {
      this.tests = JSON.parse(storageService.getItem(KEY) || '[]');
    } catch {
      this.tests = [];
    }
  }

  private save(): void {
    storageService.setItem(KEY, JSON.stringify(this.tests));
  }
}

export const projectTestRegistryService = new ProjectTestRegistryService();
