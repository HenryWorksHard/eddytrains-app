import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — CMPD Fitness',
  description: 'How CMPD Fitness collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <Link href="/login" className="text-sm text-yellow-400 hover:text-yellow-300">
            &larr; Back to sign in
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-zinc-400 mb-10">Last updated: 22 April 2026</p>

        <div className="space-y-8 leading-relaxed text-zinc-300">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Who we are</h2>
            <p>
              CMPD Fitness is operated by Louis Van den Berg, based in Australia. The service
              is a training platform that connects personal trainers with their clients.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>
              Questions, requests, or data concerns:{' '}
              <a href="mailto:support@cmpdcollective.com" className="text-yellow-400 hover:text-yellow-300">
                support@cmpdcollective.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">What data we collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Email address and full name</li>
              <li>Workout logs — exercises, sets, reps, weights</li>
              <li>Body metrics — estimated 1RMs and optional body weight</li>
              <li>Progress photos you upload</li>
              <li>Goal data and training schedule</li>
              <li>Your timezone (used to render your schedule correctly)</li>
              <li>Profile picture if you choose to upload one</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">How we use it</h2>
            <p>
              We use your data to provide the training service: show you your program, track your
              progress over time, and share your training data with your trainer if you signed up
              through one. That&apos;s it — no advertising, no profiling.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Where it&apos;s stored</h2>
            <p>
              Data is stored in Supabase, a managed database service running on AWS in the
              ap-southeast-2 region (Sydney, Australia).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Sharing</h2>
            <p className="mb-3">
              We never sell your data. Your workout data is visible only to your trainer — not to
              other clients. We use Stripe to bill trainers for their subscription to the platform;
              clients do not transact through us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Retention</h2>
            <p>
              We keep your data while your account is active. You can request deletion at any time
              by emailing{' '}
              <a href="mailto:support@cmpdcollective.com" className="text-yellow-400 hover:text-yellow-300">
                support@cmpdcollective.com
              </a>
              . We&apos;ll wipe your data within 30 days of the request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Cookies</h2>
            <p>
              We use session cookies to keep you signed in. We do not use tracking cookies, and
              we do not currently run any third-party analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Children</h2>
            <p>
              CMPD Fitness is not intended for users under 16 years of age.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Your rights</h2>
            <p>
              You have the right to access, correct, delete, or export your data. Email us to
              make a request and we&apos;ll respond within a reasonable time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Changes to this policy</h2>
            <p>
              If we update this policy we&apos;ll change the &quot;Last updated&quot; date above,
              and for material changes we&apos;ll notify you in-app.
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
