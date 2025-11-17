import { useEffect } from 'react'
import { Header } from '@/components/Header'
import { Toolbar } from '@/components/Toolbar'
import { MainLayout } from '@/components/MainLayout'
import { BottomPanel } from '@/components/BottomPanel'
import { TaskKanbanBoard } from '@/components/TaskKanbanBoard'
import { LogViewer } from '@/components/LogViewer'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { PromptPanel } from '@/components/PromptPanel'
import { useElectronSync } from './hooks/useElectronSync'
import { useAppStore } from './store/appStore'

export default function App() {
  const { projectPath } = useAppStore()

  // Sync Electron IPC events with app store
  useElectronSync()

  // Log when app mounts
  useEffect(() => {
    console.log('[App] Kugutsu UI mounted')
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Toolbar */}
      <Toolbar />

      {/* Conditional Content */}
      {projectPath ? (
        <>
          {/* Header */}
          <Header />

          {/* Main Content */}
          <MainLayout
            leftPanel={<PromptPanel />}
            taskPanel={<TaskKanbanBoard />}
          />

          {/* Bottom Panel (Logs) */}
          <BottomPanel>
            <LogViewer />
          </BottomPanel>
        </>
      ) : (
        /* Welcome Screen */
        <WelcomeScreen />
      )}
    </div>
  )
}
