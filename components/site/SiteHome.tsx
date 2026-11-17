import Link from 'next/link'
import { SiteMarquee, SiteSlides } from './SiteSlides'

const ROLES = [
  { name: 'Engineering', note: 'Live coding and system calls' },
  { name: 'Product', note: 'Remote case and working sessions' },
  { name: 'Data', note: 'Analysis rounds on a shared screen' },
  { name: 'Design', note: 'Portfolio and critique calls' },
  { name: 'Customer', note: 'Support and success conversations' },
]

export function SiteHome() {
  return (
    <main>
      <section className="home-split">
        <div>
          <p className="site-kicker">Remote roles</p>
          <h1>
            A real interviewer
            <span> on the remote call.</span>
          </h1>
          <p className="site-lede">
            Vertrix sits remote interviews for hiring teams. The candidate joins from wherever they are. Our proxy
            interviewer joins from their own desk. The result is written down before the call goes cold.
          </p>
          <div className="site-actions">
            <Link className="site-cta site-cta-lg" href="/login">
              Enter the desk
            </Link>
            <Link className="site-secondary" href="/approach">
              How a remote interview moves
            </Link>
          </div>
        </div>
        <figure className="home-photo">
          <img src="/site/interview.jpg" alt="Two people in a remote interview across a table" />
          <figcaption>CET on our clock. EST beside it, for the hiring team.</figcaption>
        </figure>
      </section>

      <section className="role-row">
        {ROLES.map((role) => (
          <article key={role.name}>
            <strong>{role.name}</strong>
            <span>{role.note}</span>
          </article>
        ))}
      </section>

      <SiteMarquee />
      <SiteSlides />

      <section className="site-block">
        <p className="site-kicker">The remote week</p>
        <h2>
          One calendar for calls
          <span> that cross an ocean.</span>
        </h2>
        <div className="site-frame">
          <div className="site-frame-bar">
            <span />
            <span />
            <span />
            <strong>Remote week</strong>
            <em>CET · EST</em>
          </div>
          <div className="site-week">
            {[
              ['Mon', '16', ''],
              ['Tue', '17', '09:00 Remote intro'],
              ['Wed', '18', ''],
              ['Thu', '19', '14:00 Tech call'],
              ['Fri', '20', ''],
              ['Sat', '21', ''],
              ['Sun', '22', ''],
            ].map(([day, date, item]) => (
              <div className="site-day" key={day}>
                <span>{day}</span>
                <strong>{date}</strong>
                {item ? <em>{item}</em> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-points">
        <article>
          <img src="/site/room.jpg" alt="A quiet room set up for a night call" />
          <h3>The call has a room</h3>
          <p>The real meeting link stays with the interview. A support link can be updated by anyone in the room.</p>
        </article>
        <article>
          <img src="/site/desk.jpg" alt="A laptop and resume ready for a remote interview" />
          <h3>The resume travels with it</h3>
          <p>The proxy interviewer downloads the resume, joins only the calls assigned to them, and leaves a note.</p>
        </article>
        <article>
          <img src="/site/studio.jpg" alt="A bright room used for remote hiring conversations" />
          <h3>The stage stays visible</h3>
          <p>Intro, tech, final, and offer each keep a result, so a remote loop does not collapse into one status.</p>
        </article>
      </section>

      <section className="site-close">
        <h2>Remote roles. One desk for the team that sits them.</h2>
        <Link className="site-cta site-cta-lg" href="/about">
          About the agency
        </Link>
      </section>
    </main>
  )
}
