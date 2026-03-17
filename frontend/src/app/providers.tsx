import { RouterProvider } from 'react-router-dom'

import { PlatformStoreProvider } from '@/app/state/platform-store'
import { AppToaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/features/auth/context/auth-provider'
import { appRouter } from '@/routes/app-router'

export const AppProviders = () => {
  return (
    <AuthProvider>
      <PlatformStoreProvider>
        <RouterProvider router={appRouter} />
        <AppToaster />
      </PlatformStoreProvider>
    </AuthProvider>
  )
}
