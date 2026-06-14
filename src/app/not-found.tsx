export default function NotFound() {
  return (
    <main className="page center">
      <div className="shell" style={{ maxWidth: 420 }}>
        <div className="card send-card">
          <div className="brand" style={{ justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.png" alt="LatePass" />
            LatePass
          </div>
          <h1 style={{ fontSize: 22 }}>Link not found</h1>
          <p>
            This link doesn&apos;t exist or has been regenerated. If you just made
            a new send link, add the latest one to your home screen.
          </p>
          <a className="btn" href="/">
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
