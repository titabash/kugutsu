import { BaseAI } from './BaseAI';
import { AgentConfig, Task, TaskAnalysisResult } from '../types';
import { ComponentType } from '../types/logging';
import { query } from '@anthropic-ai/claude-code';
import { TaskInstructionManager } from '../utils/TaskInstructionManager';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TechStackAnalyzerAI, TechStackAnalysisResult } from './TechStackAnalyzerAI';
import { RequirementsAnalyzerAI, RequirementsAnalysisResult } from './RequirementsAnalyzerAI';
import { TaskGeneratorAI, TaskGenerationResult } from './TaskGeneratorAI';

export class ProductOwnerAI extends BaseAI {
  private readonly config: AgentConfig;
  private readonly baseRepoPath: string;

  constructor(baseRepoPath: string, config?: Partial<AgentConfig>) {
    super();
    this.baseRepoPath = baseRepoPath;
    this.config = {
      systemPrompt: 'ProductOwnerAI統合コーディネーター',
      maxTurns: 50,
      allowedTools: ["Read", "Glob", "Grep", "LS", "Write"],
      ...config
    };
  }

  protected getComponentType(): ComponentType {
    return 'ProductOwner';
  }

  protected getId(): string {
    return 'ProductOwner-Coordinator';
  }

  /**
   * .kugutsuディレクトリのパスを取得
   */
  private getKugutsuDir(): string {
    return path.join(this.baseRepoPath, '.kugutsu');
  }

  /**
   * プロジェクトIDを生成
   */
  private generateProjectId(userRequest: string): string {
    // ユーザー要求から簡単なハッシュを生成
    const hash = userRequest.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '');
    return `project-${hash}-${Date.now()}`;
  }

  /**
   * ユーザからの要求を段階的に分析してタスクに分割し、指示ファイルを作成
   */
  async analyzeUserRequestWithInstructions(
    userRequest: string,
    instructionManager?: TaskInstructionManager
  ): Promise<TaskAnalysisResult> {
    this.info('🧠 段階的要求分析開始');

    // プロジェクトIDを生成
    const projectId = this.generateProjectId(userRequest);

    // instructionManagerが渡されていない場合は作成
    let localInstructionManager = instructionManager;
    if (!localInstructionManager) {
      localInstructionManager = new TaskInstructionManager(this.baseRepoPath, projectId);
    }

    // セッションIDを取得
    const sessionId = localInstructionManager.sessionId;

    // .kugutsuディレクトリとプロジェクトディレクトリを作成
    const projectsDir = path.join(this.getKugutsuDir(), 'projects', projectId);
    await fs.mkdir(projectsDir, { recursive: true });

    try {
      // 段階1: 技術スタック分析
      this.info('📊 段階1: 技術スタック分析');
      const techStackAnalyzer = new TechStackAnalyzerAI(this.baseRepoPath);
      const techStackResult = await techStackAnalyzer.analyzeTechStack(projectId, userRequest);

      // 段階2: 要件分析
      this.info('📋 段階2: 要件分析');
      const requirementsAnalyzer = new RequirementsAnalyzerAI(this.baseRepoPath);
      const requirementsResult = await requirementsAnalyzer.analyzeRequirements(userRequest, projectId, techStackResult);

      // 段階3: タスク生成
      this.info('🎯 段階3: タスク生成');
      const taskGenerator = new TaskGeneratorAI(this.baseRepoPath);
      const taskGenerationResult = await taskGenerator.generateTasks(userRequest, projectId, techStackResult, requirementsResult);

      // 従来のフォーマットに変換
      const result = await this.convertToTaskAnalysisResult(
        userRequest,
        projectId,
        sessionId,
        techStackResult,
        requirementsResult,
        taskGenerationResult
      );

      result.projectId = projectId;
      result.sessionId = sessionId;

      // 指示ファイルの作成
      for (const task of result.tasks) {
        await localInstructionManager.createTaskInstructionFile(task, task.description);
      }

      this.info(`✅ 段階的分析完了: ${result.tasks.length}個のタスクを生成`);
      return result;

    } catch (error) {
      this.error(`❌ 段階的分析でエラーが発生: ${error}`);
      throw error;
    }
  }

  /**
   * 各段階の結果を従来のTaskAnalysisResultに変換
   */
  private async convertToTaskAnalysisResult(
    userRequest: string,
    projectId: string,
    sessionId: string,
    techStackResult: TechStackAnalysisResult,
    requirementsResult: RequirementsAnalysisResult,
    taskGenerationResult: TaskGenerationResult
  ): Promise<TaskAnalysisResult> {
    // 従来のanalysis.jsonファイルを作成（他のコンポーネントとの互換性のため）
    const analysisData = {
      userRequest,
      projectId,
      sessionId,
      techStack: techStackResult,
      requirements: requirementsResult,
      tasks: taskGenerationResult.tasks.map(task => ({
        title: task.title,
        type: task.type,
        description: task.description,
        priority: task.priority,
        dependencies: task.dependencies || [],
        functionalRequirements: {
          userStories: requirementsResult.functionalRequirements.userStories,
          useCases: requirementsResult.functionalRequirements.useCases,
          businessRules: requirementsResult.functionalRequirements.businessRules
        },
        qualityRequirements: {
          usability: requirementsResult.nonFunctionalRequirements.usability,
          security: requirementsResult.nonFunctionalRequirements.security
        },
        integrationRequirements: requirementsResult.technicalRequirements.integrationPoints,
        acceptanceCriteria: requirementsResult.acceptanceCriteria,
        constraints: requirementsResult.constraints.technical
      }))
    };

    // analysis.jsonファイルを保存
    const analysisPath = path.join(this.getKugutsuDir(), 'projects', projectId, 'analysis.json');
    await fs.writeFile(analysisPath, JSON.stringify(analysisData, null, 2));

    // TaskAnalysisResultを構築
    return {
      tasks: taskGenerationResult.tasks,
      projectId,
      sessionId,
      summary: requirementsResult.userRequestSummary,
      riskAssessment: requirementsResult.riskAssessment?.join(', ') || 'N/A'
    };
  }

  /**
   * 既存のフェーズドキュメントを読み込み
   */
  private async loadPhaseDocument(projectId: string): Promise<any | null> {
    try {
      const phasePath = path.join(this.getKugutsuDir(), 'projects', projectId, `phase-${projectId}.json`);
      const content = await fs.readFile(phasePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * フェーズ情報の抽出（互換性のため）
   */
  private async extractPhaseInfoFromFile(projectId: string): Promise<any | null> {
    return null; // 段階的分析ではフェーズ管理を簡略化
  }

  /**
   * 技術スタック分析の実行
   */
  private async analyzeTechStack(): Promise<void> {
    // 新しいTechStackAnalyzerAIが処理するため、この関数は空実装
  }

  /**
   * 技術スタック情報の読み込み
   */
  private async loadTechStackMarkdown(): Promise<string> {
    try {
      const content = await fs.readFile(path.join(this.getKugutsuDir(), 'tech-stack-analysis.json'), 'utf-8');
      const analysis = JSON.parse(content);
      return `技術スタック: ${analysis.frameworks.join(', ')} (${analysis.primaryLanguages.join(', ')})`;
    } catch {
      return '技術スタック: 分析中';
    }
  }

  /**
   * メッセージアクティビティの表示
   */
  private displayMessageActivity(message: any): string {
    if (message.type === 'text') {
      return message.text;
    }
    return '';
  }
}