import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container" style={{ textAlign: 'center', marginTop: '20vh' }}>
      <h2 className="main-title">404 - Not Found</h2>
      <p className="sub" style={{ marginBottom: '32px' }}>
        The page or resource you are looking for does not exist.
      </p>
      <Link href="/" className="btn primary" style={{ textDecoration: 'none' }}>
        Return to Dashboard
      </Link>
    </div>
  );
}
