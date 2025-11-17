/**
 * NodeFlowBuilder のユニットテスト
 *
 * LangGraphワークフローのノードフロー情報生成機能のテスト
 */

import { describe, test, expect } from '@jest/globals';
import {
  buildUnifiedScrumWorkflowFlow,
  cloneNodeFlowData,
  resetNodeFlow,
} from '../../src/utils/NodeFlowBuilder.js';
import type { NodeFlowData, FlowNode } from '../../src/electron/StateStreamManager.js';

describe('NodeFlowBuilder', () => {
  describe('buildUnifiedScrumWorkflowFlow', () => {
    test('すべての必須ノードが含まれていること', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();

      // 必須ノードのリスト
      const requiredNodes = [
        '__start__',
        'analyze_complexity',
        'check_mode',
        'director_ai',
        'review_story_mapping',
        'tech_lead_design',
        'review_design',
        'task_breakdown',
        'product_owner',
        'sprint_planning',
        'instruction_generator_dispatch',
        'instruction_generator',
        'instruction_aggregator',
        'engineer_dispatch',
        'engineer',
        'engineer_aggregator',
        'review_dispatch',
        'review',
        'review_aggregator',
        'merge_coordinator',
        'conflict_resolver',
        'sprint_review',
        '__end__',
      ];

      const nodeIds = flowData.nodes.map((n) => n.id);
      requiredNodes.forEach((nodeId) => {
        expect(nodeIds).toContain(nodeId);
      });
    });

    test('開始ノードと終了ノードが正しく設定されていること', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();

      const startNode = flowData.nodes.find((n) => n.id === '__start__');
      const endNode = flowData.nodes.find((n) => n.id === '__end__');

      expect(startNode).toBeDefined();
      expect(startNode?.type).toBe('start');

      expect(endNode).toBeDefined();
      expect(endNode?.type).toBe('end');
    });

    test('すべてのノードの初期状態がpendingであること', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();

      flowData.nodes.forEach((node) => {
        expect(node.status).toBe('pending');
        expect(node.startedAt).toBeUndefined();
        expect(node.completedAt).toBeUndefined();
        expect(node.executionTime).toBeUndefined();
      });
    });

    test('エッジが正しく定義されていること', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();

      // 最低限のエッジ数を確認
      expect(flowData.edges.length).toBeGreaterThan(20);

      // 各エッジがsourceとtargetを持つこと
      flowData.edges.forEach((edge) => {
        expect(edge.source).toBeTruthy();
        expect(edge.target).toBeTruthy();
        expect(edge.id).toBeTruthy();
      });
    });

    test('高複雑度パスのエッジが存在すること', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();

      const directorEdge = flowData.edges.find(
        (e) => e.source === 'check_mode' && e.target === 'director_ai'
      );
      expect(directorEdge).toBeDefined();
      expect(directorEdge?.condition).toBe('高複雑度');
    });

    test('低複雑度パスのエッジが存在すること', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();

      const productOwnerEdge = flowData.edges.find(
        (e) => e.source === 'check_mode' && e.target === 'product_owner'
      );
      expect(productOwnerEdge).toBeDefined();
      expect(productOwnerEdge?.condition).toBe('低複雑度');
    });

    test('条件分岐エッジにラベルが付いていること', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();

      // review_story_mapping からの分岐
      const approvedEdge = flowData.edges.find(
        (e) =>
          e.source === 'review_story_mapping' && e.target === 'tech_lead_design'
      );
      expect(approvedEdge?.label).toBe('承認');

      const revisionEdge = flowData.edges.find(
        (e) =>
          e.source === 'review_story_mapping' && e.target === 'director_ai'
      );
      expect(revisionEdge?.label).toBe('修正要求');
    });
  });

  describe('cloneNodeFlowData', () => {
    test('ノードフローデータが正しく複製されること', () => {
      const original = buildUnifiedScrumWorkflowFlow();
      const cloned = cloneNodeFlowData(original);

      // 異なるオブジェクトであること
      expect(cloned).not.toBe(original);
      expect(cloned.nodes).not.toBe(original.nodes);
      expect(cloned.edges).not.toBe(original.edges);

      // 内容は同じであること
      expect(cloned.nodes.length).toBe(original.nodes.length);
      expect(cloned.edges.length).toBe(original.edges.length);
    });

    test('複製後の変更が元のデータに影響しないこと', () => {
      const original = buildUnifiedScrumWorkflowFlow();
      const cloned = cloneNodeFlowData(original);

      // 複製したデータを変更
      cloned.nodes[0].status = 'executing';
      cloned.nodes[0].startedAt = Date.now();

      // 元のデータは変更されていないこと
      expect(original.nodes[0].status).toBe('pending');
      expect(original.nodes[0].startedAt).toBeUndefined();
    });

    test('ネストされたプロパティも正しく複製されること', () => {
      const original = buildUnifiedScrumWorkflowFlow();
      const cloned = cloneNodeFlowData(original);

      // ノードのプロパティを変更
      if (cloned.nodes[0]) {
        cloned.nodes[0] = {
          ...cloned.nodes[0],
          executionTime: 1000,
        };
      }

      // 元のデータは変更されていないこと
      expect(original.nodes[0].executionTime).toBeUndefined();
    });
  });

  describe('resetNodeFlow', () => {
    test('すべてのノード状態がpendingにリセットされること', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();

      // いくつかのノードの状態を変更
      flowData.nodes[1].status = 'executing';
      flowData.nodes[1].startedAt = Date.now();
      flowData.nodes[2].status = 'completed';
      flowData.nodes[2].completedAt = Date.now();
      flowData.nodes[2].executionTime = 5000;

      const reset = resetNodeFlow(flowData);

      // __start__以外のすべてのノードがpendingにリセットされること
      reset.nodes.forEach((node) => {
        if (node.id !== '__start__') {
          expect(node.status).toBe('pending');
          expect(node.startedAt).toBeUndefined();
          expect(node.completedAt).toBeUndefined();
          expect(node.executionTime).toBeUndefined();
        }
      });
    });

    test('エッジ情報は変更されないこと', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();
      const reset = resetNodeFlow(flowData);

      expect(reset.edges.length).toBe(flowData.edges.length);
      expect(reset.edges).toEqual(flowData.edges);
    });

    test('リセット後も元のデータは変更されないこと', () => {
      const original = buildUnifiedScrumWorkflowFlow();

      // いくつかのノードの状態を変更
      original.nodes[1].status = 'executing';
      original.nodes[1].startedAt = Date.now();

      const reset = resetNodeFlow(original);

      // リセットされたデータのみが影響を受けること
      expect(reset.nodes[1].status).toBe('pending');
      expect(original.nodes[1].status).toBe('executing');
    });

    test('ノード数とエッジ数が保持されること', () => {
      const original = buildUnifiedScrumWorkflowFlow();
      const reset = resetNodeFlow(original);

      expect(reset.nodes.length).toBe(original.nodes.length);
      expect(reset.edges.length).toBe(original.edges.length);
    });
  });

  describe('データ整合性', () => {
    test('すべてのエッジのsourceノードが存在すること', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();
      const nodeIds = new Set(flowData.nodes.map((n) => n.id));

      flowData.edges.forEach((edge) => {
        expect(nodeIds.has(edge.source)).toBe(true);
      });
    });

    test('すべてのエッジのtargetノードが存在すること', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();
      const nodeIds = new Set(flowData.nodes.map((n) => n.id));

      flowData.edges.forEach((edge) => {
        expect(nodeIds.has(edge.target)).toBe(true);
      });
    });

    test('ノードIDが重複していないこと', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();
      const nodeIds = flowData.nodes.map((n) => n.id);
      const uniqueIds = new Set(nodeIds);

      expect(nodeIds.length).toBe(uniqueIds.size);
    });

    test('エッジIDが重複していないこと', () => {
      const flowData = buildUnifiedScrumWorkflowFlow();
      const edgeIds = flowData.edges.map((e) => e.id);
      const uniqueIds = new Set(edgeIds);

      expect(edgeIds.length).toBe(uniqueIds.size);
    });
  });
});
