import React, { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Folder, FolderOpen } from 'lucide-react'

declare const electronAPI: {
  getCurrentProjectPath: () => Promise<string | null>
  openProjectDialog: () => Promise<string | null>
  onProjectOpened: (callback: (data: { projectPath: string }) => void) => void
  onProjectClosed: (callback: () => void) => void
}

export const Toolbar: React.FC = () => {
  const { projectPath, setProjectPath } = useAppStore()
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    // 初期化時に現在のプロジェクトパスを取得
    electronAPI.getCurrentProjectPath().then((path) => {
      if (path) {
        setProjectPath(path)
      }
    })

    // プロジェクトが開かれたときのイベント
    electronAPI.onProjectOpened((data) => {
      setProjectPath(data.projectPath)
    })

    // プロジェクトが閉じられたときのイベント
    electronAPI.onProjectClosed(() => {
      setProjectPath(null)
    })
  }, [setProjectPath])

  const handleOpenProject = async () => {
    const path = await electronAPI.openProjectDialog()
    if (path) {
      setProjectPath(path)
    }
  }

  const getProjectName = (path: string | null): string => {
    if (!path) return 'No Project'
    return path.split('/').pop() || 'Unknown'
  }

  return (
    <div className="h-12 border-b border-gray-700 bg-gray-900 flex items-center px-4 gap-4">
      {/* プロジェクト情報 */}
      <div className="flex items-center gap-2 flex-1">
        {projectPath ? (
          <>
            <FolderOpen className="w-5 h-5 text-blue-400" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">
                {getProjectName(projectPath)}
              </span>
              <span className="text-xs text-gray-400 truncate max-w-md">
                {projectPath}
              </span>
            </div>
          </>
        ) : (
          <>
            <Folder className="w-5 h-5 text-gray-500" />
            <span className="text-sm text-gray-400">No project opened</span>
          </>
        )}
      </div>

      {/* Open Projectボタン */}
      <button
        onClick={handleOpenProject}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        className={`
          px-4 py-2 rounded-md text-sm font-medium
          transition-colors duration-200
          ${
            isHovering
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }
        `}
      >
        {projectPath ? 'Change Project' : 'Open Project'}
      </button>
    </div>
  )
}
