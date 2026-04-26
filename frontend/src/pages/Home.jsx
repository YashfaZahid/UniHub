import { Link } from 'react-router-dom'

export default function Home() {
  const wallpaperStyle = {
    backgroundImage: 'url("/wallpaper7.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed'
  }

  return (
    <div className="min-h-screen" style={wallpaperStyle}>
      {/* Dark gradient overlay for text readability - wallpaper still visible */}
      <div className="min-h-screen bg-gradient-to-b from-black/60 via-black/40 to-black/60">
      
        {/* Navigation Bar */}
        <nav className="bg-black/30 backdrop-blur-md sticky top-0 z-50 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-2">
               <div className="w-9 h-9 bg-pink-200 rounded-full flex items-center justify-center shadow-md">
  <span className="text-pink-700 text-sm font-bold">UH</span>
</div>
                <span className="text-xl font-bold text-white">UniHub</span>
              </div>
              
      <div className="hidden md:flex items-center space-x-6">
  <a href="#home" className="px-3 py-1.5 bg-pink-200 hover:bg-pink-300 text-pink-700 rounded-lg text-sm font-medium transition">Home</a>
  <a href="#about" className="px-3 py-1.5 bg-pink-200 hover:bg-pink-300 text-pink-700 rounded-lg text-sm font-medium transition">About</a>
  <a href="#features" className="px-3 py-1.5 bg-pink-200 hover:bg-pink-300 text-pink-700 rounded-lg text-sm font-medium transition">Features</a>
  <a href="#contact" className="px-3 py-1.5 bg-pink-200 hover:bg-pink-300 text-pink-700 rounded-lg text-sm font-medium transition">Contact</a>
</div>
              
              <div className="flex items-center space-x-3">
                <Link to="/login" className="px-4 py-2 text-white/80 hover:text-white transition font-medium">
                  Log in
                </Link>
               <Link to="/signup" className="px-5 py-2 bg-pink-200 hover:bg-pink-300 text-pink-700 rounded-lg font-medium transition shadow-md">
  Sign up
</Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section id="home" className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></span>
              <span className="text-sm text-pink-200 font-medium">Launching Soon</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Where{" "}
              <span className="bg-gradient-to-r from-pink-300 to-rose-300 bg-clip-text text-transparent">
                Creativity
              </span>{" "}
              Meets{" "}
              <span className="bg-gradient-to-r from-rose-300 to-pink-300 bg-clip-text text-transparent">
                Opportunity
              </span>
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto mb-10">
              Connect with talented students, showcase your skills, and turn your creativity into paid opportunities.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup" className="px-8 py-3 bg-pink-200 hover:bg-pink-300 text-pink-700 rounded-xl font-semibold transition shadow-md">
  Get Started →
</Link>
              <a href="#features" className="px-8 py-3 border-2 border-white/30 text-white rounded-xl font-semibold hover:bg-white/10 transition">
                Learn More
              </a>
            </div>
          </div>
        </section>


        {/* About Section */}
        <section id="about" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">About UniHub</h2>
              <div className="w-16 h-1 bg-pink-400 mx-auto rounded-full"></div>
              <p className="text-white/80 mt-4 max-w-2xl mx-auto">
                We're building the student marketplace for creative skills and services.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/10">
                <h3 className="text-2xl font-bold text-white mb-4">Empowering Student Creators</h3>
                <p className="text-white/80 mb-4 leading-relaxed">
                  UniHub is a platform where students can share their unique talents. 
                  Whether you're a designer, developer, writer, or artist, we provide the 
                  tools to connect you with opportunities that matter.
                </p>
                <p className="text-white/80 leading-relaxed">
                  Our mission is to create a supportive community where students can earn, 
                  learn, and grow together.
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/10">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-pink-500/30 rounded-lg flex items-center justify-center text-pink-200">✓</div>
                    <div>
                      <h4 className="font-semibold text-white">Our Mission</h4>
                      <p className="text-white/70 text-sm">Help students share their talents with the world.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-pink-500/30 rounded-lg flex items-center justify-center text-pink-200">✓</div>
                    <div>
                      <h4 className="font-semibold text-white">Our Vision</h4>
                      <p className="text-white/70 text-sm">A world where student creators thrive.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-pink-500/30 rounded-lg flex items-center justify-center text-pink-200">✓</div>
                    <div>
                      <h4 className="font-semibold text-white">Our Values</h4>
                      <p className="text-white/70 text-sm">Community, Growth, Creativity, Excellence.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Features</h2>
              <div className="w-16 h-1 bg-pink-400 mx-auto rounded-full"></div>
              <p className="text-white/80 mt-4">Everything you need to grow your creative career.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition border border-white/10">
                <div className="w-12 h-12 bg-pink-500/30 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-xl">🎨</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Showcase Skills</h3>
                <p className="text-white/70 text-sm">Create your portfolio and share your talents.</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition border border-white/10">
                <div className="w-12 h-12 bg-pink-500/30 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-xl">💰</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Find Gigs</h3>
                <p className="text-white/70 text-sm">Get paid for your skills and creativity.</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition border border-white/10">
                <div className="w-12 h-12 bg-pink-500/30 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-xl">🤝</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Connect</h3>
                <p className="text-white/70 text-sm">Network with fellow creative students.</p>
              </div>
            </div>
          </div>
        </section>

      {/* CTA Section */}
<section className="py-20">
  <div className="max-w-4xl mx-auto text-center px-4">
    <div className="bg-pink-200 rounded-3xl p-10">
      <h2 className="text-3xl font-bold text-pink-700 mb-4">
        Ready to start?
      </h2>
      <p className="text-pink-600 mb-8">
        Join UniHub today and turn your creativity into opportunities.
      </p>
      <Link to="/signup" className="inline-block px-8 py-3 bg-white text-pink-600 rounded-xl font-semibold hover:shadow-lg transition">
        Create free account
      </Link>
    </div>
  </div>
</section>

        {/* Contact Section */}
        <section id="contact" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Get in Touch</h2>
              <div className="w-16 h-1 bg-pink-400 mx-auto rounded-full"></div>
              <p className="text-white/80 mt-4">Have questions? We'd love to hear from you.</p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="grid md:grid-cols-3 gap-6 mb-12 text-center">
                <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/10">
                  <div className="text-2xl mb-2">📧</div>
                  <p className="text-white/80 text-sm">hello@unihub.com</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/10">
                  <div className="text-2xl mb-2">📱</div>
                  <p className="text-white/80 text-sm">+1 (555) 123-4567</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/10">
                  <div className="text-2xl mb-2">🌐</div>
                  <p className="text-white/80 text-sm">@unihub</p>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/10">
                <form className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Your name" className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-pink-400" />
                    <input type="email" placeholder="Your email" className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-pink-400" />
                  </div>
                  <textarea rows="4" placeholder="Your message" className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-pink-400"></textarea>
                  <button className="px-6 py-3 bg-pink-200 hover:bg-pink-300 text-pink-700 rounded-lg font-semibold transition">
  Send Message
</button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-black/50 backdrop-blur text-white py-8">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-white/60 text-sm">© 2026 UniHub. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}