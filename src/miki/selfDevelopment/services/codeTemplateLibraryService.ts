import { storageService } from '../../../services/storageService';

export type CodeTemplateLanguage = 'typescript' | 'vba' | 'kotlin' | 'shell';
export interface CodeTemplateDefinition {
  id: string;
  language: CodeTemplateLanguage;
  purpose: string;
  status: 'SEED' | 'ANALYZED' | 'VERIFIED';
  template: string;
  invariants: string[];
  requiredEvidence: string[];
}
export interface TemplateResolution {
  matched: CodeTemplateDefinition[];
  missingCapabilities: string[];
  researchQuestions: string[];
}

const KEY = 'miki_code_template_library_v1';

/** 検証済み部品を作るための骨格。完成コードや成功証拠としては扱わない。 */
export class CodeTemplateLibraryService {
  private templates: CodeTemplateDefinition[] = [];
  constructor() { this.load(); }

  public resolve(language: CodeTemplateLanguage, purpose: string, requiredCapabilities: string[] = []): TemplateResolution {
    const words = purpose.toLowerCase().split(/[^a-z0-9_぀-ヿ㐀-鿿]+/).filter(Boolean);
    const matched = this.templates.filter((item) => item.language === language && words.some((word) => item.purpose.toLowerCase().includes(word)));
    const covered = new Set(matched.flatMap((item) => item.invariants));
    const missingCapabilities = requiredCapabilities.filter((capability) => !covered.has(capability));
    return {
      matched,
      missingCapabilities,
      researchQuestions: missingCapabilities.map((capability) => `能力「${capability}」を実装・検証するための公式仕様、既存部品、反例、実行証拠は何か`),
    };
  }

  public registerCandidate(template: CodeTemplateDefinition): boolean {
    if (template.status === 'VERIFIED' && template.requiredEvidence.length === 0) return false;
    const index = this.templates.findIndex((item) => item.id === template.id);
    if (index >= 0) this.templates[index] = template;
    else this.templates.push(template);
    this.save();
    return true;
  }

  public getAll(): CodeTemplateDefinition[] { return this.templates.map((item) => ({ ...item, invariants: [...item.invariants], requiredEvidence: [...item.requiredEvidence] })); }

  private load(): void {
    const seeds: CodeTemplateDefinition[] = [
      { id: 'ts.service', language: 'typescript', purpose: '状態を持つサービス', status: 'SEED', template: 'export class {{ServiceName}} {\n  public execute(input: {{InputType}}): {{OutputType}} {\n    {{BODY}}\n  }\n}\n', invariants: ['explicit_input', 'explicit_output', 'no_fixed_pass'], requiredEvidence: ['ts_parse', 'unit_test'] },
      { id: 'ts.api_route', language: 'typescript', purpose: '検証付きAPIルート', status: 'SEED', template: "app.post('{{PATH}}', async (req, res) => {\n  {{VALIDATE_INPUT}}\n  {{BODY}}\n});\n", invariants: ['validate_input', 'fail_closed'], requiredEvidence: ['ts_parse', 'route_test'] },
      { id: 'vba.full_module', language: 'vba', purpose: '標準モジュール全体', status: 'SEED', template: 'Option Explicit\n\nPublic Sub {{MACRO_NAME}}()\n    {{BODY}}\nEnd Sub\n', invariants: ['Option Explicit', 'block_if_only', 'no_goto', 'no_labels', 'full_module'], requiredEvidence: ['vba_static_verification', 'secondary_string_verification'] },
      { id: 'kotlin.capacitor_plugin', language: 'kotlin', purpose: 'Capacitor Native Plugin', status: 'SEED', template: '@CapacitorPlugin(name = "{{PLUGIN_NAME}}")\nclass {{CLASS_NAME}} : Plugin() {\n    {{BODY}}\n}\n', invariants: ['explicit_plugin_name', 'reject_on_failure'], requiredEvidence: ['kotlin_compile', 'android_contract', 'device_test'] },
      { id: 'shell.installer', language: 'shell', purpose: '再現可能な導入スクリプト', status: 'SEED', template: '#!/usr/bin/env bash\nset -euo pipefail\n{{BODY}}\n', invariants: ['fail_closed', 'pinned_version', 'hash_verification'], requiredEvidence: ['shell_parse', 'clean_install_test'] },
    ];
    try {
      const raw = storageService.getItem(KEY);
      const saved = raw ? JSON.parse(raw) : [];
      this.templates = Array.isArray(saved) && saved.length > 0 ? saved : seeds;
    } catch {
      this.templates = seeds;
    }
  }

  private save(): void { storageService.setItem(KEY, JSON.stringify(this.templates)); }
}

export const codeTemplateLibraryService = new CodeTemplateLibraryService();
