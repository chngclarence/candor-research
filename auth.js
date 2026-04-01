// ============================================================
//  Candor Research — Auth Layer (Supabase + Google OAuth)
// ============================================================

const AUTH = (() => {

  // Load Supabase JS client from CDN
  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  let supabase = null;
  let currentUser = null;

  async function init() {
    // Dynamically load Supabase client
    await loadScript(SUPABASE_CDN);
    supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

    // Handle OAuth callback (when Google redirects back to our app)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      return validateDomain(currentUser.email);
    }
    return null;
  }

  function validateDomain(email) {
    if (!email) return null;
    const allowed = CONFIG.ALLOWED_DOMAINS.some(domain =>
      email.toLowerCase().endsWith('@' + domain.toLowerCase())
    );
    return allowed ? email : false;
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: CONFIG.BASE_URL + '/index.html',
        queryParams: {
          hd: 'shopee.com', // Hint Google to show Shopee accounts first
        },
      },
    });
    if (error) throw new Error(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    currentUser = null;
    window.location.reload();
  }

  function getUser() {
    return currentUser;
  }

  function getEmail() {
    return currentUser?.email || '';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  return { init, signInWithGoogle, signOut, getUser, getEmail, validateDomain };
})();
