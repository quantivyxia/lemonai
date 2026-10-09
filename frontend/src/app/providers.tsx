import { RouterProvider } from 'react-router-dom'

import { PlatformStoreProvider } from '@/app/state/platform-store'
import { ErrorBoundary } from '@/components/system/error-boundary'
import { AppToaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/features/auth/context/auth-provider'
import { appRouter } from '@/routes/app-router'

export const AppProviders = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PlatformStoreProvider>
          <RouterProvider router={appRouter} />
          <AppToaster />
        </PlatformStoreProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
