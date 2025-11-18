/**
 * Tests for appStore thinking messages and streaming functionality
 *
 * These tests verify:
 * - Thinking message management (add/update/remove)
 * - Message streaming (partial updates)
 * - Chat message updates
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../renderer/store/appStore';
describe('appStore - thinking messages and streaming', () => {
    beforeEach(() => {
        const store = useAppStore.getState();
        store.clearChatMessages();
    });
    describe('updateChatMessage', () => {
        it('should update existing chat message by id', () => {
            const store = useAppStore.getState();
            store.addChatMessage({
                id: 'msg-1',
                type: 'ai',
                content: 'Initial content',
                timestamp: new Date(),
            });
            store.updateChatMessage('msg-1', {
                content: 'Updated content',
            });
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages[0].content).toBe('Updated content');
        });
        it('should update multiple fields at once', () => {
            const store = useAppStore.getState();
            store.addChatMessage({
                id: 'msg-1',
                type: 'ai',
                content: 'Initial',
                timestamp: new Date(),
            });
            store.updateChatMessage('msg-1', {
                content: 'New content',
                isStreaming: true,
            });
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages[0].content).toBe('New content');
            expect(chatMessages[0].isStreaming).toBe(true);
        });
        it('should not update if message id does not exist', () => {
            const store = useAppStore.getState();
            store.addChatMessage({
                id: 'msg-1',
                type: 'ai',
                content: 'Content',
                timestamp: new Date(),
            });
            store.updateChatMessage('msg-999', {
                content: 'Should not update',
            });
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages[0].content).toBe('Content');
        });
    });
    describe('setThinkingMessage', () => {
        it('should add thinking message for a node', () => {
            const store = useAppStore.getState();
            store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...');
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(1);
            expect(chatMessages[0].type).toBe('ai');
            expect(chatMessages[0].content).toBe('Product Owner: タスクを分析中...');
            expect(chatMessages[0].isThinking).toBe(true);
            expect(chatMessages[0].nodeId).toBe('ProductOwnerNode');
        });
        it('should update existing thinking message for the same node', () => {
            const store = useAppStore.getState();
            store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...');
            store.setThinkingMessage('ProductOwnerNode', 'Product Owner', '要件を整理中...');
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(1);
            expect(chatMessages[0].content).toBe('Product Owner: 要件を整理中...');
        });
        it('should support multiple nodes thinking simultaneously', () => {
            const store = useAppStore.getState();
            store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...');
            store.setThinkingMessage('EngineerNode', 'Engineer', 'コードを実装中...');
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(2);
            expect(chatMessages[0].nodeId).toBe('ProductOwnerNode');
            expect(chatMessages[1].nodeId).toBe('EngineerNode');
        });
        it('should format message with label correctly', () => {
            const store = useAppStore.getState();
            store.setThinkingMessage('ProductOwnerNode', 'Product Owner', '処理中...');
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages[0].content).toBe('Product Owner: 処理中...');
        });
    });
    describe('clearThinkingMessage', () => {
        it('should remove thinking message for a specific node', () => {
            const store = useAppStore.getState();
            store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...');
            store.clearThinkingMessage('ProductOwnerNode');
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(0);
        });
        it('should only remove thinking message for specified node', () => {
            const store = useAppStore.getState();
            store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...');
            store.setThinkingMessage('EngineerNode', 'Engineer', 'コードを実装中...');
            store.clearThinkingMessage('ProductOwnerNode');
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(1);
            expect(chatMessages[0].nodeId).toBe('EngineerNode');
        });
        it('should do nothing if no thinking message exists for node', () => {
            const store = useAppStore.getState();
            store.addChatMessage({
                id: 'msg-1',
                type: 'user',
                content: 'Normal message',
                timestamp: new Date(),
            });
            store.clearThinkingMessage('ProductOwnerNode');
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(1);
        });
    });
    describe('Message streaming', () => {
        it('should mark message as streaming when content is being updated', () => {
            const store = useAppStore.getState();
            // Add initial streaming message
            store.addChatMessage({
                id: 'stream-1',
                type: 'ai',
                content: 'タスクの',
                timestamp: new Date(),
                isStreaming: true,
                nodeId: 'ProductOwnerNode',
            });
            // Update with more content
            store.updateChatMessage('stream-1', {
                content: 'タスクの分析が',
            });
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages[0].content).toBe('タスクの分析が');
            expect(chatMessages[0].isStreaming).toBe(true);
        });
        it('should finalize streaming message when complete', () => {
            const store = useAppStore.getState();
            store.addChatMessage({
                id: 'stream-1',
                type: 'ai',
                content: 'タスクの分析が',
                timestamp: new Date(),
                isStreaming: true,
            });
            store.updateChatMessage('stream-1', {
                content: 'タスクの分析が完了しました。',
                isStreaming: false,
            });
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages[0].content).toBe('タスクの分析が完了しました。');
            expect(chatMessages[0].isStreaming).toBe(false);
        });
    });
    describe('Integration: Thinking to final message flow', () => {
        it('should transition from thinking to streaming to final message', () => {
            const store = useAppStore.getState();
            // 1. Show thinking message
            store.setThinkingMessage('ProductOwnerNode', 'Product Owner', 'タスクを分析中...');
            let { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(1);
            expect(chatMessages[0].isThinking).toBe(true);
            // 2. Clear thinking and start streaming
            store.clearThinkingMessage('ProductOwnerNode');
            store.addChatMessage({
                id: 'final-msg',
                type: 'ai',
                content: 'タスクの',
                timestamp: new Date(),
                isStreaming: true,
                nodeId: 'ProductOwnerNode',
            });
            chatMessages = useAppStore.getState().chatMessages;
            expect(chatMessages).toHaveLength(1);
            expect(chatMessages[0].isThinking).toBeUndefined();
            expect(chatMessages[0].isStreaming).toBe(true);
            // 3. Update streaming content
            store.updateChatMessage('final-msg', {
                content: 'タスクの分析が完了しました。',
            });
            chatMessages = useAppStore.getState().chatMessages;
            expect(chatMessages[0].content).toBe('タスクの分析が完了しました。');
            // 4. Finalize
            store.updateChatMessage('final-msg', {
                isStreaming: false,
            });
            chatMessages = useAppStore.getState().chatMessages;
            expect(chatMessages[0].isStreaming).toBe(false);
        });
    });
});
//# sourceMappingURL=appStore.thinkingMessages.test.js.map