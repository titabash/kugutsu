import { BaseAI } from './BaseAI';
import { query } from '@anthropic-ai/claude-code';
import * as fs from 'fs/promises';
import * as path from 'path';
export class TechStackAnalyzerAI extends BaseAI {
    config;
    baseRepoPath;
    constructor(baseRepoPath, config) {
        super();
        this.baseRepoPath = baseRepoPath;
        this.config = {
            systemPrompt: this.getSystemPrompt(),
            maxTurns: 50,
            allowedTools: ["Read", "Glob", "Grep", "LS", "Write"],
            ...config
        };
    }
    getComponentType() {
        return 'ProductOwner';
    }
    getId() {
        return 'TechStackAnalyzer';
    }
    getSystemPrompt() {
        return `あなたは技術スタック分析の専門家です。
プロジェクトの技術構成を正確に分析し、開発に必要な技術情報を整理することが専門です。

## 🎯 専門責務
- プロジェクト構造の詳細分析
- 使用技術スタックの特定
- 開発環境・ツールの把握
- 技術的制約の抽出
- 開発コマンドの調査

## 🔧 分析アプローチ
1. **ファイル構造分析**: package.json, requirements.txt, pom.xml等の設定ファイルを調査
2. **コードベース分析**: 実際のソースコードから使用技術を特定
3. **ビルドツール分析**: ビルド・テスト・デプロイの仕組みを理解
4. **依存関係分析**: 外部ライブラリ・フレームワークの把握
5. **アーキテクチャパターン分析**: MVC, Clean Architecture等のパターンを特定

## 📊 成果物要求
分析完了後、以下の形式のJSONファイルを作成してください：

**保存先**: .kugutsu/tech-stack-analysis.json

\`\`\`json
{
  "projectType": "web-application|mobile-app|desktop-app|library|api-service",
  "primaryLanguages": ["TypeScript", "JavaScript"],
  "frameworks": ["React", "Node.js", "Express"],
  "buildTools": ["webpack", "vite", "rollup"],
  "packageManager": "npm|yarn|pnpm",
  "databaseType": "MongoDB|PostgreSQL|MySQL|SQLite|Redis",
  "deploymentPlatform": "Vercel|AWS|Docker|Heroku",
  "testingFrameworks": ["Jest", "Cypress", "Vitest"],
  "architecturePattern": "MVC|Clean Architecture|Layered|Microservices",
  "constraints": ["使用可能なツール制限", "環境制約"],
  "developmentCommands": {
    "install": "npm install",
    "build": "npm run build",
    "test": "npm test",
    "dev": "npm run dev"
  },
  "recommendation": "この技術スタックでの開発推奨事項"
}
\`\`\`

## 🚨 重要注意点
- 推測ではなく実際のファイル内容に基づいて分析
- 不明な場合は「不明」と明記
- 技術選択の理由は推測しない
- 現在の構成のみを報告（改善提案は行わない）
`;
    }
    async analyzeTechStack(projectId, userRequest) {
        this.info('🔍 技術スタック分析開始');
        // .kugutsuディレクトリを作成
        const kugutsuDir = path.join(this.baseRepoPath, '.kugutsu');
        await fs.mkdir(kugutsuDir, { recursive: true });
        const analysisPath = path.join(kugutsuDir, 'tech-stack-analysis.json');
        // 既存の分析結果をチェック
        try {
            await fs.access(analysisPath);
            const existingContent = await fs.readFile(analysisPath, 'utf-8');
            const existingResult = JSON.parse(existingContent);
            // プロジェクトの変更を検出
            const hasChanged = await this.detectProjectChanges();
            if (!hasChanged) {
                this.info('📋 既存の技術スタック分析を使用します');
                return await this.convertDetailedAnalysisToExpectedFormat(existingResult);
            }
            this.info('🔄 プロジェクト構造の変更を検出。再分析を実行します');
        }
        catch {
            this.info('🆕 新規技術スタック分析を実行します');
        }
        const prompt = await this.buildAnalysisPrompt(projectId, userRequest);
        this.info('🔄 TechStackAnalyzerAI query開始');
        const messages = [];
        for await (const message of query({
            prompt,
            abortController: new AbortController(),
            options: {
                maxTurns: this.config.maxTurns,
                cwd: this.baseRepoPath,
                allowedTools: this.config.allowedTools,
            },
        })) {
            messages.push(message);
            // Claude Code SDKのメッセージを表示
            if (message) {
                const content = message.message?.content || message;
                // tool_resultタイプの場合は簡略化
                if (Array.isArray(content) && content.some(item => item?.type === 'tool_result')) {
                    this.info(`Type: ${message.type}, Content: [tool_result - 簡略化]`);
                }
                else {
                    this.info(`Type: ${message.type}, Content: ${JSON.stringify(content)}`);
                }
            }
        }
        this.info('🔄 TechStackAnalyzerAI query完了');
        // 分析結果を読み込み
        this.info('📄 分析結果を読み込み中...');
        const result = await this.loadAnalysisResult(analysisPath);
        const languages = result.primaryLanguages && Array.isArray(result.primaryLanguages) ? result.primaryLanguages.join(', ') : '不明';
        this.info(`✅ 技術スタック分析完了: ${languages}`);
        return result;
    }
    async buildAnalysisPrompt(projectId, userRequest) {
        const projectStructure = await this.gatherProjectStructure();
        // ユーザーリクエストから技術スタックのヒントを抽出
        const userTechHints = userRequest ? await this.extractTechHintsFromUserRequest(userRequest) : null;
        let prompt = `プロジェクト構造を分析して技術スタック情報を特定してください。

## 📂 プロジェクト構造
${projectStructure}`;
        if (userTechHints) {
            prompt += `

## 🎯 ユーザーリクエストからの技術スタックヒント
${userTechHints}

**重要**: 既存のプロジェクト構造を優先し、ユーザーリクエストは補完的な情報として活用してください。`;
        }
        prompt += `

## 🔍 分析タスク
1. 設定ファイル（package.json, requirements.txt等）の詳細分析
2. ソースコードから使用技術の特定`;
        return prompt + `
3. ビルドツール・開発環境の調査
4. 依存関係の分析
5. アーキテクチャパターンの特定

## 📊 成果物作成
分析完了後、必ず .kugutsu/tech-stack-analysis.json ファイルを作成してください。

プロジェクトID: ${projectId}
`;
    }
    async gatherProjectStructure() {
        this.info('🔍 AIによるプロジェクト構造分析開始');
        const prompt = `プロジェクト構造を分析してください。

## 📂 分析タスク
1. **設定ファイル特定**: プロジェクトに存在する設定ファイルを特定し、その内容を分析
2. **ディレクトリ構造分析**: 主要なディレクトリとその役割を分析
3. **重要ファイル特定**: 技術スタック判定に重要なファイルを特定
4. **パッケージ管理**: 依存関係管理方法を特定
5. **ビルド設定**: ビルドやテストの設定を特定

## 🎯 出力形式
分析結果を以下の形式で出力してください：

\`\`\`
📄 設定ファイル:
- package.json: [存在/不存在] - [内容概要]
- requirements.txt: [存在/不存在] - [内容概要]
...

📁 主要ディレクトリ:
- src/: [説明]
- tests/: [説明]
...

📄 重要ファイル:
- README.md: [存在/不存在] - [内容概要]
- tsconfig.json: [存在/不存在] - [内容概要]
...

🔧 技術スタック判定のポイント:
- [判定に重要な要素1]
- [判定に重要な要素2]
...
\`\`\`

**重要**: 推測ではなく実際のファイル内容に基づいて分析してください。`;
        const messages = [];
        for await (const message of query({
            prompt,
            abortController: new AbortController(),
            options: {
                maxTurns: 10,
                cwd: this.baseRepoPath,
                allowedTools: ["Read", "Glob", "Grep", "LS"],
            },
        })) {
            messages.push(message);
            if (message) {
                const content = message.message?.content || message;
                // tool_resultタイプの場合は簡略化
                if (Array.isArray(content) && content.some(item => item?.type === 'tool_result')) {
                    this.info(`Type: ${message.type}, Content: [tool_result - 簡略化]`);
                }
                else {
                    this.info(`Type: ${message.type}, Content: ${JSON.stringify(content)}`);
                }
            }
        }
        // 全メッセージから分析結果を取得
        let analysisResult = '';
        for (const message of messages) {
            if (message && message.type === 'assistant') {
                const content = message.message?.content;
                if (content && Array.isArray(content)) {
                    const textContent = content
                        .filter(item => item && typeof item === 'object' && item.type === 'text')
                        .map(item => item.text)
                        .join(' ');
                    if (textContent) {
                        analysisResult += textContent + '\n';
                    }
                }
            }
        }
        return analysisResult || 'プロジェクト構造分析に失敗しました';
    }
    // isImportantFile は不要（AI が判断）
    async detectProjectChanges() {
        // 簡単な変更検出（実際の実装では最終更新時刻等を比較）
        return false;
    }
    async loadAnalysisResult(analysisPath) {
        try {
            const content = await fs.readFile(analysisPath, 'utf-8');
            const result = JSON.parse(content);
            // AI生成の詳細分析結果を期待される形式に変換
            const convertedResult = await this.convertDetailedAnalysisToExpectedFormat(result);
            return convertedResult;
        }
        catch (error) {
            this.error(`技術スタック分析結果の読み込みに失敗: ${error}`);
            // デフォルト値を返す
            return this.getDefaultTechStackResult();
        }
    }
    async convertDetailedAnalysisToExpectedFormat(result) {
        // 主要言語の抽出
        const primaryLanguages = await this.extractPrimaryLanguages(result);
        // フレームワークの抽出
        const frameworks = await this.extractFrameworks(result);
        // ビルドツールの抽出
        const buildTools = await this.extractBuildTools(result);
        // テストフレームワークの抽出
        const testingFrameworks = await this.extractTestingFrameworks(result);
        // パッケージマネージャーの抽出
        const packageManager = await this.extractPackageManager(result);
        // アーキテクチャパターンの抽出
        const architecturePattern = await this.extractArchitecturePattern(result);
        // 開発コマンドの抽出
        const developmentCommands = await this.extractDevelopmentCommands(result);
        return {
            projectType: result.projectStructure?.type || result.projectType || 'unknown',
            primaryLanguages,
            frameworks,
            buildTools,
            packageManager,
            testingFrameworks,
            architecturePattern,
            constraints: result.riskFactors?.map((risk) => risk.description) || [],
            developmentCommands,
            recommendation: result.recommendedImprovements?.[0]?.description || '',
            databaseType: result.databaseType,
            deploymentPlatform: result.deploymentPlatform
        };
    }
    async extractPrimaryLanguages(result) {
        if (result.primaryLanguages && Array.isArray(result.primaryLanguages)) {
            return result.primaryLanguages;
        }
        if (result.coreLanguages && Array.isArray(result.coreLanguages)) {
            return result.coreLanguages
                .filter((lang) => lang.usage === 'primary' || lang.percentage > 50)
                .map((lang) => lang.name);
        }
        // AIに判断させる
        return await this.askAIForTechStackInference('primaryLanguages', result);
    }
    async extractFrameworks(result) {
        if (result.frameworks && Array.isArray(result.frameworks)) {
            return result.frameworks;
        }
        const frameworks = [];
        // UI フレームワーク
        if (result.uiFrameworks && Array.isArray(result.uiFrameworks)) {
            frameworks.push(...result.uiFrameworks.map((fw) => fw.name));
        }
        // コア依存関係からフレームワークを抽出
        if (result.coreDependencies && Array.isArray(result.coreDependencies)) {
            result.coreDependencies
                .filter((dep) => dep.type === 'framework')
                .forEach((dep) => frameworks.push(dep.name));
        }
        return frameworks.length > 0 ? frameworks : await this.askAIForTechStackInference('frameworks', result);
    }
    async extractBuildTools(result) {
        if (result.buildTools && Array.isArray(result.buildTools)) {
            if (typeof result.buildTools[0] === 'string') {
                return result.buildTools;
            }
            return result.buildTools.map((tool) => tool.name);
        }
        return await this.askAIForTechStackInference('buildTools', result);
    }
    async extractTestingFrameworks(result) {
        if (result.testingFrameworks && Array.isArray(result.testingFrameworks)) {
            return result.testingFrameworks;
        }
        if (result.testingFramework) {
            return [result.testingFramework.name];
        }
        return await this.askAIForTechStackInference('testingFrameworks', result);
    }
    async extractPackageManager(result) {
        if (result.packageManager) {
            if (typeof result.packageManager === 'string') {
                return result.packageManager;
            }
            return result.packageManager.name;
        }
        const result_array = await this.askAIForTechStackInference('packageManager', result);
        return result_array[0] || 'npm';
    }
    async extractArchitecturePattern(result) {
        if (result.architecturePattern) {
            return result.architecturePattern;
        }
        if (result.architecturalPatterns && Array.isArray(result.architecturalPatterns)) {
            return result.architecturalPatterns.map((pattern) => pattern.name).join(', ');
        }
        const result_array = await this.askAIForTechStackInference('architecturePattern', result);
        return result_array[0] || 'unknown';
    }
    async extractDevelopmentCommands(result) {
        if (result.developmentCommands) {
            return result.developmentCommands;
        }
        // AIに判断させる
        return await this.askAIForDevelopmentCommands(result);
    }
    getDefaultTechStackResult() {
        return {
            projectType: 'unknown',
            primaryLanguages: [],
            frameworks: [],
            buildTools: [],
            packageManager: 'unknown',
            testingFrameworks: [],
            architecturePattern: 'unknown',
            constraints: [],
            developmentCommands: {
                install: '',
                build: '',
                test: '',
                dev: ''
            },
            recommendation: 'AI分析が失敗しました'
        };
    }
    async extractTechHintsFromUserRequest(userRequest) {
        // AIに技術スタックのヒント抽出を任せる
        return await this.askAIForTechStackHints(userRequest);
    }
    async askAIForTechStackInference(category, result) {
        const prompt = `プロジェクトの技術スタック分析結果から${category}を推定してください。

## 分析結果
${JSON.stringify(result, null, 2)}

## 推定対象
${category}

## 指示
- 分析結果から適切な${category}を推定してください
- 結果は配列形式で返してください
- 推測で補完してください（空配列は返さないで）
- 簡潔な回答をお願いします`;
        try {
            const messages = [];
            for await (const message of query({
                prompt,
                abortController: new AbortController(),
                options: {
                    maxTurns: 3,
                    cwd: this.baseRepoPath,
                    allowedTools: ["Read", "Glob"],
                },
            })) {
                messages.push(message);
            }
            const lastMessage = messages[messages.length - 1];
            const content = lastMessage?.message?.content || lastMessage?.content || '';
            // JSONの配列を抽出
            const jsonMatch = content.match(/\[.*\]/s);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                }
                catch {
                    // JSON解析に失敗した場合は文字列を配列に変換
                    return content.split(',').map((item) => item.trim().replace(/["\[\]]/g, ''));
                }
            }
            return [content.trim()];
        }
        catch (error) {
            this.error(`AI技術スタック推定エラー: ${error}`);
            return ['unknown'];
        }
    }
    async askAIForDevelopmentCommands(result) {
        const prompt = `プロジェクトの技術スタック分析結果から適切な開発コマンドを推定してください。

## 分析結果
${JSON.stringify(result, null, 2)}

## 指示
- install, build, test, devコマンドを推定してください
- パッケージマネージャーや技術スタックに適したコマンドを提案してください
- 結果はJSON形式で返してください: {"install": "...", "build": "...", "test": "...", "dev": "..."}`;
        try {
            const messages = [];
            for await (const message of query({
                prompt,
                abortController: new AbortController(),
                options: {
                    maxTurns: 3,
                    cwd: this.baseRepoPath,
                    allowedTools: ["Read", "Glob"],
                },
            })) {
                messages.push(message);
            }
            const lastMessage = messages[messages.length - 1];
            const content = lastMessage?.message?.content || lastMessage?.content || '';
            // JSONオブジェクトを抽出
            const jsonMatch = content.match(/\{.*\}/s);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                }
                catch {
                    // JSON解析失敗時のフォールバック
                    return {
                        install: 'npm install',
                        build: 'npm run build',
                        test: 'npm test',
                        dev: 'npm run dev'
                    };
                }
            }
            return {
                install: 'npm install',
                build: 'npm run build',
                test: 'npm test',
                dev: 'npm run dev'
            };
        }
        catch (error) {
            this.error(`AI開発コマンド推定エラー: ${error}`);
            return {
                install: 'npm install',
                build: 'npm run build',
                test: 'npm test',
                dev: 'npm run dev'
            };
        }
    }
    async askAIForTechStackHints(userRequest) {
        const prompt = `ユーザーリクエストから技術スタックのヒントを抽出してください。

## ユーザーリクエスト
${userRequest}

## 指示
- 技術名（言語、フレームワーク、データベース、クラウドサービス等）を検出してください
- 開発パターン（API開発、フロントエンド、テスト等）を検出してください
- 検出されたヒントを「- 項目: 内容」形式で返してください
- 何も検出されない場合は「技術スタックのヒントは検出されませんでした」と返してください`;
        try {
            const messages = [];
            for await (const message of query({
                prompt,
                abortController: new AbortController(),
                options: {
                    maxTurns: 3,
                    cwd: this.baseRepoPath,
                    allowedTools: [],
                },
            })) {
                messages.push(message);
            }
            const lastMessage = messages[messages.length - 1];
            return lastMessage?.message?.content || lastMessage?.content || '技術スタックのヒントは検出されませんでした';
        }
        catch (error) {
            this.error(`AI技術スタックヒント抽出エラー: ${error}`);
            return '技術スタックのヒントは検出されませんでした';
        }
    }
}
//# sourceMappingURL=TechStackAnalyzerAI.js.map