import React from 'react'
import { Folder, GitBranch, Users, Zap } from 'lucide-react'

declare const electronAPI: {
  openProjectDialog: () => Promise<string | null>
}

export const WelcomeScreen: React.FC = () => {
  const handleOpenProject = async () => {
    await electronAPI.openProjectDialog()
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-900">
      <div className="max-w-2xl mx-auto text-center px-8">
        {/* Logo/Title */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">
            🤖 Kugutsu
          </h1>
          <p className="text-xl text-gray-400">
            AI-Powered Parallel Development System
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          <div className="bg-gray-800 rounded-lg p-6">
            <Users className="w-8 h-8 text-blue-400 mb-3 mx-auto" />
            <h3 className="text-white font-semibold mb-2">Multiple AI Engineers</h3>
            <p className="text-sm text-gray-400">
              Work on multiple tasks simultaneously with AI-powered engineers
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <GitBranch className="w-8 h-8 text-green-400 mb-3 mx-auto" />
            <h3 className="text-white font-semibold mb-2">Git Worktree Isolation</h3>
            <p className="text-sm text-gray-400">
              Each task runs in isolated git worktree for parallel development
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <Zap className="w-8 h-8 text-yellow-400 mb-3 mx-auto" />
            <h3 className="text-white font-semibold mb-2">Automated Review</h3>
            <p className="text-sm text-gray-400">
              AI-powered code review and intelligent conflict resolution
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <Folder className="w-8 h-8 text-purple-400 mb-3 mx-auto" />
            <h3 className="text-white font-semibold mb-2">Task Orchestration</h3>
            <p className="text-sm text-gray-400">
              Automatic task decomposition and dependency management
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="space-y-4">
          <button
            onClick={handleOpenProject}
            className="w-full max-w-md mx-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-lg transition-colors duration-200 flex items-center justify-center gap-3"
          >
            <Folder className="w-5 h-5" />
            Open Project
          </button>

          <p className="text-sm text-gray-500">
            Select a Git repository to get started
          </p>
        </div>

        {/* Version */}
        <div className="mt-12 text-xs text-gray-600">
          Powered by Claude Code SDK
        </div>
      </div>
    </div>
  )
}
