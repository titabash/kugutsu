import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../renderer/store/appStore';
describe('appStore - chatMessages', () => {
    beforeEach(() => {
        // Reset store state before each test
        const store = useAppStore.getState();
        store.clearChatMessages();
    });
    describe('addChatMessage', () => {
        it('should add a chat message to the store', () => {
            const store = useAppStore.getState();
            const message = {
                id: 'test-1',
                type: 'user',
                content: 'Hello, AI!',
                timestamp: new Date('2025-01-01T00:00:00Z'),
            };
            store.addChatMessage(message);
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(1);
            expect(chatMessages[0]).toEqual(message);
        });
        it('should add multiple chat messages', () => {
            const store = useAppStore.getState();
            const message1 = {
                id: 'test-1',
                type: 'user',
                content: 'First message',
                timestamp: new Date('2025-01-01T00:00:00Z'),
            };
            const message2 = {
                id: 'test-2',
                type: 'ai',
                content: 'Second message',
                timestamp: new Date('2025-01-01T00:01:00Z'),
            };
            store.addChatMessage(message1);
            store.addChatMessage(message2);
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(2);
            expect(chatMessages[0]).toEqual(message1);
            expect(chatMessages[1]).toEqual(message2);
        });
        it('should limit chatMessages to maxChatMessages (100)', () => {
            const store = useAppStore.getState();
            // Add 150 messages
            for (let i = 0; i < 150; i++) {
                store.addChatMessage({
                    id: `test-${i}`,
                    type: 'user',
                    content: `Message ${i}`,
                    timestamp: new Date(),
                });
            }
            const { chatMessages, maxChatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(maxChatMessages);
            expect(chatMessages).toHaveLength(100);
            // Check that oldest messages were removed
            expect(chatMessages[0].id).toBe('test-50');
            expect(chatMessages[99].id).toBe('test-149');
        });
    });
    describe('addChatMessages', () => {
        it('should add multiple chat messages at once', () => {
            const store = useAppStore.getState();
            const messages = [
                {
                    id: 'test-1',
                    type: 'user',
                    content: 'Message 1',
                    timestamp: new Date('2025-01-01T00:00:00Z'),
                },
                {
                    id: 'test-2',
                    type: 'ai',
                    content: 'Message 2',
                    timestamp: new Date('2025-01-01T00:01:00Z'),
                },
                {
                    id: 'test-3',
                    type: 'system',
                    content: 'Message 3',
                    timestamp: new Date('2025-01-01T00:02:00Z'),
                },
            ];
            store.addChatMessages(messages);
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(3);
            expect(chatMessages).toEqual(messages);
        });
        it('should enforce maxChatMessages limit when adding batch', () => {
            const store = useAppStore.getState();
            const messages = Array.from({ length: 120 }, (_, i) => ({
                id: `test-${i}`,
                type: 'user',
                content: `Message ${i}`,
                timestamp: new Date(),
            }));
            store.addChatMessages(messages);
            const { chatMessages, maxChatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(maxChatMessages);
            expect(chatMessages).toHaveLength(100);
        });
    });
    describe('clearChatMessages', () => {
        it('should clear all chat messages', () => {
            const store = useAppStore.getState();
            // Add some messages
            store.addChatMessage({
                id: 'test-1',
                type: 'user',
                content: 'Message 1',
                timestamp: new Date(),
            });
            store.addChatMessage({
                id: 'test-2',
                type: 'ai',
                content: 'Message 2',
                timestamp: new Date(),
            });
            expect(useAppStore.getState().chatMessages).toHaveLength(2);
            // Clear messages
            store.clearChatMessages();
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages).toHaveLength(0);
        });
    });
    describe('ChatMessage types', () => {
        it('should support user type messages', () => {
            const store = useAppStore.getState();
            const message = {
                id: 'test-1',
                type: 'user',
                content: 'User message',
                timestamp: new Date(),
            };
            store.addChatMessage(message);
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages[0].type).toBe('user');
        });
        it('should support ai type messages', () => {
            const store = useAppStore.getState();
            const message = {
                id: 'test-1',
                type: 'ai',
                content: 'AI message',
                timestamp: new Date(),
                nodeId: 'ProductOwnerNode',
            };
            store.addChatMessage(message);
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages[0].type).toBe('ai');
            expect(chatMessages[0].nodeId).toBe('ProductOwnerNode');
        });
        it('should support system type messages', () => {
            const store = useAppStore.getState();
            const message = {
                id: 'test-1',
                type: 'system',
                content: 'System message',
                timestamp: new Date(),
            };
            store.addChatMessage(message);
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages[0].type).toBe('system');
        });
        it('should support optional data field', () => {
            const store = useAppStore.getState();
            const message = {
                id: 'test-1',
                type: 'ai',
                content: 'AI message with data',
                timestamp: new Date(),
                data: {
                    tasks: ['task1', 'task2'],
                    count: 2,
                },
            };
            store.addChatMessage(message);
            const { chatMessages } = useAppStore.getState();
            expect(chatMessages[0].data).toEqual({
                tasks: ['task1', 'task2'],
                count: 2,
            });
        });
    });
});
//# sourceMappingURL=appStore.chatMessages.test.js.map