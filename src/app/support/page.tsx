import Link from 'next/link'

// Support page.
//
// WHY IT EXISTS. App Store Connect requires a reachable Support URL for every
// app, and Apple's reviewers do open it. A contact form would need a mail
// transport and a spam story; a page with a real address and real answers
// satisfies the requirement and is more use to an actual client at 6am in a
// gym. Deliberately public (no auth) so a locked-out user can still read it.

export const metadata = {
  title: 'Support — CMPD Fitness',
  description: 'Help, contact details, and answers for CMPD Fitness clients and trainers.',
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <Link href="/login" className="text-sm text-yellow-400 hover:text-yellow-300">
            &larr; Back to sign in
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Support</h1>
        <p className="text-sm text-zinc-400 mb-10">We read every email and reply within 2 business days.</p>

        <div className="space-y-8 leading-relaxed text-zinc-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact us</h2>
            <p>
              Email{' '}
              <a href="mailto:contact@cmpdcollective.com" className="text-yellow-400 hover:text-yellow-300">
                contact@cmpdcollective.com
              </a>
              . Tell us the email address on your account and what you were doing when it went
              wrong, and we can usually sort it on the first reply.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">What CMPD Fitness is</h2>
            <p>
              A training platform. Your trainer builds your program, you log every set against it
              on your phone, and you both see the progress. If you train with a CMPD coach, your
              account is created for you and you&apos;ll get an invite by email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">I can&apos;t sign in</h2>
            <p className="mb-3">
              Use <span className="text-white">Forgot password</span> on the sign-in screen to get
              a reset link by email. The link is single-use and expires, so request a fresh one
              rather than reusing an old email.
            </p>
            <p>
              If no email arrives, check spam, then email us and we&apos;ll confirm which address
              your account is under.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">My workout didn&apos;t save</h2>
            <p>
              Sets save as you enter them, but they need a connection. Gym wifi that you have not
              signed in to will stop them saving, and the app shows a warning bar across the top
              when it has no connection. Turn wifi off so the phone uses mobile data, and the sets
              you enter from then on will save.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Workout reminders</h2>
            <p>
              In the app, open <span className="text-white">Profile</span>, then{' '}
              <span className="text-white">Workout reminders</span>, and pick your days and time.
              Reminders are scheduled on that phone, so they work with no signal, but they do not
              follow you to another device. If the toggle won&apos;t turn on, allow notifications
              for CMPD in your phone&apos;s Settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Deleting your account</h2>
            <p>
              Open <span className="text-white">Profile</span> and scroll to{' '}
              <span className="text-white">Delete account</span>. This permanently removes your
              account, your workout history, your goals and your photos. It cannot be undone, and
              we cannot restore it afterwards. You can also email us and we&apos;ll do it for you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Billing</h2>
            <p>
              Trainers subscribe to the platform; clients don&apos;t pay through the app.
              Subscriptions are managed from the billing page on the web at{' '}
              <a href="https://app.cmpdcollective.com/billing" className="text-yellow-400 hover:text-yellow-300">
                app.cmpdcollective.com/billing
              </a>
              . Email us about a refund or a plan change and we&apos;ll handle it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Your data</h2>
            <p>
              What we collect and why is set out in our{' '}
              <Link href="/privacy" className="text-yellow-400 hover:text-yellow-300">
                Privacy Policy
              </Link>
              . You can ask for a copy of your data, a correction, or deletion at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Reporting a problem</h2>
            <p>
              If something looks broken or wrong, email us with a screenshot and the time it
              happened. If it&apos;s a security issue, say so in the subject line and we&apos;ll
              treat it as a priority.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-zinc-800 text-sm text-zinc-500">
          CMPD Fitness &middot; Australia
        </div>
      </div>
    </div>
  )
}
