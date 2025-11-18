import React, { useState, useEffect, useRef } from 'react'
import { Send, Settings, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useAppStore } from '../store/appStore'
import type { ChatMessage } from '../types'

type AIProvider = 'claude' | 'codex' | 'mock'

declare const electronAPI: {
  executePrompt: (prompt: string, options: {
    provider?: AIProvider
    maxEngineers?: number
    maxTurns?: number
  }) => Promise<void>
}

export const PromptPanel: React.FC = () => {
  const [prompt, setPrompt] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [provider, setProvider] = useState<AIProvider>('mock')
  const [maxEngineers, setMaxEngineers] = useState(3)
  const [maxTurns, setMaxTurns] = useState(30)

  const { metadata, chatMessages, addChatMessage } = useAppStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async () => {
    if (!prompt.trim() || isExecuting) return

    // Add user message to chat
    addChatMessage({
      id: `${Date.now()}-${Math.random()}`,
      type: 'user',
      content: prompt,
      timestamp: new Date(),
    })

    const currentPrompt = prompt
    setPrompt('')
    setIsExecuting(true)

    try {
      await electronAPI.executePrompt(currentPrompt, {
        provider,
        maxEngineers,
        maxTurns
      })
    } catch (error) {
      addChatMessage({
        id: `${Date.now()}-${Math.random()}`,
        type: 'system',
        content: `エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        timestamp: new Date(),
      })
    } finally {
      setIsExecuting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold">プロンプト</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Settings Panel (collapsible) */}
      {showSettings && (
        <div className="border-b border-border bg-muted/20 p-4">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                AIプロバイダー
              </label>
              <RadioGroup
                value={provider}
                onValueChange={(value) => setProvider(value as AIProvider)}
                className="mt-2 space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="claude" id="provider-claude" />
                  <Label htmlFor="provider-claude" className="text-sm font-normal cursor-pointer">
                    Claude (Anthropic)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="codex" id="provider-codex" />
                  <Label htmlFor="provider-codex" className="text-sm font-normal cursor-pointer">
                    Codex (OpenAI)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mock" id="provider-mock" />
                  <Label htmlFor="provider-mock" className="text-sm font-normal cursor-pointer">
                    Mock (テスト用)
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                最大エンジニア数
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxEngineers}
                onChange={(e) => setMaxEngineers(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                最大ターン数
              </label>
              <input
                type="number"
                min="5"
                max="50"
                value={maxTurns}
                onChange={(e) => setMaxTurns(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {chatMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p className="mb-2 text-sm">
                AIエンジニアに指示を送信してください
              </p>
              <p className="text-xs">
                例: "ユーザー認証機能を実装してください"
              </p>
            </div>
          ) : (
            <>
              {chatMessages.map((message) => (
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
                        : 'Product Owner AI'}
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

      {/* Loading Spinner */}
      {metadata.isRunning && (
        <div
          className="border-t border-border bg-muted/10 p-3"
          data-loading-spinner="true"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">実行中...</p>
              {/* Show current thinking nodes */}
              {chatMessages.filter(msg => msg.isThinking).map(msg => (
                <p key={msg.id} className="text-xs text-muted-foreground">
                  {msg.content}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4">
        <div className="space-y-3">
          {/* Provider Selection */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              AIプロバイダー
            </label>
            <RadioGroup
              value={provider}
              onValueChange={(value) => setProvider(value as AIProvider)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="claude" id="provider-claude-main" />
                <Label htmlFor="provider-claude-main" className="text-sm font-normal cursor-pointer">
                  Claude
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="codex" id="provider-codex-main" />
                <Label htmlFor="provider-codex-main" className="text-sm font-normal cursor-pointer">
                  Codex
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mock" id="provider-mock-main" />
                <Label htmlFor="provider-mock-main" className="text-sm font-normal cursor-pointer">
                  Mock
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AIに指示を入力... (Cmd/Ctrl+Enterで送信)"
            className="min-h-[100px] resize-none"
            disabled={isExecuting || metadata.isRunning}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {metadata.isRunning
                ? '実行中... 完了までお待ちください'
                : 'Cmd/Ctrl+Enter で送信'}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isExecuting || metadata.isRunning}
              size="sm"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  送信中...
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
  )
}
