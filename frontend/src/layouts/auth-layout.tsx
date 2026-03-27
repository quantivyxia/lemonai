import { Outlet } from 'react-router-dom'

export const AuthLayout = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(130deg,#f6f8fc_0%,#eef3fa_45%,#e9f2f7_100%)] p-4 sm:p-8">
      <div className="pointer-events-none absolute -left-10 top-24 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-14 right-12 h-52 w-52 rounded-full bg-teal-200/40 blur-3xl" />
      <section className="relative flex w-full items-center justify-center">
        <Outlet />
      </section>
    </div>
  )
}
