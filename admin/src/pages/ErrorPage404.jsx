import './ErrorPage404.css';
import bgImage from '../assets/HostOps-BG-Optimized.png';

export default function ErrorPage404() {
  return (
    <div
      className="ep404-container"
      style={{ backgroundImage: `url("${bgImage}")` }}
    >
      <div className="ep404-content">
        <h1 className="ep404-number">404</h1>
        <h2 className="ep404-title">Page Lost in Translation</h2>
        <p className="ep404-text">
          The page you're searching for seems to have wandered off into the digital wilderness. Let's get you back on track.
        </p>
        <a href="https://hostops.online/" className="ep404-button">
          <span>Return Home</span>
        </a>
      </div>
    </div>
  );
}