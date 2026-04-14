import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #E6E7E8', paddingTop: '40px', paddingBottom: '40px', marginTop: '80px' }}>
      <div className="container">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', marginBottom: '32px' }}>

          {/* Nav links */}
          <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <li>
              <a href="https://t.me/SoulMatcherCoach" target="_blank" rel="noopener noreferrer" className="btn-green">
                Enroll in the Course
              </a>
            </li>
            <li>
              <Link href="/blog" className="nav-link">Blog</Link>
            </li>
            <li>
              <a href="https://sergovantseva.com/terms-of-use/" className="nav-link">Terms of Use</a>
            </li>
            <li>
              <a href="https://sergovantseva.com/privacy-policy/" className="nav-link">Privacy Policy</a>
            </li>
          </ul>

          {/* Social icons */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <a href="https://youtube.com/@sergovantseva" target="_blank" rel="noopener noreferrer" className="social-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 23 22" fill="none">
                <g clipPath="url(#yt1)">
                  <path d="M22.114 6.6s-.215-1.517-.877-2.183c-.838-.877-1.775-.881-2.204-.932-3.077-.224-7.696-.224-7.696-.224h-.009s-4.618 0-7.695.224c-.43.051-1.366.055-2.204.932C.767 5.083.557 6.6.557 6.6S.333 8.383.333 10.162v1.667c0 1.779.219 3.562.219 3.562s.215 1.517.872 2.183c.838.877 1.938.847 2.428.941 1.762.168 7.481.22 7.481.22s4.623-.009 7.7-.228c.43-.051 1.366-.055 2.204-.932.661-.666.876-2.183.876-2.183S22.333 13.613 22.333 11.83v-1.667C22.333 8.383 22.114 6.6 22.114 6.6zM9.06 13.853V7.67l5.942 3.102-5.942 3.08z" fill="black"/>
                </g>
                <defs><clipPath id="yt1"><rect width="22" height="22" fill="white" transform="translate(0.333)"/></clipPath></defs>
              </svg>
            </a>
            <a href="https://instagram.com/sergovantseva" target="_blank" rel="noopener noreferrer" className="social-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 1.98c2.94 0 3.288.013 4.443.064 1.074.047 1.654.228 2.041.378.511.198.881.438 1.263.82.382.387.622.752.82 1.264.15.387.33.966.378 2.04.05 1.156.063 1.504.063 4.438s-.013 3.282-.063 4.438c-.048 1.074-.228 1.654-.378 2.04a3.4 3.4 0 0 1-.82 1.264 3.4 3.4 0 0 1-1.263.82c-.387.15-.967.33-2.04.378-1.156.051-1.504.063-4.443.063s-3.287-.012-4.443-.063c-1.074-.048-1.654-.228-2.04-.378a3.4 3.4 0 0 1-1.264-.82 3.4 3.4 0 0 1-.82-1.264c-.15-.386-.33-.966-.377-2.04C2.006 14.282 1.993 13.934 1.993 11s.013-3.282.064-4.438c.047-1.074.228-1.653.377-2.04.198-.512.438-.877.82-1.264a3.4 3.4 0 0 1 1.264-.82c.386-.15.966-.33 2.04-.378C7.713 1.993 8.06 1.98 11 1.98zM11 0C8.013 0 7.639.013 6.466.065 5.297.117 4.494.306 3.798.576a5.37 5.37 0 0 0-1.952 1.27A5.37 5.37 0 0 0 .576 3.798C.306 4.494.117 5.294.065 6.466.014 7.639 0 8.013 0 11c0 2.986.014 3.36.065 4.534.052 1.168.24 1.971.511 2.668a5.37 5.37 0 0 0 1.27 1.952 5.37 5.37 0 0 0 1.952 1.27c.697.27 1.5.459 2.668.511C7.64 21.986 8.013 22 11 22s3.36-.014 4.534-.065c1.168-.052 1.971-.24 2.668-.511a5.37 5.37 0 0 0 1.952-1.27 5.37 5.37 0 0 0 1.27-1.952c.27-.697.459-1.5.511-2.668C21.986 14.36 22 13.986 22 11s-.014-3.36-.065-4.534c-.052-1.172-.24-1.971-.511-2.668a5.37 5.37 0 0 0-1.27-1.952A5.37 5.37 0 0 0 18.202.576C17.506.306 16.706.117 15.534.065 14.36.014 13.987 0 11 0z" fill="black"/>
                <path d="M11 5.35a5.65 5.65 0 1 0 0 11.3 5.65 5.65 0 0 0 0-11.3zm0 9.315a3.665 3.665 0 1 1 0-7.33 3.665 3.665 0 0 1 0 7.33z" fill="black"/>
                <circle cx="16.857" cy="5.143" r="1.32" fill="black"/>
              </svg>
            </a>
            <a href="https://t.me/SoulMatcherCoach" target="_blank" rel="noopener noreferrer" className="social-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path fillRule="evenodd" clipRule="evenodd" d="M22 11C22 17.075 17.075 22 11 22C4.925 22 0 17.075 0 11C0 4.925 4.925 0 11 0C17.075 0 22 4.925 22 11ZM11.394 8.12c-1.07.445-3.208 1.366-6.415 2.763-.52.207-.793.41-.818.608-.044.335.375.467.946.646.077.025.158.05.24.077.562.182 1.318.396 1.71.404.357.008.755-.139 1.194-.437 2.996-2.022 4.543-3.044 4.64-3.066.069-.015.163-.034.228.023.064.057.057.165.05.194-.04.177-1.686 1.707-2.538 2.499-.266.247-.454.422-.492.462-.086.09-.174.174-.258.256-.523.503-.914.88-.015 1.496.449.296.809.54 1.167.785.392.267.782.533 1.288.864.128.084.251.172.371.257.455.325.865.617 1.37.57.294-.026.597-.302.752-1.127.364-1.948 1.08-6.169 1.246-7.908a1.85 1.85 0 0 0-.017-.456.5.5 0 0 0-.17-.31c-.132-.107-.335-.13-.426-.128-.413.007-1.048.228-4.103 1.489z" fill="black"/>
              </svg>
            </a>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #E6E7E8', paddingTop: '24px' }}>
          <p style={{ fontSize: '15px', color: '#000', margin: 0 }}>© SERGOVANTSEVA. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
