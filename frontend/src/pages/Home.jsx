import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="home-page">
      <header className="home-nav">
        <div className="home-nav-inner">
          <Link to="/" className="home-brand">
            <span className="home-logo">UH</span>
            <span className="home-brand-name">UniHub</span>
          </Link>

          <nav className="home-nav-links" aria-label="Main">
            <a href="#home" className="home-nav-link">Home</a>
            <a href="#about" className="home-nav-link">About</a>
            <a href="#features" className="home-nav-link">Features</a>
            <a href="#contact" className="home-nav-link">Contact</a>
          </nav>

          <div className="home-nav-actions">
            <Link to="/login" className="home-btn-ghost">Log in</Link>
            <Link to="/signup" className="home-btn-primary">Sign up</Link>
          </div>
        </div>
      </header>

      <section id="home" className="home-section home-hero">
        <div className="home-section-inner">
          <div className="home-pill">
            <span className="home-pill-dot" />
            <span>Student marketplace for creators</span>
          </div>
          <h1>
            Where <span className="home-hero-accent">Creativity</span> Meets{' '}
            <span className="home-hero-accent">Opportunity</span>
          </h1>
          <p>
            Connect with talented students, showcase your skills, and turn your creativity into
            paid opportunities.
          </p>
          <div className="home-hero-actions">
            <Link to="/signup" className="home-btn-primary">Get Started →</Link>
            <a href="#features" className="home-btn-outline">Learn More</a>
          </div>
        </div>
      </section>

      <section id="about" className="home-section">
        <div className="home-section-inner">
          <div className="home-section-title">
            <h2>About UniHub</h2>
            <div className="home-divider" />
            <p>We&apos;re building the student marketplace for creative skills and services.</p>
          </div>

          <div className="home-grid-2">
            <div className="home-card">
              <h3>Empowering Student Creators</h3>
              <p>
                UniHub is a platform where students can share their unique talents. Whether you&apos;re
                a designer, developer, writer, or artist, we provide the tools to connect you with
                opportunities that matter.
              </p>
              <p style={{ marginTop: '1rem' }}>
                Our mission is to create a supportive community where students can earn, learn, and
                grow together.
              </p>
            </div>
            <div className="home-card">
              <div className="home-check-item">
                <span className="home-check-icon">✓</span>
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Our Mission</h3>
                  <p>Help students share their talents with the world.</p>
                </div>
              </div>
              <div className="home-check-item">
                <span className="home-check-icon">✓</span>
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Our Vision</h3>
                  <p>A world where student creators thrive.</p>
                </div>
              </div>
              <div className="home-check-item">
                <span className="home-check-icon">✓</span>
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Our Values</h3>
                  <p>Community, growth, creativity, excellence.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="home-section">
        <div className="home-section-inner">
          <div className="home-section-title">
            <h2>Features</h2>
            <div className="home-divider" />
            <p>Everything you need to grow your creative career.</p>
          </div>

          <div className="home-grid-3">
            <div className="home-card">
              <div className="home-feature-icon">🎨</div>
              <h3>Showcase Skills</h3>
              <p>Create your portfolio and share your talents.</p>
            </div>
            <div className="home-card">
              <div className="home-feature-icon">💰</div>
              <h3>Find Gigs</h3>
              <p>Get paid for your skills and creativity.</p>
            </div>
            <div className="home-card">
              <div className="home-feature-icon">🤝</div>
              <h3>Connect</h3>
              <p>Network with fellow creative students.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-inner">
          <div className="home-cta">
            <h2>Ready to start?</h2>
            <p>Join UniHub today and turn your creativity into opportunities.</p>
            <Link to="/signup" className="home-btn-primary">Create free account</Link>
          </div>
        </div>
      </section>

      <section id="contact" className="home-section">
        <div className="home-section-inner">
          <div className="home-section-title">
            <h2>Get in Touch</h2>
            <div className="home-divider" />
            <p>Have questions? We&apos;d love to hear from you.</p>
          </div>

          <div className="home-contact-grid">
            <div className="home-card home-contact-card">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📧</div>
              <p>hello@unihub.com</p>
            </div>
            <div className="home-card home-contact-card">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📱</div>
              <p>+1 (555) 123-4567</p>
            </div>
            <div className="home-card home-contact-card">
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🌐</div>
              <p>@unihub</p>
            </div>
          </div>

          <div className="home-card">
            <form className="home-form" onSubmit={(e) => e.preventDefault()}>
              <div className="home-form-grid">
                <input type="text" placeholder="Your name" aria-label="Your name" />
                <input type="email" placeholder="Your email" aria-label="Your email" />
              </div>
              <textarea rows={4} placeholder="Your message" aria-label="Your message" />
              <button type="submit" className="home-btn-primary" style={{ width: 'fit-content' }}>
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <p>© 2026 UniHub. All rights reserved.</p>
      </footer>
    </div>
  )
}
