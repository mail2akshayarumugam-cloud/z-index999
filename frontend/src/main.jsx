import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ─── H.I.V.E. Email Scanner (Console API) ───
// Usage from F12 console:
//   scanEmail("full email text here")
//   scanEmail("Send Rs 1 to scammer@upi to verify your account")

window.scanEmail = async function(emailBody, sender = 'unknown@suspicious.com', subject = 'Scanned Email') {
  const user = JSON.parse(localStorage.getItem('scam_shield_user') || '{}')
  if (!user.id) { console.error('❌ Not logged in. Login first.'); return }

  console.log('🔍 H.I.V.E. scanning email...')

  try {
    const resp = await fetch('/api/email/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        sender_email: sender,
        subject: subject,
        body: emailBody,
      }),
    })
    const data = await resp.json()

    if (data.is_scam) {
      const upis = data.entities?.upi_ids || []
      const conf = Math.round(data.confidence * 100)

      console.log(`%c🚨 SCAM DETECTED (${conf}% confidence)`, 'color: #ef4444; font-size: 16px; font-weight: bold')
      console.log(`%c   Type: ${data.scam_type || 'unknown'}`, 'color: #f59e0b')
      console.log(`%c   Risk: ${data.risk_level}`, 'color: #ef4444')
      if (upis.length > 0) {
        console.log(`%c   🔒 UPI FLAGGED: ${upis.join(', ')}`, 'color: #ef4444; font-weight: bold; font-size: 14px')
        console.log(`%c   ⛔ Any payment to ${upis.join(', ')} will now be BLOCKED`, 'color: #dc2626; font-weight: bold')
      }
      console.log('%c   Indicators:', 'color: #94a3b8', data.key_indicators)

      if (Notification.permission === 'granted') {
        new Notification('🚨 H.I.V.E. — Scam Detected!', {
          body: `${data.scam_type?.toUpperCase()} scam (${conf}%)${upis.length > 0 ? `\nUPI blocked: ${upis.join(', ')}` : ''}`,
          icon: '/favicon.svg',
          tag: 'hive-scam',
        })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') {
            new Notification('🚨 H.I.V.E. — Scam Detected!', {
              body: `${data.scam_type?.toUpperCase()} scam (${conf}%)${upis.length > 0 ? `\nUPI blocked: ${upis.join(', ')}` : ''}`,
              icon: '/favicon.svg',
              tag: 'hive-scam',
            })
          }
        })
      }

      return { scam: true, confidence: conf, upis, type: data.scam_type }
    } else {
      console.log('%c✅ Email appears safe', 'color: #22c55e; font-size: 14px; font-weight: bold')
      return { scam: false }
    }
  } catch (err) {
    console.error('❌ Scan failed:', err.message)
    return { error: err.message }
  }
}

// Quick demo shortcut
window.demoScam = function(upi = 'scammer@ybl') {
  return window.scanEmail(
    `URGENT: Your UPI account will be blocked within 30 minutes due to incomplete KYC verification. Send Rs 1 to ${upi} immediately to complete verification. Do not ignore this message.`,
    'starrydiddy@gmail.com',
    'URGENT: UPI ACCOUNT VERIFICATION REQUIRED'
  )
}

// ─── Gmail Auto-Scanner ───
// Run hiveScan() in Gmail tab's console — reads the open email and scans it
// Or paste this entire block into Gmail's F12 console:

window.HIVE_API = 'http://localhost:8001'

