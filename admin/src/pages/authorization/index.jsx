/**
 * authorization/index.jsx
 * ─────────────────────────────────────────────────────
 * Entry point for the Authorization modal.
 * Rendered at the App level — blocks all routes until
 * a valid OTP is submitted (or session already verified).
 *
 * Props:
 *   onAuthorized  () => void   called when OTP passes
 */

import './authorization.css';

import AuthModal from './components/AuthModal';

export default function AuthorizationModal({ onAuthorized }) {
  return <AuthModal onAuthorized={onAuthorized} />;
}
