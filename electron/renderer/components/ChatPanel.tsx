/**
 * ChatPanel Component
 *
 * シンプルなチャット入力コンポーネント
 * ワークフローエディタと連携してプロンプトを送信する
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

/**
 * メッセージの型定義
 */
export interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'ai';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
  isStreaming?: boolean;
}

/**
 * ChatPanelのProps
 */
export interface ChatPanelProps {
  /** プロンプト送信時のコールバック */
  onSubmit: (prompt: string) => Promise<void>;
  /** 表示するメッセージ一覧 */
  messages: ChatMessage[];
  /** 実行中かどうか */
  isExecuting: boolean;
}

/**
 * ChatPanel - ワークフロー用チャット入力パネル
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  onSubmit,
  messages,
  isExecuting,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // プロンプト送信処理
  const handleSubmit = async () => {
    if (!prompt.trim() || isExecuting || isSubmitting) return;

    const currentPrompt = prompt;
    setPrompt('');
    setIsSubmitting(true);

    try {
      await onSubmit(currentPrompt);
    } finally {
      setIsSubmitting(false);
    }
  };

  // キーボードショートカット (Cmd/Ctrl+Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isDisabled = isExecuting || isSubmitting;

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold">チャット</h2>
      </div>

      {/* メッセージ一覧 */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p className="mb-2 text-sm">
                ワークフローを実行するにはプロンプトを入力してください
              </p>
              <p className="text-xs">
                例: "ユーザー認証機能を実装してください"
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  data-thinking={message.isThinking ? 'true' : undefined}
                  data-streaming={message.isStreaming ? 'true' : undefined}
                  className={`rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : message.type === 'system'
                        ? 'bg-yellow-500/10 border border-yellow-500/20'
                        : 'bg-green-500/10 border border-green-500/20'
                  } ${message.isThinking ? 'animate-pulse border-purple-500/50' : ''}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {message.type === 'user'
                        ? 'あなた'
                        : message.type === 'system'
                          ? 'システム'
                          : 'AI'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                    {message.isStreaming && (
                      <span className="inline-block ml-1 animate-pulse">▋</span>
                    )}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* ローディング表示 */}
      {isDisabled && (
        <div className="border-t border-border bg-muted/10 p-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">実行中...</p>
            </div>
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <div className="p-4">
        <div className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="プロンプトを入力... (Cmd/Ctrl+Enterで送信)"
            className="min-h-[100px] resize-none"
            disabled={isDisabled}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {isDisabled
                ? '実行中... 完了までお待ちください'
                : 'Cmd/Ctrl+Enter で送信'}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isDisabled}
              size="sm"
            >
              {isSubmitting || isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  実行中...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  送信
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
