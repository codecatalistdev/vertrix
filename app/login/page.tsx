import { LoginForm } from '@/components/LoginForm'
import { PublicFrame } from '@/components/site/PublicFrame'

export const metadata = { title: 'Sign in' }

export default function Page() {
  return (
    <PublicFrame>
      <div className="site-login-split">
        <LoginForm />
        <figure className="login-still">
          <img src="/site/room.jpg" alt="A quiet room ready for a remote interview" />
          <figcaption>The remote desk is for the Vertrix team.</figcaption>
        </figure>
      </div>
    </PublicFrame>
  )
}
