import { WorkspaceScaffold } from '@/features/workspace/components/WorkspaceScaffold'
import { registerRendererModuleRegistry } from './bootstrap/registerRendererModuleRegistry'

function App() {
  const config = window.appApi.getConfig()
  const rendererModules = registerRendererModuleRegistry(config)

  return (
    <main className='ap-shell px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6'>
      <div className='mx-auto flex w-full max-w-[1800px] flex-col gap-5'>
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
