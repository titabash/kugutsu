import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useElectronSync } from '../renderer/hooks/useElectronSync';
import { useAppStore } from '../renderer/store/appStore';
describe('useElectronSync - chatMessages', () => {
    let mockElectronAPI;
    let graphEventsBatchCallback = null;
    beforeEach(() => {
        // Reset store
        const store = useAppStore.getState();
        store.clearChatMessages();
        // Mock window.electronAPI
        graphEventsBatchCallback = null;
        mockElectronAPI = {
            onGraphEventsBatch: vi.fn((callback) => {
                graphEventsBatchCallback = callback;
                return () => {
                    graphEventsBatchCallback = null;
                };
            }),
            onInitialDataLoaded: vi.fn(() => () => { }),
            onFileChanged: vi.fn(() => () => { }),
            onNodeFlowInit: vi.fn(() => () => { }),
            onNodeStatusChange: vi.fn(() => () => { }),
            getGraphState: vi.fn(() => Promise.resolve(null)),
        };
        // @ts-ignore - Mock window.electronAPI
        global.window = global.window || {};
        // @ts-ignore
        global.window.electronAPI = mockElectronAPI;
    });
    describe('state-init event', () => {
        it('should add system message when state-init event is received', async () => {
            renderHook(() => useElectronSync());
            // Simulate state-init event
            const event = {
                type: 'state-init',
                timestamp: Date.now(),
                data: {
                    tasks: [],
                    metadata: {
                        phase: 'initializing',
                        totalTasks: 0,
                        tasksCompleted: 0,
                        tasksFailed: 0,
                        hasErrors: false,
                    },
                },
            };
            await act(async () => {
                graphEventsBatchCallback([event]);
            });
            await waitFor(() => {
                const { chatMessages } = useAppStore.getState();
                expect(chatMessages).toHaveLength(1);
                expect(chatMessages[0].type).toBe('system');
                expect(chatMessages[0].content).toBe('AIエージェントの実行を開始しました');
            });
        });
    });
    describe('node-started event for ProductOwner', () => {
        it('should add thinking message when ProductOwnerNode starts', async () => {
            renderHook(() => useElectronSync());
            const event = {
                type: 'node-started',
                timestamp: Date.now(),
                data: {
                    nodeId: 'ProductOwnerNode',
                },
            };
            graphEventsBatchCallback([event]);
            await waitFor(() => {
                const { chatMessages } = useAppStore.getState();
                expect(chatMessages).toHaveLength(1);
                expect(chatMessages[0].type).toBe('ai');
                expect(chatMessages[0].content).toBe('Product Owner: タスクを分析中...');
                expect(chatMessages[0].nodeId).toBe('ProductOwnerNode');
                expect(chatMessages[0].isThinking).toBe(true);
            });
        });
        it('should not add message for unimportant nodes', async () => {
            renderHook(() => useElectronSync());
            const event = {
                type: 'node-started',
                timestamp: Date.now(),
                data: {
                    nodeId: 'TaskBreakdownNode', // Unimportant node
                },
            };
            graphEventsBatchCallback([event]);
            await waitFor(() => {
                const { chatMessages } = useAppStore.getState();
                expect(chatMessages).toHaveLength(0);
            }, { timeout: 500 });
        });
    });
    describe('node-completed event for ProductOwner', () => {
        it('should add AI message with task results when ProductOwnerNode completes', async () => {
            renderHook(() => useElectronSync());
            const event = {
                type: 'node-completed',
                timestamp: Date.now(),
                data: {
                    nodeId: 'ProductOwnerNode',
                    startedAt: Date.now() - 5000,
                    result: {
                        tasks: [
                            { id: '1', title: 'Task 1' },
                            { id: '2', title: 'Task 2' },
                            { id: '3', title: 'Task 3' },
                        ],
                    },
                },
            };
            graphEventsBatchCallback([event]);
            await waitFor(() => {
                const { chatMessages } = useAppStore.getState();
                expect(chatMessages).toHaveLength(1);
                expect(chatMessages[0].type).toBe('ai');
                expect(chatMessages[0].content).toContain('タスクの分析が完了しました');
                expect(chatMessages[0].content).toContain('3個のタスクを作成しました');
                expect(chatMessages[0].content).toContain('Task 1');
                expect(chatMessages[0].content).toContain('Task 2');
                expect(chatMessages[0].content).toContain('Task 3');
            });
        });
        it('should show "他X個" when there are more than 3 tasks', async () => {
            renderHook(() => useElectronSync());
            const tasks = Array.from({ length: 10 }, (_, i) => ({
                id: `${i + 1}`,
                title: `Task ${i + 1}`,
            }));
            const event = {
                type: 'node-completed',
                timestamp: Date.now(),
                data: {
                    nodeId: 'ProductOwnerNode',
                    result: {
                        tasks,
                    },
                },
            };
            graphEventsBatchCallback([event]);
            await waitFor(() => {
                const { chatMessages } = useAppStore.getState();
                expect(chatMessages).toHaveLength(1);
                expect(chatMessages[0].content).toContain('10個のタスクを作成しました');
                expect(chatMessages[0].content).toContain('...他7個');
            });
        });
        it('should use result.message if tasks are not present', async () => {
            renderHook(() => useElectronSync());
            const event = {
                type: 'node-completed',
                timestamp: Date.now(),
                data: {
                    nodeId: 'ProductOwnerNode',
                    result: {
                        message: 'Custom message from ProductOwner',
                    },
                },
            };
            graphEventsBatchCallback([event]);
            await waitFor(() => {
                const { chatMessages } = useAppStore.getState();
                expect(chatMessages).toHaveLength(1);
                expect(chatMessages[0].content).toBe('Custom message from ProductOwner');
            });
        });
        it('should not add message for unimportant nodes', async () => {
            renderHook(() => useElectronSync());
            const event = {
                type: 'node-completed',
                timestamp: Date.now(),
                data: {
                    nodeId: 'TaskBreakdownNode', // Unimportant node
                    result: {},
                },
            };
            graphEventsBatchCallback([event]);
            await waitFor(() => {
                const { chatMessages } = useAppStore.getState();
                expect(chatMessages).toHaveLength(0);
            }, { timeout: 500 });
        });
        it('should not add message if result is missing', async () => {
            renderHook(() => useElectronSync());
            const event = {
                type: 'node-completed',
                timestamp: Date.now(),
                data: {
                    nodeId: 'ProductOwnerNode',
                },
            };
            graphEventsBatchCallback([event]);
            await waitFor(() => {
                const { chatMessages } = useAppStore.getState();
                expect(chatMessages).toHaveLength(0);
            }, { timeout: 500 });
        });
    });
    describe('Integration: full flow', () => {
        it('should add messages in correct order for complete ProductOwner flow', async () => {
            renderHook(() => useElectronSync());
            // 1. State init
            graphEventsBatchCallback([
                {
                    type: 'state-init',
                    timestamp: Date.now(),
                    data: { tasks: [], metadata: { phase: 'initializing' } },
                },
            ]);
            // 2. ProductOwner starts
            graphEventsBatchCallback([
                {
                    type: 'node-started',
                    timestamp: Date.now(),
                    data: { nodeId: 'ProductOwnerNode' },
                },
            ]);
            // 3. ProductOwner completes
            graphEventsBatchCallback([
                {
                    type: 'node-completed',
                    timestamp: Date.now(),
                    data: {
                        nodeId: 'ProductOwnerNode',
                        result: {
                            tasks: [{ id: '1', title: 'Test Task' }],
                        },
                    },
                },
            ]);
            await waitFor(() => {
                const { chatMessages } = useAppStore.getState();
                // After completion, thinking message is cleared, so we have:
                // 1. System message (実行を開始)
                // 2. Completion message (分析が完了)
                expect(chatMessages).toHaveLength(2);
                // Check message order and content
                expect(chatMessages[0].type).toBe('system');
                expect(chatMessages[0].content).toContain('実行を開始');
                expect(chatMessages[1].type).toBe('ai');
                expect(chatMessages[1].content).toContain('分析が完了');
                expect(chatMessages[1].isThinking).toBeUndefined(); // No longer thinking
            });
        });
    });
});
//# sourceMappingURL=useElectronSync.chatMessages.test.js.map