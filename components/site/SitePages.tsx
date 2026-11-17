import Link from 'next/link'

const STEPS = [
  {
    n: '01',
    title: 'The remote role arrives',
    body: 'A hiring team sends the job, the resume, and the kind of call it is. Engineering, product, data, design, or a customer role. Nothing is on a calendar yet.',
    image: '/site/desk.jpg',
    alt: 'A resume and laptop prepared for a remote role',
  },
  {
    n: '02',
    title: 'We set one slot on two clocks',
    body: 'A supporter drops the interview on the week. The start is chosen in Central European time. US Eastern is shown on the same slot, so a hiring manager does not convert it.',
    image: '/site/studio.jpg',
    alt: 'A bright room where remote interviews are planned',
  },
  {
    n: '03',
    title: 'The proxy joins from their desk',
    body: 'They see that remote interview only. They download the resume, open the room, and take the call. The real meeting link stays fixed. The support link can change.',
    image: '/site/interview.jpg',
    alt: 'An interviewer speaking with a candidate',
  },
  {
    n: '04',
    title: 'The stage is written after the call',
    body: 'Scheduled, waiting, passed, hold, failed, or offer. Intro can already be passed while the technical call is still ahead. Earlier empty stages become passed when a later one is scheduled.',
    image: '/site/office.jpg',
    alt: 'A modern office hall between remote interview calls',
  },
  {
    n: '05',
    title: 'The loop can be read from anywhere',
    body: 'Administrators and supporters see every remote interview. A proxy sees the ones they sat, including each stage already marked, through to offer.',
    image: '/site/room.jpg',
    alt: 'A night room ready for a remote call',
  },
]

export function ApproachPage() {
  return (
    <main>
      <header className="page-left">
        <p className="site-kicker">How a remote interview moves</p>
        <h1>
          From the job description
          <span> to the call,</span> then the record.
        </h1>
        <p className="site-lede">
          A remote role never shares a room. Vertrix still keeps one thread: who assigned it, who sat it, and what
          happened at each stage.
        </p>
      </header>
      <div className="bands">
        {STEPS.map((step, index) => (
          <article className={index % 2 ? 'band band-flip' : 'band'} key={step.n}>
            <img src={step.image} alt={step.alt} />
            <div>
              <span>{step.n}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </div>
          </article>
        ))}
      </div>
      <section className="site-close">
        <h2>Put the next remote call on the week.</h2>
        <Link className="site-cta site-cta-lg" href="/login">
          Enter the desk
        </Link>
      </section>
    </main>
  )
}

export function DeskPage() {
  return (
    <main>
      <header className="page-left">
        <p className="site-kicker">The remote desk</p>
        <h1>
          The call, the stage,
          <span> and the record</span> stay together.
        </h1>
        <p className="site-lede">
          Remote interviews scatter across inboxes. The desk keeps the schedule, the result of each stage, and the room
          on the same interview.
        </p>
      </header>
      <section className="bento">
        <article className="bento-photo">
          <img src="/site/office.jpg" alt="A long office used by the remote interview team" />
          <div>
            <h2>Calendar</h2>
            <p>A Monday week or a month. Drag a stretch of the day to place a remote interview. CET leads. EST sits beside it.</p>
          </div>
        </article>
        <article>
          <h2>Results</h2>
          <p>Each remote candidate has a cell for intro, tech, final, and offer. Open a cell and mark scheduled, waiting, passed, hold, failed, or offer.</p>
        </article>
        <article>
          <h2>Dashboard</h2>
          <p>Counts by month and by proxy interviewer. Administrators and supporters see the agency. A proxy sees only the remote interviews on their name.</p>
        </article>
        <article className="bento-wide">
          <img src="/site/room.jpg" alt="A dark room prepared for a late remote interview" />
          <div>
            <h2>Room</h2>
            <p>The real meeting link is locked on the room page. Anyone in the room can edit the support link and the note. The resume stays attached.</p>
          </div>
        </article>
      </section>
      <section className="record-strip">
        <h2>On a remote interview we keep</h2>
        <ul>
          <li>The role and the proxy interviewer</li>
          <li>CET start, duration, and the EST reading</li>
          <li>Job description and resume</li>
          <li>Real meeting link and support link</li>
          <li>A result for every stage through offer</li>
        </ul>
      </section>
    </main>
  )
}

export function AboutPage() {
  return (
    <main>
      <section className="about-hero">
        <img src="/site/portrait.jpg" alt="A Vertrix interviewer with a laptop by the window" />
        <div>
          <p className="site-kicker">The agency</p>
          <h1>
            Built for hiring
            <span> that never shares a room.</span>
          </h1>
          <p>
            Remote roles changed the interview. The candidate, the interviewer, and the hiring manager can be in three
            places. Vertrix is the agency that still puts a prepared person on that call and keeps a clear record after
            it.
          </p>
        </div>
      </section>
      <section className="about-columns">
        <article>
          <h2>Why the clock is printed twice</h2>
          <p>
            Our interviewers plan in Central European time. Many of the remote roles we sit are read by teams on US
            Eastern time. Both clocks stay on the interview, including through daylight saving.
          </p>
        </article>
        <article>
          <h2>Why a proxy interviewer</h2>
          <p>
            The hiring team sends the role. A supporter assigns the call. The proxy interviewer sits it, sees only their
            own interviews, and leaves the stage result where the rest of the agency can read it.
          </p>
        </article>
        <article>
          <h2>Who this site is for</h2>
          <p>
            These pages introduce the agency. The calendar, resumes, and rooms are for people on the Vertrix team. If
            you already sit remote interviews with us, sign in.
          </p>
          <Link className="site-cta" href="/login">
            Sign in
          </Link>
        </article>
      </section>
    </main>
  )
}
