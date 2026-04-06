import { WorkspaceScaffold } from '@/features/workspace/components/WorkspaceScaffold'
import { registerRendererModuleRegistry } from './bootstrap/registerRendererModuleRegistry'

function App() {
  const config = window.appApi.getConfig()
  const rendererModules = registerRendererModuleRegistry(config)

  return (
    <main className='min-h-screen px-6 py-8 text-ink'>
      <div className='mx-auto flex max-w-7xl flex-col gap-6'>
        <WorkspaceScaffold />
      </div>
      {rendererModules.map((module) => {
        const Component = module.component
        return <Component key={module.id} />
      })}
    </main>
  )
}

export default App