window.hiveScan = async function() {
  // Extract email body from Gmail DOM
  const selectors = [
    '.a3s.aiL',           // Gmail email body
    '.ii.gt',             // Gmail message content
    '[data-message-id]',  // Gmail message container
    '.nH .aHU',           // Gmail reading pane
  ]

  let emailText = ''
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el && el.innerText?.length > 20) {
      emailText = el.innerText
      break
    }
  }

  if (!emailText) {
    // Fallback: get all visible text in the main content area
    const main = document.querySelector('[role="main"]') || document.body
    emailText = main.innerText?.slice(0, 3000) || ''
  }

  if (emailText.length < 20) {
    console.error('❌ No email content found. Open an email in Gmail first.')
    return
  }

  console.log('%c🔍 H.I.V.E. auto-scanning open email...', 'color: #6366f1; font-size: 13px')
  console.log('%c   Text length: ' + emailText.length + ' chars', 'color: #94a3b8')

  try {
    const user = JSON.parse(localStorage.getItem('scam_shield_user') || '{"id":"user-arjun"}')
    const resp = await fetch(window.HIVE_API + '/api/email/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        sender_email: 'gmail-autoscan@detected',
        subject: 'Gmail Auto-Scan',
        body: emailText,
      }),
    })
    const data = await resp.json()

    if (data.is_scam) {
      const upis = data.entities?.upi_ids || []
      const conf = Math.round(data.confidence * 100)
      console.log(`%c🚨 SCAM DETECTED (${conf}%)`, 'color: #ef4444; font-size: 18px; font-weight: bold')
      console.log(`%c   Type: ${data.scam_type}`, 'color: #f59e0b; font-size: 13px')
      if (upis.length > 0) {
        console.log(`%c   🔒 UPI BLOCKED: ${upis.join(', ')}`, 'color: #ef4444; font-weight: bold; font-size: 15px')
        console.log(`%c   ⛔ Payments to these UPIs will now be HELD by Model 2`, 'color: #dc2626; font-weight: bold')
      }
      console.log('%c   Indicators:', 'color: #94a3b8', data.key_indicators)
      try { new Notification('🚨 SCAM — ' + (upis[0] || data.scam_type), { body: `${conf}% confidence. ${upis.length > 0 ? 'UPI blocked: ' + upis.join(', ') : ''}` }) } catch {}
      return { scam: true, upis, confidence: conf }
    } else {
      console.log('%c✅ Email appears safe', 'color: #22c55e; font-size: 14px')
      return { scam: false }
    }
  } catch (err) {
    console.error('❌ H.I.V.E. scan failed:', err.message)
    console.log('%c💡 Make sure Scam Shield backend is running at ' + window.HIVE_API, 'color: #f59e0b')
  }
}

// Auto-scan: watch for Gmail email opens (MutationObserver)
window.hiveAutoWatch = function() {
  if (window._hiveWatcher) { console.log('Already watching.'); return }
  console.log('%c👁️ H.I.V.E. now watching Gmail for new emails...', 'color: #6366f1; font-size: 13px; font-weight: bold')
  let lastScanned = ''
  window._hiveWatcher = setInterval(async () => {
    const el = document.querySelector('.a3s.aiL') || document.querySelector('.ii.gt')
    if (el) {
      const text = el.innerText || ''
      if (text.length > 30 && text !== lastScanned) {
        lastScanned = text
        await window.hiveScan()
      }
    }
  }, 3000)
  console.log('%c   Checking every 3 seconds. Run hiveStopWatch() to stop.', 'color: #94a3b8')
}

window.hiveStopWatch = function() {
  if (window._hiveWatcher) { clearInterval(window._hiveWatcher); window._hiveWatcher = null }
  console.log('Stopped watching.')
}

console.log('%c🛡️ Scam Shield — H.I.V.E. Console API Ready', 'color: #6366f1; font-size: 14px; font-weight: bold')
console.log('%c   scanEmail("email text")    — scan any text', 'color: #94a3b8')
console.log('%c   demoScam("upi@id")         — quick scam test', 'color: #94a3b8')
console.log('')
console.log('%c📧 Gmail Auto-Scanner:', 'color: #6366f1; font-size: 13px; font-weight: bold')
console.log('%c   hiveScan()       — scan the currently open Gmail email', 'color: #94a3b8')
console.log('%c   hiveAutoWatch()  — auto-scan every new email you open', 'color: #94a3b8')
console.log('%c   hiveStopWatch()  — stop auto-scanning', 'color: #94a3b8')
