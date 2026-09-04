// H.I.V.E. Gmail Auto-Scanner — Scam Shield
// Monitors Gmail for open emails and auto-scans through H.I.V.E.

const API = 'http://localhost:8001'
const CHECK_INTERVAL = 3000
let lastScannedText = ''
let userId = 'user-arjun'

// Try to get logged-in user
try {
  const stored = JSON.parse(localStorage.getItem('scam_shield_user') || '{}')
  if (stored.id) userId = stored.id
} catch {}

function getEmailBody() {
  // Gmail DOM selectors for the currently open email body
  const selectors = [
    '.a3s.aiL',               // Main email body
    '.ii.gt .a3s',            // Alternative body
    '.ii.gt',                 // Message content wrapper
    '[data-message-id] .a3s', // Specific message
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el && el.innerText && el.innerText.trim().length > 20) {
      return el.innerText.trim()
    }
  }
  return ''
}

function getEmailSender() {
  const el = document.querySelector('.gD') || document.querySelector('[email]')
  return el?.getAttribute('email') || el?.innerText || 'unknown@gmail'
}

function getEmailSubject() {
  const el = document.querySelector('.hP') || document.querySelector('h2.hP')
  return el?.innerText || 'No Subject'
}

async function scanEmail(body, sender, subject) {
  try {
    const resp = await fetch(`${API}/api/email/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        sender_email: sender,
        subject: subject,
        body: body,
      }),
    })
    return await resp.json()
  } catch (err) {
    console.log('[H.I.V.E.] Backend not reachable:', err.message)
    return null
  }
}

function showBanner(data) {
  // Remove existing banner
  const old = document.getElementById('hive-scam-banner')
  if (old) old.remove()

  const upis = data.entities?.upi_ids || []
  const conf = Math.round(data.confidence * 100)
  const isScam = data.is_scam

  const banner = document.createElement('div')
  banner.id = 'hive-scam-banner'
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 999999;
    padding: 12px 20px; display: flex; align-items: center; gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px; animation: hiveBannerSlide 0.4s ease-out;
    ${isScam
      ? 'background: linear-gradient(135deg, #dc2626, #b91c1c); color: white;'
      : 'background: linear-gradient(135deg, #059669, #047857); color: white;'
    }
  `

  if (isScam) {
    banner.innerHTML = `
      <span style="font-size:20px">🚨</span>
      <div style="flex:1">
        <strong>H.I.V.E. SCAM DETECTED (${conf}%)</strong>
        ${upis.length > 0 ? `<br><span style="font-size:12px;opacity:0.9">⛔ UPI blocked: <strong>${upis.join(', ')}</strong> — payments to this UPI will be HELD</span>` : ''}
      </div>
      <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px">Dismiss</button>
    `
  } else {
    banner.innerHTML = `
      <span style="font-size:20px">✅</span>
      <div style="flex:1"><strong>H.I.V.E. — Email appears safe</strong></div>
      <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px">OK</button>
    `
    setTimeout(() => banner.remove(), 5000)
  }

  document.body.appendChild(banner)

  // Auto-dismiss safe banners, keep scam banners for 15s
  if (isScam) {
    setTimeout(() => { if (banner.parentElement) banner.remove() }, 15000)
  }
}

// Inject animation CSS
const style = document.createElement('style')
style.textContent = `
  @keyframes hiveBannerSlide {
    from { transform: translateY(-100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`
document.head.appendChild(style)

// Main watcher — checks every 3 seconds for a new email being viewed
async function checkForNewEmail() {
  const body = getEmailBody()
  if (!body || body.length < 30 || body === lastScannedText) return

  lastScannedText = body
  const sender = getEmailSender()
  const subject = getEmailSubject()

  console.log(`[H.I.V.E.] Auto-scanning email from ${sender}...`)

  const result = await scanEmail(body, sender, subject)
  if (!result) return

  if (result.is_scam) {
    const upis = result.entities?.upi_ids || []
    console.log(`%c[H.I.V.E.] 🚨 SCAM DETECTED — ${upis.join(', ') || result.scam_type}`, 'color: #ef4444; font-weight: bold; font-size: 14px')
    showBanner(result)

    // Browser notification
    if (Notification.permission === 'granted') {
      new Notification('H.I.V.E. — Scam Detected!', {
        body: `${result.scam_type} scam (${Math.round(result.confidence * 100)}%)${upis.length > 0 ? '\nUPI blocked: ' + upis.join(', ') : ''}`,
        tag: 'hive-email-scam',
      })
    }
  } else {
    console.log('[H.I.V.E.] ✅ Email safe')
    showBanner(result)
  }
}

// Start monitoring
console.log('%c🛡️ H.I.V.E. Email Scanner active — monitoring Gmail', 'color: #6366f1; font-size: 14px; font-weight: bold')
Notification.requestPermission()
setInterval(checkForNewEmail, CHECK_INTERVAL)
// Run once immediately
setTimeout(checkForNewEmail, 1000)
