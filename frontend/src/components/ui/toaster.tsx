import { Toaster } from 'sonner'

export const AppToaster = () => {
  return (
    <Toaster
      closeButton
      position="top-right"
      richColors
      toastOptions={{
        className: 'font-sans',
      }}
    />
  )
}
