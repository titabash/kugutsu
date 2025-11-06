import { useEffect } from 'react'
import { Header } from '@/components/Header'
import { MainLayout } from '@/components/MainLayout'
import { BottomPanel } from '@/components/BottomPanel'
import { GraphVisualization } from '@/components/GraphVisualization'
import { TaskKanbanBoard } from '@/components/TaskKanbanBoard'
import { LogViewer } from '@/components/LogViewer'
import { useElectronSync } from './hooks/useElectronSync'

export default function App() {
  // Sync Electron IPC events with app store
  useElectronSync()

  // Log when app mounts
  useEffect(() => {
    console.log('[App] Kugutsu UI mounted')
  }, [])

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <MainLayout leftPanel={<GraphVisualization />} rightPanel={<TaskKanbanBoard />} />

      {/* Bottom Panel (Logs) */}
      <BottomPanel>
        <LogViewer />
      </BottomPanel>
    </div>
  )
}
