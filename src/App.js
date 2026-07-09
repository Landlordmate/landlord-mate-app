import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { supabase } from './supabase';
import logo from './Logo Landlord mate.jpeg';
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://1e789b2e334793578d6fcee57a284887@o4511667260948480.ingest.de.sentry.io/4511667272417360",
});

const TURNSTILE_SITE_KEY = '0x4AAAAAADueBaC2ed2qo-XQ';

const Turnstile = forwardRef(function Turnstile({ siteKey, onVerify, onExpire }, ref) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useImperativeHandle(ref, () => ({
    resetCaptcha: () => {
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  }));

  useEffect(() => {
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !window.turnstile || !containerRef.current || widgetIdRef.current !== null) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onVerify(token),
        'expired-callback': () => { if (onExpire) onExpire(); },
        'error-callback': () => { if (onExpire) onExpire(); },
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
      if (existingScript) {
        existingScript.addEventListener('load', renderWidget);
      } else {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current !== null) {
        try { window.turnstile.remove(widgetIdRef.current); } catch (e) {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  return <div ref={containerRef} />;
});

const font = "'Nunito', sans-serif";
const navy = '#0f1e30';
const navyLight = '#1a2e45';
const blue = '#2b7cd3';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const PRICE_IDS = {
  starter: { annual: 'price_1TpZbC5NBmtcziU4LjXThhwZ', monthly: 'price_1TpZbC5NBmtcziU438DdnrvJ' },
  pro: { annual: 'price_1TpZcK5NBmtcziU4tXlBZm2K', monthly: 'price_1TpZcK5NBmtcziU4HNgnGsxM' },
  portfolio: { annual: 'price_1TpZcS5NBmtcziU41LfqiSyT', monthly: 'price_1TpZcS5NBmtcziU4b7kMtQJ1' },
  agent_starter: { annual: 'price_1TpZcY5NBmtcziU4yJyvyefF', monthly: 'price_1TpZcY5NBmtcziU499WC0B73' },
  agent_pro: { annual: 'price_1TpZcd5NBmtcziU4Me9q0PYO', monthly: 'price_1TpZcc5NBmtcziU4pxw1xjBT' },
  agent_portfolio: { annual: 'price_1TpZci5NBmtcziU45Y97MTe5', monthly: 'price_1TpZci5NBmtcziU493pLJiSk' },
};

const LANDLORD_DOC_TYPES = [
  'Passport',
  'Driving Licence',
  'National Insurance Card',
  'Rent Smart Wales Licence',
  'Proof of Address',
  'Tenancy Deposit Scheme Certificate',
  'Professional Qualification',
  'Other'
];

const DOC_TYPES = [
  'Gas Safety Certificate',
  'EICR (Electrical Report)',
  'EPC (Energy Performance)',
  'HMO Licence',
  'Tenancy Agreement',
  'Written Statement (Wales Occupation Contract)',
  'Deposit Certificate',
  'Rent Smart Wales Licence',
  'Selective Licence',
  'Smoke & Carbon Monoxide Alarms',
  'Legionella Risk Assessment',
  'PAT Test (Portable Appliance Testing)',
  'Inventory & Check-In Report',
  'Check-Out Report',
  'Guarantor Agreement',
  'Insurance Certificate',
  'Fitness for Human Habitation',
  'Other'
];

const COUNTRIES = ['England', 'Wales', 'Scotland', 'Northern Ireland'];

// Returns true if any property in the given list is in Wales.
// Properties with no country set yet default to "not Wales" — safer to
// under-show Welsh-specific content than confuse a non-Welsh landlord.
function isWalesRelevant(properties) {
  if (!properties || properties.length === 0) return false;
  return properties.some(p => p.country === 'Wales');
}

function getExpiryStatus(expiryDate) {
  if (!expiryDate) return null;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Expired', type: 'expired' };
  if (daysLeft <= 30) return { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: `${daysLeft}d left`, type: 'urgent' };
  if (daysLeft <= 90) return { color: '#eab308', bg: 'rgba(234,179,8,0.15)', label: `${daysLeft}d left`, type: 'soon' };
  return { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', label: `${daysLeft}d left`, type: 'good' };
}

function getTrialStatus(trialEndsAt) {
  if (!trialEndsAt) return { expired: false, daysLeft: 7 };
  const now = new Date();
  const end = new Date(trialEndsAt);
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return { expired: daysLeft <= 0, daysLeft: Math.max(0, daysLeft) };
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Tidies up display casing only (e.g. "MICHAEL GRAHAM YOUNG" -> "Michael Graham Young").
// Never changes what's actually stored in the database, just how it's shown.
function toDisplayCase(name) {
  if (!name) return name;
  // Leave short all-caps words alone (likely intentional acronyms, e.g. "MGY", "UK")
  return name.split(' ').map(word => {
    if (word.length <= 3 && word === word.toUpperCase()) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

const COMPLIANCE_WEIGHTS = {
  'Gas Safety Certificate': 25,
  'EICR (Electrical Report)': 20,
  'EPC (Energy Performance)': 15,
  'HMO Licence': 15,
  'Smoke & Carbon Monoxide Alarms': 15,
  'Tenancy Agreement': 10,
};

function getComplianceScore(docs) {
  if (!docs || docs.length === 0) return 0;
  let score = 0;
  for (const [docType, points] of Object.entries(COMPLIANCE_WEIGHTS)) {
    const match = docs.find(d => d.document_type === docType);
    if (match) {
      const status = getExpiryStatus(match.expiry_date);
      if (!match.expiry_date || status?.type === 'good') score += points;
      else if (status?.type === 'soon') score += Math.round(points * 0.7);
      else if (status?.type === 'urgent') score += Math.round(points * 0.3);
    }
  }
  return Math.min(score, 100);
}

function getScoreColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 50) return '#eab308';
  return '#ef4444';
}

function getCountryFlag(country) {
  switch (country) {
    case 'Wales': return '🏴󠁧󠁢󠁷󠁬󠁳󠁥';
    case 'Scotland': return '🏴󠁧󠁢󠁳󠁣󠁴󠁿';
    case 'Northern Ireland': return '🇬🇧';
    default: return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  }
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function CompliancePieChart({ documents }) {
  const expired = documents.filter(d => getExpiryStatus(d.expiry_date)?.type === 'expired').length;
  const urgent = documents.filter(d => getExpiryStatus(d.expiry_date)?.type === 'urgent').length;
  const soon = documents.filter(d => getExpiryStatus(d.expiry_date)?.type === 'soon').length;
  const good = documents.filter(d => getExpiryStatus(d.expiry_date)?.type === 'good').length;
  const noExpiry = documents.filter(d => !d.expiry_date).length;
  const total = documents.length;
  if (total === 0) return null;
  const size = 180, cx = 90, cy = 90, r = 66, innerR = 39;
  const segments = [
    { count: good, color: '#22c55e', label: 'Compliant' },
    { count: soon, color: '#eab308', label: 'Expiring Soon' },
    { count: urgent + expired, color: '#ef4444', label: 'Action Needed' },
    { count: noExpiry, color: '#4a9eff', label: 'No Expiry' },
  ].filter(s => s.count > 0);
  let startAngle = -Math.PI / 2;
  const paths = segments.map(seg => {
    const angle = (seg.count / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle), iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle), iy2 = cy + innerR * Math.sin(startAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
    startAngle = endAngle;
    return { ...seg, d };
  });
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>
      <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 16px' }}>Compliance Overview</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
          {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} opacity="0.9" />)}
          <circle cx={cx} cy={cy} r={innerR - 2} fill="#0f1e30" />
          <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="20" fontWeight="900" fontFamily="Nunito, sans-serif">{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11" fontFamily="Nunito, sans-serif">DOCS</text>
        </svg>
        <div style={{ flex: 1, minWidth: '140px' }}>
          {[
            { count: good, color: '#22c55e', label: 'Compliant' },
            { count: soon, color: '#eab308', label: 'Expiring Soon' },
            { count: urgent + expired, color: '#ef4444', label: 'Action Needed' },
            { count: noExpiry, color: '#4a9eff', label: 'No Expiry Set' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', flex: 1 }}>{item.label}</span>
              <span style={{ color: 'white', fontWeight: '800', fontSize: '13px' }}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OnboardingWizard({ onComplete, onAddProperty, user }) {
  const [step, setStep] = useState(0);
  const [propertyCount, setPropertyCount] = useState('');
  const [docNeeds, setDocNeeds] = useState([]);
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();

  const propertyOptions = ['1', '2-3', '4-5', '6-10', '11-20', '20+'];
  const docOptions = [
    { key: 'gas_safe', label: 'Gas Safety Certificate' },
    { key: 'eicr', label: 'EICR (Electrical)' },
    { key: 'epc', label: 'EPC' },
    { key: 'deposit', label: 'Deposit Protection Certificate' },
    { key: 'tenancy', label: 'Tenancy Agreement' },
    { key: 'legionella', label: 'Legionella Risk Assessment' },
  ];

  const toggleDoc = (key) => setDocNeeds(docNeeds.includes(key) ? docNeeds.filter(d => d !== key) : [...docNeeds, key]);

  const recommendedPlan = (count) => {
    if (count === '1' || count === '2-3') return 'Starter (£149/year)';
    if (count === '4-5' || count === '6-10') return 'Pro (£299/year)';
    return 'Portfolio (£499/year)';
  };

  const saveStep0 = async () => {
    setSaving(true);
    try {
      await supabase.from('users').update({ property_count: propertyCount, doc_needs: docNeeds }).eq('id', user.id);
    } catch (e) { console.error(e); }
    setSaving(false);
    setStep(1);
  };

  const steps = [
    { icon: '🏠', title: 'Add your first property', desc: "Start by adding a rental property. We'll look up the address from your postcode.", action: 'Add Property →', isAdd: true, hint: null },
    { icon: '📄', title: 'Upload a compliance document', desc: "Upload your Gas Safety Certificate, EICR, EPC or any other certificate. Set the expiry date and we'll remind you automatically.", hint: 'We send reminders at 90, 60, 30, 14 and 7 days before expiry.', action: 'Got it →', isAdd: false },
    { icon: '🔗', title: 'Share with your agent', desc: 'Generate a secure link to share your compliance documents with your letting agent instantly — no login required for them.', action: "Let's go! →", isAdd: false, hint: null },
  ];

  if (step === 0) {
    return (
      <div style={{ padding: isMobile ? '20px 16px 80px' : '32px', flex: 1 }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ color: 'white', fontWeight: '900', fontSize: isMobile ? '22px' : '26px', margin: '0 0 8px' }}>Welcome! Let's get you set up 👋</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: 0 }}>Just two quick questions first</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '20px', padding: '32px', marginBottom: '16px' }}>
            <p style={{ color: 'white', fontWeight: '800', fontSize: '17px', margin: '0 0 14px' }}>How many rental properties do you own?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '28px' }}>
              {propertyOptions.map(opt => (
                <button key={opt} onClick={() => setPropertyCount(opt)} style={{ padding: '10px 18px', borderRadius: '20px', border: propertyCount === opt ? '2px solid #2b7cd3' : '1px solid rgba(255,255,255,0.15)', background: propertyCount === opt ? 'rgba(43,124,211,0.2)' : 'rgba(255,255,255,0.04)', color: propertyCount === opt ? 'white' : 'rgba(255,255,255,0.7)', fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>{opt}</button>
              ))}
            </div>
            {propertyCount && (
              <p style={{ color: '#7db3e8', fontSize: '13px', margin: '0 0 28px', background: 'rgba(43,124,211,0.1)', border: '1px solid rgba(43,124,211,0.25)', borderRadius: '10px', padding: '10px 16px' }}>
                💡 Based on that, <strong>{recommendedPlan(propertyCount)}</strong> would likely suit you best — but you can try everything free for 7 days first.
              </p>
            )}
            <p style={{ color: 'white', fontWeight: '800', fontSize: '17px', margin: '0 0 14px' }}>Which documents do you need to track?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '28px' }}>
              {docOptions.map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', border: docNeeds.includes(opt.key) ? '2px solid #2b7cd3' : '1px solid rgba(255,255,255,0.12)', background: docNeeds.includes(opt.key) ? 'rgba(43,124,211,0.12)' : 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={docNeeds.includes(opt.key)} onChange={() => toggleDoc(opt.key)} style={{ width: '18px', height: '18px', accentColor: '#2b7cd3' }} />
                  <span style={{ color: 'white', fontSize: '14px' }}>{opt.label}</span>
                </label>
              ))}
            </div>
            <button onClick={saveStep0} disabled={!propertyCount || saving} style={{ width: '100%', padding: '14px', background: '#2b7cd3', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontFamily: font, fontWeight: '700', cursor: !propertyCount || saving ? 'not-allowed' : 'pointer', opacity: !propertyCount || saving ? 0.5 : 1 }}>
              {saving ? 'Saving...' : 'Continue →'}
            </button>
          </div>
          <p onClick={() => setStep(1)} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '13px', cursor: 'pointer', margin: 0 }}>Skip for now</p>
        </div>
      </div>
    );
  }

  const current = steps[step - 1];
  return (
    <div style={{ padding: isMobile ? '20px 16px 80px' : '32px', flex: 1 }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'white', fontWeight: '900', fontSize: isMobile ? '22px' : '26px', margin: '0 0 8px' }}>Welcome! Let's get you set up 👋</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: 0 }}>3 quick steps and you're protected</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: s < step ? '#22c55e' : s === step ? '#2b7cd3' : 'rgba(255,255,255,0.1)', border: `2px solid ${s < step ? '#22c55e' : s === step ? '#2b7cd3' : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: '800' }}>
                {s < step ? '✓' : s}
              </div>
              {s < 3 && <div style={{ width: '40px', height: '2px', background: s < step ? '#22c55e' : 'rgba(255,255,255,0.1)', borderRadius: '2px' }} />}
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '20px', padding: '32px', textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>{current.icon}</div>
          <h2 style={{ color: 'white', fontWeight: '800', fontSize: '20px', margin: '0 0 12px' }}>Step {step}: {current.title}</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', lineHeight: '1.7', margin: '0 0 24px' }}>{current.desc}</p>
          {current.hint && (
            <div style={{ background: 'rgba(43,124,211,0.1)', border: '1px solid rgba(43,124,211,0.25)', borderRadius: '10px', padding: '10px 16px', marginBottom: '24px' }}>
              <p style={{ color: '#7db3e8', fontSize: '13px', margin: 0 }}>💡 {current.hint}</p>
            </div>
          )}
          <button onClick={() => { if (current.isAdd) { onAddProperty(); } else if (step < 3) { setStep(step + 1); } else { onComplete(); } }} style={{ width: '100%', padding: '14px', background: '#2b7cd3', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
            {current.action}
          </button>
        </div>
        {step < 3 && <p onClick={() => step < 3 ? setStep(step + 1) : onComplete()} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '13px', cursor: 'pointer', margin: 0 }}>Skip for now</p>}
      </div>
    </div>
  );
}

function HomeScreenBanner({ onDismiss }) {
  const ios = isIOS();
  const android = isAndroid();
  if (!ios && !android) return null;

  return (
    <div style={{ background: 'rgba(43,124,211,0.12)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <span style={{ fontSize: '22px', flexShrink: 0 }}>📱</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', color: 'white', fontWeight: '700', fontSize: '13px' }}>Get the full app experience</p>
        {ios && (
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.55)', fontSize: '12px', lineHeight: '1.5' }}>
            Tap the <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Share</strong> button at the bottom of your browser, then tap <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Add to Home Screen</strong>.
          </p>
        )}
        {android && (
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.55)', fontSize: '12px', lineHeight: '1.5' }}>
            Tap the <strong style={{ color: 'rgba(255,255,255,0.8)' }}>menu icon</strong> in your browser, then tap <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Add to Home screen</strong>.
          </p>
        )}
      </div>
      <button onClick={onDismiss} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '18px', cursor: 'pointer', padding: '0', flexShrink: 0, lineHeight: 1 }}>×</button>
    </div>
  );
}

function PaywallScreen({ user, onSubscribe, subscribing, onClose, daysLeft }) {
  const isMobile = useIsMobile();
  const [billing, setBilling] = useState('annual');

  const plans = [
    {
      key: 'starter',
      name: 'Starter',
      annualPrice: 149,
      monthlyPrice: 14.90,
      properties: '1-3 properties',
      desc: 'Perfect for small landlords',
      color: blue,
      features: ['AI document scanning', 'Automatic expiry reminders', 'Secure document storage'],
    },
    {
      key: 'pro',
      name: 'Pro',
      annualPrice: 299,
      monthlyPrice: 29.90,
      properties: '4-10 properties',
      desc: 'Most popular',
      color: '#7c3aed',
      highlight: true,
      features: ['Everything in Starter', 'Custom reminder schedules'],
    },
    {
      key: 'portfolio',
      name: 'Portfolio',
      annualPrice: 499,
      monthlyPrice: 49.90,
      properties: 'Unlimited properties',
      desc: 'Serious portfolio landlords',
      color: '#059669',
      features: ['Everything in Pro', 'CSV portfolio export', 'Priority support'],
    },
  ];

  const getPriceId = (plan) => PRICE_IDS[plan.key][billing];
  const isExpired = !onClose;
  const lostFeatures = [
    'Automatic certificate expiry reminders',
    'Uploading new documents',
    'Agent sharing links',
    'AI document scanning and Ask Mate',
  ];

  return (
    <div style={{ minHeight: '100vh', background: navy, fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' }}>
      {onClose && (
        <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer' }}>×</button>
      )}
      <div style={{ width: '100%', maxWidth: '680px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src={logo} alt="The Landlord Mate" style={{ display: 'block', height: isMobile ? '72px' : '88px', margin: '0 auto 20px' }} />

          {!isExpired && typeof daysLeft === 'number' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: '999px', padding: '6px 16px', marginBottom: '16px' }}>
              <span style={{ fontSize: '14px' }}>⏰</span>
              <span style={{ color: '#eab308', fontSize: '13px', fontWeight: '800' }}>
                Your trial ends in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
              </span>
            </div>
          )}

          <h1 style={{ color: 'white', fontWeight: '900', fontSize: isMobile ? '24px' : '28px', margin: '0 0 12px' }}>
            {isExpired ? 'Your free trial has ended' : "Don't lose your compliance protection"}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', margin: '0 0 20px' }}>
            {isExpired
              ? 'Choose a plan to get back into your documents and reminders'
              : 'Pick a plan now and keep everything running without a gap'}
          </p>

          <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: '800', letterSpacing: '1px', margin: '0 0 10px' }}>WITHOUT A PLAN, YOU'LL LOSE</p>
            {lostFeatures.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: i === lostFeatures.length - 1 ? 0 : '8px' }}>
                <span style={{ color: '#f97316', fontSize: '14px', lineHeight: '20px' }}>✕</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '20px' }}>{f}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '4px', marginBottom: '16px' }}>
            <button
              onClick={() => setBilling('monthly')}
              style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', background: billing === 'monthly' ? 'white' : 'transparent', color: billing === 'monthly' ? navy : 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}
            >Monthly</button>
            <button
              onClick={() => setBilling('annual')}
              style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', background: billing === 'annual' ? 'white' : 'transparent', color: billing === 'annual' ? navy : 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}
            >Annual</button>
          </div>
          {billing === 'annual' && (
            <p style={{ color: '#22c55e', fontSize: '13px', fontWeight: '700', margin: '0 0 12px' }}>Save 2 months free with annual billing</p>
          )}

          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '10px 16px', marginBottom: '8px' }}>
            <p style={{ color: '#22c55e', fontSize: '13px', margin: 0, fontWeight: '600' }}>Your documents are safe and stored. Subscribe any time to switch reminders and uploads back on.</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexDirection: isMobile ? 'column' : 'row' }}>
          {plans.map(plan => {
            const displayPrice = billing === 'annual' ? `£${plan.annualPrice}` : `£${plan.monthlyPrice.toFixed(2)}`;
            const period = billing === 'annual' ? '/year' : '/month';
            const annualEquiv = billing === 'monthly' ? `£${plan.annualPrice}/yr if paid annually` : null;

            return (
              <div key={plan.key} style={{ flex: 1, background: plan.highlight ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', border: `2px solid ${plan.highlight ? '#7c3aed' : 'rgba(255,255,255,0.1)'}`, borderRadius: '16px', padding: '24px', position: 'relative' }}>
                {plan.highlight && <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#7c3aed', color: 'white', padding: '4px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap' }}>MOST POPULAR</div>}
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '800', letterSpacing: '2px', margin: '0 0 8px' }}>{plan.name.toUpperCase()}</p>
                <p style={{ color: 'white', fontWeight: '900', fontSize: '32px', margin: '0 0 2px', lineHeight: 1 }}>
                  {displayPrice}<span style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>{period}</span>
                </p>
                {annualEquiv && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '2px 0 4px' }}>{annualEquiv}</p>}
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 16px' }}>{plan.properties}</p>
                {plan.features && plan.features.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    {plan.features.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ color: plan.color, fontSize: '12px', lineHeight: '18px' }}>✓</span>
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', lineHeight: '18px' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => onSubscribe(getPriceId(plan))}
                  disabled={subscribing}
                  style={{ width: '100%', padding: '12px', background: plan.color, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: subscribing ? 'not-allowed' : 'pointer', opacity: subscribing ? 0.7 : 1 }}
                >
                  {subscribing ? 'Loading...' : `Choose ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '24px' }}>
          Secure payment via Stripe · Cancel anytime · Questions? <a href="mailto:support@thelandlordmate.com" style={{ color: blue }}>support@thelandlordmate.com</a>
        </p>
      </div>
    </div>
  );
}

function TrialNudgeBanner({ daysLeft, onSubscribe }) {
  return (
    <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '20px' }}>⏰</span>
      <p style={{ margin: 0, color: '#eab308', fontWeight: '700', fontSize: '13px', flex: 1 }}>
        Your free trial ends in {daysLeft} {daysLeft === 1 ? 'day' : 'days'} — choose a plan to keep access
      </p>
      <button onClick={onSubscribe} style={{ background: '#eab308', color: '#0f1e30', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontFamily: font, fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        Choose a plan
      </button>
    </div>
  );
}

function AgentView({ token }) {
  const [property, setProperty] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: prop } = await supabase.from('properties').select('*').eq('share_token', token).single();
      if (prop) {
        setProperty(prop);
        const { data: docs } = await supabase.from('documents').select('*').eq('property_id', prop.id);
        if (docs) setDocuments(docs);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) return <div style={{ minHeight: '100vh', background: navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}><p style={{ color: 'white' }}>Loading...</p></div>;
  if (!property) return <div style={{ minHeight: '100vh', background: navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}><p style={{ color: 'white' }}>Invalid or expired link.</p></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0f1e30', fontFamily: font }}>
      <div style={{ background: '#1a2e45', padding: '16px 24px', display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(43,124,211,0.2)' }}>
        <img src={logo} alt="The Landlord Mate" style={{ height: '40px' }} />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginLeft: '16px' }}>Compliance View</span>
      </div>
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ background: 'rgba(43,124,211,0.1)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px' }}>
          <p style={{ margin: 0, color: '#7db3e8', fontSize: '14px' }}>📋 Shared compliance summary — read only.</p>
        </div>
        <h1 style={{ color: 'white', fontWeight: '800', fontSize: '22px' }}>{property.address_line_1}</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '-8px', textTransform: 'capitalize', fontSize: '13px' }}>{property.property_type}{property.country ? ` · ${property.country}` : ''}</p>
        {documents.length === 0 && <div style={{ background: 'rgba(255,255,255,0.04)', padding: '32px', borderRadius: '12px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No documents uploaded yet</div>}
        {documents.map(doc => {
          const status = getExpiryStatus(doc.expiry_date);
          return (
            <div key={doc.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', borderRadius: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status ? status.color : '#666', flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: 'white', fontSize: '14px' }}>{doc.document_type}</p>
                  {doc.expiry_date && <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Expires: {new Date(doc.expiry_date).toLocaleDateString('en-GB')}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {status && <span style={{ background: status.bg, color: status.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{status.label}</span>}
                {doc.file_path && (() => { const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_path); return <a href={data.publicUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', background: 'rgba(43,124,211,0.15)', color: '#4a9eff', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>👁 View</a>; })()}
              </div>
            </div>
          );
        })}
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '12px', marginTop: '32px' }}>Powered by The Landlord Mate · thelandlordmate.com</p>
      </div>
    </div>
  );
}

function BottomNav({ activeScreen, setScreen }) {
  const items = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'askmate', icon: '💬', label: 'Ask Mate' },
    { id: 'properties', icon: '🏠', label: 'Properties' },
    { id: 'landlordocs', icon: '🪪', label: 'My Docs' },
    { id: 'letters', icon: '📝', label: 'Letters' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0d1b2a', borderTop: '1px solid rgba(43,124,211,0.2)', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map(item => (
        <div key={item.id} onClick={() => setScreen(item.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', cursor: 'pointer', color: activeScreen === item.id ? blue : 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: '700', gap: '4px' }}>
          <span style={{ fontSize: '20px' }}>{item.icon}</span>
          {item.label}
        </div>
      ))}
    </div>
  );
}

function Sidebar({ activeScreen, setScreen, user, handleSignOut, properties, documents, landlordLogoUrl, setSelectedLetter, setSelectedProperty }) {
  const urgentCount = documents.filter(d => {
    const s = getExpiryStatus(d.expiry_date);
    return s?.type === 'expired' || s?.type === 'urgent';
  }).length;

  const navItem = (id, icon, label, badge) => (
    <div onClick={() => {
      setScreen(id);
      if (id === 'letters') setSelectedLetter(null);
      if (id === 'properties') setSelectedProperty(null);
    }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', cursor: 'pointer', borderLeft: `3px solid ${activeScreen === id ? blue : 'transparent'}`, background: activeScreen === id ? 'rgba(43,124,211,0.1)' : 'transparent', color: activeScreen === id ? 'white' : 'rgba(255,255,255,0.75)', fontSize: '13px', fontWeight: '600', transition: 'all 0.15s' }}>
      <span style={{ fontSize: '16px' }}>{icon}</span>
      {label}
      {badge > 0 && <span style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
    </div>
  );

  return (
    <div style={{ width: '220px', minHeight: '100vh', background: '#0d1b2a', borderRight: '1px solid rgba(43,124,211,0.15)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(43,124,211,0.15)', cursor: 'pointer' }} onClick={() => setScreen('dashboard')}>
        <img src={logo} alt="The Landlord Mate" style={{ height: '72px' }} />
        {landlordLogoUrl && (
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(43,124,211,0.15)' }}>
            <img src={landlordLogoUrl} alt="Your logo" style={{ height: '96px', width: '96px', objectFit: 'contain', display: 'block', background: 'white', borderRadius: '10px', padding: '6px' }} />
          </div>
        )}
      </div>
      <div style={{ padding: '16px 0', flex: 1 }}>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', padding: '0 20px', marginBottom: '8px' }}>OVERVIEW</p>
        {navItem('dashboard', '📊', 'Dashboard', urgentCount)}
        {navItem('askmate', '💬', 'Ask Mate')}
        {navItem('properties', '🏠', 'All Properties')}
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', padding: '0 20px', margin: '16px 0 8px' }}>RESOURCES</p>
        {navItem('landlordocs', '🪪', 'My Documents')}
        {isWalesRelevant(properties) && navItem('wales', '🏴󠁧󠁢󠁷󠁬󠁳󠁥', 'Wales Compliance')}
        {navItem('letters', '📝', 'Letter Templates')}
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', padding: '0 20px', margin: '16px 0 8px' }}>ACCOUNT</p>
        {navItem('settings', '⚙️', 'Settings')}
        {navItem('faq', '❓', 'Help & FAQs')}
      </div>
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(43,124,211,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: blue, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '13px', flexShrink: 0 }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <span style={{ display: 'inline-block', background: 'rgba(43,124,211,0.2)', color: blue, padding: '1px 7px', borderRadius: '20px', fontSize: '9px', fontWeight: '700', marginBottom: '3px' }}>LANDLORD</span>
            <p style={{ margin: 0, color: 'white', fontSize: '12px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>{properties.length} {properties.length === 1 ? 'property' : 'properties'}</p>
          </div>
        </div>
        <button onClick={handleSignOut} style={{ width: '100%', padding: '10px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: font }}>Sign Out</button>
      </div>
    </div>
  );
}

function AskAnythingWidget({ properties, forceWales }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Thinking...');
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!loading) return;
    const msgs = ['Thinking...', 'Checking compliance rules...', 'Almost there...'];
    let i = 0;
    setLoadingMsg(msgs[0]);
    const interval = setInterval(() => { i = (i + 1) % msgs.length; setLoadingMsg(msgs[i]); }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  // Agents always see the Wales-aware prompt set (they may manage Welsh
  // landlords even if their own account isn't Welsh) — same rule already
  // used for the full Ask Mate AI chat. Landlords only see it if at least
  // one of their properties is in Wales.
  const showWalesPrompts = forceWales || isWalesRelevant(properties);

  const walesPrompts = [
    'What documents do I need for a Welsh tenancy?',
    'How often does a Gas Safety Certificate need renewing?',
    'What is a Section 173 notice?',
    'When must I protect a tenancy deposit?',
    'What is Rent Smart Wales?',
    'What is an EICR and when do I need one?',
    'What is a Written Occupation Contract?',
    'How much notice must I give a tenant in Wales?',
  ];

  const generalPrompts = [
    'How often does a Gas Safety Certificate need renewing?',
    'What is an EICR and when do I need one?',
    'When must I protect a tenancy deposit?',
    'What is a Section 21 notice?',
    'Do I need an EPC to let my property?',
    'What are my responsibilities for smoke alarms?',
    'What is a Right to Rent check?',
    'How much notice must I give a tenant in England?',
  ];

  const suggestions = showWalesPrompts ? walesPrompts : generalPrompts;

  const handleAsk = async (q) => {
    const query = q || question;
    if (!query.trim()) return;
    setLoading(true);
    setAnswer('');
    try {
      const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/ask-anything', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
        body: JSON.stringify({ question: query, isWales: showWalesPrompts })
      });
      const data = await res.json();
      setAnswer(data.answer || 'Sorry, I could not get an answer. Please try again.');
    } catch (e) {
      setAnswer('Sorry, something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{ background: 'rgba(43,124,211,0.08)', border: '1px solid rgba(43,124,211,0.25)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px', paddingTop: '8px' }}>
        <img src={logo} alt="The Landlord Mate" style={{ height: '90px', marginBottom: '12px' }} />
        <h2 style={{ margin: '0 0 10px', color: 'white', fontWeight: '900', fontSize: '36px', fontFamily: font, letterSpacing: '-0.5px' }}>Ask Mate</h2>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '15px' }}>Instant answers on landlord law and compliance</p>
      </div>

      <div style={{ position: 'relative', marginBottom: '14px' }}>
        <input
          type="text"
          placeholder={showWalesPrompts ? "Ask about Gas Safe, EICR, Rent Smart Wales, tenancy law..." : "Ask about Gas Safe, EICR, deposits, tenancy law..."}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAsk(); }}
          style={{ width: '100%', padding: '16px 56px 16px 20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(43,124,211,0.4)', borderRadius: '50px', color: 'white', fontSize: '15px', fontFamily: font, outline: 'none', boxSizing: 'border-box' }}
        />
        <button
          onClick={() => handleAsk()}
          disabled={loading || !question.trim()}
          style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '38px', height: '38px', background: blue, color: 'white', border: 'none', borderRadius: '50%', fontSize: '16px', cursor: loading || !question.trim() ? 'not-allowed' : 'pointer', opacity: loading || !question.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {loading ? '⋯' : '↑'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => { setQuestion(s); handleAsk(s); }} style={{ background: 'rgba(43,124,211,0.15)', border: '1px solid rgba(43,124,211,0.3)', color: '#7db3e8', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '16px', height: '16px', border: '2px solid rgba(43,124,211,0.3)', borderTopColor: blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{loadingMsg}</p>
        </div>
      )}

      {answer && !loading && (
        <div style={{ marginTop: '16px', background: 'rgba(43,124,211,0.08)', border: '1px solid rgba(43,124,211,0.25)', borderRadius: '12px', padding: '20px 24px' }}>
          <p style={{ margin: '0 0 10px', color: blue, fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>🤖 Answer</p>
          <p style={{ margin: 0, color: 'white', fontSize: '15px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{answer}</p>
          <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>AI-generated — always verify with official sources or a solicitor for legal matters.</p>
        </div>
      )}
    </div>
  );
}

function Dashboard({ properties, documents, setScreen, setSelectedProperty, handleSelectProperty, userName, showHomeBanner, onDismissBanner, trialDaysLeft, showTrialNudge, onSubscribe, onPrintReport }) {
  const [showAgentShareModal, setShowAgentShareModal] = useState(false);
  const byExpirySoonest = (a, b) => new Date(a.expiry_date) - new Date(b.expiry_date);
  const expiredDocs = documents.filter(d => getExpiryStatus(d.expiry_date)?.type === 'expired').sort(byExpirySoonest);
  const urgentDocs = documents.filter(d => getExpiryStatus(d.expiry_date)?.type === 'urgent').sort(byExpirySoonest);
  const soonDocs = documents.filter(d => getExpiryStatus(d.expiry_date)?.type === 'soon').sort(byExpirySoonest);
  const goodDocs = documents.filter(d => getExpiryStatus(d.expiry_date)?.type === 'good');
  const actionNeeded = [...expiredDocs, ...urgentDocs];
  const isMobile = useIsMobile();

  const statCard = (label, value, color, sub, onClick) => (
    <div onClick={onClick} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: isMobile ? '16px' : '20px 24px', flex: 1, minWidth: isMobile ? '140px' : 'auto', cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.2s' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = 'rgba(43,124,211,0.4)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
      <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.65)', fontSize: '10px', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '0 0 4px', color: color, fontSize: isMobile ? '28px' : '36px', fontWeight: '900', lineHeight: 1 }}>{value}</p>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>{sub}</p>
    </div>
  );

  const docRow = (doc, property) => {
    const status = getExpiryStatus(doc.expiry_date);
    return (
      <div key={doc.id} onClick={() => { setSelectedProperty(property); setScreen('property'); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status?.color || '#666', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, color: 'white', fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.document_type}</p>
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{property?.address_line_1} · {doc.expiry_date ? `Due ${new Date(doc.expiry_date).toLocaleDateString('en-GB')}` : 'No expiry set'}</p>
        </div>
        {status && <span style={{ background: status.bg, color: status.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>{status.label}</span>}
      </div>
    );
  };

  const getPropertyForDoc = (doc) => properties.find(p => p.id === doc.property_id);

  return (
    <div style={{ padding: isMobile ? '20px 16px 80px' : '32px', flex: 1, overflowY: 'auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ color: 'white', fontWeight: '900', fontSize: isMobile ? '22px' : '26px', margin: 0 }}>{getGreeting()}{userName ? `, ${userName}` : ''} 👋</h1>
            <span style={{ background: 'rgba(43,124,211,0.2)', color: blue, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>LANDLORD</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: '13px' }}>
            {actionNeeded.length > 0 ? `${actionNeeded.length} ${actionNeeded.length === 1 ? 'document needs' : 'documents need'} your attention` : 'All your documents are in order ✓'}
          </p>
        </div>
        {properties.length > 0 && (
          <button
            onClick={() => setShowAgentShareModal(true)}
            style={{ background: blue, color: 'white', border: 'none', borderRadius: '10px', padding: '12px 20px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
          >
            🔗 Share with your agent
          </button>
        )}
      </div>

      {showAgentShareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#0f2137', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '18px', fontWeight: '800' }}>🔗 Share with your agent</h3>
              <button onClick={() => setShowAgentShareModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '0 0 20px', lineHeight: 1.6 }}>
              The best way to share with your agent is to add their email address directly on each property. They'll get full, permanent visibility of your compliance documents automatically.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 16px' }}>Choose a property to add your agent's email or generate a one-off share link:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', marginBottom: '20px' }}>
              {properties.map(p => (
                <button key={p.id} onClick={() => { setShowAgentShareModal(false); handleSelectProperty(p); setScreen('properties'); }} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white', fontSize: '13px', fontFamily: font, fontWeight: '600', cursor: 'pointer', textAlign: 'left' }}>
                  🏠 {p.address_line_1}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAgentShareModal(false)} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {showHomeBanner && <HomeScreenBanner onDismiss={onDismissBanner} />}
      {showTrialNudge && <TrialNudgeBanner daysLeft={trialDaysLeft} onSubscribe={onSubscribe} />}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {statCard('Properties', properties.length, blue, 'All properties', () => setScreen('properties'))}
        {statCard('Documents', documents.length, '#22c55e', 'Stored safely', () => setScreen('properties'))}
        {statCard('Expiring', soonDocs.length, '#eab308', 'Within 90 days', () => {
          if (soonDocs.length > 0) {
            const targetProperty = properties.find(p => p.id === soonDocs[0].property_id);
            if (targetProperty) {
              handleSelectProperty(targetProperty);
              setScreen('properties');
              return;
            }
          }
          setScreen('properties');
        })}
        {statCard('Action', actionNeeded.length, '#ef4444', 'Expired or urgent', () => {
          if (actionNeeded.length > 0) {
            const worstDoc = actionNeeded[0];
            const targetProperty = properties.find(p => p.id === worstDoc.property_id);
            if (targetProperty) {
              handleSelectProperty(targetProperty);
              setScreen('properties');
              return;
            }
          }
          setScreen('properties');
        })}
      </div>

      {documents.length > 0 && <CompliancePieChart documents={documents} />}

      <div style={{ background: 'rgba(43,124,211,0.1)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '14px', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 4px', color: 'white', fontWeight: '800', fontSize: '15px' }}>🔗 Know another landlord?</p>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Share The Landlord Mate and help them stay compliant too.</p>
        </div>
        <button onClick={() => {
          const shareUrl = 'https://app.thelandlordmate.com';
          const shareText = 'I use The Landlord Mate to manage my property compliance — Gas Safe, EICR, EPC all in one place with automatic reminders. Try it free for 7 days:';
          if (navigator.share) {
            navigator.share({ title: 'The Landlord Mate', text: shareText, url: shareUrl });
          } else {
            navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
            alert('Link copied! Share it with other landlords.');
          }
        }} style={{ padding: '12px 24px', background: blue, border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Share Now →
        </button>
      </div>

      <AskAnythingWidget properties={properties} />

      {properties.length > 0 && (
        <div style={{ marginBottom: '24px', textAlign: 'right' }}>
          <button onClick={onPrintReport} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
            🖨️ Print Compliance Report
          </button>
          <button onClick={() => {
            const shareText = 'I use The Landlord Mate to manage my property compliance — Gas Safe, EICR, EPC all in one place with automatic reminders. Try it free for 7 days: https://app.thelandlordmate.com';
            if (navigator.share) { navigator.share({ title: 'The Landlord Mate', text: shareText, url: 'https://app.thelandlordmate.com' }); }
            else { navigator.clipboard.writeText(shareText); alert('Copied! Share with other landlords.'); }
          }} style={{ padding: '10px 20px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
            🔗 Share with a landlord
          </button>
        </div>
      )}

      {actionNeeded.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: '700', margin: '0 0 12px' }}>⚠ Expired — action needed</p>
          {actionNeeded.map(doc => docRow(doc, getPropertyForDoc(doc)))}
        </div>
      )}

      {soonDocs.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ color: '#eab308', fontSize: '13px', fontWeight: '700', margin: '0 0 12px' }}>⏰ Expiring soon</p>
          {soonDocs.map(doc => docRow(doc, getPropertyForDoc(doc)))}
        </div>
      )}

      {goodDocs.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ color: '#22c55e', fontSize: '13px', fontWeight: '700', margin: '0 0 12px' }}>✓ All good</p>
          {goodDocs.map(doc => docRow(doc, getPropertyForDoc(doc)))}
        </div>
      )}

      {documents.length === 0 && properties.length === 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', margin: '0 0 12px' }}>🏠</p>
          <p style={{ color: 'white', fontWeight: '700', fontSize: '16px', margin: '0 0 8px' }}>No documents yet</p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '0 0 20px' }}>Add a property and upload your compliance certificates</p>
          <button onClick={() => setScreen('properties')} style={{ background: blue, color: 'white', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: font }}>Add your first property</button>
        </div>
      )}
    </div>
  );
}

function AppShell({ screen, setScreen, user, handleSignOut, properties, allDocuments, children, landlordLogoUrl, setSelectedLetter, setSelectedProperty }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: navy, fontFamily: font }}>
      {!isMobile && <Sidebar activeScreen={screen} setScreen={setScreen} user={user} handleSignOut={handleSignOut} properties={properties} documents={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty} />}
      {isMobile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#0d1b2a', borderBottom: '1px solid rgba(43,124,211,0.15)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 100, height: '72px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={logo} alt="The Landlord Mate" style={{ height: '48px', cursor: 'pointer' }} onClick={() => setScreen('dashboard')} />
            {landlordLogoUrl && (
              <>
                <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.2)' }} />
                <img src={landlordLogoUrl} alt="Your logo" style={{ height: '52px', objectFit: 'contain', maxWidth: '140px' }} />
              </>
            )}
          </div>
          <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Sign Out</button>
        </div>
      )}
      <div style={{ flex: 1, overflowY: 'auto', marginTop: isMobile ? '72px' : 0 }}>
        {children}
      </div>
      {isMobile && <BottomNav activeScreen={screen} setScreen={setScreen} />}
    </div>
  );
}

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [userRecord, setUserRecord] = useState(null);
  const [properties, setProperties] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [propertyActionMessage, setPropertyActionMessage] = useState(null);
  const [newAddress, setNewAddress] = useState('');
  const [newPostcode, setNewPostcode] = useState('');
  const [newType, setNewType] = useState('house');
  const [newCountry, setNewCountry] = useState('Wales');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [addressResults, setAddressResults] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [screen, setScreen] = useState('login');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [confirmDeleteProperty, setConfirmDeleteProperty] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [scanningDocument, setScanningDocument] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [customDocType, setCustomDocType] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [noExpiry, setNoExpiry] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editingLandlordDoc, setEditingLandlordDoc] = useState(null);
  const [editLandlordDocType, setEditLandlordDocType] = useState('');
  const [editLandlordExpiry, setEditLandlordExpiry] = useState('');
  const [propertyNotes, setPropertyNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [todos, setTodos] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [newInventoryRoom, setNewInventoryRoom] = useState('');
  const [newInventoryItem, setNewInventoryItem] = useState('');
  const [newInventoryCondition, setNewInventoryCondition] = useState('Good');
  const [newInventoryNotes, setNewInventoryNotes] = useState('');
  const [newTodo, setNewTodo] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Maintenance');
  const [tenancyStart, setTenancyStart] = useState('');
  const [tenancyEnd, setTenancyEnd] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenancySaved, setTenancySaved] = useState(false);
  const [rentReviewDate, setRentReviewDate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchasePriceSaved, setPurchasePriceSaved] = useState(false);
  const [showPrintReport, setShowPrintReport] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [letterProperty, setLetterProperty] = useState('');
  const [letterTenant, setLetterTenant] = useState('');
  const [letterRent, setLetterRent] = useState('');
  const [letterNewRent, setLetterNewRent] = useState('');
  const [letterEffectiveDate, setLetterEffectiveDate] = useState('');
  const [editableLetter, setEditableLetter] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editDocType, setEditDocType] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [loginCaptchaToken, setLoginCaptchaToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [editingAgentEmailInline, setEditingAgentEmailInline] = useState(false);
  const [agentEmailInlineValue, setAgentEmailInlineValue] = useState('');
  const [savingAgentEmailInline, setSavingAgentEmailInline] = useState(false);
  const [propertyViewMode, setPropertyViewMode] = useState('tiles'); // 'tiles' or 'list'
  const [landlordPropSearch, setLandlordPropSearch] = useState('');
  const [landlordPropFilter, setLandlordPropFilter] = useState('all');
  const [landlordSearchFocused, setLandlordSearchFocused] = useState(false);
  const [editPropertyAddress, setEditPropertyAddress] = useState('');
  const [editPropertyType, setEditPropertyType] = useState('house');
  const [editPropertyCountry, setEditPropertyCountry] = useState('Wales');
  const [editPropertyAgentEmail, setEditPropertyAgentEmail] = useState('');
  const [landlordDocs, setLandlordDocs] = useState([]);
  const [showLandlordUpload, setShowLandlordUpload] = useState(false);
  const [landlordDocType, setLandlordDocType] = useState(LANDLORD_DOC_TYPES[0]);
  const [landlordExpiryDate, setLandlordExpiryDate] = useState('');
  const [landlordUploadFile, setLandlordUploadFile] = useState(null);
  const [scanningLandlordDoc, setScanningLandlordDoc] = useState(false);
  const [landlordScanResult, setLandlordScanResult] = useState(null);
  const [landlordScanError, setLandlordScanError] = useState('');
  const [landlordUploading, setLandlordUploading] = useState(false);
  const [settingsNewEmail, setSettingsNewEmail] = useState('');
  const [settingsEmailMsg, setSettingsEmailMsg] = useState('');
  const [settingsEmailError, setSettingsEmailError] = useState('');
  const [settingsName, setSettingsName] = useState('');
  const [settingsNameSaved, setSettingsNameSaved] = useState(false);
  const [settingsNameError, setSettingsNameError] = useState('');
  const [reminderDays, setReminderDays] = useState(null);
  const [reminderDaysSaved, setReminderDaysSaved] = useState(false);
  const [calendarLinkCopied, setCalendarLinkCopied] = useState(false);
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState('');
  const [settingsNewPassword, setSettingsNewPassword] = useState('');
  const [settingsPasswordMsg, setSettingsPasswordMsg] = useState('');
  const [settingsPasswordError, setSettingsPasswordError] = useState('');
  const [isRecovery, setIsRecovery] = useState(false);
  const [passwordResetDone, setPasswordResetDone] = useState(false);
  const [showHomeBanner, setShowHomeBanner] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [forcePaywall, setForcePaywall] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'choose-plan') {
      setForcePaywall(true);
    }
  }, []);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [accountType, setAccountType] = useState('landlord');
  const [agencyName, setAgencyName] = useState('');
  const [agencyNameEdit, setAgencyNameEdit] = useState('');
  const [agencyNameSaved, setAgencyNameSaved] = useState(false);
  const [referralSource, setReferralSource] = useState('');
  const [agentData, setAgentData] = useState(null);
  const [agentLandlords, setAgentLandlords] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [resendingId, setResendingId] = useState(null);
  const [nameAutoFilled, setNameAutoFilled] = useState(false);
  const [showAgentAddProperty, setShowAgentAddProperty] = useState(false);
  const [agentAddPropertyMessage, setAgentAddPropertyMessage] = useState(null);
  const [agentNewLandlordEmail, setAgentNewLandlordEmail] = useState('');
  const [showAgentUpload, setShowAgentUpload] = useState(false);
  const [agentUploadFile, setAgentUploadFile] = useState(null);
  const [agentDocType, setAgentDocType] = useState(DOC_TYPES[0]);
  const [agentCustomDocType, setAgentCustomDocType] = useState('');
  const [agentExpiryDate, setAgentExpiryDate] = useState('');
  const [agentNoExpiry, setAgentNoExpiry] = useState(false);
  const [agentUploading, setAgentUploading] = useState(false);
  const [scanningAgentDocument, setScanningAgentDocument] = useState(false);
  const [agentScanResult, setAgentScanResult] = useState(null);
  const [agentScanError, setAgentScanError] = useState('');
  const [agentEditingProperty, setAgentEditingProperty] = useState(false);
  const [agentEditPropertyAddress, setAgentEditPropertyAddress] = useState('');
  const [agentEditPropertyType, setAgentEditPropertyType] = useState('');
  const [agentEditPropertyCountry, setAgentEditPropertyCountry] = useState('');
  const [agentAddPropertySaving, setAgentAddPropertySaving] = useState(false);
  const [agentAddPropertyError, setAgentAddPropertyError] = useState('');
  const [agentProperties, setAgentProperties] = useState([]);
  const [agentOnboardSizeAnswer, setAgentOnboardSizeAnswer] = useState(null);
  const [agentDocuments, setAgentDocuments] = useState([]);
  const [agentFilter, setAgentFilter] = useState('all');
  const [agentGroupByLandlord, setAgentGroupByLandlord] = useState(false);
  const [agentPropertiesPage, setAgentPropertiesPage] = useState(1);
  const [collapsedLandlordGroups, setCollapsedLandlordGroups] = useState({});
  const [editingLandlordId, setEditingLandlordId] = useState(null);
  const [editingLandlordName, setEditingLandlordName] = useState('');
  const [savingLandlordName, setSavingLandlordName] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteLandlordEmail, setInviteLandlordEmail] = useState('');
  const [inviteLandlordName, setInviteLandlordName] = useState('');

  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const candidate = inviteLandlordEmail.trim().toLowerCase();
    setNameAutoFilled(false);
    if (!emailRegex.test(candidate) || inviteLandlordName.trim()) return;

    const timer = setTimeout(async () => {
      const { data: priorInvite } = await supabase
        .from('invitations')
        .select('landlord_name')
        .eq('landlord_email', candidate)
        .not('landlord_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (priorInvite?.landlord_name) {
        setInviteLandlordName(priorInvite.landlord_name);
        setNameAutoFilled(true);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [inviteLandlordEmail]);

  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [bulkEmailsText, setBulkEmailsText] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [agentDemoMode, setAgentDemoMode] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentScreen, setAgentScreen] = useState('dashboard');
  const [agentBilling, setAgentBilling] = useState('annual');
  const [selectedAgentProperty, setSelectedAgentProperty] = useState(null);
  const [selectedAgentPropertyDocs, setSelectedAgentPropertyDocs] = useState([]);
  const [agentPropertyTab, setAgentPropertyTab] = useState('documents');
  const [agentNotes, setAgentNotes] = useState([]);
  const [newAgentNote, setNewAgentNote] = useState('');
  const [agentTemplates, setAgentTemplates] = useState([]);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [selectedProperties, setSelectedProperties] = useState([]);
  const [agencyLogoUrl, setAgencyLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoSaved, setLogoSaved] = useState(false);
  const [landlordLogoUrl, setLandlordLogoUrl] = useState('');
  const [landlordLogoSaved, setLandlordLogoSaved] = useState(false);
  const [landlordLogoError, setLandlordLogoError] = useState('');
  const [pendingLandlordLogo, setPendingLandlordLogo] = useState(null);
  const [pendingLandlordLogoPreview, setPendingLandlordLogoPreview] = useState('');
  const [pendingAgencyLogo, setPendingAgencyLogo] = useState(null);
  const [pendingAgencyLogoPreview, setPendingAgencyLogoPreview] = useState('');
  const [propertyPhotoUrl, setPropertyPhotoUrl] = useState('');
  const [showPrintProperty, setShowPrintProperty] = useState(false);
  const [bulkChasing, setBulkChasing] = useState(false);
  const [bulkChaseResult, setBulkChaseResult] = useState('');
  const captchaRef = useRef(null);
  const loginCaptchaRef = useRef(null);
  const isMobile = useIsMobile();

  const trialStatus = userRecord ? getTrialStatus(userRecord.trial_ends_at) : { expired: false, daysLeft: 14 };
  const isSubscribed = userRecord?.subscription_status === 'active' || userRecord?.lifetime_access === true;
  const trialExpired = trialStatus.expired && !isSubscribed;
  const showTrialNudge = !trialStatus.expired && trialStatus.daysLeft <= 4 && !isSubscribed;

  // ---- Tier gating helpers ----
  // Plan property limits, mirrors pricing copy on the landing page and paywall screens.
  const LANDLORD_PROPERTY_LIMITS = { starter: 3, pro: 10, portfolio: Infinity };
  const AGENT_PROPERTY_LIMITS = { starter: 50, pro: 200, portfolio: Infinity };
  const TIER_RANK = { starter: 0, pro: 1, portfolio: 2 };
  const myTier = userRecord?.lifetime_access ? 'portfolio' : (userRecord?.subscription_tier || 'starter').toLowerCase();
  // True if the current user's plan is at or above `required` ('pro' or 'portfolio').
  const meetsTier = (required) => (TIER_RANK[myTier] ?? 0) >= (TIER_RANK[required] ?? 0);
  // Friendly alert shown when a gated feature is used below its required tier.
  const tierGateAlert = (featureName, required) => {
    const planLabel = required === 'portfolio' ? 'Portfolio' : 'Pro';
    alert(`${featureName} is available on the ${planLabel} plan and above. You can upgrade any time from Settings.`);
  };

  // Decide whether to show the landlord onboarding wizard once we actually
  // have both the user's DB record and their properties loaded. This runs
  // as its own effect (rather than inline in loadPropertiesForUser) because
  // userRecord and properties load in parallel on login, so checking
  // userRecord inside the properties loader risked reading a stale null.
  useEffect(() => {
    if (!userRecord || userRecord.account_type === 'agent') return;
    if (userRecord.onboarding_complete !== true && properties.length === 0) {
      setShowOnboarding(true);
    }
  }, [userRecord, properties]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Use the cached session immediately so the app loads fast...
        setUser(session.user);
        loadPropertiesForUser(session.user.id);
        loadUserRecord(session.user.id, session.user);
        setScreen('dashboard');
        if (!localStorage.getItem('tlm_home_banner_dismissed')) {
          setShowHomeBanner(true);
        }
        // ...then quietly fetch the current, non-cached version in case
        // anything (like display name) changed since this token was issued.
        supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
          if (freshUser) setUser(freshUser);
        });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setScreen('reset-password');
        setLoading(false);
        return;
      }
      // Skip INITIAL_SESSION entirely — the getSession()+getUser() combo above
      // already handles page load.
      if (event === 'INITIAL_SESSION') return;
      if (session?.user) {
        // IMPORTANT: never trust session.user's embedded metadata directly here.
        // It can reflect a stale, locally-cached token snapshot (e.g. taken
        // before a profile edit like display name), and Supabase can fire
        // SIGNED_IN / TOKEN_REFRESHED on load depending on browser/session
        // state — that previously caused saved changes to silently revert.
        // Always re-fetch the authoritative current user from the server.
        const sessionUserId = session.user.id;
        setUser(session.user);
        loadUserRecord(sessionUserId, session.user);
        loadPropertiesForUser(sessionUserId);
        setScreen('dashboard');
        if (!localStorage.getItem('tlm_home_banner_dismissed')) {
          setShowHomeBanner(true);
        }
        supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
          if (freshUser) setUser(freshUser);
        });
      }
    });

    // Check for successful payment return
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      // Send payment confirmation email
      if (user?.email) {
        const planName = userRecord?.lifetime_access ? 'Lifetime Access' : (userRecord?.account_type === 'agent' ? 'Agent Plan' : `${userRecord?.subscription_tier || 'Starter'} Plan`);
        fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            full_name: user.user_metadata?.full_name || 'Landlord',
            subject: 'Welcome to The Landlord Mate — Subscription Confirmed',
            message: `Thank you for subscribing to The Landlord Mate!\n\nYour ${planName} is now active. Here's what you can do:\n\n• Upload your compliance documents (Gas Safe, EICR, EPC etc)\n• Set expiry dates and get automatic reminders\n• Share documents with your letting agent instantly\n\nIf you need any help, reply to this email or visit our Help & FAQs section in the app.\n\nSupport: support@thelandlordmate.com (we respond within 24 hours)\n\nLog in here: https://app.thelandlordmate.com\n\nThank you for choosing The Landlord Mate.\n\nThe Landlord Mate Team`
          })
        }).catch(() => {});
      }
    }

    return () => subscription.unsubscribe();
  }, []);

  const loadUserRecord = async (userId, authUser) => {
    let { data } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!data && authUser) {
      // First time this authenticated session has been seen — most likely they've
      // just confirmed their email and this is their first real sign-in. Create
      // their profile now using the details saved at signup time.
      data = await createUserProfile(authUser);
    }
    if (data) {
      setUserRecord(data);
      if (data.logo_url) setLandlordLogoUrl(data.logo_url);
      if (data.account_type === 'agent') {
        loadAgentData(data);
      }
      if (!data.welcome_email_sent) {
        sendWelcomeEmailOnce(data, authUser);
      }
    }
  };

  const sendWelcomeEmailOnce = async (userRow, authUser) => {
    // Atomic claim: only proceed if THIS call is the one that successfully flips
    // the flag from false to true. If getSession and onAuthStateChange both fire
    // near-simultaneously, only one of these updates will find a matching row
    // (the other will already see welcome_email_sent = true and match nothing),
    // so only one of them gets a row back and only one sends the email.
    const { data: claimed } = await supabase
      .from('users')
      .update({ welcome_email_sent: true })
      .eq('id', userRow.id)
      .eq('welcome_email_sent', false)
      .select();
    if (!claimed || claimed.length === 0) return; // someone else already claimed it
    const fullName = authUser?.user_metadata?.full_name || userRow.agency_name || 'there';
    if (userRow.account_type === 'agent') {
      const inviteLink = `https://app.thelandlordmate.com?agent=${userRow.agent_code}`;
      fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userRow.email,
          full_name: userRow.agency_name || fullName,
          subject: `Welcome to The Landlord Mate Agent Portal`,
          message: `Your agent dashboard is ready at app.thelandlordmate.com\n\nHere's how to get started:\n\n1. Share your landlord invitation link with your clients:\n${inviteLink}\n\n2. When they sign up via your link they automatically appear in your portfolio\n\n3. View their compliance status, send messages and download reports from your dashboard\n\nIf you have any questions just reply to this email.\n\nThe Landlord Mate Team`
        })
      }).catch(() => {});
    } else {
      fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userRow.email,
          full_name: fullName,
          template: 'welcome'
        })
      }).catch(() => {});
    }
  };

  const loadAgentData = async (agentRecord) => {
    setAgentData(agentRecord);
    if (agentRecord.logo_url) setAgencyLogoUrl(agentRecord.logo_url);

    // Load all properties linked to this agent — either a landlord self-linked
    // them by entering this agent's email, or this agent added the property
    // directly on the landlord's behalf.
    const { data: props } = await supabase
      .from('properties')
      .select('*')
      .or(`agent_email.eq.${agentRecord.email},added_by_agent_id.eq.${agentRecord.id}`);
    if (!props) return;
    setAgentProperties(props);

    // Load all documents for these properties
    if (props.length > 0) {
      const allDocs = [];
      for (const p of props) {
        const { data: docs } = await supabase.from('documents').select('*').eq('property_id', p.id);
        if (docs) allDocs.push(...docs);
      }
      setAgentDocuments(allDocs);
    }

    // Match landlords to properties — checked via a secure server-side function,
    // since RLS correctly blocks the agent's own session from reading other
    // users' rows directly from the client.
    const landlordIds = [...new Set(props.map(p => p.user_id).filter(Boolean))];
    if (landlordIds.length > 0) {
      try {
        const landlordsRes = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/get-agent-landlords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
          body: JSON.stringify({ ids: landlordIds }),
        });
        const landlordsData = await landlordsRes.json();
        setAgentLandlords(landlordsData?.landlords || []);
      } catch (e) {
        setAgentLandlords([]);
      }
    } else {
      setAgentLandlords([]);
    }

    // Load this agent's invitations (pending and recently accepted)
    const { data: invites } = await supabase
      .from('invitations')
      .select('*')
      .eq('agency_id', agentRecord.id)
      .order('created_at', { ascending: false });
    if (invites) setPendingInvitations(invites);

    // Load templates — seed defaults if none exist
    const { data: existingTemplates } = await supabase.from('templates').select('*').eq('agent_id', agentRecord.id);
    if (existingTemplates && existingTemplates.length === 0) {
      const defaults = [
        { agent_id: agentRecord.id, title: 'Gas Safety Due', body: 'Dear Landlord,\n\nYour Gas Safety Certificate at [property_address] is due for renewal on [expiry_date].\n\nPlease arrange an inspection with a Gas Safe registered engineer and upload the new certificate within 7 days.\n\nKind regards,\n[agency_name]' },
        { agent_id: agentRecord.id, title: 'EICR Due', body: 'Dear Landlord,\n\nYour Electrical Inspection Report (EICR) at [property_address] expires on [expiry_date].\n\nPlease arrange a new EICR with a qualified electrician and upload the certificate.\n\nKind regards,\n[agency_name]' },
        { agent_id: agentRecord.id, title: 'Missing Documents', body: 'Dear Landlord,\n\nWe are missing compliance documents for [property_address].\n\nPlease log in to your Landlord Mate account and upload your Gas Safety Certificate, EICR, and EPC as soon as possible.\n\nKind regards,\n[agency_name]' },
        { agent_id: agentRecord.id, title: 'General Compliance Chase', body: 'Dear Landlord,\n\nPlease update your compliance documents for [property_address] at your earliest convenience.\n\nLog in to your Landlord Mate account to view what needs attention.\n\nKind regards,\n[agency_name]' },
        { agent_id: agentRecord.id, title: 'HMO Licence Due', body: 'Dear Landlord,\n\nYour HMO Licence for [property_address] expires on [expiry_date].\n\nPlease renew your licence with your local authority and upload the new certificate.\n\nKind regards,\n[agency_name]' },
        { agent_id: agentRecord.id, title: 'Rent Smart Wales Due', body: 'Dear Landlord,\n\nYour Rent Smart Wales licence expires on [expiry_date].\n\nPlease renew at rentsmart.gov.wales and upload your new certificate.\n\nKind regards,\n[agency_name]' },
      ];
      const { data: seeded } = await supabase.from('templates').insert(defaults).select();
      if (seeded) setAgentTemplates(seeded);
    } else if (existingTemplates) {
      setAgentTemplates(existingTemplates);
    }
  };

  const handleSelectAgentProperty = async (property) => {
    setSelectedAgentProperty(property);
    setAgentPropertyTab('documents');
    const { data: docs } = await supabase.from('documents').select('*').eq('property_id', property.id);
    if (docs) setSelectedAgentPropertyDocs(docs);
    const { data: notes } = await supabase.from('agent_notes').select('*').eq('property_id', property.id).order('created_at', { ascending: false });
    if (notes) setAgentNotes(notes);
    const { data: templates } = await supabase.from('templates').select('*').eq('agent_id', user.id);
    if (templates) setAgentTemplates(templates);
    setAgentScreen('property');
  };

  const handleAddAgentNote = async () => {
    if (!newAgentNote.trim()) return;
    const { data } = await supabase.from('agent_notes').insert([{ property_id: selectedAgentProperty.id, agent_id: user.id, note: newAgentNote.trim() }]).select();
    if (data) { setAgentNotes([data[0], ...agentNotes]); setNewAgentNote(''); }
  };

  const handleScanAgentDocument = async () => {
    if (!agentUploadFile) { alert('Please select a file first.'); return; }
    setScanningAgentDocument(true);
    setAgentScanError('');
    setAgentScanResult(null);
    try {
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(agentUploadFile);
      });
      const mimeType = agentUploadFile.type || 'application/octet-stream';
      const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/extract-document-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
        body: JSON.stringify({ fileBase64, mimeType, documentTypeHint: agentDocType !== 'Other' ? agentDocType : '' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAgentScanError(data.error || 'Could not scan this document. Please enter the details manually.');
        setScanningAgentDocument(false);
        return;
      }
      setAgentScanResult(data);
      if (data.document_type && DOC_TYPES.includes(data.document_type)) {
        setAgentDocType(data.document_type);
      } else if (data.document_type) {
        setAgentDocType('Other');
        setAgentCustomDocType(data.document_type);
      }
      if (data.expiry_date) {
        setAgentNoExpiry(false);
        setAgentExpiryDate(data.expiry_date);
      }
    } catch (e) {
      setAgentScanError('Could not scan this document. Please enter the details manually.');
    }
    setScanningAgentDocument(false);
  };

  const handleAgentUpload = async () => {
    if (!agentUploadFile) { alert('Please select a file.'); return; }
    setAgentUploading(true);
    const fileExt = agentUploadFile.name.split('.').pop();
    const filePath = `${selectedAgentProperty.user_id || 'pending'}/${selectedAgentProperty.id}/${Date.now()}.${fileExt}`;
    const { error: storageError } = await supabase.storage.from('documents').upload(filePath, agentUploadFile);
    if (storageError) { alert(storageError.message); setAgentUploading(false); return; }
    const finalDocType = agentDocType === 'Other' && agentCustomDocType.trim() ? agentCustomDocType.trim() : agentDocType;
    const { error: dbError } = await supabase.from('documents').insert([{
      property_id: selectedAgentProperty.id,
      user_id: selectedAgentProperty.user_id,
      added_by_agent_id: user.id,
      document_type: finalDocType,
      file_path: filePath,
      expiry_date: agentNoExpiry ? null : (agentExpiryDate || null),
    }]);
    if (dbError) { alert(dbError.message); setAgentUploading(false); return; }

    const { data: updatedDocs } = await supabase.from('documents').select('*').eq('property_id', selectedAgentProperty.id);
    if (updatedDocs) setSelectedAgentPropertyDocs(updatedDocs);

    const landlord = agentLandlords.find(l => l.id === selectedAgentProperty.user_id);
    if (landlord?.email) {
      fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: landlord.email,
          full_name: landlord.full_name || 'there',
          template: 'agent_uploaded_document',
          extra: {
            agencyName: toDisplayCase(userRecord?.agency_name) || 'Your letting agent',
            propertyAddress: selectedAgentProperty.address_line_1,
            docType: finalDocType,
          },
        })
      }).catch(() => {});
    }

    setShowAgentUpload(false);
    setAgentUploadFile(null);
    setAgentExpiryDate('');
    setAgentDocType(DOC_TYPES[0]);
    setAgentCustomDocType('');
    setAgentNoExpiry(false);
    setAgentUploading(false);
    setAgentScanResult(null);
    setAgentScanError('');
  };

  const handleAgentEditPropertyOpen = () => {
    setAgentEditPropertyAddress(selectedAgentProperty.address_line_1);
    setAgentEditPropertyType(selectedAgentProperty.property_type);
    setAgentEditPropertyCountry(selectedAgentProperty.country || 'Wales');
    setAgentEditingProperty(true);
  };

  const handleAgentSaveEditProperty = async () => {
    if (!agentEditPropertyAddress.trim()) { alert('Address cannot be empty.'); return; }
    const { error } = await supabase.from('properties').update({
      address_line_1: agentEditPropertyAddress,
      property_type: agentEditPropertyType,
      country: agentEditPropertyCountry,
    }).eq('id', selectedAgentProperty.id);
    if (error) { alert(error.message); return; }
    const updated = { ...selectedAgentProperty, address_line_1: agentEditPropertyAddress, property_type: agentEditPropertyType, country: agentEditPropertyCountry };
    setSelectedAgentProperty(updated);
    setAgentProperties(agentProperties.map(p => p.id === selectedAgentProperty.id ? updated : p));
    setAgentEditingProperty(false);
  };

  const handleDeleteAgentAccount = async () => {
    if (!window.confirm("Are you sure? This will permanently delete your agency account, invitations, notes, and templates. Your landlords' properties and documents are NOT affected. This cannot be undone.")) return;
    if (!window.confirm('Last chance — are you absolutely sure you want to delete your agency account?')) return;
    // Disconnect (don't delete) any properties linked to this agent — the
    // property and its documents stay with the landlord, only the link breaks.
    await supabase.from('properties').update({ added_by_agent_id: null }).eq('added_by_agent_id', user.id);
    await supabase.from('properties').update({ agent_email: null }).eq('agent_email', user.email.toLowerCase());
    await supabase.from('invitations').delete().eq('agency_id', user.id);
    await supabase.from('agent_notes').delete().eq('agent_id', user.id);
    await supabase.from('templates').delete().eq('agent_id', user.id);
    await supabase.from('users').delete().eq('id', user.id);
    try {
      await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (e) {
      // Data is already gone either way — don't block sign-out over this step.
    }
    await supabase.auth.signOut();
    setUser(null); setAgentProperties([]); setAgentLandlords([]); setScreen('login');
  };

  const handleAgentDeleteProperty = async () => {
    if (!window.confirm(`Remove ${selectedAgentProperty.address_line_1} from your properties? This also deletes any documents attached to it. This can't be undone.`)) return;
    try {
      const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/agent-delete-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
        body: JSON.stringify({ propertyId: selectedAgentProperty.id, agentId: user.id }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        alert(result.error || 'Could not delete this property — please try again.');
        return;
      }
      setAgentProperties(agentProperties.filter(p => p.id !== selectedAgentProperty.id));
      setSelectedAgentProperty(null);
      setAgentScreen('properties');
    } catch (e) {
      alert('Could not delete this property — please try again.');
    }
  };

  const handleQuickDeleteProperty = async (property, e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove ${property.address_line_1} from your properties? This also deletes any documents attached to it. This can't be undone.`)) return;
    try {
      const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/agent-delete-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
        body: JSON.stringify({ propertyId: property.id, agentId: user.id }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        alert(result.error || 'Could not delete this property — please try again.');
        return;
      }
      setAgentProperties(agentProperties.filter(p => p.id !== property.id));
    } catch (e) {
      alert('Could not delete this property — please try again.');
    }
  };

  const handleQuickEditProperty = async (property, e) => {
    e.stopPropagation();
    await handleSelectAgentProperty(property);
    setAgentEditPropertyAddress(property.address_line_1);
    setAgentEditPropertyType(property.property_type);
    setAgentEditPropertyCountry(property.country || 'Wales');
    setAgentEditingProperty(true);
  };

  const handleDeleteAgentNote = async (noteId) => {
    await supabase.from('agent_notes').delete().eq('id', noteId);
    setAgentNotes(agentNotes.filter(n => n.id !== noteId));
  };

  const handleSaveTemplate = async () => {
    if (!templateTitle.trim() || !templateBody.trim()) return;
    const { data } = await supabase.from('templates').insert([{ agent_id: user.id, title: templateTitle, body: templateBody }]).select();
    if (data) { setAgentTemplates([...agentTemplates, data[0]]); setTemplateTitle(''); setTemplateBody(''); setShowNewTemplate(false); }
  };

  const handleDeleteTemplate = async (id) => {
    await supabase.from('templates').delete().eq('id', id);
    setAgentTemplates(agentTemplates.filter(t => t.id !== id));
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    setUploadingLogo(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      await supabase.from('users').update({ logo_url: data.publicUrl }).eq('id', user.id);
      const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;
      setAgencyLogoUrl(bustedUrl);
      setUserRecord({ ...userRecord, logo_url: bustedUrl });
    } else {
      console.error('Logo upload error:', error);
    }
    setUploadingLogo(false);
  };

  const handleLandlordLogoUpload = async (file) => {
    if (!file) return false;
    setLandlordLogoError('');
    const ext = file.name.split('.').pop();
    const path = `${user.id}-landlord.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      const { error: dbError } = await supabase.from('users').update({ logo_url: data.publicUrl }).eq('id', user.id);
      if (dbError) {
        console.error('Landlord logo DB update error:', dbError);
        setLandlordLogoError('Saved the image but failed to update your profile. Please try again.');
        return false;
      }
      setLandlordLogoUrl(`${data.publicUrl}?t=${Date.now()}`);
      setLandlordLogoSaved(true);
      setTimeout(() => setLandlordLogoSaved(false), 3000);
      return true;
    } else {
      console.error('Landlord logo upload error:', error);
      setLandlordLogoError(`Upload failed: ${error.message || 'please try again.'}`);
      return false;
    }
  };

  const handleLandlordLogoSelect = (file) => {
    if (!file) return;
    setLandlordLogoError('');
    setPendingLandlordLogo(file);
    setPendingLandlordLogoPreview(URL.createObjectURL(file));
  };

  const handleLandlordLogoSave = async () => {
    if (!pendingLandlordLogo) return;
    const success = await handleLandlordLogoUpload(pendingLandlordLogo);
    if (success) {
      setPendingLandlordLogo(null);
      setPendingLandlordLogoPreview('');
    }
  };

  const handleLandlordLogoRemove = async () => {
    const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    for (const ext of extensions) {
      await supabase.storage.from('logos').remove([`${user.id}-landlord.${ext}`]);
    }
    await supabase.from('users').update({ logo_url: null }).eq('id', user.id);
    setLandlordLogoUrl('');
    setPendingLandlordLogo(null);
    setPendingLandlordLogoPreview('');
    setLandlordLogoError('');
  };

  const handleAgencyLogoSelect = (file) => {
    if (!file) return;
    setPendingAgencyLogo(file);
    setPendingAgencyLogoPreview(URL.createObjectURL(file));
  };

  const handleAgencyLogoSave = async () => {
    if (!pendingAgencyLogo) return;
    setUploadingLogo(true);
    const ext = pendingAgencyLogo.name.split('.').pop();
    const path = `${user.id}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, pendingAgencyLogo, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      await supabase.from('users').update({ logo_url: data.publicUrl }).eq('id', user.id);
      const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;
      setAgencyLogoUrl(bustedUrl);
      setUserRecord({ ...userRecord, logo_url: bustedUrl });
      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 3000);
    }
    setPendingAgencyLogo(null);
    setPendingAgencyLogoPreview('');
    setUploadingLogo(false);
  };

  const handleAgencyLogoRemove = async () => {
    const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    for (const ext of extensions) {
      await supabase.storage.from('logos').remove([`${user.id}.${ext}`]);
    }
    await supabase.from('users').update({ logo_url: null }).eq('id', user.id);
    setAgencyLogoUrl('');
    setPendingAgencyLogo(null);
    setPendingAgencyLogoPreview('');
  };

  const handlePropertyPhotoUpload = async (file, propertyId) => {
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `property_${propertyId}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      await supabase.from('properties').update({ photo_url: data.publicUrl }).eq('id', propertyId);
      setProperties(properties.map(p => p.id === propertyId ? { ...p, photo_url: data.publicUrl } : p));
      if (selectedProperty?.id === propertyId) {
        setSelectedProperty({ ...selectedProperty, photo_url: data.publicUrl });
      }
    }
  };

  const handleAgentPropertyPhotoUpload = async (file, propertyId) => {
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `property_${propertyId}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.from('properties').update({ photo_url: data.publicUrl }).eq('id', propertyId);
      setAgentProperties(agentProperties.map(p => p.id === propertyId ? { ...p, photo_url: bustedUrl } : p));
      if (selectedAgentProperty?.id === propertyId) {
        setSelectedAgentProperty({ ...selectedAgentProperty, photo_url: bustedUrl });
      }
    }
  };


  const handleInviteLandlord = async () => {
    if (!inviteLandlordEmail.trim()) return;
    setInviteSending(true);
    setInviteError('');
    const emailTrimmed = inviteLandlordEmail.trim().toLowerCase();

    try {
      // Auto-fill: check if this landlord has been in the system before (any agency)
      let landlordName = inviteLandlordName.trim();
      if (!landlordName) {
        const { data: priorInvite } = await supabase
          .from('invitations')
          .select('landlord_name')
          .eq('landlord_email', emailTrimmed)
          .not('landlord_name', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (priorInvite?.landlord_name) landlordName = priorInvite.landlord_name;
      }

      // Check for an existing pending invitation from this agency to this email
      const { data: existingInvite } = await supabase
        .from('invitations')
        .select('id, token')
        .eq('agency_id', user.id)
        .eq('landlord_email', emailTrimmed)
        .eq('status', 'pending')
        .maybeSingle();

      let token;
      if (existingInvite) {
        // Resend using the same token, just bump last_sent_at and count
        token = existingInvite.token;
        await supabase.from('invitations').update({
          last_sent_at: new Date().toISOString(),
          resend_count: (existingInvite.resend_count || 0) + 1,
          landlord_name: landlordName || null,
        }).eq('id', existingInvite.id);
      } else {
        const { data: newInvite, error: inviteInsertError } = await supabase
          .from('invitations')
          .insert([{ agency_id: user.id, landlord_email: emailTrimmed, landlord_name: landlordName || null }])
          .select('token')
          .single();
        if (inviteInsertError) throw inviteInsertError;
        token = newInvite.token;
      }

      const inviteLink = `https://app.thelandlordmate.com?invite=${token}`;
      const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailTrimmed,
          full_name: landlordName || 'there',
          template: 'agent_invite',
          extra: { agencyName: toDisplayCase(userRecord?.agency_name) || 'Your letting agent', inviteLink },
        })
      });
      if (!res.ok) throw new Error('Email failed to send');
      setInviteSent(true);
      setInviteLandlordEmail('');
      setInviteLandlordName('');
      setTimeout(() => { setInviteSent(false); setShowInviteForm(false); }, 3000);
    } catch(e) {
      setInviteError('Something went wrong sending that invite — please try again.');
    }
    setInviteSending(false);
  };

  const handleBulkInvite = async () => {
    const rawLines = bulkEmailsText.split('\n').map(l => l.trim()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const seen = new Set();
    const validEmails = [];
    const invalidLines = [];

    for (const line of rawLines) {
      const email = line.split(',')[0].trim().toLowerCase();
      if (!emailRegex.test(email)) {
        invalidLines.push(line);
      } else if (seen.has(email)) {
        // duplicate, skip silently
      } else {
        seen.add(email);
        validEmails.push(email);
      }
    }

    if (validEmails.length === 0) {
      setBulkResults({ sent: 0, failed: 0, invalidLines, failedEmails: [] });
      return;
    }

    setBulkSending(true);
    setBulkResults(null);
    let sent = 0;
    const failedEmails = [];

    for (const email of validEmails) {
      try {
        // Reuse existing pending invitation token if one exists, else create a new one
        const { data: existingInvite } = await supabase
          .from('invitations')
          .select('id, token, resend_count')
          .eq('agency_id', user.id)
          .eq('landlord_email', email)
          .eq('status', 'pending')
          .maybeSingle();

        let token;
        if (existingInvite) {
          token = existingInvite.token;
          await supabase.from('invitations').update({
            last_sent_at: new Date().toISOString(),
            resend_count: (existingInvite.resend_count || 0) + 1,
          }).eq('id', existingInvite.id);
        } else {
          const { data: newInvite, error: insertErr } = await supabase
            .from('invitations')
            .insert([{ agency_id: user.id, landlord_email: email }])
            .select('token')
            .single();
          if (insertErr) throw insertErr;
          token = newInvite.token;
        }

        const inviteLink = `https://app.thelandlordmate.com?invite=${token}`;
        const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            full_name: 'there',
            template: 'agent_invite',
            extra: { agencyName: toDisplayCase(userRecord?.agency_name) || 'Your letting agent', inviteLink },
          })
        });
        if (!res.ok) throw new Error('failed');
        sent++;
      } catch (e) {
        failedEmails.push(email);
      }
      await new Promise(r => setTimeout(r, 300));
    }

    setBulkResults({ sent, failed: failedEmails.length, invalidLines, failedEmails });
    setBulkSending(false);
    if (failedEmails.length === 0 && invalidLines.length === 0) {
      setBulkEmailsText('');
    }
  };

  const handleResendInvitation = async (invitation) => {
    setResendingId(invitation.id);
    try {
      await supabase.from('invitations').update({
        last_sent_at: new Date().toISOString(),
        resend_count: (invitation.resend_count || 0) + 1,
      }).eq('id', invitation.id);

      const inviteLink = `https://app.thelandlordmate.com?invite=${invitation.token}`;
      await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invitation.landlord_email,
          full_name: invitation.landlord_name || 'there',
          template: 'agent_invite',
          extra: { agencyName: toDisplayCase(userRecord?.agency_name) || 'Your letting agent', inviteLink },
        })
      });

      setPendingInvitations(prev => prev.map(inv => inv.id === invitation.id
        ? { ...inv, last_sent_at: new Date().toISOString(), resend_count: (inv.resend_count || 0) + 1 }
        : inv
      ));
    } catch (e) {
      // silent fail on resend, button will just be clickable again
    }
    setResendingId(null);
  };

  const handleDeleteInvitation = async (invitationId) => {
    const { error } = await supabase.from('invitations').delete().eq('id', invitationId);
    if (error) {
      alert('Could not remove that invitation — please try again.');
      return;
    }
    setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
  };

  const handleAgentAddProperty = async () => {
    if (addressResults.length === 0 && !newAddress.trim()) {
      setAgentAddPropertyError('Please look up and select an address first.');
      return;
    }
    if (!agentNewLandlordEmail.trim()) {
      setAgentAddPropertyError("Please enter the landlord's email address.");
      return;
    }
    const emailTrimmed = agentNewLandlordEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setAgentAddPropertyError('That doesn\u2019t look like a valid email address — please check it and try again.');
      return;
    }

    const agentPropLimit = AGENT_PROPERTY_LIMITS[myTier] ?? AGENT_PROPERTY_LIMITS.starter;
    if (agentProperties.length >= agentPropLimit) {
      setAgentAddPropertyError(`Your ${myTier.charAt(0).toUpperCase() + myTier.slice(1)} plan allows up to ${agentPropLimit} properties. Upgrade your plan in Settings to add more.`);
      return;
    }

    setAgentAddPropertySaving(true);
    setAgentAddPropertyError('');
    setAgentAddPropertyMessage(null);

    try {
      // Does this landlord already have an account? Checked via a secure
      // server-side function, since RLS correctly blocks the agent's own
      // session from reading another user's row directly from the client.
      let existingLandlord = null;
      let landlordAlreadyHasThisProperty = false;
      try {
        const lookupRes = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/lookup-landlord', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
          body: JSON.stringify({ email: emailTrimmed, address: newAddress }),
        });
        const lookupData = await lookupRes.json();
        if (lookupData?.id) existingLandlord = { id: lookupData.id };
        landlordAlreadyHasThisProperty = !!lookupData?.duplicateProperty;
      } catch (e) {
        // If the lookup fails for any reason, fall through to the invite
        // path below rather than blocking the whole add-property action.
      }

      if (landlordAlreadyHasThisProperty) {
        setAgentAddPropertyError('This landlord has already added this property themselves — no need to add it again.');
        setAgentAddPropertySaving(false);
        return;
      }

      // Has this exact property already been added for this exact landlord?
      const { data: possibleDupes } = await supabase
        .from('properties')
        .select('id, user_id, pending_landlord_email')
        .eq('added_by_agent_id', user.id)
        .ilike('address_line_1', newAddress);

      const isDuplicate = (possibleDupes || []).some(p =>
        existingLandlord ? p.user_id === existingLandlord.id : (p.pending_landlord_email || '').toLowerCase() === emailTrimmed
      );
      if (isDuplicate) {
        setAgentAddPropertyError('You\u2019ve already added this property for this landlord — check your properties list.');
        setAgentAddPropertySaving(false);
        return;
      }

      const propertyRecord = {
        user_id: existingLandlord ? existingLandlord.id : null,
        pending_landlord_email: existingLandlord ? null : emailTrimmed,
        added_by_agent_id: user.id,
        address_line_1: newAddress,
        property_type: newType,
        country: newCountry,
      };

      const { error: insertError } = await supabase.from('properties').insert([propertyRecord]);
      if (insertError) throw insertError;

      if (existingLandlord) {
        setAgentAddPropertyMessage({ type: 'success', text: `\u2713 Linked directly to ${emailTrimmed}'s existing account — it'll be waiting for them next time they log in. No invite needed.` });
        fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailTrimmed,
            full_name: 'there',
            template: 'agent_linked_existing_property',
            extra: { agencyName: toDisplayCase(userRecord?.agency_name) || 'Your letting agent', propertyAddress: newAddress },
          })
        }).catch(() => {});
      } else {
        // Reuse an existing pending invite for this landlord if one exists, rather than creating a duplicate
        const { data: existingInvite } = await supabase
          .from('invitations')
          .select('id, token, resend_count')
          .eq('agency_id', user.id)
          .eq('landlord_email', emailTrimmed)
          .eq('status', 'pending')
          .maybeSingle();

        let token;
        if (existingInvite) {
          token = existingInvite.token;
          await supabase.from('invitations').update({
            last_sent_at: new Date().toISOString(),
            resend_count: (existingInvite.resend_count || 0) + 1,
            property_address: newAddress,
          }).eq('id', existingInvite.id);
        } else {
          const { data: newInvite, error: inviteErr } = await supabase
            .from('invitations')
            .insert([{ agency_id: user.id, landlord_email: emailTrimmed, property_address: newAddress }])
            .select('token')
            .single();
          if (inviteErr) throw inviteErr;
          token = newInvite.token;
        }

        const inviteLink = `https://app.thelandlordmate.com?invite=${token}`;
        fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailTrimmed,
            full_name: 'there',
            template: 'agent_added_property',
            extra: { agencyName: toDisplayCase(userRecord?.agency_name) || 'Your letting agent', inviteLink, propertyAddress: newAddress },
          })
        }).catch(() => {});

        setAgentAddPropertyMessage({ type: 'info', text: `\u2713 Property saved. ${emailTrimmed} doesn't have an account yet, so we've sent them an invite to claim it${existingInvite ? ' (reusing their existing pending invite)' : ''}.` });
      }

      setShowAgentAddProperty(false);
      setAgentNewLandlordEmail('');
      setNewAddress(''); setNewPostcode(''); setAddressResults([]);
      await loadAgentData(userRecord);
    } catch (e) {
      setAgentAddPropertyError('Something went wrong adding that property — please try again.');
    }
    setAgentAddPropertySaving(false);
  };





  const handleBulkChase = async () => {
    if (selectedProperties.length === 0) return;
    if (!meetsTier('pro')) { tierGateAlert('Bulk chasing landlords', 'pro'); return; }
    setBulkChasing(true);
    setBulkChaseResult('');
    let sent = 0;
    for (const propId of selectedProperties) {
      const property = agentProperties.find(p => p.id === propId);
      const landlord = agentLandlords.find(l => l.id === property?.user_id);
      if (landlord?.email) {
        try {
          await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: landlord.email,
              full_name: landlord.full_name || 'Landlord',
              subject: `Action Required: Compliance documents needed for ${property.address_line_1}`,
              message: `Your letting agent ${toDisplayCase(userRecord?.agency_name) || ''} has flagged that compliance documents for ${property.address_line_1} need attention. Please log in to The Landlord Mate and update your certificates as soon as possible.`
            })
          });
          sent++;
        } catch(e) {}
      }
    }
    setBulkChaseResult(`✓ Reminder sent to ${sent} landlord${sent !== 1 ? 's' : ''}`);
    setSelectedProperties([]);
    setBulkChasing(false);
  };

  // New: landlord-side portfolio export, didn't exist before, mirrors the agent
  // version above. Portfolio tier only.
  // New: lets Pro+ landlords customise which day-thresholds they get reminded at,
  // instead of everyone being stuck on the fixed 90/60/30/14/7 default.
  const handleSaveReminderDays = async (days) => {
    if (!meetsTier('pro')) { tierGateAlert('Custom reminder schedules', 'pro'); return; }
    if (!days || days.length === 0) { alert('Please keep at least one reminder day selected.'); return; }
    const sorted = [...days].sort((a, b) => b - a);
    setReminderDays(sorted);
    await supabase.from('users').update({ reminder_days: sorted }).eq('id', user.id);
    setUserRecord(prev => prev ? { ...prev, reminder_days: sorted } : prev);
    setReminderDaysSaved(true);
    setTimeout(() => setReminderDaysSaved(false), 2000);
  };

  const handleLandlordExportCSV = () => {
    if (!meetsTier('portfolio')) { tierGateAlert('CSV portfolio export', 'portfolio'); return; }
    const rows = [['Property', 'Type', 'Country', 'Health', 'Documents', 'Next Expiry']];
    properties.forEach(p => {
      const docs = (allDocuments || []).filter(d => d.property_id === p.id);
      const expired = docs.some(d => getExpiryStatus(d.expiry_date)?.type === 'expired');
      const urgent = docs.some(d => getExpiryStatus(d.expiry_date)?.type === 'urgent');
      const soon = docs.some(d => getExpiryStatus(d.expiry_date)?.type === 'soon');
      const health = expired || urgent ? 'Action Needed' : soon ? 'Expiring Soon' : docs.length === 0 ? 'No Documents' : 'Compliant';
      const nextDoc = docs.filter(d => d.expiry_date).sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date))[0];
      rows.push([p.address_line_1, p.property_type || '—', p.country || '—', health, docs.length, nextDoc ? `${nextDoc.document_type} (${new Date(nextDoc.expiry_date).toLocaleDateString('en-GB')})` : '—']);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-portfolio-compliance-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAgentExportCSV = (landlordId = null) => {
    if (!meetsTier('portfolio')) { tierGateAlert('CSV portfolio export', 'portfolio'); return; }
    const rows = [['Property', 'Landlord', 'Country', 'Health', 'Documents', 'Next Expiry']];

    const scoreFor = (propertyId) => {
      const docs = agentDocuments.filter(d => d.property_id === propertyId);
      if (docs.length === 0) return 0;
      let score = 100;
      docs.forEach(doc => {
        const status = getExpiryStatus(doc.expiry_date);
        if (!status) return;
        if (status.type === 'expired') score -= 50;
        else if (status.type === 'urgent') score -= 25;
        else if (status.type === 'soon') score -= 10;
      });
      return Math.max(0, score);
    };

    let baseProperties;
    let exportLabel = userRecord?.agency_name || 'portfolio';

    if (landlordId) {
      // Export just this one landlord, ignores any active dashboard search/filter, always their full portfolio.
      baseProperties = agentProperties.filter(p => p.user_id === landlordId);
      const landlord = agentLandlords.find(l => l.id === landlordId);
      exportLabel = (landlord?.full_name || landlord?.email || 'landlord').replace(/[^a-z0-9]+/gi, '-');
    } else {
      // Full export: matches whatever is currently searched/filtered on the dashboard, so what you see is what you get.
      baseProperties = agentProperties.filter(p => {
        const landlord = agentLandlords.find(l => l.id === p.user_id);
        const score = scoreFor(p.id);
        const matchesSearch = !agentSearch || p.address_line_1.toLowerCase().includes(agentSearch.toLowerCase()) || (landlord?.email || '').toLowerCase().includes(agentSearch.toLowerCase()) || (landlord?.full_name || '').toLowerCase().includes(agentSearch.toLowerCase());
        const matchesFilter = agentFilter === 'all' || (agentFilter === 'red' && score < 50) || (agentFilter === 'amber' && score >= 50 && score < 80) || (agentFilter === 'green' && score >= 80) || (agentFilter === 'none' && agentDocuments.filter(d => d.property_id === p.id).length === 0);
        return matchesSearch && matchesFilter;
      });
    }

    const sortedProperties = [...baseProperties].sort((a, b) => {
      const landlordA = (agentLandlords.find(l => l.id === a.user_id)?.full_name || agentLandlords.find(l => l.id === a.user_id)?.email || 'zzz_no_landlord').toLowerCase();
      const landlordB = (agentLandlords.find(l => l.id === b.user_id)?.full_name || agentLandlords.find(l => l.id === b.user_id)?.email || 'zzz_no_landlord').toLowerCase();
      if (landlordA !== landlordB) return landlordA.localeCompare(landlordB);
      return (a.address_line_1 || '').toLowerCase().localeCompare((b.address_line_1 || '').toLowerCase());
    });

    let lastLandlordKey = null;
    sortedProperties.forEach(p => {
      const landlord = agentLandlords.find(l => l.id === p.user_id);
      const landlordKey = landlord?.id || 'no_landlord';
      if (!landlordId && lastLandlordKey !== null && landlordKey !== lastLandlordKey) {
        rows.push(['', '', '', '', '', '']);
      }
      lastLandlordKey = landlordKey;
      const docs = agentDocuments.filter(d => d.property_id === p.id);
      const expired = docs.some(d => getExpiryStatus(d.expiry_date)?.type === 'expired');
      const urgent = docs.some(d => getExpiryStatus(d.expiry_date)?.type === 'urgent');
      const soon = docs.some(d => getExpiryStatus(d.expiry_date)?.type === 'soon');
      const health = expired || urgent ? 'Action Needed' : soon ? 'Expiring Soon' : docs.length === 0 ? 'No Documents' : 'Compliant';
      const nextDoc = docs.filter(d => d.expiry_date).sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date))[0];
      rows.push([p.address_line_1, landlord?.full_name || landlord?.email || '—', p.country || '—', health, docs.length, nextDoc ? `${nextDoc.document_type} (${new Date(nextDoc.expiry_date).toLocaleDateString('en-GB')})` : '—']);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportLabel}-compliance-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubscribe = async (priceId) => {
    setSubscribing(true);
    try {
      const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ priceId, userId: user.id, email: user.email })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Something went wrong. Please try again.');
        setSubscribing(false);
      }
    } catch (e) {
      alert('Something went wrong. Please try again.');
      setSubscribing(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalError('');
    setPortalLoading(true);
    try {
      const customerId = userRecord?.stripe_customer_id;
      if (!customerId) {
        setPortalError('No billing account found yet. Please contact support if this seems wrong.');
        setPortalLoading(false);
        return;
      }
      const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ customerId })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPortalError('Something went wrong opening billing settings. Please try again.');
        setPortalLoading(false);
      }
    } catch (e) {
      setPortalError('Something went wrong opening billing settings. Please try again.');
      setPortalLoading(false);
    }
  };

  const handleDismissBanner = () => {
    localStorage.setItem('tlm_home_banner_dismissed', 'true');
    setShowHomeBanner(false);
  };

  const loadPropertiesForUser = async (userId) => {
    const { data: props } = await supabase.from('properties').select('*').eq('user_id', userId);
    if (props) {
      setProperties(props);
      await loadAllDocuments(props);
    }
    const { data: ldocs } = await supabase.from('documents').select('*').eq('user_id', userId).is('property_id', null);
    if (ldocs) setLandlordDocs(ldocs);
  };

  const loadAllDocuments = async (props) => {
    if (!props || props.length === 0) { setAllDocuments([]); return; }
    const allDocs = [];
    for (const p of props) {
      const { data } = await supabase.from('documents').select('*').eq('property_id', p.id);
      if (data) allDocs.push(...data);
    }
    setAllDocuments(allDocs);
  };

  const handleFindAddress = async () => {
    if (!newPostcode) { setAddressError('Please enter a postcode.'); return; }
    setAddressLoading(true);
    setAddressError('');
    setAddressResults([]);
    try {
      const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/find-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ postcode: newPostcode })
      });
      const data = await res.json();
      if (!res.ok || data.error) { setAddressError('Postcode not found. Please check and try again.'); setAddressLoading(false); return; }
      setAddressResults(data.addresses);
    } catch (e) {
      setAddressError('Could not look up postcode. Please try again.');
    }
    setAddressLoading(false);
  };

  const handleSignIn = async () => {
    setLoading(true);
    setError('');
    if (!loginCaptchaToken) { setError('Please complete the CAPTCHA.'); setLoading(false); return; }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: loginCaptchaToken } });
    if (error) { setError(error.message); loginCaptchaRef.current?.resetCaptcha(); setLoginCaptchaToken(''); setLoading(false); return; }
    if (data.user) {
      setUser(data.user);
      await loadPropertiesForUser(data.user.id);
      await loadUserRecord(data.user.id, data.user);
      setScreen('dashboard');
      if (!localStorage.getItem('tlm_home_banner_dismissed')) {
        setShowHomeBanner(true);
      }
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError('');
    if (!fullName || !email || !password) { setError('Please fill in all fields.'); setLoading(false); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); setLoading(false); return; }
    if (!captchaToken) { setError('Please complete the CAPTCHA.'); setLoading(false); return; }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        captchaToken,
        data: {
          full_name: fullName,
          account_type: accountType,
          agency_name: accountType === 'agent' ? agencyName : null,
          referral_source: referralSource || null,
          invite_token: new URLSearchParams(window.location.search).get('invite') || null,
          legacy_agent_code: new URLSearchParams(window.location.search).get('agent') || null,
        }
      }
    });
    if (error) { setError(error.message); captchaRef.current?.resetCaptcha(); setCaptchaToken(''); setLoading(false); return; }

    const authUser = data.session?.user || data.user;

    if (authUser && data.session?.user) {
      // We have a real authenticated session right now (confirmation off, or
      // not required) — safe to create the profile row immediately.
      await createUserProfile(data.session.user);
      setUser(data.session.user);
      await loadUserRecord(data.session.user.id, data.session.user);
      if (accountType !== 'agent') setShowOnboarding(true);
      setScreen('dashboard');
      if (!localStorage.getItem('tlm_home_banner_dismissed')) {
        setShowHomeBanner(true);
      }
    } else {
      // No session yet — confirmation is required. Don't touch the database
      // (there's no authenticated context to do it safely). Everything needed
      // to create the profile later is saved in user_metadata above, and will
      // be picked up automatically the moment they confirm and sign in.
      setScreen('verify');
    }
    setLoading(false);
  };

  const createUserProfile = async (authUser) => {
    const { data: existing } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    if (existing) return existing;

    const meta = authUser.user_metadata || {};
    const userEmail = authUser.email;
    const metaAccountType = meta.account_type || 'landlord';
    let resolvedAgentCode = null;

    if (meta.invite_token && metaAccountType === 'landlord') {
      const { data: invitation } = await supabase
        .from('invitations')
        .select('id, agency_id, landlord_email, status')
        .eq('token', meta.invite_token)
        .eq('status', 'pending')
        .maybeSingle();
      if (invitation && invitation.landlord_email.toLowerCase() === userEmail.toLowerCase()) {
        const { data: agencyRecord } = await supabase.from('users').select('agent_code').eq('id', invitation.agency_id).single();
        resolvedAgentCode = agencyRecord?.agent_code || null;
        await supabase.from('invitations').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invitation.id);
      }
    }
    if (!resolvedAgentCode && meta.legacy_agent_code) {
      resolvedAgentCode = meta.legacy_agent_code;
    }

    const { error: insertError } = await supabase.from('users').insert([{
      id: authUser.id,
      email: userEmail,
      full_name: meta.full_name || null,
      account_type: metaAccountType,
      agency_name: metaAccountType === 'agent' ? meta.agency_name : null,
      agent_code: metaAccountType === 'agent' ? authUser.id.split('-')[0] : null,
      referred_by_agent: resolvedAgentCode || null,
      referral_source: meta.referral_source || null,
    }]);
    if (insertError) {
      // Most likely a concurrent call (getSession + onAuthStateChange firing
      // near-simultaneously) already created this row a moment ago — not a
      // real failure. Fetch whatever's there now instead of giving up.
      const { data: nowExists } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      return nowExists || null;
    }

    if (resolvedAgentCode && metaAccountType === 'landlord') {
      await supabase.from('users').update({ referred_by_agent: resolvedAgentCode }).eq('id', authUser.id);
    }
    if (metaAccountType === 'landlord') {
      await supabase.from('properties').update({ user_id: authUser.id, pending_landlord_email: null }).eq('pending_landlord_email', userEmail.toLowerCase());
    }

    const { data: created } = await supabase.from('users').select('*').eq('id', authUser.id).single();
    return created;
  };

  const handleForgotPassword = async () => {
    if (!email) { setError('Please enter your email address first.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://app.thelandlordmate.com' });
    if (error) { setError(error.message); } else { setForgotSent(true); }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { setError(error.message); setLoading(false); return; }
    setPasswordResetDone(true);
    setIsRecovery(false);
    setLoading(false);
  };

  const handleAskAI = async () => {
    if (!aiQuestion.trim() || aiLoading) return;
    const question = aiQuestion.trim();
    setAiLoading(true);
    setAiQuestion('');
    setAiHistory(prev => [...prev, { role: 'user', content: question }]);

    try {
      const isWales = isWalesRelevant(properties) || userRecord?.account_type === 'agent';
      const systemPrompt = `You are a helpful UK landlord compliance assistant for The Landlord Mate platform. You provide clear, practical advice on landlord compliance, property law, and lettings regulations.${isWales ? ' The user is based in Wales so prioritise Welsh legislation including the Renting Homes (Wales) Act 2016, Rent Smart Wales requirements, Section 173 notices, and Written Occupation Contracts.' : ' Focus on English and UK-wide landlord law including the Renters Rights Act, Gas Safety regulations, EICR requirements and EPC obligations.'} Keep answers concise, practical and in plain English. Always recommend seeking professional legal advice for specific situations.`;

      const response = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/ask-anything', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
        body: JSON.stringify({ 
          question,
          isWales: isWalesRelevant(properties) || userRecord?.account_type === 'agent',
          history: aiHistory.map(h => ({ role: h.role, content: h.content }))
        })
      });
      const data = await response.json();
      const answer = data.answer || 'Sorry, I could not get an answer. Please try again.';
      setAiHistory(prev => [...prev, { role: 'assistant', content: answer }]);
      setAiAnswer(answer);
    } catch(e) {
      setAiHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    }
    setAiLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setUserRecord(null); setProperties([]); setAllDocuments([]); setSelectedProperty(null); setScreen('login'); setShowOnboarding(false);
  };

  const handleSaveProperty = async () => {
    if (!newAddress) { alert('Please select an address.'); return; }
    const alreadyExists = properties.some(p => (p.address_line_1 || '').toLowerCase().trim() === newAddress.toLowerCase().trim());
    if (alreadyExists) {
      alert('This property is already in your account — your agent may have already added it for you. Check your properties list.');
      return;
    }
    const propLimit = LANDLORD_PROPERTY_LIMITS[myTier] ?? LANDLORD_PROPERTY_LIMITS.starter;
    if (properties.length >= propLimit) {
      alert(`Your ${myTier.charAt(0).toUpperCase() + myTier.slice(1)} plan allows up to ${propLimit} propert${propLimit === 1 ? 'y' : 'ies'}. Upgrade your plan in Settings to add more.`);
      return;
    }
    const agentEmailTrimmed = newAgentEmail.trim().toLowerCase();
    const { data, error } = await supabase.from('properties').insert([{ user_id: user.id, address_line_1: newAddress, property_type: newType, country: newCountry, agent_email: agentEmailTrimmed || null }]).select();
    if (error) { alert(error.message); return; }
    if (data) {
      const newProps = [...properties, data[0]];
      setProperties(newProps);
      await loadAllDocuments(newProps);
      if (agentEmailTrimmed) {
        fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: agentEmailTrimmed,
            full_name: 'there',
            template: 'landlord_linked_agent',
            extra: { landlordName: user?.user_metadata?.full_name || 'A landlord', propertyAddress: newAddress },
          })
        }).catch(() => {});
        setPropertyActionMessage(`✓ Property added and linked to ${agentEmailTrimmed} — they've been emailed to let them know.`);
      } else {
        setPropertyActionMessage('✓ Property added.');
      }
      setTimeout(() => setPropertyActionMessage(null), 6000);
      setShowAdd(false); setNewAddress(''); setNewPostcode(''); setAddressResults([]); setNewCountry('Wales'); setNewAgentEmail('');
    }
  };

  const handleEditProperty = (p, e) => { e.stopPropagation(); setEditingProperty(p); setEditPropertyAddress(p.address_line_1); setEditPropertyType(p.property_type); setEditPropertyCountry(p.country || 'Wales'); setEditPropertyAgentEmail(p.agent_email || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleSaveEditProperty = async () => {
    const newAgentEmailTrimmed = editPropertyAgentEmail.trim().toLowerCase();
    const isNewAgentEmail = newAgentEmailTrimmed && newAgentEmailTrimmed !== (editingProperty.agent_email || '').toLowerCase();
    const { error } = await supabase.from('properties').update({ address_line_1: editPropertyAddress, property_type: editPropertyType, country: editPropertyCountry, agent_email: newAgentEmailTrimmed || null }).eq('id', editingProperty.id);
    if (error) { alert(error.message); return; }
    setProperties(properties.map(p => p.id === editingProperty.id ? { ...p, address_line_1: editPropertyAddress, property_type: editPropertyType, country: editPropertyCountry, agent_email: newAgentEmailTrimmed || null } : p));
    if (isNewAgentEmail) {
      fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newAgentEmailTrimmed,
          full_name: 'there',
          template: 'landlord_linked_agent',
          extra: { landlordName: userRecord?.full_name || 'A landlord', propertyAddress: editPropertyAddress },
        })
      }).catch(() => {});
      setPropertyActionMessage(`✓ Saved and linked to ${newAgentEmailTrimmed} — they've been emailed to let them know.`);
    } else {
      setPropertyActionMessage('✓ Property updated.');
    }
    setTimeout(() => setPropertyActionMessage(null), 6000);
    setEditingProperty(null);
  };

  const handleDeleteProperty = async (propertyId, e) => {
    if (e) e.stopPropagation();
    await supabase.from('documents').delete().eq('property_id', propertyId);
    await supabase.from('properties').delete().eq('id', propertyId);
    const newProps = properties.filter(p => p.id !== propertyId);
    setProperties(newProps);
    await loadAllDocuments(newProps);
    setConfirmDeleteProperty(null);
  };

  const handleSelectProperty = async (property) => {
    setSelectedProperty(property);
    setShareLink('');
    setPropertyNotes(property.notes || '');
    setNotesSaved(false);
    setTodos(property.todos ? JSON.parse(property.todos) : []);
    setInventory(property.inventory ? JSON.parse(property.inventory) : []);
    setExpenses(property.expenses ? JSON.parse(property.expenses) : []);
    setTenancyStart(property.tenancy_start || '');
    setTenancyEnd(property.tenancy_end || '');
    setTenantName(property.tenant_name || '');
    setTenantPhone(property.tenant_phone || '');
    setRentReviewDate(property.rent_review_date || '');
    setPurchasePrice(property.purchase_price || '');
    setShowAddExpense(false);
    const { data } = await supabase.from('documents').select('*').eq('property_id', property.id);
    if (data) setDocuments(data);
    setScreen('property');
  };

  const handleSaveNotes = async () => {
    const { error } = await supabase.from('properties').update({ notes: propertyNotes }).eq('id', selectedProperty.id);
    if (!error) {
      setProperties(properties.map(p => p.id === selectedProperty.id ? { ...p, notes: propertyNotes } : p));
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    }
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    const todo = { id: Date.now(), text: newTodo.trim(), done: false };
    const updated = [...todos, todo];
    setTodos(updated);
    setNewTodo('');
    await supabase.from('properties').update({ todos: JSON.stringify(updated) }).eq('id', selectedProperty.id);
  };

  const handleToggleTodo = async (id) => {
    const updated = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTodos(updated);
    await supabase.from('properties').update({ todos: JSON.stringify(updated) }).eq('id', selectedProperty.id);
  };

  const handleDeleteTodo = async (id) => {
    const updated = todos.filter(t => t.id !== id);
    setTodos(updated);
    await supabase.from('properties').update({ todos: JSON.stringify(updated) }).eq('id', selectedProperty.id);
  };

  const handleAddInventoryItem = async () => {
    if (!newInventoryItem.trim() || !newInventoryRoom.trim()) return;
    const item = { id: Date.now(), room: newInventoryRoom.trim(), item: newInventoryItem.trim(), condition: newInventoryCondition, notes: newInventoryNotes.trim() };
    const updated = [...inventory, item];
    setInventory(updated);
    setNewInventoryItem(''); setNewInventoryNotes('');
    await supabase.from('properties').update({ inventory: JSON.stringify(updated) }).eq('id', selectedProperty.id);
  };

  const handleDeleteInventoryItem = async (id) => {
    const updated = inventory.filter(i => i.id !== id);
    setInventory(updated);
    await supabase.from('properties').update({ inventory: JSON.stringify(updated) }).eq('id', selectedProperty.id);
  };

  const handlePrintInventory = () => {
    const rooms = [...new Set(inventory.map(i => i.room))];
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Inventory Report - ${selectedProperty?.address_line_1}</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1a1a1a}h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;margin:24px 0 8px;border-bottom:2px solid #0f1e30;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th{background:#0f1e30;color:white;padding:8px 12px;text-align:left;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}.good{color:#22c55e;font-weight:700}.fair{color:#eab308;font-weight:700}.poor{color:#ef4444;font-weight:700}.footer{margin-top:40px;font-size:11px;color:#999;border-top:1px solid #e2e8f0;padding-top:12px}</style></head><body><h1>Inventory Report</h1><p style="color:#666;font-size:13px">${selectedProperty?.address_line_1} · Generated ${new Date().toLocaleDateString('en-GB')}</p>${rooms.map(room => `<h2>${room}</h2><table><tr><th>Item</th><th>Condition</th><th>Notes</th></tr>${inventory.filter(i => i.room === room).map(i => `<tr><td>${i.item}</td><td class="${i.condition.toLowerCase()}">${i.condition}</td><td>${i.notes || '-'}</td></tr>`).join('')}</table>`).join('')}<div class="footer">Inventory Report · The Landlord Mate · thelandlordmate.com · ${new Date().toLocaleDateString('en-GB')}</div></body></html>`);
    w.print();
  };

  const handleAddExpense = async () => {
    if (!expenseDesc.trim() || !expenseAmount) return;
    const expense = { id: Date.now(), desc: expenseDesc.trim(), amount: parseFloat(expenseAmount), date: expenseDate || new Date().toISOString().split('T')[0], category: expenseCategory };
    const updated = [...expenses, expense];
    setExpenses(updated);
    setExpenseDesc(''); setExpenseAmount(''); setExpenseDate(''); setExpenseCategory('Maintenance'); setShowAddExpense(false);
    await supabase.from('properties').update({ expenses: JSON.stringify(updated) }).eq('id', selectedProperty.id);
  };

  const handleDeleteExpense = async (id) => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    await supabase.from('properties').update({ expenses: JSON.stringify(updated) }).eq('id', selectedProperty.id);
  };

  const handleExportExpenses = () => {
    const rows = [['Date', 'Category', 'Description', 'Amount (£)']];
    expenses.forEach(e => rows.push([e.date, e.category, e.desc, e.amount.toFixed(2)]));
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    rows.push(['', '', 'TOTAL', total.toFixed(2)]);
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProperty?.address_line_1 || 'property'}-expenses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveTenancy = async () => {
    const { error } = await supabase.from('properties').update({ 
      tenancy_start: tenancyStart || null, 
      tenancy_end: tenancyEnd || null, 
      tenant_name: tenantName, 
      tenant_phone: tenantPhone,
      rent_review_date: rentReviewDate || null,
    }).eq('id', selectedProperty.id);
    if (!error) { setTenancySaved(true); setTimeout(() => setTenancySaved(false), 3000); }
  };

  const getNoticeDate = (endDate) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const notice = new Date(end);
    notice.setDate(notice.getDate() - 56);
    return notice;
  };

  const handleGenerateShareLink = async () => {
    const token = crypto.randomUUID();
    const { error } = await supabase.from('properties').update({ share_token: token }).eq('id', selectedProperty.id);
    if (error) { alert(error.message); return; }
    const link = `https://app.thelandlordmate.com?share=${token}`;
    setShareLink(link);
    navigator.clipboard.writeText(link);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 3000);
  };

  const handleScanDocument = async () => {
    if (!uploadFile) { alert('Please select a file first.'); return; }
    setScanningDocument(true);
    setScanError('');
    setScanResult(null);
    try {
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(uploadFile);
      });
      const mimeType = uploadFile.type || 'application/octet-stream';
      const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/extract-document-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
        body: JSON.stringify({ fileBase64, mimeType, documentTypeHint: docType !== 'Other' ? docType : '' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setScanError(data.error || 'Could not scan this document. Please enter the details manually.');
        setScanningDocument(false);
        return;
      }
      setScanResult(data);
      // Pre-fill the form — the landlord still confirms/edits before saving, nothing is saved automatically.
      if (data.document_type && DOC_TYPES.includes(data.document_type)) {
        setDocType(data.document_type);
      } else if (data.document_type) {
        setDocType('Other');
        setCustomDocType(data.document_type);
      }
      if (data.expiry_date) {
        setNoExpiry(false);
        setExpiryDate(data.expiry_date);
      }
    } catch (e) {
      setScanError('Could not scan this document. Please enter the details manually.');
    }
    setScanningDocument(false);
  };

  const handleUpload = async () => {
    if (!uploadFile) { alert('Please select a file.'); return; }
    setUploading(true);
    const fileExt = uploadFile.name.split('.').pop();
    const filePath = `${user.id}/${selectedProperty.id}/${Date.now()}.${fileExt}`;
    const { error: storageError } = await supabase.storage.from('documents').upload(filePath, uploadFile);
    if (storageError) { alert(storageError.message); setUploading(false); return; }
    const finalDocType = docType === 'Other' && customDocType.trim() ? customDocType.trim() : docType;
    const { error: dbError } = await supabase.from('documents').insert([{ property_id: selectedProperty.id, user_id: user.id, document_type: finalDocType, file_path: filePath, expiry_date: noExpiry ? null : (expiryDate || null) }]);
    if (dbError) { alert(dbError.message); setUploading(false); return; }
    const { data: updatedDocs } = await supabase.from('documents').select('*').eq('property_id', selectedProperty.id);
    if (updatedDocs) { setDocuments(updatedDocs); await loadAllDocuments(properties); }
    setShowUpload(false); setUploadFile(null); setExpiryDate(''); setDocType(DOC_TYPES[0]); setCustomDocType(''); setNoExpiry(false); setUploading(false); setScanResult(null); setScanError('');
  };

  const handleScanLandlordDocument = async () => {
    if (!landlordUploadFile) { alert('Please select a file first.'); return; }
    setScanningLandlordDoc(true);
    setLandlordScanError('');
    setLandlordScanResult(null);
    try {
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(landlordUploadFile);
      });
      const mimeType = landlordUploadFile.type || 'application/octet-stream';
      const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/extract-document-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
        body: JSON.stringify({ fileBase64, mimeType, documentTypeHint: landlordDocType }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setLandlordScanError(data.error || 'Could not scan this document. Please enter the details manually.');
        setScanningLandlordDoc(false);
        return;
      }
      setLandlordScanResult(data);
      if (data.document_type && LANDLORD_DOC_TYPES.includes(data.document_type)) {
        setLandlordDocType(data.document_type);
      }
      if (data.expiry_date) {
        setLandlordExpiryDate(data.expiry_date);
      }
    } catch (e) {
      setLandlordScanError('Could not scan this document. Please enter the details manually.');
    }
    setScanningLandlordDoc(false);
  };

  const handleLandlordUpload = async () => {
    if (!landlordUploadFile) { alert('Please select a file.'); return; }
    setLandlordUploading(true);
    const fileExt = landlordUploadFile.name.split('.').pop();
    const filePath = `${user.id}/landlord/${Date.now()}.${fileExt}`;
    const { error: storageError } = await supabase.storage.from('documents').upload(filePath, landlordUploadFile);
    if (storageError) { alert(storageError.message); setLandlordUploading(false); return; }
    const { error: dbError } = await supabase.from('documents').insert([{ user_id: user.id, property_id: null, document_type: landlordDocType, file_path: filePath, expiry_date: landlordExpiryDate || null }]);
    if (dbError) { alert(dbError.message); setLandlordUploading(false); return; }
    const { data: updated } = await supabase.from('documents').select('*').eq('user_id', user.id).is('property_id', null);
    if (updated) setLandlordDocs(updated);
    setShowLandlordUpload(false); setLandlordUploadFile(null); setLandlordExpiryDate(''); setLandlordDocType(LANDLORD_DOC_TYPES[0]); setLandlordUploading(false); setLandlordScanResult(null); setLandlordScanError('');
  };

  const handleDeleteLandlordDoc = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    await supabase.from('documents').delete().eq('id', docId);
    setLandlordDocs(landlordDocs.filter(d => d.id !== docId));
  };

  const handleDeleteDoc = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    await supabase.from('documents').delete().eq('id', docId);
    setDocuments(documents.filter(d => d.id !== docId));
    await loadAllDocuments(properties);
  };

  const handleEditDoc = (doc) => { setEditingDoc(doc); setEditExpiry(doc.expiry_date || ''); setEditDocType(doc.document_type); };

  const handleSaveEdit = async () => {
    const { error } = await supabase.from('documents').update({ expiry_date: editExpiry || null, document_type: editDocType }).eq('id', editingDoc.id);
    if (error) { alert(error.message); return; }
    setDocuments(documents.map(d => d.id === editingDoc.id ? { ...d, expiry_date: editExpiry || null, document_type: editDocType } : d));
    await loadAllDocuments(properties);
    setEditingDoc(null);
  };

  const handleEditLandlordDoc = (doc) => { setEditingLandlordDoc(doc); setEditLandlordExpiry(doc.expiry_date || ''); setEditLandlordDocType(doc.document_type); };

  const handleSaveLandlordEdit = async () => {
    const { error } = await supabase.from('documents').update({ expiry_date: editLandlordExpiry || null, document_type: editLandlordDocType }).eq('id', editingLandlordDoc.id);
    if (error) { alert(error.message); return; }
    setLandlordDocs(landlordDocs.map(d => d.id === editingLandlordDoc.id ? { ...d, expiry_date: editLandlordExpiry || null, document_type: editLandlordDocType } : d));
    setEditingLandlordDoc(null);
  };

  const inputStyle = { width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '15px', fontFamily: font, boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', color: 'white' };
  const lightInputStyle = { width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', fontFamily: font, boxSizing: 'border-box' };
  const primaryBtn = { width: '100%', padding: '14px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontFamily: font, fontWeight: '700', cursor: 'pointer' };

  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get("share");
  const agentCodeFromUrl = urlParams.get("agent");
  if (shareToken) return <AgentView token={shareToken} />;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: font }}>
        <div style={{ textAlign: 'center' }}>
          <img src={logo} alt="The Landlord Mate" style={{ height: '56px', marginBottom: '24px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (screen === 'reset-password') {
    return (
      <div style={{ minHeight: '100vh', background: navy, fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <img src={logo} alt="The Landlord Mate" style={{ height: '120px' }} />
          </div>
          <h1 style={{ color: '#0f1e30', textAlign: 'center', marginTop: 0, fontSize: '22px', fontWeight: '800' }}>Set new password</h1>
          {passwordResetDone ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#2e7d32', background: '#e8f5e9', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>✓ Password updated successfully!</p>
              <button onClick={() => setScreen('login')} style={{ width: '100%', padding: '14px', background: '#0f1e30', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Sign In</button>
            </div>
          ) : (
            <div>
              {error && <p style={{ color: '#c62828', background: '#ffebee', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' }}>{error}</p>}
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>Enter your new password below.</p>
              <input type="password" placeholder="New password (min 8 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={lightInputStyle} />
              <button onClick={handleResetPassword} disabled={loading} style={{ width: '100%', padding: '14px', background: '#0f1e30', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontFamily: font, fontWeight: '700', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Hard paywall — trial expired and not subscribed
  // Note: trial-expired email is handled server-side by email-lifecycle-cron (day7_expired),
  // which is more reliable than this client-side trigger (proper database dedup vs localStorage,
  // and fires even if the person never logs back in to trigger this screen).
  if (user && trialExpired) {
    return <PaywallScreen user={user} onSubscribe={handleSubscribe} subscribing={subscribing} />;
  }

  // Voluntary "Choose a plan" from Settings — still on trial, can dismiss
  if (user && forcePaywall && !trialExpired) {
    return <PaywallScreen user={user} onSubscribe={handleSubscribe} subscribing={subscribing} onClose={() => setForcePaywall(false)} daysLeft={trialStatus.daysLeft} />;
  }

  // AGENT DASHBOARD
  if (user && userRecord?.account_type === 'agent') {
    const inviteLink = `https://app.thelandlordmate.com?agent=${userRecord?.agent_code}`;
    const agentTrialStatus = getTrialStatus(userRecord?.trial_ends_at);
    const agentIsSubscribed = userRecord?.subscription_status === 'active' || userRecord?.lifetime_access === true;
    const agentTrialExpired = agentTrialStatus.expired && !agentIsSubscribed;

    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 3);
    const in28 = new Date(); in28.setDate(in28.getDate() + 28);
    const in75 = new Date(); in75.setDate(in75.getDate() + 75);
    const in200 = new Date(); in200.setDate(in200.getDate() + 200);

    const demoProperties = [
      { id: 'demo1', address_line_1: '14 Maple Street, Cardiff, CF10 2AB', property_type: 'house', country: 'Wales', user_id: 'demo_landlord1' },
      { id: 'demo2', address_line_1: '29 Pantbach Road, Birchgrove, CF14 1TH', property_type: 'house', country: 'Wales', user_id: 'demo_landlord2' },
      { id: 'demo3', address_line_1: '7 Cyncoed Avenue, Cardiff, CF23 6SB', property_type: 'flat', country: 'Wales', user_id: 'demo_landlord3' },
      { id: 'demo4', address_line_1: '42 Whitchurch Road, Cardiff, CF14 3LX', property_type: 'house', country: 'Wales', user_id: 'demo_landlord4' },
      { id: 'demo5', address_line_1: '15 Cathedral Road, Cardiff, CF11 9HA', property_type: 'flat', country: 'Wales', user_id: 'demo_landlord5' },
    ];
    const demoDocuments = [
      { id: 'd1', property_id: 'demo1', document_type: 'Gas Safety Certificate', expiry_date: yesterday.toISOString().split('T')[0] },
      { id: 'd2', property_id: 'demo1', document_type: 'EPC (Energy Performance)', expiry_date: in200.toISOString().split('T')[0] },
      { id: 'd3', property_id: 'demo2', document_type: 'EICR (Electrical Report)', expiry_date: in28.toISOString().split('T')[0] },
      { id: 'd4', property_id: 'demo2', document_type: 'Gas Safety Certificate', expiry_date: in75.toISOString().split('T')[0] },
      { id: 'd5', property_id: 'demo3', document_type: 'Gas Safety Certificate', expiry_date: in200.toISOString().split('T')[0] },
      { id: 'd6', property_id: 'demo3', document_type: 'EICR (Electrical Report)', expiry_date: in200.toISOString().split('T')[0] },
      { id: 'd7', property_id: 'demo3', document_type: 'EPC (Energy Performance)', expiry_date: in200.toISOString().split('T')[0] },
      { id: 'd8', property_id: 'demo5', document_type: 'Gas Safety Certificate', expiry_date: in75.toISOString().split('T')[0] },
    ];
    const demoLandlords = [
      { id: 'demo_landlord1', email: 'david.hughes@email.com', full_name: 'David Hughes' },
      { id: 'demo_landlord2', email: 'sarah.jones@email.com', full_name: 'Sarah Jones' },
      { id: 'demo_landlord3', email: 'gareth.williams@email.com', full_name: 'Gareth Williams' },
      { id: 'demo_landlord4', email: 'emma.davies@email.com', full_name: 'Emma Davies' },
      { id: 'demo_landlord5', email: 'james.thomas@email.com', full_name: 'James Thomas' },
    ];
    const displayProperties = agentDemoMode ? demoProperties : agentProperties;
    const displayDocuments = agentDemoMode ? demoDocuments : agentDocuments;
    const displayLandlords = agentDemoMode ? demoLandlords : agentLandlords;

    // Agent paywall
    if (agentTrialExpired) {
      return (
        <div style={{ minHeight: '100vh', background: navy, fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '720px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <img src={logo} alt="The Landlord Mate" style={{ height: '56px', marginBottom: '20px' }} />
              <h1 style={{ color: 'white', fontWeight: '900', fontSize: '28px', margin: '0 0 12px' }}>Your free trial has ended</h1>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', margin: '0 0 16px' }}>Choose an agent plan to keep managing your portfolio</p>

              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', padding: '4px', marginBottom: '16px' }}>
                <button
                  onClick={() => setAgentBilling('monthly')}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', background: agentBilling === 'monthly' ? 'white' : 'transparent', color: agentBilling === 'monthly' ? navy : 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}
                >Monthly</button>
                <button
                  onClick={() => setAgentBilling('annual')}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', background: agentBilling === 'annual' ? 'white' : 'transparent', color: agentBilling === 'annual' ? navy : 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}
                >Annual</button>
              </div>
              {agentBilling === 'annual' && (
                <p style={{ color: '#22c55e', fontSize: '13px', fontWeight: '700', margin: '0 0 12px' }}>Save 2 months free with annual billing</p>
              )}

              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '10px 16px', display: 'inline-block' }}>
                <p style={{ color: '#22c55e', fontSize: '13px', margin: 0, fontWeight: '600' }}>🔒 Your portfolio data is safe — subscribe any time to keep access.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexDirection: isMobile ? 'column' : 'row' }}>
              {[
                { key: 'agent_starter', name: 'Agent Starter', annualPrice: 499, monthlyPrice: 49.90, properties: 'Up to 50 properties', color: blue, features: ['Agency dashboard', 'Landlord invitation links', 'Compliance tracking'] },
                { key: 'agent_pro', name: 'Agent Pro', annualPrice: 999, monthlyPrice: 99.90, properties: 'Up to 200 properties', color: '#7c3aed', highlight: true, features: ['Everything in Starter', 'Bulk landlord chasing', 'Compliance report PDFs'] },
                { key: 'agent_portfolio', name: 'Agent Portfolio', annualPrice: 1999, monthlyPrice: 199.90, properties: 'Unlimited properties', color: '#059669', features: ['Everything in Pro', 'CSV portfolio export', 'Priority support'] },
              ].map(plan => {
                const displayPrice = agentBilling === 'annual' ? `£${plan.annualPrice}` : `£${plan.monthlyPrice.toFixed(2)}`;
                const period = agentBilling === 'annual' ? '/year' : '/month';
                const annualEquiv = agentBilling === 'monthly' ? `£${plan.annualPrice}/yr if paid annually` : null;
                return (
                <div key={plan.key} style={{ flex: 1, background: plan.highlight ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', border: `2px solid ${plan.highlight ? '#7c3aed' : 'rgba(255,255,255,0.1)'}`, borderRadius: '16px', padding: '24px', position: 'relative' }}>
                  {plan.highlight && <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#7c3aed', color: 'white', padding: '4px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', whiteSpace: 'nowrap' }}>MOST POPULAR</div>}
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '800', letterSpacing: '2px', margin: '0 0 8px' }}>{plan.name.toUpperCase()}</p>
                  <p style={{ color: 'white', fontWeight: '900', fontSize: '32px', margin: '0 0 2px', lineHeight: 1 }}>{displayPrice}<span style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>{period}</span></p>
                  {annualEquiv && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', margin: '2px 0 4px' }}>{annualEquiv}</p>}
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 16px' }}>{plan.properties}</p>
                  {plan.features && plan.features.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      {plan.features.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '6px' }}>
                          <span style={{ color: plan.color, fontSize: '12px', lineHeight: '18px' }}>✓</span>
                          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', lineHeight: '18px' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => handleSubscribe(PRICE_IDS[plan.key][agentBilling])} disabled={subscribing} style={{ width: '100%', padding: '12px', background: plan.color, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: subscribing ? 'not-allowed' : 'pointer', opacity: subscribing ? 0.7 : 1 }}>
                    {subscribing ? 'Loading…' : `Choose ${plan.name}`}
                  </button>
                </div>
                );
              })}
            </div>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '24px' }}>
              Secure payment via Stripe · Questions? <a href="mailto:support@thelandlordmate.com" style={{ color: blue }}>support@thelandlordmate.com</a>
            </p>
          </div>
        </div>
      );
    }

    // Agent onboarding — show for new agents with no properties
    if (agentProperties.length === 0 && userRecord?.onboarding_complete !== true) {
      return (
        <div style={{ minHeight: '100vh', background: navy, fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '560px', textAlign: 'center' }}>
            <img src={logo} alt="The Landlord Mate" style={{ height: '56px', marginBottom: '24px' }} />
            <h1 style={{ color: 'white', fontWeight: '900', fontSize: '26px', margin: '0 0 12px' }}>Welcome to your Agent Portal! 🏢</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px', margin: '0 0 32px' }}>You're all set up. Here's how to get your landlords linked in 3 easy steps.</p>
            {[
              { step: '1', icon: '🔗', title: 'Share your invitation link', desc: 'Send this link to your landlords. When they sign up via your link they automatically appear in your portfolio.' },
              { step: '2', icon: '🏠', title: 'Landlords add their properties', desc: 'They upload their compliance certificates and enter your email on each property.' },
              { step: '3', icon: '📊', title: 'You get full visibility', desc: 'See every property, every certificate, every expiry date across your entire portfolio in one place.' },
            ].map(item => (
              <div key={item.step} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px 24px', marginBottom: '12px', textAlign: 'left', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: blue, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '900', fontSize: '14px', flexShrink: 0 }}>{item.step}</div>
                <div>
                  <p style={{ margin: '0 0 4px', color: 'white', fontWeight: '700', fontSize: '15px' }}>{item.icon} {item.title}</p>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.6' }}>{item.desc}</p>
                </div>
              </div>
            ))}

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px 24px', marginBottom: '24px', textAlign: 'left' }}>
              <p style={{ margin: '0 0 4px', color: 'white', fontWeight: '700', fontSize: '15px' }}>One quick thing</p>
              <p style={{ margin: '0 0 14px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Roughly how many properties does your agency manage? We'll point you to the right plan, no pressure, you're on a free trial either way.</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'small', label: 'Under 50', tier: 'Agent Starter', price: '£499/yr' },
                  { id: 'mid', label: '50–200', tier: 'Agent Pro', price: '£999/yr' },
                  { id: 'large', label: '200+', tier: 'Agent Portfolio', price: '£1,999/yr' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setAgentOnboardSizeAnswer(opt)} style={{
                    padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer',
                    background: agentOnboardSizeAnswer?.id === opt.id ? blue : 'rgba(255,255,255,0.06)',
                    color: agentOnboardSizeAnswer?.id === opt.id ? 'white' : 'rgba(255,255,255,0.7)',
                    border: `1px solid ${agentOnboardSizeAnswer?.id === opt.id ? blue : 'rgba(255,255,255,0.12)'}`,
                    transition: 'all 0.15s ease'
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {agentOnboardSizeAnswer && (
                <div style={{ marginTop: '14px', padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ color: '#4ade80', fontSize: '13px', fontWeight: '600' }}>✓ We'd suggest <strong>{agentOnboardSizeAnswer.tier}</strong> ({agentOnboardSizeAnswer.price}) for that</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>You can always change this later in Settings</span>
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(43,124,211,0.1)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '12px', padding: '16px 20px', margin: '0 0 24px', textAlign: 'left' }}>
              <p style={{ margin: '0 0 8px', color: 'white', fontWeight: '700', fontSize: '14px' }}>Your invitation link</p>
              <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', wordBreak: 'break-all' }}>{inviteLink}</p>
              <button onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 3000); }} style={{ padding: '8px 20px', background: inviteCopied ? '#22c55e' : blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
                {inviteCopied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
            <button onClick={async () => {
              const updates = { onboarding_complete: true };
              if (agentOnboardSizeAnswer) updates.agent_portfolio_size_estimate = agentOnboardSizeAnswer.id;
              await supabase.from('users').update(updates).eq('id', user.id);
              setUserRecord(prev => ({ ...prev, ...updates }));
            }} style={{ width: '100%', padding: '14px', background: blue, color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
              Go to my dashboard →
            </button>
          </div>
        </div>
      );
    }

    const getHealthScore = (propertyId) => {
      const docs = agentDocuments.filter(d => d.property_id === propertyId);
      if (docs.length === 0) return 0;
      let score = 100;
      docs.forEach(doc => {
        const status = getExpiryStatus(doc.expiry_date);
        if (!status) return;
        if (status.type === 'expired') score -= 50;
        else if (status.type === 'urgent') score -= 25;
        else if (status.type === 'soon') score -= 10;
      });
      return Math.max(0, score);
    };

    const getHealthColor = (score) => score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
    const getHealthLabel = (score) => score >= 80 ? 'Compliant' : score >= 50 ? 'Expiring Soon' : 'Action Needed';

    const getLandlordForProperty = (property) => agentLandlords.find(l => l.id === property.user_id);
    const getNextExpiry = (propertyId) => {
      const docs = agentDocuments.filter(d => d.property_id === propertyId && d.expiry_date);
      if (!docs.length) return null;
      return docs.sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date))[0];
    };

    const getHealthScoreD = (propertyId) => {
      const docs = displayDocuments.filter(d => d.property_id === propertyId);
      if (docs.length === 0) return 0;
      let score = 100;
      docs.forEach(doc => {
        const status = getExpiryStatus(doc.expiry_date);
        if (!status) return;
        if (status.type === 'expired') score -= 50;
        else if (status.type === 'urgent') score -= 25;
        else if (status.type === 'soon') score -= 10;
      });
      return Math.max(0, score);
    };
    const getLandlordD = (property) => displayLandlords.find(l => l.id === property.user_id);
    const getNextExpiryD = (propertyId) => {
      const docs = displayDocuments.filter(d => d.property_id === propertyId && d.expiry_date);
      if (!docs.length) return null;
      return docs.sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date))[0];
    };

    const workQueue = {
      expired: displayProperties.filter(p => displayDocuments.some(d => d.property_id === p.id && getExpiryStatus(d.expiry_date)?.type === 'expired')),
      urgent: displayProperties.filter(p => displayDocuments.some(d => d.property_id === p.id && getExpiryStatus(d.expiry_date)?.type === 'urgent') && !displayDocuments.some(d => d.property_id === p.id && getExpiryStatus(d.expiry_date)?.type === 'expired')),
      soon: displayProperties.filter(p => displayDocuments.some(d => d.property_id === p.id && getExpiryStatus(d.expiry_date)?.type === 'soon') && !displayDocuments.some(d => d.property_id === p.id && ['expired','urgent'].includes(getExpiryStatus(d.expiry_date)?.type))),
    };

    const filteredAndSearched = displayProperties.filter(p => {
      const score = getHealthScoreD(p.id);
      const landlord = getLandlordD(p);
      const matchesSearch = !agentSearch || p.address_line_1.toLowerCase().includes(agentSearch.toLowerCase()) || (landlord?.email || '').toLowerCase().includes(agentSearch.toLowerCase()) || (landlord?.full_name || '').toLowerCase().includes(agentSearch.toLowerCase());
      const matchesFilter = agentFilter === 'all' || (agentFilter === 'red' && score < 50) || (agentFilter === 'amber' && score >= 50 && score < 80) || (agentFilter === 'green' && score >= 80) || (agentFilter === 'none' && displayDocuments.filter(d => d.property_id === p.id).length === 0);
      return matchesSearch && matchesFilter;
    });

    const PROPERTIES_PER_PAGE = 20;
    const LANDLORD_GROUPS_PER_PAGE = 10;

    // Group filtered properties by landlord (used when agentGroupByLandlord is on).
    // Sorted so landlords with the most pressing properties (lowest score) surface first.
    const landlordGroupsAll = (() => {
      const map = new Map();
      filteredAndSearched.forEach(p => {
        const landlord = getLandlordD(p);
        const key = landlord?.id || 'unlinked';
        if (!map.has(key)) map.set(key, { landlord, properties: [] });
        map.get(key).properties.push(p);
      });
      return Array.from(map.values()).sort((a, b) => {
        const aMin = Math.min(...a.properties.map(p => getHealthScoreD(p.id)));
        const bMin = Math.min(...b.properties.map(p => getHealthScoreD(p.id)));
        return aMin - bMin;
      });
    })();

    const totalPages = agentGroupByLandlord
      ? Math.max(1, Math.ceil(landlordGroupsAll.length / LANDLORD_GROUPS_PER_PAGE))
      : Math.max(1, Math.ceil(filteredAndSearched.length / PROPERTIES_PER_PAGE));
    const safePage = Math.min(agentPropertiesPage, totalPages);

    const pagedProperties = filteredAndSearched.slice((safePage - 1) * PROPERTIES_PER_PAGE, safePage * PROPERTIES_PER_PAGE);
    const pagedLandlordGroups = landlordGroupsAll.slice((safePage - 1) * LANDLORD_GROUPS_PER_PAGE, safePage * LANDLORD_GROUPS_PER_PAGE);

    const navItems = [
      { id: 'dashboard', label: '📊 Dashboard' },
      { id: 'askmate', label: '💬 Ask Mate' },
      { id: 'properties', label: '🏠 Properties' },
      { id: 'landlords', label: '👤 Landlords' },
      { id: 'templates', label: '📝 Templates' },
      { id: 'settings', label: '⚙️ Settings' },
      { id: 'faq', label: '❓ Help' },
    ];

    // Property detail view
    if (agentScreen === 'property' && selectedAgentProperty) {
      const propLandlord = getLandlordForProperty(selectedAgentProperty);
      const propScore = getHealthScore(selectedAgentProperty.id);
      return (
        <div style={{ minHeight: '100vh', background: navy, fontFamily: font }}>
          <div style={{ background: '#0d1b2a', borderBottom: '1px solid rgba(43,124,211,0.2)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={logo} alt="The Landlord Mate" style={{ height: '80px', cursor: 'pointer' }} onClick={() => { setAgentScreen('dashboard'); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); }} />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', cursor: 'pointer' }} onClick={() => { setAgentScreen('dashboard'); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); }}>← Back</span>
              <span style={{ color: 'white', fontWeight: '700', fontSize: '14px' }}>{selectedAgentProperty.address_line_1}</span>
            </div>
            <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Sign Out</button>
          </div>

          <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Property header */}
            {/* Property photo */}
            {selectedAgentProperty.photo_url ? (
              <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', aspectRatio: isMobile ? '16/9' : '16/6' }}>
                <img src={selectedAgentProperty.photo_url} alt={selectedAgentProperty.address_line_1} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(13,27,42,0.8) 100%)' }} />
                <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', gap: '6px' }}>
                  <label style={{ background: 'rgba(0,0,0,0.65)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    📷 Change
                    <input type="file" accept="image/*" onChange={e => handleAgentPropertyPhotoUpload(e.target.files[0], selectedAgentProperty.id)} style={{ display: 'none' }} />
                  </label>
                  <button onClick={async () => { await supabase.from('properties').update({ photo_url: null }).eq('id', selectedAgentProperty.id); setAgentProperties(agentProperties.map(p => p.id === selectedAgentProperty.id ? { ...p, photo_url: null } : p)); setSelectedAgentProperty({ ...selectedAgentProperty, photo_url: null }); }} style={{ background: 'rgba(239,68,68,0.8)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: font }}>🗑 Remove</button>
                </div>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '10px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>
                📷 Add a photo of this property
                <input type="file" accept="image/*" onChange={e => handleAgentPropertyPhotoUpload(e.target.files[0], selectedAgentProperty.id)} style={{ display: 'none' }} />
              </label>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ flex: 1 }}>
                {agentEditingProperty ? (
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '10px', padding: '16px', maxWidth: '420px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '600' }}>Address</label>
                    <input type="text" value={agentEditPropertyAddress} onChange={(e) => setAgentEditPropertyAddress(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <select value={agentEditPropertyType} onChange={(e) => setAgentEditPropertyType(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }}>
                        <option value="House">House</option>
                        <option value="Flat">Flat</option>
                        <option value="Bungalow">Bungalow</option>
                        <option value="HMO">HMO</option>
                        <option value="Other">Other</option>
                      </select>
                      <select value={agentEditPropertyCountry} onChange={(e) => setAgentEditPropertyCountry(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }}>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={handleAgentSaveEditProperty} style={{ flex: 1, padding: '10px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setAgentEditingProperty(false)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 style={{ color: 'white', fontWeight: '900', fontSize: '22px', margin: '0 0 4px' }}>{selectedAgentProperty.address_line_1}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 8px', fontSize: '13px', textTransform: 'capitalize' }}>{selectedAgentProperty.property_type}{selectedAgentProperty.country ? ` · ${selectedAgentProperty.country}` : ''}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={handleAgentEditPropertyOpen} style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>✏️ Edit</button>
                      <button onClick={handleAgentDeleteProperty} style={{ padding: '5px 12px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>🗑 Delete</button>
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => { if (!meetsTier('pro')) { tierGateAlert('Compliance Report PDFs', 'pro'); return; } const w = window.open('', '_blank'); const today = new Date().toLocaleDateString('en-GB'); const hasDocs = selectedAgentPropertyDocs.length > 0; const scoreBlockHtml = hasDocs ? `<p style="background:#f0fdf4;border:1px solid #bbf7d0;padding:10px 14px;border-radius:6px;font-size:13px">Compliance Health Score: <strong style="color:${propScore >= 80 ? '#22c55e' : propScore >= 50 ? '#eab308' : '#ef4444'}">${propScore}/100</strong></p>` : `<p style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 14px;border-radius:6px;font-size:13px;color:#64748b">No compliance documents uploaded yet for this property.</p>`; w.document.write(`<html><head><title>Compliance Report - ${selectedAgentProperty.address_line_1}</title><style>body{font-family:Georgia,serif;padding:40px;max-width:800px;margin:0 auto;color:#1a1a1a}h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;margin:24px 0 12px;border-bottom:2px solid #0f1e30;padding-bottom:6px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#0f1e30;color:white;padding:8px 12px;text-align:left;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}.green{color:#22c55e;font-weight:700}.red{color:#ef4444;font-weight:700}.amber{color:#eab308;font-weight:700}.footer{margin-top:40px;font-size:11px;color:#999;border-top:1px solid #e2e8f0;padding-top:12px}</style></head><body><h1>${selectedAgentProperty.address_line_1}</h1><p style="color:#666;font-size:13px">${selectedAgentProperty.property_type}${selectedAgentProperty.country ? ' · ' + selectedAgentProperty.country : ''} · Report generated ${today}</p>${scoreBlockHtml}<h2>Compliance Documents</h2><table><tr><th>Document</th><th>Expiry Date</th><th>Status</th><th>Days Remaining</th></tr>${selectedAgentPropertyDocs.map(doc => { const s = getExpiryStatus(doc.expiry_date); const cls = s?.type === 'good' ? 'green' : s?.type === 'expired' ? 'red' : 'amber'; return `<tr><td>${doc.document_type}</td><td>${doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-GB') : 'No date'}</td><td class="${cls}">${s?.label || 'No date set'}</td><td class="${cls}">${s?.label || '—'}</td></tr>`; }).join('')}</table><div class="footer">Generated by The Landlord Mate for ${userRecord?.agency_name || 'your agency'} · thelandlordmate.com · ${today}</div></body></html>`); w.print(); }} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
                  🖨️ Compliance Report
                </button>
                <div style={{ textAlign: 'center' }}>
                  {selectedAgentPropertyDocs.length === 0 ? (
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.35)', fontWeight: '900', fontSize: '20px', lineHeight: 1 }}>—</p>
                  ) : (
                    <p style={{ margin: 0, color: getHealthColor(propScore), fontWeight: '900', fontSize: '32px', lineHeight: 1 }}>{propScore}</p>
                  )}
                  <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Health Score</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0' }}>
              {[
                { id: 'documents', label: '📄 Documents' },
                { id: 'landlord', label: '👤 Landlord' },
                { id: 'notes', label: `📝 Notes ${agentNotes.length > 0 ? `(${agentNotes.length})` : ''}` },
                { id: 'templates', label: '✉️ Message' },
                { id: 'audit', label: '🕐 Audit Log' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setAgentPropertyTab(tab.id)} style={{ padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: `2px solid ${agentPropertyTab === tab.id ? blue : 'transparent'}`, color: agentPropertyTab === tab.id ? 'white' : 'rgba(255,255,255,0.5)', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', marginBottom: '-1px' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Documents tab */}
            {agentPropertyTab === 'documents' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <button onClick={() => setShowAgentUpload(!showAgentUpload)} style={{ padding: '10px 18px', background: showAgentUpload ? 'rgba(255,255,255,0.08)' : blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
                    {showAgentUpload ? 'Cancel' : '+ Upload Document for Landlord'}
                  </button>
                </div>

                {showAgentUpload && (
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(43,124,211,0.3)', padding: '24px', borderRadius: '12px', marginBottom: '16px' }}>
                    <h3 style={{ color: 'white', marginTop: 0, fontWeight: '700', fontSize: '15px' }}>Upload Document</h3>
                    <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Document type</label>
                    <select value={agentDocType} onChange={(e) => { setAgentDocType(e.target.value); setAgentCustomDocType(''); }} style={inputStyle}>
                      {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {agentDocType === 'Other' && (
                      <input type="text" placeholder="Enter document type…" value={agentCustomDocType} onChange={(e) => setAgentCustomDocType(e.target.value)} style={{ ...inputStyle, marginTop: '-4px' }} />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <input type="checkbox" id="agentNoExpiry" checked={agentNoExpiry} onChange={(e) => { setAgentNoExpiry(e.target.checked); if (e.target.checked) setAgentExpiryDate(''); }} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                      <label htmlFor="agentNoExpiry" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>No expiry date (e.g. tenancy agreement, deposit cert)</label>
                    </div>
                    {!agentNoExpiry && (
                      <>
                        <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Expiry date</label>
                        <input type="date" value={agentExpiryDate} onChange={(e) => setAgentExpiryDate(e.target.value)} style={inputStyle} />
                      </>
                    )}
                    <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Select file <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>(PDF, JPG or PNG)</span></label>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/*" onChange={(e) => { setAgentUploadFile(e.target.files[0]); setAgentScanResult(null); setAgentScanError(''); }} style={{ ...inputStyle, padding: '8px' }} />

                    {agentUploadFile && !agentScanResult && (
                      <button onClick={handleScanAgentDocument} disabled={scanningAgentDocument} style={{ width: '100%', padding: '12px', marginTop: '4px', marginBottom: '12px', background: 'rgba(43,124,211,0.12)', border: '1px solid rgba(43,124,211,0.35)', borderRadius: '8px', color: blue, fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: scanningAgentDocument ? 'default' : 'pointer', opacity: scanningAgentDocument ? 0.7 : 1 }}>
                        {scanningAgentDocument ? '✨ Reading the document…' : '✨ Scan with AI — fill in the dates for me'}
                      </button>
                    )}

                    {agentScanResult && (
                      <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                        <p style={{ margin: '0 0 4px', color: '#4ade80', fontSize: '13px', fontWeight: '700' }}>✓ Scanned — please check this is correct before saving</p>
                        {agentScanResult.confidence === 'low' && (
                          <p style={{ margin: '0 0 4px', color: '#fbbf24', fontSize: '12px' }}>⚠ Low confidence — double-check the date below carefully.</p>
                        )}
                      </div>
                    )}
                    {agentScanError && (
                      <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '-4px', marginBottom: '12px' }}>{agentScanError}</p>
                    )}

                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '4px', marginBottom: '12px' }}>The landlord will get an email letting them know this was added on their behalf, so they can check it over.</p>

                    <button onClick={handleAgentUpload} disabled={agentUploading} style={{ width: '100%', padding: '14px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontFamily: font, fontWeight: '700', cursor: agentUploading ? 'default' : 'pointer', opacity: agentUploading ? 0.7 : 1 }}>
                      {agentUploading ? 'Uploading…' : 'Save Document'}
                    </button>
                  </div>
                )}

                {selectedAgentPropertyDocs.length === 0 ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No documents uploaded yet</p>
                  </div>
                ) : selectedAgentPropertyDocs.map(doc => {
                  const status = getExpiryStatus(doc.expiry_date);
                  return (
                    <div key={doc.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '16px 20px', borderRadius: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status?.color || '#666', flexShrink: 0 }} />
                        <div>
                          <p style={{ margin: 0, fontWeight: '700', color: 'white', fontSize: '14px' }}>{doc.document_type}</p>
                          {doc.expiry_date && <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Expires: {new Date(doc.expiry_date).toLocaleDateString('en-GB')}</p>}
                          {!doc.expiry_date && <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No expiry date</p>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {status && <span style={{ background: status.bg, color: status.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{status.label}</span>}
                        {doc.file_path && (() => { const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_path); return <a href={data.publicUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', background: 'rgba(43,124,211,0.15)', color: '#4a9eff', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>👁 View</a>; })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Landlord tab */}
            {agentPropertyTab === 'landlord' && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '24px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 16px' }}>Landlord Details</p>
                <p style={{ color: 'white', fontWeight: '700', fontSize: '15px', margin: '0 0 4px' }}>{propLandlord?.full_name || '—'}</p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 16px' }}>{propLandlord?.email || '—'}</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 4px' }}>Account type: <span style={{ color: 'white' }}>{propLandlord?.account_type || 'landlord'}</span></p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 }}>Member since: <span style={{ color: 'white' }}>{propLandlord?.created_at ? new Date(propLandlord.created_at).toLocaleDateString('en-GB') : '—'}</span></p>
              </div>
            )}

            {/* Notes tab */}
            {agentPropertyTab === 'notes' && (
              <div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <textarea value={newAgentNote} onChange={e => setNewAgentNote(e.target.value)} placeholder="Add a note about this property..." rows={3} style={{ flex: 1, padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '14px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white', resize: 'none' }} />
                  <button onClick={handleAddAgentNote} style={{ padding: '12px 16px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', alignSelf: 'flex-end' }}>Add</button>
                </div>
                {agentNotes.length === 0 && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No notes yet</p>}
                {agentNotes.map(note => (
                  <div key={note.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                    <p style={{ margin: '0 0 8px', color: 'white', fontSize: '14px', lineHeight: '1.6' }}>{note.note}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>{new Date(note.created_at).toLocaleString('en-GB')}</p>
                      <button onClick={() => handleDeleteAgentNote(note.id)} style={{ padding: '3px 8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '4px', fontSize: '11px', fontFamily: font, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Message/Templates tab */}
            {agentPropertyTab === 'templates' && (
              <div>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '16px' }}>Send a message to the landlord. Placeholders are automatically filled in.</p>
                {agentTemplates.length === 0 ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '0 0 12px' }}>No templates yet — create them in the Templates section</p>
                  </div>
                ) : agentTemplates.map(t => {
                  const nextExpiry = selectedAgentPropertyDocs.filter(d => d.expiry_date).sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date))[0];
                  const populatedBody = t.body
                    .replace(/\[property_address\]/g, selectedAgentProperty.address_line_1)
                    .replace(/\[expiry_date\]/g, nextExpiry ? new Date(nextExpiry.expiry_date).toLocaleDateString('en-GB') : '[expiry date]')
                    .replace(/\[agency_name\]/g, userRecord?.agency_name || 'Your Agent');
                  return (
                    <div key={t.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px 20px', marginBottom: '10px' }}>
                      <p style={{ margin: '0 0 8px', color: 'white', fontWeight: '700', fontSize: '14px' }}>{t.title}</p>
                      <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{populatedBody}</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <a href={`mailto:${propLandlord?.email || ''}?subject=${encodeURIComponent(t.title)}&body=${encodeURIComponent(populatedBody)}`} style={{ padding: '7px 14px', background: blue, color: 'white', borderRadius: '7px', fontSize: '12px', fontFamily: font, fontWeight: '700', textDecoration: 'none' }}>Send Email</a>
                        <button onClick={() => navigator.clipboard.writeText(populatedBody)} style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '7px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Copy</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Audit Log tab */}
            {agentPropertyTab === 'audit' && (
              <div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px' }}>Timeline of activity for this property.</p>
                <div style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px solid rgba(43,124,211,0.3)' }}>
                  {selectedAgentPropertyDocs.map(doc => (
                    <div key={doc.id} style={{ marginBottom: '16px', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-25px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: blue }} />
                      <p style={{ margin: '0 0 2px', color: 'white', fontSize: '13px', fontWeight: '600' }}>📄 {doc.document_type} uploaded</p>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{doc.created_at ? new Date(doc.created_at).toLocaleString('en-GB') : 'Date unknown'}</p>
                    </div>
                  ))}
                  {agentNotes.map(note => (
                    <div key={note.id} style={{ marginBottom: '16px', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '-25px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: '#a78bfa' }} />
                      <p style={{ margin: '0 0 2px', color: 'white', fontSize: '13px', fontWeight: '600' }}>📝 Agent note added</p>
                      <p style={{ margin: '0 0 2px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontStyle: 'italic' }}>"{note.note.substring(0, 60)}{note.note.length > 60 ? '...' : ''}"</p>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{new Date(note.created_at).toLocaleString('en-GB')}</p>
                    </div>
                  ))}
                  <div style={{ marginBottom: '16px', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-25px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                    <p style={{ margin: '0 0 2px', color: 'white', fontSize: '13px', fontWeight: '600' }}>👁️ Agent viewed property</p>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Just now</p>
                  </div>
                  {selectedAgentPropertyDocs.length === 0 && agentNotes.length === 0 && (
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No activity recorded yet</p>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      );
    }
    if (agentScreen === 'landlords') {
      const landlordsList = displayLandlords.map(l => {
        const theirProperties = displayProperties.filter(p => p.user_id === l.id);
        const theirDocs = displayProperties.length > 0 ? agentDocuments.filter(d => theirProperties.some(p => p.id === d.property_id)) : [];
        const avgScore = theirProperties.length > 0
          ? Math.round(theirProperties.reduce((sum, p) => sum + getHealthScoreD(p.id), 0) / theirProperties.length)
          : null;
        return { ...l, propertyCount: theirProperties.length, firstProperty: theirProperties[0], avgScore };
      }).sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email));

      return (
        <div style={{ minHeight: '100vh', background: navy, fontFamily: font }}>
          <div style={{ background: '#0d1b2a', borderBottom: '1px solid rgba(43,124,211,0.2)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={logo} alt="The Landlord Mate" style={{ height: '80px', cursor: 'pointer' }} onClick={() => { setAgentScreen('dashboard'); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); }} />
              {agencyLogoUrl && <img src={agencyLogoUrl} alt="Agency logo" style={{ height: '80px', objectFit: 'contain' }} />}
              <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ color: 'white', fontWeight: '900', fontSize: '20px', letterSpacing: '-0.5px' }}>{userRecord?.agency_name || 'Agent Portal'}</span>
              <span style={{ background: 'rgba(43,124,211,0.2)', color: blue, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>AGENT</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {navItems.map(n => <button key={n.id} onClick={() => { setAgentScreen(n.id); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); if (n.id === 'properties') setSelectedAgentProperty(null); }} style={{ padding: '6px 12px', background: agentScreen === n.id ? blue : 'transparent', color: agentScreen === n.id ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>{n.label}</button>)}
              <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>
          <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={{ color: 'white', fontWeight: '900', fontSize: '22px', margin: 0 }}>👤 Your Landlords</h1>
              <button onClick={() => setShowAgentAddProperty(true) || setAgentScreen('properties')} style={{ padding: '10px 20px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>+ Add Landlord</button>
            </div>

            {landlordsList.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', margin: '0 0 12px' }}>👤</p>
                <p style={{ color: 'white', fontWeight: '700', fontSize: '16px', margin: '0 0 8px' }}>No landlords linked yet</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Invite landlords or add a property on their behalf from the Properties tab to see them here.</p>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0', padding: '12px 20px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>LANDLORD</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>PROPERTIES</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>AVG SCORE</span>
                  <span></span>
                </div>
                {landlordsList.map((l, i) => (
                  <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0', padding: '14px 20px', borderBottom: i < landlordsList.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center' }}>
                    <div>
                      {editingLandlordId === l.id ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input type="text" autoFocus value={editingLandlordName} onChange={e => setEditingLandlordName(e.target.value)} style={{ ...inputStyle, marginBottom: 0, padding: '6px 10px', fontSize: '13px', maxWidth: '180px' }} />
                          <button disabled={savingLandlordName} onClick={async () => {
                            if (!editingLandlordName.trim()) return;
                            setSavingLandlordName(true);
                            try {
                              const res = await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/agent-update-landlord-name', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
                                body: JSON.stringify({ agentId: user.id, landlordId: l.id, fullName: editingLandlordName.trim() }),
                              });
                              const result = await res.json();
                              if (!res.ok || result.error) { alert(result.error || 'Could not update this name — please try again.'); }
                              else { setAgentLandlords(prev => prev.map(al => al.id === l.id ? { ...al, full_name: editingLandlordName.trim() } : al)); }
                            } catch (e) { alert('Could not update this name — please try again.'); }
                            setSavingLandlordName(false);
                            setEditingLandlordId(null);
                          }} style={{ padding: '6px 10px', background: blue, color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>{savingLandlordName ? '...' : 'Save'}</button>
                          <button onClick={() => setEditingLandlordId(null)} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <p style={{ margin: 0, color: 'white', fontWeight: '600', fontSize: '13px' }}>{l.full_name || l.email}</p>
                            {l.full_name && <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{l.email}</p>}
                          </div>
                          <button onClick={() => { setEditingLandlordId(l.id); setEditingLandlordName(l.full_name || ''); }} title="Edit name" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '12px', cursor: 'pointer', padding: '2px' }}>✏️</button>
                        </div>
                      )}
                    </div>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{l.propertyCount} {l.propertyCount === 1 ? 'property' : 'properties'}</p>
                    <p style={{ margin: 0, color: l.avgScore === null ? 'rgba(255,255,255,0.3)' : getHealthColor(l.avgScore), fontSize: '13px', fontWeight: '700' }}>{l.avgScore === null ? '—' : `${l.avgScore}/100`}</p>
                    <p onClick={() => { setAgentSearch(l.full_name || l.email); setAgentPropertiesPage(1); setAgentScreen('properties'); }} style={{ margin: 0, color: l.propertyCount > 0 ? blue : 'rgba(255,255,255,0.3)', fontSize: '12px', fontWeight: '600', cursor: l.propertyCount > 0 ? 'pointer' : 'default' }}>{l.propertyCount > 0 ? `View all ${l.propertyCount} →` : '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (agentScreen === 'templates') {
      return (
        <div style={{ minHeight: '100vh', background: navy, fontFamily: font }}>
          <div style={{ background: '#0d1b2a', borderBottom: '1px solid rgba(43,124,211,0.2)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={logo} alt="The Landlord Mate" style={{ height: '80px', cursor: 'pointer' }} onClick={() => { setAgentScreen('dashboard'); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); }} />
              {agencyLogoUrl && <img src={agencyLogoUrl} alt="Agency logo" style={{ height: '80px', objectFit: 'contain' }} />}
              <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ color: 'white', fontWeight: '900', fontSize: '20px', letterSpacing: '-0.5px' }}>{userRecord?.agency_name || 'Agent Portal'}</span>
              <span style={{ background: 'rgba(43,124,211,0.2)', color: blue, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>AGENT</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {navItems.map(n => <button key={n.id} onClick={async () => { setAgentScreen(n.id); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); if (n.id === 'properties') setSelectedAgentProperty(null); const { data } = await supabase.from('templates').select('*').eq('agent_id', user.id); if (data) setAgentTemplates(data); }} style={{ padding: '6px 12px', background: agentScreen === n.id ? blue : 'transparent', color: agentScreen === n.id ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>{n.label}</button>)}
              <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>
          <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={{ color: 'white', fontWeight: '900', fontSize: '22px', margin: 0 }}>📝 Message Templates</h1>
              <button onClick={() => setShowNewTemplate(!showNewTemplate)} style={{ padding: '10px 20px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>+ New Template</button>
            </div>
            {showNewTemplate && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
                <input type="text" placeholder="Template title" value={templateTitle} onChange={e => setTemplateTitle(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '14px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white', boxSizing: 'border-box' }} />
                <textarea placeholder="Message body..." value={templateBody} onChange={e => setTemplateBody(e.target.value)} rows={6} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '14px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white', boxSizing: 'border-box', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleSaveTemplate} style={{ padding: '10px 20px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Save Template</button>
                  <button onClick={() => setShowNewTemplate(false)} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {agentTemplates.length === 0 && !showNewTemplate && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', margin: '0 0 12px' }}>✉️</p>
                <p style={{ color: 'white', fontWeight: '700', fontSize: '16px', margin: '0 0 8px' }}>No templates yet</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Create reusable message templates for chasing landlords</p>
              </div>
            )}
            {agentTemplates.map(t => (
              <div key={t.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <p style={{ margin: 0, color: 'white', fontWeight: '700', fontSize: '15px' }}>{t.title}</p>
                  <button onClick={() => handleDeleteTemplate(t.id)} style={{ padding: '3px 8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '4px', fontSize: '11px', fontFamily: font, cursor: 'pointer' }}>Delete</button>
                </div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (agentScreen === 'askmate') {
      const agentChatPrompts = [
        'What documents do I need for a Welsh tenancy?',
        'What is a Section 173 notice?',
        'What is Rent Smart Wales?',
        'What is a Written Occupation Contract?',
        'What is an EICR and when do I need one?',
        'When must I protect a tenancy deposit?',
      ];
      return (
        <div style={{ minHeight: '100vh', background: navy, fontFamily: font }}>
          <div style={{ background: '#0d1b2a', borderBottom: '1px solid rgba(43,124,211,0.2)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={logo} alt="The Landlord Mate" style={{ height: '80px', cursor: 'pointer' }} onClick={() => { setAgentScreen('dashboard'); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); }} />
              {agencyLogoUrl && <img src={agencyLogoUrl} alt="Agency logo" style={{ height: '80px', objectFit: 'contain' }} />}
              <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ color: 'white', fontWeight: '900', fontSize: '20px', letterSpacing: '-0.5px' }}>{userRecord?.agency_name || 'Agent Portal'}</span>
              <span style={{ background: 'rgba(43,124,211,0.2)', color: blue, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>AGENT</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {navItems.map(n => <button key={n.id} onClick={async () => { setAgentScreen(n.id); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); if (n.id === 'properties') setSelectedAgentProperty(null); const { data } = await supabase.from('templates').select('*').eq('agent_id', user.id); if (data) setAgentTemplates(data); }} style={{ padding: '6px 12px', background: agentScreen === n.id ? blue : 'transparent', color: agentScreen === n.id ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>{n.label}</button>)}
              <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>

          <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 80px)', boxSizing: 'border-box' }}>div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 80px)', boxSizing: 'border-box' }}>
            <div style={{ marginBottom: '20px' }}>
              <span onClick={() => { setAgentScreen('dashboard'); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); }} style={{ color: blue, fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-block', marginBottom: '10px' }}>← Back to Dashboard</span>
              <h1 style={{ color: 'white', fontWeight: '800', fontSize: '20px', margin: '0 0 6px' }}>💬 Ask Mate</h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>Instant answers on landlord and letting law, with memory of your conversation. Covers Wales and England compliance.</p>
            </div>

            <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', marginBottom: '16px', minHeight: '300px' }}>
              {aiHistory.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '18px' }}>Ask me anything about landlord or letting agent compliance, or try one of these:</p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {agentChatPrompts.map((s, i) => (
                      <button key={i} onClick={() => { setAiQuestion(s); }} style={{ background: 'rgba(43,124,211,0.15)', border: '1px solid rgba(43,124,211,0.3)', color: '#7db3e8', padding: '8px 14px', borderRadius: '20px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aiHistory.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '75%', padding: '10px 16px', borderRadius: '16px', fontSize: '13px', lineHeight: '1.6', fontFamily: font,
                    background: m.role === 'user' ? blue : 'rgba(255,255,255,0.07)',
                    color: m.role === 'user' ? 'white' : 'rgba(255,255,255,0.85)',
                    borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                    borderBottomLeftRadius: m.role === 'user' ? '16px' : '4px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '10px 16px', borderRadius: '16px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontFamily: font }}>
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Ask about Gas Safe, EICR, Rent Smart Wales, tenancy law..."
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAskAI(); }}
                style={{ width: '100%', padding: '16px 56px 16px 20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(43,124,211,0.4)', borderRadius: '50px', color: 'white', fontSize: '15px', fontFamily: font, outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                onClick={() => handleAskAI()}
                disabled={aiLoading || !aiQuestion.trim()}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '38px', height: '38px', background: blue, color: 'white', border: 'none', borderRadius: '50%', fontSize: '16px', cursor: aiLoading || !aiQuestion.trim() ? 'not-allowed' : 'pointer', opacity: aiLoading || !aiQuestion.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {aiLoading ? '⋯' : '↑'}
              </button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '10px', textAlign: 'center' }}>Ask Mate can make mistakes. Always seek professional advice for specific situations.</p>
          </div>
        </div>
      );
    }

    if (agentScreen === 'faq') {
      const agentFaqs = [
        { q: 'How do I invite landlords to my portfolio?', a: 'Go to your Dashboard and copy your unique Invitation Link. Send it to your landlords via email or WhatsApp. When they sign up using your link they automatically appear in your portfolio — no manual linking needed.' },
        { q: 'How does the health score work?', a: 'Each property gets a score from 0-100. It starts at 100 and deductions are made for compliance issues: -50 for an expired document, -25 for a document expiring within 30 days, -10 for a document expiring within 90 days. Green is 80+, amber is 50-79, red is below 50.' },
        { q: 'How do I send a bulk chase to landlords?', a: 'On the Dashboard, tick the checkboxes next to the properties you want to chase, then click the "Chase Landlords" button. The system sends a reminder email to each landlord automatically.' },
        { q: 'How do I download a compliance report?', a: 'Click on any property in your portfolio, then click the "Compliance Report" button at the top. This generates a print-ready PDF showing all certificates, expiry dates and current status.' },
        { q: 'How do I add my agency logo?', a: 'Go to Settings and find the Agency Logo section. Click Choose File, select your logo image, preview it, then click Save Logo. Your logo will appear in the header on all screens.' },
        { q: 'How do message templates work?', a: 'Go to Templates to create and manage your message templates. When you click on a property and go to the Message tab, you can send any template to the landlord. The [property_address], [expiry_date] and [agency_name] placeholders are automatically filled in.' },
        { q: 'What does the Work Queue show?', a: 'The Work Queue at the top of your dashboard shows properties that need immediate attention — expired certificates in red, documents expiring within 30 days in amber, and those expiring within 90 days in yellow.' },
        { q: 'Can landlords see my agent notes?', a: 'No — agent notes are completely private. Only you and other agents in your account can see notes added in the Notes tab. Landlords have no visibility of them.' },
        { q: 'How do I export my portfolio?', a: 'Click the Export CSV button on your dashboard. This exports whatever properties currently match your search and filter, grouped by landlord, with their compliance status, document count and next expiry date. Clear your search and filter first if you want everyone. Want just one landlord? Turn on "Group by Landlord" and click Export next to their name instead.' },
        { q: 'How do I get help?', a: 'Email support@thelandlordmate.com and we will respond within 24 hours Monday to Friday.' },
      ];
      return (
        <div style={{ minHeight: '100vh', background: navy, fontFamily: font }}>
          <div style={{ background: '#0d1b2a', borderBottom: '1px solid rgba(43,124,211,0.2)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={logo} alt="The Landlord Mate" style={{ height: '80px', cursor: 'pointer' }} onClick={() => { setAgentScreen('dashboard'); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); }} />
              {agencyLogoUrl && <img src={agencyLogoUrl} alt="Agency logo" style={{ height: '80px', objectFit: 'contain' }} />}
              <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ color: 'white', fontWeight: '900', fontSize: '20px', letterSpacing: '-0.5px' }}>{userRecord?.agency_name || 'Agent Portal'}</span>
              <span style={{ background: 'rgba(43,124,211,0.2)', color: blue, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>AGENT</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {navItems.map(n => <button key={n.id} onClick={async () => { setAgentScreen(n.id); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); if (n.id === 'properties') setSelectedAgentProperty(null); const { data } = await supabase.from('templates').select('*').eq('agent_id', user.id); if (data) setAgentTemplates(data); }} style={{ padding: '6px 12px', background: agentScreen === n.id ? blue : 'transparent', color: agentScreen === n.id ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>{n.label}</button>)}
              <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>
          <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ color: 'white', fontWeight: '800', fontSize: '22px', marginBottom: '6px' }}>❓ Help & FAQs</h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '8px' }}>Everything you need to know about the agent portal.</p>
            <a href="mailto:support@thelandlordmate.com" style={{ color: blue, fontSize: '13px', fontWeight: '700', marginBottom: '24px', display: 'block' }}>Email us at support@thelandlordmate.com →</a>
            <div style={{ background: 'rgba(43,124,211,0.08)', border: '1px solid rgba(43,124,211,0.25)', borderRadius: '14px', padding: '20px 24px', marginBottom: '24px' }}>
              <p style={{ margin: '0 0 4px', color: 'white', fontWeight: '700', fontSize: '14px' }}>📞 Support</p>
              <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>We respond within 24 hours, Monday to Friday.</p>
              <a href="mailto:support@thelandlordmate.com" style={{ color: blue, fontSize: '13px', fontWeight: '700' }}>support@thelandlordmate.com</a>
            </div>
            {agentFaqs.map((faq, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px 24px', marginBottom: '10px' }}>
                <p style={{ margin: '0 0 8px', color: 'white', fontWeight: '700', fontSize: '14px' }}>Q: {faq.q}</p>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: '13px', lineHeight: '1.7' }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (agentScreen === 'settings') {
      return (
        <div style={{ minHeight: '100vh', background: navy, fontFamily: font }}>
          <div style={{ background: '#0d1b2a', borderBottom: '1px solid rgba(43,124,211,0.2)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={logo} alt="The Landlord Mate" style={{ height: '80px', cursor: 'pointer' }} onClick={() => { setAgentScreen('dashboard'); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); }} />
              {agencyLogoUrl && <img src={agencyLogoUrl} alt="Agency logo" style={{ height: '80px', objectFit: 'contain' }} />}
              <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ color: 'white', fontWeight: '900', fontSize: '20px', letterSpacing: '-0.5px' }}>{userRecord?.agency_name || 'Agent Portal'}</span>
              <span style={{ background: 'rgba(43,124,211,0.2)', color: blue, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>AGENT</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {navItems.map(n => <button key={n.id} onClick={async () => { setAgentScreen(n.id); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); if (n.id === 'properties') setSelectedAgentProperty(null); const { data } = await supabase.from('templates').select('*').eq('agent_id', user.id); if (data) setAgentTemplates(data); }} style={{ padding: '6px 12px', background: agentScreen === n.id ? blue : 'transparent', color: agentScreen === n.id ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>{n.label}</button>)}
              <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Sign Out</button>
            </div>
          </div>
          <div style={{ padding: '32px', maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ color: 'white', fontWeight: '900', fontSize: '22px', marginBottom: '24px' }}>⚙️ Settings</h1>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '24px', marginBottom: '16px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 16px' }}>Agency Profile</p>
              
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '700', margin: '0 0 6px' }}>Agency Name</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input type="text" placeholder={userRecord?.agency_name || 'Agency name'} value={agencyNameEdit} onChange={e => setAgencyNameEdit(e.target.value)} style={{ flex: 1, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '14px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white' }} />
                <button onClick={async () => {
                  if (!agencyNameEdit.trim()) return;
                  await supabase.from('users').update({ agency_name: agencyNameEdit.trim() }).eq('id', user.id);
                  setUserRecord({ ...userRecord, agency_name: agencyNameEdit.trim() });
                  setAgencyNameSaved(true);
                  setAgencyNameEdit('');
                  setTimeout(() => setAgencyNameSaved(false), 3000);
                }} style={{ padding: '10px 16px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>Save</button>
              </div>
              {agencyNameSaved && <p style={{ color: '#22c55e', fontSize: '12px', fontWeight: '700', margin: '-10px 0 12px' }}>✓ Agency name updated!</p>}
              
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 16px' }}>{user?.email}</p>
              
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: '700', margin: '0 0 8px' }}>Agency Logo</p>
              {(pendingAgencyLogoPreview || agencyLogoUrl) && (
                <img src={pendingAgencyLogoPreview || agencyLogoUrl} alt="Agency logo" style={{ height: '64px', objectFit: 'contain', marginBottom: '12px', display: 'block', borderRadius: '6px', maxWidth: '200px', background: 'white', padding: '8px 12px' }} />
              )}
              <input type="file" accept="image/*" onChange={e => handleAgencyLogoSelect(e.target.files[0])} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px', display: 'block' }} />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {pendingAgencyLogoPreview && <button onClick={handleAgencyLogoSave} disabled={uploadingLogo} style={{ padding: '8px 16px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>{uploadingLogo ? 'Saving...' : 'Save Logo'}</button>}
                {agencyLogoUrl && !pendingAgencyLogoPreview && <button onClick={handleAgencyLogoRemove} style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '8px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Remove Logo</button>}
                {pendingAgencyLogoPreview && <button onClick={() => { setPendingAgencyLogo(null); setPendingAgencyLogoPreview(''); }} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Cancel</button>}
              </div>
              {logoSaved && <p style={{ color: '#22c55e', fontSize: '12px', fontWeight: '700', margin: '0 0 8px' }}>✓ Logo saved!</p>}
              <div style={{ background: 'rgba(43,124,211,0.1)', border: '1px solid rgba(43,124,211,0.25)', borderRadius: '10px', padding: '12px 16px' }}>
                <p style={{ margin: '0 0 4px', color: '#7db3e8', fontSize: '13px', fontWeight: '700' }}>Your Agent Code</p>
                <p style={{ margin: 0, color: 'white', fontSize: '13px', fontFamily: 'monospace' }}>{userRecord?.agent_code}</p>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '24px', marginBottom: '16px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 16px' }}>Invitation Link</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 12px' }}>Share this with landlords to link them to your portfolio automatically.</p>
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', wordBreak: 'break-all', marginBottom: '10px' }}>{inviteLink}</div>
              <button onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 3000); }} style={{ padding: '8px 16px', background: inviteCopied ? '#22c55e' : blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
                {inviteCopied ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '24px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 16px' }}>Support</p>
              <a href="mailto:support@thelandlordmate.com" style={{ color: blue, fontSize: '13px', fontWeight: '600' }}>support@thelandlordmate.com</a>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '24px', marginTop: '16px' }}>
              <p style={{ color: '#ef4444', fontSize: '11px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 12px' }}>Danger Zone</p>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 16px' }}>This deletes your agency account, invitations, notes, and templates. Properties and documents belonging to your landlords are not affected — they'll simply no longer show as linked to your agency.</p>
              <button onClick={handleDeleteAgentAccount} style={{ padding: '10px 20px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Delete My Agency Account</button>
            </div>
          </div>
        </div>
      );
    }

    // Main dashboard + properties list
    return (
      <div style={{ minHeight: '100vh', background: navy, fontFamily: font }}>
        {/* Header with nav */}
        <div style={{ background: '#0d1b2a', borderBottom: '1px solid rgba(43,124,211,0.2)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={logo} alt="The Landlord Mate" style={{ height: '80px', cursor: 'pointer' }} onClick={() => { setAgentScreen('dashboard'); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); }} />
            {agencyLogoUrl && <img src={agencyLogoUrl} alt="Agency logo" style={{ height: '80px', objectFit: 'contain' }} />}
            <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.15)' }} />
            <span style={{ color: 'white', fontWeight: '900', fontSize: '20px', letterSpacing: '-0.5px' }}>{userRecord?.agency_name || 'Agent Portal'}</span>
            <span style={{ background: 'rgba(43,124,211,0.2)', color: blue, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>AGENT</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {navItems.map(n => <button key={n.id} onClick={async () => { setAgentScreen(n.id); setShowBulkInvite(false); setShowInviteForm(false); setShowAgentAddProperty(false); if (n.id === 'properties') setSelectedAgentProperty(null); const { data } = await supabase.from('templates').select('*').eq('agent_id', user.id); if (data) setAgentTemplates(data); }} style={{ padding: '6px 12px', background: agentScreen === n.id ? blue : 'transparent', color: agentScreen === n.id ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>{n.label}</button>)}
            <button onClick={() => setAgentDemoMode(!agentDemoMode)} style={{ padding: '6px 12px', background: agentDemoMode ? '#f59e0b' : 'rgba(245,158,11,0.15)', color: agentDemoMode ? 'white' : '#f59e0b', border: `1px solid rgba(245,158,11,0.4)`, borderRadius: '6px', fontSize: '11px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
              {agentDemoMode ? '👁 Demo ON' : '👁 Demo'}
            </button>
            <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Sign Out</button>
          </div>
        </div>

        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>

          {agentDemoMode && <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#f59e0b', fontWeight: '700', fontSize: '13px' }}>👁 Demo Mode — showing sample portfolio data. Click "Demo ON" to return to your live data.</span></div>}

          {/* Work Queue — Heart Attack Dashboard */}
          {(workQueue.expired.length > 0 || workQueue.urgent.length > 0) && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px' }}>
              <p style={{ margin: '0 0 12px', color: '#ef4444', fontWeight: '800', fontSize: '14px' }}>⚠️ Work Queue — Needs Attention Today</p>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {workQueue.expired.length > 0 && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: '10px', padding: '12px 16px', flex: 1, minWidth: '160px' }}>
                    <p style={{ margin: '0 0 4px', color: '#ef4444', fontWeight: '900', fontSize: '24px' }}>{workQueue.expired.length}</p>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Expired certificates</p>
                  </div>
                )}
                {workQueue.urgent.length > 0 && (
                  <div style={{ background: 'rgba(249,115,22,0.1)', borderRadius: '10px', padding: '12px 16px', flex: 1, minWidth: '160px' }}>
                    <p style={{ margin: '0 0 4px', color: '#f97316', fontWeight: '900', fontSize: '24px' }}>{workQueue.urgent.length}</p>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Expiring within 30 days</p>
                  </div>
                )}
                {workQueue.soon.length > 0 && (
                  <div style={{ background: 'rgba(234,179,8,0.1)', borderRadius: '10px', padding: '12px 16px', flex: 1, minWidth: '160px' }}>
                    <p style={{ margin: '0 0 4px', color: '#eab308', fontWeight: '900', fontSize: '24px' }}>{workQueue.soon.length}</p>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>Expiring within 90 days</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {[
              { label: 'Properties', value: displayProperties.length, color: blue, sub: 'In your portfolio', screen: 'properties' },
              { label: 'Action Needed', value: workQueue.expired.length + workQueue.urgent.length, color: '#ef4444', sub: 'Expired or urgent', screen: 'properties', onClick: () => {
                const target = workQueue.expired[0] || workQueue.urgent[0];
                if (target) { handleSelectAgentProperty(target); setAgentScreen('property'); }
                else setAgentScreen('properties');
              } },
              { label: 'Expiring Soon', value: workQueue.soon.length, color: '#eab308', sub: 'Within 90 days', screen: 'properties', onClick: () => {
                const target = workQueue.soon[0];
                if (target) { handleSelectAgentProperty(target); setAgentScreen('property'); }
                else setAgentScreen('properties');
              } },
              { label: 'Compliant', value: displayProperties.filter(p => getHealthScoreD(p.id) >= 80).length, color: '#22c55e', sub: 'Health score 80+', screen: 'properties' },
              { label: 'Compliance %', value: displayProperties.length > 0 ? `${Math.round((displayProperties.filter(p => getHealthScoreD(p.id) >= 80).length / displayProperties.length) * 100)}%` : '—', color: '#a78bfa', sub: 'Portfolio health', screen: null },
              { label: 'Landlords', value: displayLandlords.length, color: '#4a9eff', sub: 'Linked accounts', screen: 'landlords' },
            ].map((s, i) => (
              <div key={i} onClick={() => { if (s.onClick) s.onClick(); else if (s.screen) setAgentScreen(s.screen); }} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '18px 20px', flex: 1, minWidth: '130px', cursor: (s.screen || s.onClick) ? 'pointer' : 'default', transition: 'border-color 0.2s' }}
                onMouseEnter={e => { if (s.screen) e.currentTarget.style.borderColor = 'rgba(43,124,211,0.4)'; }}
                onMouseLeave={e => { if (s.screen) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
                <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{s.label}</p>
                <p style={{ margin: '0 0 2px', color: s.color, fontSize: '28px', fontWeight: '900', lineHeight: 1 }}>{s.value}</p>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Portfolio Compliance Chart */}
          {agentDocuments.length > 0 && <CompliancePieChart documents={agentDocuments} />}

          {/* Invite Link */}
          <div style={{ background: 'rgba(43,124,211,0.08)', border: '1px solid rgba(43,124,211,0.25)', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', color: 'white', fontWeight: '700', fontSize: '13px' }}>🔗 Landlord Invitation Link</p>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Share with landlords to link them automatically</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{inviteLink}</div>
            <button onClick={() => { navigator.clipboard.writeText(inviteLink); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 3000); }} style={{ padding: '8px 16px', background: inviteCopied ? '#22c55e' : blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {inviteCopied ? '✓ Copied!' : 'Copy Link'}
            </button>
            <button onClick={() => setShowInviteForm(!showInviteForm)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ✉️ Invite by Email
            </button>
            <button onClick={() => setShowBulkInvite(!showBulkInvite)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              📋 Bulk Invite
            </button>
            <button onClick={() => { setShowAgentAddProperty(!showAgentAddProperty); setAgentAddPropertyMessage(null); setAgentAddPropertyError(''); }} style={{ padding: '8px 16px', background: 'rgba(43,124,211,0.15)', color: '#4a9eff', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '8px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🏠 Add Property for Landlord
            </button>
          </div>

          {agentAddPropertyMessage && (
            <div style={{ background: agentAddPropertyMessage.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(43,124,211,0.1)', border: `1px solid ${agentAddPropertyMessage.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(43,124,211,0.3)'}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <p style={{ margin: 0, color: agentAddPropertyMessage.type === 'success' ? '#4ade80' : '#4a9eff', fontSize: '13px', fontWeight: '600', lineHeight: '1.5' }}>{agentAddPropertyMessage.text}</p>
              <button onClick={() => setAgentAddPropertyMessage(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>✕</button>
            </div>
          )}

          {/* Agent add property on behalf of landlord */}
          {showAgentAddProperty && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '14px', padding: '20px 24px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 4px', color: 'white', fontWeight: '700', fontSize: '14px' }}>🏠 Add a Property on Behalf of a Landlord</p>
              <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>For landlords who'd rather you set things up for them. If they don't have an account yet, we'll invite them automatically and link this property the moment they sign up.</p>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Postcode" value={newPostcode} onChange={e => setNewPostcode(e.target.value)} style={{ flex: 1, minWidth: '140px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white' }} />
                <button onClick={handleFindAddress} disabled={addressLoading} style={{ padding: '10px 18px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
                  {addressLoading ? 'Looking…' : 'Find Address'}
                </button>
              </div>
              {addressError && <p style={{ color: '#ef4444', fontSize: '12px', margin: '0 0 10px' }}>{addressError}</p>}
              {addressResults.length > 0 && (
                <select onChange={e => setNewAddress(e.target.value)} value={newAddress} style={{ width: '100%', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white', marginBottom: '10px', boxSizing: 'border-box' }}>
                  <option value="">Select address…</option>
                  {addressResults.map((addr, i) => <option key={i} value={addr}>{addr}</option>)}
                </select>
              )}

              <input type="email" placeholder="Landlord email address" value={agentNewLandlordEmail} onChange={e => setAgentNewLandlordEmail(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white', marginBottom: '12px', boxSizing: 'border-box' }} />

              {agentAddPropertyError && <p style={{ color: '#ef4444', fontSize: '12px', margin: '0 0 10px' }}>{agentAddPropertyError}</p>}

              <button onClick={handleAgentAddProperty} disabled={agentAddPropertySaving} style={{ padding: '10px 20px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: agentAddPropertySaving ? 'not-allowed' : 'pointer' }}>
                {agentAddPropertySaving ? 'Saving…' : 'Save Property'}
              </button>
            </div>
          )}

          {/* Bulk invite form */}
          {showBulkInvite && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px 24px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 4px', color: 'white', fontWeight: '700', fontSize: '14px' }}>📋 Invite Multiple Landlords</p>
              <p style={{ margin: '0 0 14px', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Paste one email address per line — copy straight from a spreadsheet if that's easier.</p>
              <textarea
                value={bulkEmailsText}
                onChange={e => setBulkEmailsText(e.target.value)}
                placeholder={"jane@example.com\njohn@example.com\nsarah@example.com"}
                rows={6}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: 'monospace', background: 'rgba(255,255,255,0.06)', color: 'white', resize: 'vertical', marginBottom: '12px', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={handleBulkInvite} disabled={bulkSending || !bulkEmailsText.trim()} style={{ padding: '10px 20px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: bulkSending ? 'not-allowed' : 'pointer', opacity: !bulkEmailsText.trim() ? 0.5 : 1 }}>
                  {bulkSending ? 'Sending invites…' : 'Send All Invites'}
                </button>
                {bulkEmailsText.trim() && !bulkSending && (
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{bulkEmailsText.split('\n').filter(l => l.trim()).length} email{bulkEmailsText.split('\n').filter(l => l.trim()).length === 1 ? '' : 's'} ready</p>
                )}
              </div>
              {bulkResults && (
                <div style={{ marginTop: '14px', padding: '12px 16px', background: bulkResults.failed > 0 || bulkResults.invalidLines.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${bulkResults.failed > 0 || bulkResults.invalidLines.length > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`, borderRadius: '8px' }}>
                  <p style={{ margin: 0, color: bulkResults.failed > 0 || bulkResults.invalidLines.length > 0 ? '#ef4444' : '#22c55e', fontSize: '13px', fontWeight: '700' }}>
                    ✓ {bulkResults.sent} invite{bulkResults.sent === 1 ? '' : 's'} sent successfully
                  </p>
                  {bulkResults.failed > 0 && (
                    <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{bulkResults.failed} failed to send: {bulkResults.failedEmails.join(', ')}</p>
                  )}
                  {bulkResults.invalidLines.length > 0 && (
                    <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{bulkResults.invalidLines.length} line{bulkResults.invalidLines.length === 1 ? '' : 's'} skipped — not valid email addresses: {bulkResults.invalidLines.join(', ')}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Invitation status tracker */}
          {pendingInvitations.length > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px 24px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 14px', color: 'white', fontWeight: '700', fontSize: '14px' }}>📨 Invitations ({pendingInvitations.length})</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendingInvitations.map(inv => {
                  const isAccepted = inv.status === 'accepted';
                  const daysSinceSent = Math.floor((Date.now() - new Date(inv.last_sent_at)) / (1000 * 60 * 60 * 24));
                  const canResend = !isAccepted && daysSinceSent >= 0;
                  return (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ minWidth: '180px' }}>
                        <p style={{ margin: 0, color: 'white', fontSize: '13px', fontWeight: '600' }}>{inv.landlord_name || inv.landlord_email}</p>
                        {inv.landlord_name && <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{inv.landlord_email}</p>}
                        {inv.property_address && <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>🏠 {inv.property_address}</p>}
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: isAccepted ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)', color: isAccepted ? '#22c55e' : '#eab308' }}>
                        {isAccepted ? '✓ Signed Up' : `Pending${daysSinceSent > 0 ? ` · sent ${daysSinceSent}d ago` : ''}`}
                      </span>
                      {!isAccepted && (
                        <button
                          onClick={() => handleResendInvitation(inv)}
                          disabled={resendingId === inv.id}
                          style={{ padding: '6px 14px', background: 'rgba(43,124,211,0.15)', color: '#4a9eff', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: resendingId === inv.id ? 'not-allowed' : 'pointer' }}
                        >
                          {resendingId === inv.id ? 'Sending…' : '↻ Resend'}
                        </button>
                      )}
                      <button
                        onClick={() => { if (window.confirm(`Remove this invitation to ${inv.landlord_email}?`)) handleDeleteInvitation(inv.id); }}
                        style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Invite by email form */}
          {showInviteForm && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 4px', color: 'white', fontWeight: '700', fontSize: '14px' }}>✉️ Invite a Landlord by Email</p>
              <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Send your landlord a personalised invitation email with your unique link included.</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                  <input type="text" placeholder="Landlord name (optional)" value={inviteLandlordName} onChange={e => { setInviteLandlordName(e.target.value); setNameAutoFilled(false); }} style={{ width: '100%', padding: '10px 14px', paddingRight: nameAutoFilled ? '110px' : '14px', border: `1px solid ${nameAutoFilled ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', fontSize: '13px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white', boxSizing: 'border-box', transition: 'border-color 0.3s' }} />
                  {nameAutoFilled && (
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', whiteSpace: 'nowrap' }}>✓ Known landlord</span>
                  )}
                </div>
                <input type="email" placeholder="Landlord email address" value={inviteLandlordEmail} onChange={e => setInviteLandlordEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInviteLandlord()} style={{ flex: 2, minWidth: '220px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white' }} />
                <button onClick={handleInviteLandlord} disabled={inviteSending || !inviteLandlordEmail} style={{ padding: '10px 20px', background: inviteSent ? '#22c55e' : blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', opacity: !inviteLandlordEmail ? 0.5 : 1 }}>
                  {inviteSent ? '✓ Sent!' : inviteSending ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
              {inviteError && <p style={{ margin: '0 0 8px', color: '#ef4444', fontSize: '12px', fontWeight: '600' }}>⚠ {inviteError}</p>}
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>They'll receive an email from The Landlord Mate with your invitation link and instructions to sign up.</p>
            </div>
          )}

          {/* Search + Filter + Export */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="text" placeholder="Search properties or landlords..." value={agentSearch} onChange={e => { setAgentSearch(e.target.value); setAgentPropertiesPage(1); }} style={{ flex: 1, minWidth: '200px', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white' }} />
            {[
              { id: 'all', label: 'All' },
              { id: 'red', label: '🔴 Action' },
              { id: 'amber', label: '🟡 Soon' },
              { id: 'green', label: '🟢 Good' },
              { id: 'none', label: '⚫ No Docs' },
            ].map(f => (
              <button key={f.id} onClick={() => { setAgentFilter(f.id); setAgentPropertiesPage(1); }} style={{ padding: '6px 12px', background: agentFilter === f.id ? blue : 'rgba(255,255,255,0.06)', color: agentFilter === f.id ? 'white' : 'rgba(255,255,255,0.6)', border: `1px solid ${agentFilter === f.id ? blue : 'rgba(255,255,255,0.1)'}`, borderRadius: '20px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>
                {f.label}
              </button>
            ))}
            <button onClick={() => { setAgentGroupByLandlord(!agentGroupByLandlord); setAgentPropertiesPage(1); }} style={{ padding: '6px 12px', background: agentGroupByLandlord ? blue : 'rgba(255,255,255,0.06)', color: agentGroupByLandlord ? 'white' : 'rgba(255,255,255,0.6)', border: `1px solid ${agentGroupByLandlord ? blue : 'rgba(255,255,255,0.1)'}`, borderRadius: '20px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              👤 Group by Landlord
            </button>
            <button onClick={() => handleAgentExportCSV()} style={{ padding: '6px 14px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '20px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              📥 Export CSV
            </button>
            {selectedProperties.length > 0 && (
              <button onClick={handleBulkChase} disabled={bulkChasing} style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {bulkChasing ? 'Sending...' : `📧 Chase ${selectedProperties.length} Landlord${selectedProperties.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
          {bulkChaseResult && <p style={{ color: '#22c55e', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>{bulkChaseResult}</p>}

          {/* Properties Table */}
          {agentProperties.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: '40px', margin: '0 0 12px' }}>🏠</p>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '16px', margin: '0 0 8px' }}>No properties linked yet</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Share your invitation link with landlords to get started</p>
            </div>
          ) : (() => {
            const renderRow = (property, i, total) => {
              const score = getHealthScoreD(property.id);
              const scoreColor = getHealthColor(score);
              const nextExpiry = getNextExpiryD(property.id);
              const landlord = getLandlordD(property);
              const status = nextExpiry ? getExpiryStatus(nextExpiry.expiry_date) : null;
              return (
                <div key={property.id} style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 120px 1.5fr 100px 150px', gap: '0', padding: '13px 20px', borderBottom: i < total - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <input type="checkbox" checked={selectedProperties.includes(property.id)} onChange={(e) => { e.stopPropagation(); setSelectedProperties(prev => e.target.checked ? [...prev, property.id] : prev.filter(id => id !== property.id)); }} style={{ width: '16px', height: '16px', cursor: 'pointer' }} onClick={e => e.stopPropagation()} />
                  <div>
                    <p style={{ margin: 0, color: 'white', fontWeight: '600', fontSize: '13px' }}>{property.address_line_1}</p>
                    <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.35)', fontSize: '11px', textTransform: 'capitalize' }}>{property.property_type}{property.country ? ` · ${property.country}` : ''}</p>
                  </div>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{landlord?.full_name || landlord?.email || '—'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {(() => {
                      const docCount = displayDocuments.filter(d => d.property_id === property.id).length;
                      const noDocs = docCount === 0;
                      return (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: noDocs ? 'rgba(255,255,255,0.06)' : `${scoreColor}20`, border: `2px solid ${noDocs ? 'rgba(255,255,255,0.2)' : scoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={noDocs ? 'No documents uploaded yet' : `${score}/100`}>
                          <span style={{ color: noDocs ? 'rgba(255,255,255,0.35)' : scoreColor, fontWeight: '900', fontSize: noDocs ? '8px' : '11px' }}>{noDocs ? '—' : score}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{nextExpiry ? nextExpiry.document_type : '—'}</p>
                  <div>
                    {status ? <span style={{ background: status.bg, color: status.color, padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>{status.label}</span> : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>—</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={(e) => handleQuickEditProperty(property, e)} title="Edit" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '13px', cursor: 'pointer', padding: '2px' }}>✏️</button>
                    <button onClick={(e) => handleQuickDeleteProperty(property, e)} title="Delete" style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', padding: '2px' }}>🗑</button>
                    <p onClick={() => handleSelectAgentProperty(property)} style={{ margin: 0, color: blue, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>View →</p>
                  </div>
                </div>
              );
            };

            const tableHeader = (
              <div style={{ display: 'grid', gridTemplateColumns: '40px 2fr 1.5fr 120px 1.5fr 100px 150px', gap: '0', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                {['', 'Property', 'Landlord', 'Score', 'Next Expiry', 'Status', ''].map(h => (
                  <p key={h} style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>{h}</p>
                ))}
              </div>
            );

            return (
              <>
                {filteredAndSearched.length === 0 ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>No properties match your search or filter.</p>
                  </div>
                ) : agentGroupByLandlord ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {pagedLandlordGroups.map(group => {
                      const key = group.landlord?.id || 'unlinked';
                      const isCollapsed = !!collapsedLandlordGroups[key];
                      return (
                        <div key={key} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
                          <div onClick={() => setCollapsedLandlordGroups(prev => ({ ...prev, [key]: !prev[key] }))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▾</span>
                              <p style={{ margin: 0, color: 'white', fontWeight: '700', fontSize: '14px' }}>👤 {group.landlord?.full_name || group.landlord?.email || 'No landlord linked'}</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '600' }}>{group.properties.length} {group.properties.length === 1 ? 'property' : 'properties'}</span>
                              {group.landlord?.id && (
                                <button onClick={(e) => { e.stopPropagation(); handleAgentExportCSV(group.landlord.id); }} style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '14px', fontSize: '11px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  📥 Export
                                </button>
                              )}
                            </div>
                          </div>
                          {!isCollapsed && (
                            <>
                              {tableHeader}
                              {group.properties.map((p, i) => renderRow(p, i, group.properties.length))}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
                    {tableHeader}
                    {pagedProperties.map((p, i) => renderRow(p, i, pagedProperties.length))}
                  </div>
                )}

                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '18px' }}>
                    <button onClick={() => setAgentPropertiesPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.06)', color: safePage === 1 ? 'rgba(255,255,255,0.25)' : 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '600', cursor: safePage === 1 ? 'default' : 'pointer' }}>← Prev</button>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Page {safePage} of {totalPages}</span>
                    <button onClick={() => setAgentPropertiesPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.06)', color: safePage === totalPages ? 'rgba(255,255,255,0.25)' : 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '600', cursor: safePage === totalPages ? 'default' : 'pointer' }}>Next →</button>
                  </div>
                )}
              </>
            );
          })()}
          {/* Ask Mate Widget */}
          <AskAnythingWidget forceWales={true} />

        </div>
      </div>
    );
  }

  if (user && showOnboarding) {
    return (
      <AppShell screen="dashboard" setScreen={setScreen} user={user} handleSignOut={handleSignOut} properties={properties} allDocuments={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty}>
        <OnboardingWizard
          user={user}
          onComplete={async () => { await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id); setUserRecord(prev => ({ ...prev, onboarding_complete: true })); setShowOnboarding(false); }}
          onAddProperty={async () => { await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id); setUserRecord(prev => ({ ...prev, onboarding_complete: true })); setShowOnboarding(false); setScreen('properties'); setShowAdd(true); }}
        />
      </AppShell>
    );
  }

  if (user && screen === 'property' && selectedProperty) {
    return (
      <AppShell screen="properties" setScreen={(s) => { if (s !== 'property') setSelectedProperty(null); setScreen(s); }} user={user} handleSignOut={handleSignOut} properties={properties} allDocuments={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty}>
        <div style={{ padding: isMobile ? '20px 16px 80px' : '32px' }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '4px', cursor: 'pointer', fontSize: '13px' }} onClick={() => { setSelectedProperty(null); setScreen('properties'); }}>← Back to properties</p>

          {propertyActionMessage && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <p style={{ margin: 0, color: '#4ade80', fontSize: '13px', fontWeight: '600', lineHeight: '1.5' }}>{propertyActionMessage}</p>
              <button onClick={() => setPropertyActionMessage(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>✕</button>
            </div>
          )}
          
          {/* Property photo */}
          {selectedProperty.photo_url ? (
            <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', aspectRatio: isMobile ? '16/9' : '16/6' }}>
              <img src={selectedProperty.photo_url} alt={selectedProperty.address_line_1} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }} />
              <div style={{ position: 'absolute', bottom: '10px', right: '10px', display: 'flex', gap: '6px' }}>
                <label style={{ background: 'rgba(0,0,0,0.65)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  📷 Change
                  <input type="file" accept="image/*" onChange={e => handlePropertyPhotoUpload(e.target.files[0], selectedProperty.id)} style={{ display: 'none' }} />
                </label>
                <button onClick={async () => { await supabase.from('properties').update({ photo_url: null }).eq('id', selectedProperty.id); setProperties(properties.map(p => p.id === selectedProperty.id ? { ...p, photo_url: null } : p)); setSelectedProperty({ ...selectedProperty, photo_url: null }); }} style={{ background: 'rgba(239,68,68,0.8)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: font }}>🗑 Remove</button>
              </div>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '10px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>
              📷 Add a photo of this property
              <input type="file" accept="image/*" onChange={e => handlePropertyPhotoUpload(e.target.files[0], selectedProperty.id)} style={{ display: 'none' }} />
            </label>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
            <h1 style={{ color: 'white', fontWeight: '800', marginTop: '4px', fontSize: '20px', margin: 0 }}>{selectedProperty.address_line_1}</h1>
            {(() => { const score = getComplianceScore(documents); const sc = getScoreColor(score); const noDocs = !documents || documents.length === 0; return (
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                {noDocs ? (
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.35)', fontWeight: '900', fontSize: '20px', lineHeight: 1 }}>—</p>
                ) : (
                  <p style={{ margin: 0, color: sc, fontWeight: '900', fontSize: '28px', lineHeight: 1 }}>{score}</p>
                )}
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>Health Score</p>
              </div>
            ); })()}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '4px', textTransform: 'capitalize', fontSize: '13px' }}>
            {selectedProperty.property_type}{selectedProperty.country ? ` · ${getCountryFlag(selectedProperty.country)} ${selectedProperty.country}` : ''}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>👤 Letting Agent:</span>
            {editingAgentEmailInline ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="email" autoFocus placeholder="agent@example.com" value={agentEmailInlineValue} onChange={e => setAgentEmailInlineValue(e.target.value)} style={{ padding: '6px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', fontSize: '13px', fontFamily: font, background: 'rgba(255,255,255,0.08)', color: 'white', minWidth: '200px' }} />
                <button disabled={savingAgentEmailInline} onClick={async () => {
                  const trimmed = agentEmailInlineValue.trim().toLowerCase();
                  const isNew = trimmed && trimmed !== (selectedProperty.agent_email || '').toLowerCase();
                  setSavingAgentEmailInline(true);
                  const { error } = await supabase.from('properties').update({ agent_email: trimmed || null }).eq('id', selectedProperty.id);
                  if (!error) {
                    setSelectedProperty({ ...selectedProperty, agent_email: trimmed || null });
                    setProperties(properties.map(p => p.id === selectedProperty.id ? { ...p, agent_email: trimmed || null } : p));
                    if (isNew) {
                      fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/send-welcome-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: trimmed,
                          full_name: 'there',
                          template: 'landlord_linked_agent',
                          extra: { landlordName: user?.user_metadata?.full_name || 'A landlord', propertyAddress: selectedProperty.address_line_1 },
                        })
                      }).catch(() => {});
                      setPropertyActionMessage(`✓ Linked to ${trimmed} — they've been emailed to let them know.`);
                    } else if (!trimmed) {
                      setPropertyActionMessage('✓ Agent link removed.');
                    } else {
                      setPropertyActionMessage('✓ Saved.');
                    }
                    setTimeout(() => setPropertyActionMessage(null), 6000);
                  } else {
                    alert(error.message);
                  }
                  setSavingAgentEmailInline(false);
                  setEditingAgentEmailInline(false);
                }} style={{ padding: '6px 12px', background: blue, color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>{savingAgentEmailInline ? '...' : 'Save'}</button>
                <button onClick={() => setEditingAgentEmailInline(false)} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <>
                <span style={{ color: selectedProperty.agent_email ? '#7eb6f5' : 'rgba(255,255,255,0.35)', fontSize: '13px', fontWeight: '600' }}>{selectedProperty.agent_email || 'Not linked yet'}</span>
                <button onClick={() => { setAgentEmailInlineValue(selectedProperty.agent_email || ''); setEditingAgentEmailInline(true); }} title="Edit" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer', padding: '2px' }}>✏️</button>
              </>
            )}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
            <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'white', fontSize: '14px' }}>🔗 Share with your letting agent</p>
            <p style={{ margin: '0 0 14px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>No login required — they just click the link.</p>
            <div style={{ background: 'rgba(43,124,211,0.1)', border: '1px solid rgba(43,124,211,0.25)', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
              {selectedProperty.agent_email ? (
                <p style={{ margin: 0, color: '#7eb6f5', fontSize: '12px', lineHeight: '1.6' }}>✓ You've already linked <strong>{selectedProperty.agent_email}</strong> to this property — they can already see it automatically, no link needed. Only use the link below if you want to show someone else, or your agent isn't on The Landlord Mate yet.</p>
              ) : (
                <p style={{ margin: 0, color: '#7eb6f5', fontSize: '12px', lineHeight: '1.6' }}>💡 If your agent already uses The Landlord Mate, it's easier to add their email under <strong>Edit</strong> above instead — that connects permanently, no link needed ever again. Use the link below only if they're not signed up yet, or you just want to show them quickly.</p>
              )}
            </div>
            {shareLink && (
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', wordBreak: 'break-all' }}>{shareLink}</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <a href={`mailto:?subject=${encodeURIComponent('Compliance documents for ' + selectedProperty.address_line_1)}&body=${encodeURIComponent(`Hi,\n\nHere's a link to view the compliance documents for ${selectedProperty.address_line_1}, no login needed:\n\n${shareLink}\n\nThanks`)}`} style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>✉️ Email it</a>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Here's a link to view the compliance documents for ${selectedProperty.address_line_1}, no login needed: ${shareLink}`)}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>💬 WhatsApp it</a>
                  <a href={`sms:?body=${encodeURIComponent(`Here's a link to view the compliance documents for ${selectedProperty.address_line_1}, no login needed: ${shareLink}`)}`} style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>📱 Text it</a>
                </div>
              </div>
            )}
            <button onClick={handleGenerateShareLink} style={{ background: shareCopied ? '#22c55e' : blue, color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
              {shareCopied ? '✓ Link copied!' : shareLink ? 'Generate new link' : 'Generate share link'}
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
            <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'white', fontSize: '14px' }}>📝 Property Notes</p>
            <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Add notes about this property — boiler location, tenant contact, access codes, snagging etc.</p>
            <textarea
              value={propertyNotes}
              onChange={(e) => { setPropertyNotes(e.target.value); setNotesSaved(false); }}
              placeholder="e.g. Boiler is in the kitchen cupboard. Tenant contact: John 07700 900000. Spare key with neighbour at No.25."
              rows={4}
              style={{ width: '100%', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '14px', fontFamily: font, boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', color: 'white', resize: 'vertical' }}
            />
            <button
              onClick={handleSaveNotes}
              style={{ marginTop: '8px', padding: '8px 20px', background: notesSaved ? '#22c55e' : blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}
            >
              {notesSaved ? '✓ Saved!' : 'Save Notes'}
            </button>
          </div>

          {/* TO-DO LIST */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
            <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'white', fontSize: '14px' }}>✅ To-Do List</p>
            <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Tasks for this property — snagging, repairs, inspections etc.</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input type="text" placeholder="Add a task..." value={newTodo} onChange={(e) => setNewTodo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(); }} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              <button onClick={handleAddTodo} style={{ padding: '12px 16px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
            </div>
            {todos.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 }}>No tasks yet</p>}
            {todos.map(todo => (
              <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <input type="checkbox" checked={todo.done} onChange={() => handleToggleTodo(todo.id)} style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ flex: 1, color: todo.done ? 'rgba(255,255,255,0.3)' : 'white', fontSize: '14px', textDecoration: todo.done ? 'line-through' : 'none' }}>{todo.text}</span>
                <button onClick={() => handleDeleteTodo(todo.id)} style={{ padding: '3px 8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '4px', fontSize: '11px', fontFamily: font, cursor: 'pointer' }}>Remove</button>
              </div>
            ))}
          </div>

          {/* INVENTORY */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <p style={{ margin: 0, fontWeight: '700', color: 'white', fontSize: '14px' }}>📋 Inventory</p>
              {inventory.length > 0 && <button onClick={handlePrintInventory} style={{ padding: '4px 10px', background: 'rgba(43,124,211,0.15)', color: blue, border: 'none', borderRadius: '6px', fontSize: '11px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>🖨️ Print Report</button>}
            </div>
            <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Log the condition of items and rooms — useful for move-in/move-out and deposit disputes.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input type="text" placeholder="Room (e.g. Kitchen, Bedroom 1)" value={newInventoryRoom} onChange={e => setNewInventoryRoom(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
              <input type="text" placeholder="Item (e.g. Oven, Sofa)" value={newInventoryItem} onChange={e => setNewInventoryItem(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
              <select value={newInventoryCondition} onChange={e => setNewInventoryCondition(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="New">New</option>
              </select>
              <input type="text" placeholder="Notes (optional)" value={newInventoryNotes} onChange={e => setNewInventoryNotes(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
              <button onClick={handleAddInventoryItem} style={{ padding: '12px 16px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add Item</button>
            </div>

            {inventory.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 }}>No items logged yet</p>}

            {[...new Set(inventory.map(i => i.room))].map(room => (
              <div key={room} style={{ marginBottom: '12px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px' }}>{room}</p>
                {inventory.filter(i => i.room === room).map(item => {
                  const condColor = item.condition === 'Good' || item.condition === 'New' ? '#22c55e' : item.condition === 'Fair' ? '#eab308' : '#ef4444';
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: condColor, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'white', fontSize: '13px' }}>{item.item}</span>
                      <span style={{ color: condColor, fontSize: '12px', fontWeight: '700' }}>{item.condition}</span>
                      {item.notes && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{item.notes}</span>}
                      <button onClick={() => handleDeleteInventoryItem(item.id)} style={{ padding: '3px 8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '4px', fontSize: '11px', fontFamily: font, cursor: 'pointer' }}>Remove</button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* EXPENDITURE TRACKER */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <p style={{ margin: 0, fontWeight: '700', color: 'white', fontSize: '14px' }}>💰 Expenditure Tracker</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {expenses.length > 0 && <button onClick={handleExportExpenses} style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none', borderRadius: '6px', fontSize: '11px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Export CSV</button>}
                <button onClick={() => setShowAddExpense(!showAddExpense)} style={{ padding: '4px 10px', background: blue, color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>+ Add</button>
              </div>
            </div>
            <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Log costs for tax returns — repairs, certificates, maintenance etc.</p>

            {/* Purchase Price */}
            <div style={{ background: 'rgba(43,124,211,0.08)', border: '1px solid rgba(43,124,211,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', color: 'white', fontWeight: '700', fontSize: '13px' }}>🏠 Purchase Price</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>£</span>
                  <input type="number" placeholder="0.00" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} style={{ ...inputStyle, marginBottom: 0, paddingLeft: '28px' }} />
                </div>
                <button onClick={async () => {
                  const { error } = await supabase.from('properties').update({ purchase_price: purchasePrice || null }).eq('id', selectedProperty.id);
                  if (error) { alert(error.message); return; }
                  setPurchasePriceSaved(true);
                  setTimeout(() => setPurchasePriceSaved(false), 3000);
                }} style={{ padding: '12px 16px', background: purchasePriceSaved ? '#22c55e' : blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>{purchasePriceSaved ? '✓ Saved' : 'Save'}</button>
              </div>
              {purchasePriceSaved && <p style={{ color: '#22c55e', fontSize: '12px', fontWeight: '700', margin: '8px 0 0' }}>✓ Purchase price saved!</p>}
              {purchasePrice && expenses.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Purchase price</span>
                    <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>£{parseFloat(purchasePrice).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Total expenses</span>
                    <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>£{expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: '700' }}>Total invested</span>
                    <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: '900' }}>£{(parseFloat(purchasePrice) + expenses.reduce((sum, e) => sum + e.amount, 0)).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
            {showAddExpense && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(43,124,211,0.3)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
                <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }}>
                  {['Maintenance', 'Repairs', 'Certificates', 'Insurance', 'Agent Fees', 'Utilities', 'Legal', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="text" placeholder="Description" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" placeholder="Amount £" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                  <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button onClick={handleAddExpense} style={{ ...primaryBtn, flex: 1, padding: '10px' }}>Save Expense</button>
                  <button onClick={() => setShowAddExpense(false)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '14px', fontFamily: font, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {expenses.length === 0 && !showAddExpense && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 }}>No expenses logged yet</p>}
            {expenses.map(exp => (
              <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: 'white', fontSize: '13px', fontWeight: '600' }}>{exp.desc}</p>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{exp.category} · {exp.date}</p>
                </div>
                <span style={{ color: '#22c55e', fontWeight: '800', fontSize: '14px' }}>£{exp.amount.toFixed(2)}</span>
                <button onClick={() => handleDeleteExpense(exp.id)} style={{ padding: '3px 8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '4px', fontSize: '11px', fontFamily: font, cursor: 'pointer' }}>Remove</button>
              </div>
            ))}
            {expenses.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '700' }}>Total</span>
                <span style={{ color: 'white', fontWeight: '900', fontSize: '16px' }}>£{expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* TENANCY MANAGEMENT */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
            <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'white', fontSize: '14px' }}>🏠 Tenancy Details</p>
            <p style={{ margin: '0 0 12px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Track your tenancy dates and tenant contact details.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '600' }}>Tenancy Start</label>
                <input type="date" value={tenancyStart} onChange={(e) => setTenancyStart(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '600' }}>Tenancy End</label>
                <input type="date" value={tenancyEnd} onChange={(e) => setTenancyEnd(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
            </div>
            {tenancyEnd && (() => {
              const noticeDate = getNoticeDate(tenancyEnd);
              const today = new Date();
              const daysToNotice = Math.ceil((noticeDate - today) / (1000 * 60 * 60 * 24));
              return (
                <div style={{ background: daysToNotice < 30 ? 'rgba(239,68,68,0.1)' : 'rgba(43,124,211,0.1)', border: `1px solid ${daysToNotice < 30 ? 'rgba(239,68,68,0.3)' : 'rgba(43,124,211,0.3)'}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '8px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: daysToNotice < 30 ? '#ef4444' : '#7db3e8', fontWeight: '600' }}>
                    📅 Serve notice by {noticeDate.toLocaleDateString('en-GB')} {daysToNotice < 0 ? '— OVERDUE' : daysToNotice < 30 ? `— ${daysToNotice} days left` : `(${daysToNotice} days away)`}
                  </p>
                </div>
              );
            })()}
            <input type="text" placeholder="Tenant name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
            <input type="text" placeholder="Tenant phone" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
            <div>
              <label style={{ display: 'block', marginBottom: '4px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '600' }}>Next Rent Review Date</label>
              <input type="date" value={rentReviewDate} onChange={(e) => setRentReviewDate(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
              {rentReviewDate && (() => {
                const days = Math.ceil((new Date(rentReviewDate) - new Date()) / (1000 * 60 * 60 * 24));
                const color = days < 30 ? '#ef4444' : days < 90 ? '#eab308' : '#22c55e';
                return <p style={{ color, fontSize: '12px', fontWeight: '600', margin: '-4px 0 8px' }}>📅 Rent review {days < 0 ? 'was overdue' : `in ${days} days`} ({new Date(rentReviewDate).toLocaleDateString('en-GB')})</p>;
              })()}
            </div>
            <button onClick={handleSaveTenancy} style={{ padding: '8px 20px', background: tenancySaved ? '#22c55e' : blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
              {tenancySaved ? '✓ Saved!' : 'Save Tenancy Details'}
            </button>
          </div>

          <h2 style={{ color: 'white', fontWeight: '700', margin: '0 0 12px', fontSize: '16px' }}>Compliance Documents</h2>
          <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(234,179,8,0.9)' }}>💡 Click <strong>Edit</strong> on any document to update its expiry date.</p>
          </div>

          {editingDoc && (
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(43,124,211,0.4)', padding: '24px', borderRadius: '12px', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', marginTop: 0, fontWeight: '700', fontSize: '15px' }}>Edit Document</h3>
              <select value={editDocType} onChange={(e) => setEditDocType(e.target.value)} style={inputStyle}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Expiry date</label>
              <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} style={inputStyle} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleSaveEdit} style={{ ...primaryBtn, flex: 1 }}>Save Changes</button>
                <button onClick={() => setEditingDoc(null)} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '15px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {documents.length === 0 && !showUpload && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '40px 24px', borderRadius: '12px', textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '32px', margin: '0 0 8px' }}>📄</p>
              <p style={{ color: 'white', fontWeight: '600', margin: '0 0 6px', fontSize: '14px' }}>No documents yet</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', margin: 0 }}>Upload your first compliance document below</p>
            </div>
          )}

          {documents.map(doc => {
            const status = getExpiryStatus(doc.expiry_date);
            return (
              <div key={doc.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '16px', borderRadius: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status?.color || '#555', flexShrink: 0, marginTop: '5px' }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: '700', color: 'white', fontSize: '14px' }}>{doc.document_type}</p>
                      {doc.expiry_date && <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>Expires: {new Date(doc.expiry_date).toLocaleDateString('en-GB')}</p>}
                      {!doc.expiry_date && <p style={{ margin: '2px 0 0', color: '#eab308', fontSize: '12px' }}>⚠ No expiry date set</p>}
                      {doc.document_type === 'Deposit Certificate' && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <a href="https://www.tenancydepositscheme.com" target="_blank" rel="noreferrer" style={{ color: blue, fontSize: '11px', fontWeight: '600', background: 'rgba(43,124,211,0.1)', padding: '3px 8px', borderRadius: '4px', textDecoration: 'none' }}>TDS →</a>
                          <a href="https://www.depositprotection.com" target="_blank" rel="noreferrer" style={{ color: blue, fontSize: '11px', fontWeight: '600', background: 'rgba(43,124,211,0.1)', padding: '3px 8px', borderRadius: '4px', textDecoration: 'none' }}>DPS →</a>
                          <a href="https://www.mydeposits.co.uk" target="_blank" rel="noreferrer" style={{ color: blue, fontSize: '11px', fontWeight: '600', background: 'rgba(43,124,211,0.1)', padding: '3px 8px', borderRadius: '4px', textDecoration: 'none' }}>MyDeposits →</a>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {status && !isMobile && <span style={{ background: status.bg, color: status.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{status.label}</span>}
                    {doc.file_path && (() => { const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_path); return <a href={data.publicUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', background: 'rgba(43,124,211,0.15)', color: '#4a9eff', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>👁 View</a>; })()}
                    <button onClick={() => handleEditDoc(doc)} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDeleteDoc(doc.id)} style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}

          {showUpload && (
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(43,124,211,0.3)', padding: '24px', borderRadius: '12px', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', marginTop: 0, fontWeight: '700', fontSize: '15px' }}>Upload Document</h3>
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Document type</label>
              <select value={docType} onChange={(e) => { setDocType(e.target.value); setCustomDocType(''); }} style={inputStyle}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '-8px', marginBottom: '12px' }}>💡 Can't find your document? Select 'Other' to add your own.</p>
              {docType === 'Other' && (
                <input type="text" placeholder="Enter document type…" value={customDocType} onChange={(e) => setCustomDocType(e.target.value)} style={{ ...inputStyle, marginTop: '-4px' }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <input type="checkbox" id="noExpiry" checked={noExpiry} onChange={(e) => { setNoExpiry(e.target.checked); if (e.target.checked) setExpiryDate(''); }} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                <label htmlFor="noExpiry" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>No expiry date (e.g. tenancy agreement, deposit cert)</label>
              </div>
              {!noExpiry && (
                <>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Expiry date <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>(optional but recommended)</span></label>
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={inputStyle} />
                </>
              )}
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Select file <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>(PDF, JPG or PNG)</span></label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/*" capture={false} onChange={(e) => { setUploadFile(e.target.files[0]); setScanResult(null); setScanError(''); }} style={{ ...inputStyle, padding: '8px' }} />

              {uploadFile && !scanResult && (
                <button onClick={handleScanDocument} disabled={scanningDocument} style={{ width: '100%', padding: '12px', marginTop: '4px', marginBottom: '12px', background: 'rgba(43,124,211,0.12)', border: '1px solid rgba(43,124,211,0.35)', borderRadius: '8px', color: blue, fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: scanningDocument ? 'default' : 'pointer', opacity: scanningDocument ? 0.7 : 1 }}>
                  {scanningDocument ? '✨ Reading your document…' : '✨ Scan with AI — fill in the dates for me'}
                </button>
              )}

              {scanResult && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                  <p style={{ margin: '0 0 4px', color: '#4ade80', fontSize: '13px', fontWeight: '700' }}>✓ Scanned — please check this is correct before saving</p>
                  {scanResult.confidence === 'low' && (
                    <p style={{ margin: '0 0 4px', color: '#fbbf24', fontSize: '12px' }}>⚠ Low confidence — double-check the date below carefully.</p>
                  )}
                  {scanResult.notes && (
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{scanResult.notes}</p>
                  )}
                </div>
              )}
              {scanError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
                  <p style={{ margin: 0, color: '#f87171', fontSize: '12px', fontWeight: '600' }}>{scanError}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={handleUpload} disabled={uploading} style={{ ...primaryBtn, flex: 1, opacity: uploading ? 0.7 : 1 }}>{uploading ? 'Uploading…' : 'Upload Document'}</button>
                <button onClick={() => { setShowUpload(false); setScanResult(null); setScanError(''); }} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '15px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          {!showUpload && <button onClick={() => setShowUpload(true)} style={{ ...primaryBtn, marginTop: '8px' }}>+ Upload Document</button>}
        </div>
      </AppShell>
    );
  }

  if (user && screen === 'askmate') {
    const chatWalesRelevant = isWalesRelevant(properties) || userRecord?.account_type === 'agent';
    const chatPrompts = chatWalesRelevant ? [
      'What documents do I need for a Welsh tenancy?',
      'What is a Section 173 notice?',
      'What is Rent Smart Wales?',
      'What is a Written Occupation Contract?',
    ] : [
      'How often does a Gas Safety Certificate need renewing?',
      'What is an EICR and when do I need one?',
      'When must I protect a tenancy deposit?',
      'What is a Section 21 notice?',
    ];
    return (
      <AppShell screen="askmate" setScreen={setScreen} user={user} handleSignOut={handleSignOut} properties={properties} allDocuments={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty}>
        <div style={{ padding: isMobile ? '20px 16px 90px' : '32px', display: 'flex', flexDirection: 'column', minHeight: isMobile ? 'calc(100vh - 72px)' : '100vh', boxSizing: 'border-box' }}>
          <div style={{ marginBottom: '20px' }}>
            <span onClick={() => setScreen('dashboard')} style={{ color: blue, fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-block', marginBottom: '10px' }}>← Back to Dashboard</span>
            <div style={{ textAlign: 'center', paddingTop: '8px' }}>
              <img src={logo} alt="The Landlord Mate" style={{ height: '90px', marginBottom: '12px' }} />
              <h1 style={{ margin: '0 0 10px', color: 'white', fontWeight: '900', fontSize: '36px', fontFamily: font, letterSpacing: '-0.5px' }}>Ask Mate</h1>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '15px' }}>Instant answers on landlord law and compliance, with memory of your conversation.</p>
            </div>
          </div>

          <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', marginBottom: '16px', minHeight: '300px' }}>
            {aiHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '18px' }}>Ask me anything about landlord compliance, or try one of these:</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {chatPrompts.map((s, i) => (
                    <button key={i} onClick={() => { setAiQuestion(s); }} style={{ background: 'rgba(43,124,211,0.15)', border: '1px solid rgba(43,124,211,0.3)', color: '#7db3e8', padding: '8px 14px', borderRadius: '20px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {aiHistory.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: '10px 16px', borderRadius: '16px', fontSize: '13px', lineHeight: '1.6', fontFamily: font,
                  background: m.role === 'user' ? blue : 'rgba(255,255,255,0.07)',
                  color: m.role === 'user' ? 'white' : 'rgba(255,255,255,0.85)',
                  borderBottomRightRadius: m.role === 'user' ? '4px' : '16px',
                  borderBottomLeftRadius: m.role === 'user' ? '16px' : '4px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 16px', borderRadius: '16px', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontFamily: font }}>
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder={chatWalesRelevant ? "Ask about Gas Safe, EICR, Rent Smart Wales, tenancy law..." : "Ask about Gas Safe, EICR, deposits, tenancy law..."}
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAskAI(); }}
              style={{ width: '100%', padding: '16px 56px 16px 20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(43,124,211,0.4)', borderRadius: '50px', color: 'white', fontSize: '15px', fontFamily: font, outline: 'none', boxSizing: 'border-box' }}
            />
            <button
              onClick={() => handleAskAI()}
              disabled={aiLoading || !aiQuestion.trim()}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '38px', height: '38px', background: blue, color: 'white', border: 'none', borderRadius: '50%', fontSize: '16px', cursor: aiLoading || !aiQuestion.trim() ? 'not-allowed' : 'pointer', opacity: aiLoading || !aiQuestion.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {aiLoading ? '⋯' : '↑'}
            </button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '10px', textAlign: 'center' }}>Ask Mate can make mistakes. Always seek professional advice for specific situations.</p>
        </div>
      </AppShell>
    );
  }

  if (user && screen === 'properties') {
    return (
      <AppShell screen="properties" setScreen={setScreen} user={user} handleSignOut={handleSignOut} properties={properties} allDocuments={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty}>
        <div style={{ padding: isMobile ? '20px 16px 80px' : '32px' }}>
          <h1 style={{ color: 'white', fontWeight: '800', fontSize: '20px', marginBottom: '6px' }}>All Properties</h1>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>Click a property to manage its compliance documents.</p>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px', flexShrink: 0 }}>
              <button onClick={() => setPropertyViewMode('tiles')} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '700', fontFamily: font, cursor: 'pointer', background: propertyViewMode === 'tiles' ? blue : 'transparent', color: propertyViewMode === 'tiles' ? 'white' : 'rgba(255,255,255,0.5)' }}>🔳 Tiles</button>
              <button onClick={() => setPropertyViewMode('list')} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '700', fontFamily: font, cursor: 'pointer', background: propertyViewMode === 'list' ? blue : 'transparent', color: propertyViewMode === 'list' ? 'white' : 'rgba(255,255,255,0.5)' }}>☰ List</button>
            </div>
          </div>

          {properties.length > 5 && (
            <div style={{
              display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center',
              background: 'linear-gradient(135deg, rgba(43,124,211,0.08), rgba(139,92,246,0.06))',
              border: '1px solid rgba(43,124,211,0.18)', borderRadius: '14px', padding: '12px 14px'
            }}>
              <div style={{
                position: 'relative', flex: 1, minWidth: '220px',
                boxShadow: landlordSearchFocused ? '0 0 0 3px rgba(43,124,211,0.25), 0 0 18px rgba(43,124,211,0.35)' : 'none',
                borderRadius: '10px', transition: 'box-shadow 0.2s ease'
              }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', opacity: 0.5, pointerEvents: 'none' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search by address or postcode..."
                  value={landlordPropSearch}
                  onChange={e => setLandlordPropSearch(e.target.value)}
                  onFocus={() => setLandlordSearchFocused(true)}
                  onBlur={() => setLandlordSearchFocused(false)}
                  style={{
                    width: '100%', padding: '10px 14px 10px 34px', border: `1px solid ${landlordSearchFocused ? blue : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: '10px', fontSize: '13px', fontFamily: font, background: 'rgba(255,255,255,0.06)', color: 'white',
                    outline: 'none', transition: 'border-color 0.2s ease', boxSizing: 'border-box'
                  }}
                />
              </div>
              {[
                { id: 'all', label: 'All', color: 'rgba(255,255,255,0.6)', glow: 'rgba(255,255,255,0.15)' },
                { id: 'red', label: '🔴 Action Needed', color: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
                { id: 'amber', label: '🟡 Expiring Soon', color: '#eab308', glow: 'rgba(234,179,8,0.4)' },
                { id: 'green', label: '🟢 Compliant', color: '#22c55e', glow: 'rgba(34,197,94,0.4)' },
                { id: 'none', label: '⚪ No Docs', color: 'rgba(255,255,255,0.5)', glow: 'rgba(255,255,255,0.15)' },
              ].map(f => {
                const active = landlordPropFilter === f.id;
                return (
                  <button key={f.id} onClick={() => setLandlordPropFilter(f.id)} style={{
                    padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer',
                    background: active ? `${f.color}22` : 'rgba(255,255,255,0.05)',
                    color: active ? f.color : 'rgba(255,255,255,0.55)',
                    border: `1px solid ${active ? f.color : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: active ? `0 0 12px ${f.glow}` : 'none',
                    transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                  }}>
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
              <p style={{ margin: 0, color: '#4ade80', fontSize: '13px', fontWeight: '600', lineHeight: '1.5' }}>{propertyActionMessage}</p>
              <button onClick={() => setPropertyActionMessage(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>✕</button>
            </div>
          )}

          {properties.length === 0 && !showAdd && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '40px 24px', borderRadius: '12px', textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '40px', margin: '0 0 12px' }}>🏠</p>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '16px', margin: '0 0 8px' }}>No properties yet</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Add your first rental property to get started</p>
            </div>
          )}

          {editingProperty && (
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(43,124,211,0.4)', padding: '24px', borderRadius: '12px', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', marginTop: 0, fontWeight: '700', fontSize: '15px' }}>Edit Property</h3>
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Address</label>
              <input type="text" value={editPropertyAddress} onChange={(e) => setEditPropertyAddress(e.target.value)} style={inputStyle} />
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Property type</label>
              <select value={editPropertyType} onChange={(e) => setEditPropertyType(e.target.value)} style={inputStyle}>
                <option value="house">House</option>
                <option value="flat">Flat</option>
                <option value="hmo">HMO</option>
              </select>
<label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Country</label>
              <select value={editPropertyCountry} onChange={(e) => setEditPropertyCountry(e.target.value)} style={inputStyle}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Letting agent email <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}>(optional — links this property to your agent's account if they're already on The Landlord Mate, or invites them if not)</span></label>
              <input type="email" placeholder="e.g. agent@shepherdsharpe.co.uk" value={editPropertyAgentEmail} onChange={(e) => setEditPropertyAgentEmail(e.target.value)} style={inputStyle} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleSaveEditProperty} style={{ ...primaryBtn, flex: 1 }}>Save Changes</button>
                <button onClick={() => setEditingProperty(null)} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '15px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {(() => {
            const q = landlordPropSearch.trim().toLowerCase();
            const visibleProperties = properties.filter(p => {
              const matchesSearch = !q || p.address_line_1.toLowerCase().includes(q);
              if (!matchesSearch) return false;
              if (landlordPropFilter === 'all') return true;
              const docs = allDocuments.filter(d => d.property_id === p.id);
              if (landlordPropFilter === 'none') return docs.length === 0;
              if (docs.length === 0) return false;
              const score = getComplianceScore(docs);
              if (landlordPropFilter === 'green') return score >= 80;
              if (landlordPropFilter === 'amber') return score >= 50 && score < 80;
              if (landlordPropFilter === 'red') return score < 50;
              return true;
            });
            if (visibleProperties.length === 0) {
              return (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>No properties match your search or filter.</p>
                </div>
              );
            }
            return visibleProperties.map(p => (
            <div key={p.id} onClick={() => handleSelectProperty(p)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', marginBottom: '10px', cursor: 'pointer', overflow: 'hidden', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(43,124,211,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
              {propertyViewMode === 'tiles' && p.photo_url && (
                <div style={{ aspectRatio: '16/7', overflow: 'hidden', position: 'relative' }}>
                  <img src={p.photo_url} alt={p.address_line_1} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(13,27,42,0.8) 100%)' }} />
                </div>
              )}
              <div style={{ padding: propertyViewMode === 'list' ? '10px 14px' : '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  {(propertyViewMode === 'list' || !p.photo_url) && (
                    <div style={{ width: propertyViewMode === 'list' ? '28px' : '36px', height: propertyViewMode === 'list' ? '28px' : '36px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(43,124,211,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: propertyViewMode === 'list' ? '13px' : '16px', flexShrink: 0 }}>
                      {propertyViewMode === 'list' && p.photo_url
                        ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : '🏠'}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: '700', color: 'white', fontSize: propertyViewMode === 'list' ? '13px' : '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address_line_1}</p>
                    <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: '12px', textTransform: 'capitalize' }}>
                      {p.property_type}{p.country ? ` · ${getCountryFlag(p.country)} ${p.country}` : ''} · <span style={{ color: blue }}>View →</span>
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                  <button onClick={(e) => handleEditProperty(p, e)} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteProperty(p); }} style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            </div>
          ));
          })()}

          {showAdd && (
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(43,124,211,0.3)', padding: '24px', borderRadius: '12px', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', marginTop: 0, fontWeight: '700', fontSize: '15px' }}>Add New Property</h3>
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Country</label>
              <select value={newCountry} onChange={(e) => setNewCountry(e.target.value)} style={inputStyle}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Postcode</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input type="text" placeholder="e.g. CF641TH" value={newPostcode} onChange={(e) => setNewPostcode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleFindAddress(); }} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                <button onClick={handleFindAddress} disabled={addressLoading} style={{ padding: '12px 16px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', opacity: addressLoading ? 0.7 : 1 }}>
                  {addressLoading ? '…' : 'Find'}
                </button>
              </div>
              {addressError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>⚠ {addressError}</p>}
              {addressResults.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Select address</label>
                  <select onChange={(e) => setNewAddress(e.target.value)} style={inputStyle} defaultValue="">
                    <option value="" disabled>Choose address…</option>
                    {addressResults.map((a, i) => <option key={i} value={a}>{a}</option>)}
                  </select>
                </div>
              )}
              {newAddress && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px', color: '#22c55e', fontWeight: '600' }}>
                  ✓ {newAddress}
                </div>
              )}
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Property type</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)} style={inputStyle}>
                <option value="house">House</option>
                <option value="flat">Flat</option>
                <option value="hmo">HMO</option>
              </select>
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Letting agent email <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}>(optional)</span></label>
              <input type="email" placeholder="e.g. agent@shepherdsharpe.co.uk" value={newAgentEmail} onChange={(e) => setNewAgentEmail(e.target.value)} style={inputStyle} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleSaveProperty} style={{ ...primaryBtn, flex: 1 }}>Save Property</button>
                <button onClick={() => { setShowAdd(false); setNewAddress(''); setNewPostcode(''); setAddressResults([]); setNewCountry('Wales'); setNewAgentEmail(''); }} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '15px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          {!showAdd && <button onClick={() => setShowAdd(true)} style={{ ...primaryBtn, marginTop: '8px' }}>+ Add Property</button>}
        </div>

        {confirmDeleteProperty && (
          <div onClick={() => setConfirmDeleteProperty(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: navy, border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '28px', maxWidth: '400px', width: '100%' }}>
              <p style={{ fontSize: '32px', margin: '0 0 12px', textAlign: 'center' }}>⚠️</p>
              <h3 style={{ color: 'white', fontWeight: '800', fontSize: '18px', margin: '0 0 8px', textAlign: 'center' }}>Are you sure?</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', textAlign: 'center', margin: '0 0 4px' }}>This will permanently delete</p>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '14px', textAlign: 'center', margin: '0 0 4px' }}>{confirmDeleteProperty.address_line_1}</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', textAlign: 'center', margin: '0 0 24px' }}>and every document stored against it. This cannot be undone.</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setConfirmDeleteProperty(null)} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '8px', fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => handleDeleteProperty(confirmDeleteProperty.id)} style={{ flex: 1, padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Yes, Delete</button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  if (user && screen === 'landlordocs') {
    return (
      <AppShell screen="landlordocs" setScreen={setScreen} user={user} handleSignOut={handleSignOut} properties={properties} allDocuments={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty}>
        <div style={{ padding: isMobile ? '20px 16px 80px' : '32px' }}>
          <h1 style={{ color: 'white', fontWeight: '800', fontSize: '20px', marginBottom: '6px' }}>🪪 My Documents</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '24px' }}>Your personal landlord documents — stored once, available always.</p>

          {landlordDocs.length === 0 && !showLandlordUpload && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '40px 24px', borderRadius: '12px', textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '40px', margin: '0 0 12px' }}>🪪</p>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '16px', margin: '0 0 8px' }}>No documents yet</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Upload your passport, licences and landlord certificates here</p>
            </div>
          )}

          {landlordDocs.map(doc => {
            const status = getExpiryStatus(doc.expiry_date);
            return (
              <div key={doc.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '16px', borderRadius: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status?.color || '#2b7cd3', flexShrink: 0, marginTop: '5px' }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: '700', color: 'white', fontSize: '14px' }}>{doc.document_type}</p>
                      {doc.expiry_date && <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>Expires: {new Date(doc.expiry_date).toLocaleDateString('en-GB')}</p>}
                      {!doc.expiry_date && <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>No expiry date</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {status && !isMobile && <span style={{ background: status.bg, color: status.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{status.label}</span>}
                    {doc.file_path && (() => { const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_path); return <a href={data.publicUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 10px', background: 'rgba(43,124,211,0.15)', color: '#4a9eff', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>👁 View</a>; })()}
                    <button onClick={() => handleEditLandlordDoc(doc)} style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => handleDeleteLandlordDoc(doc.id)} style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '12px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}

          {editingLandlordDoc && (
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(43,124,211,0.4)', padding: '24px', borderRadius: '12px', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', marginTop: 0, fontWeight: '700', fontSize: '15px' }}>Edit Document</h3>
              <select value={editLandlordDocType} onChange={(e) => setEditLandlordDocType(e.target.value)} style={inputStyle}>
                {LANDLORD_DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Expiry date</label>
              <input type="date" value={editLandlordExpiry} onChange={(e) => setEditLandlordExpiry(e.target.value)} style={inputStyle} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleSaveLandlordEdit} style={{ ...primaryBtn, flex: 1 }}>Save Changes</button>
                <button onClick={() => setEditingLandlordDoc(null)} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '15px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {showLandlordUpload && (
            <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(43,124,211,0.3)', padding: '24px', borderRadius: '12px', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', marginTop: 0, fontWeight: '700', fontSize: '15px' }}>Upload Document</h3>
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Document type</label>
              <select value={landlordDocType} onChange={(e) => setLandlordDocType(e.target.value)} style={inputStyle}>
                {LANDLORD_DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Expiry date <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>(optional)</span></label>
              <input type="date" value={landlordExpiryDate} onChange={(e) => setLandlordExpiryDate(e.target.value)} style={inputStyle} />
              <label style={{ display: 'block', marginBottom: '6px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: '600' }}>Select file <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: '400' }}>(PDF, JPG or PNG)</span></label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/*" capture={false} onChange={(e) => { setLandlordUploadFile(e.target.files[0]); setLandlordScanResult(null); setLandlordScanError(''); }} style={{ ...inputStyle, padding: '8px' }} />

              {landlordUploadFile && !landlordScanResult && (
                <button onClick={handleScanLandlordDocument} disabled={scanningLandlordDoc} style={{ width: '100%', padding: '12px', marginTop: '4px', marginBottom: '12px', background: 'rgba(43,124,211,0.12)', border: '1px solid rgba(43,124,211,0.35)', borderRadius: '8px', color: blue, fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: scanningLandlordDoc ? 'default' : 'pointer', opacity: scanningLandlordDoc ? 0.7 : 1 }}>
                  {scanningLandlordDoc ? '✨ Reading your document…' : '✨ Scan with AI — fill in the dates for me'}
                </button>
              )}

              {landlordScanResult && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                  <p style={{ margin: '0 0 4px', color: '#4ade80', fontSize: '13px', fontWeight: '700' }}>✓ Scanned — please check this is correct before saving</p>
                  {landlordScanResult.confidence === 'low' && (
                    <p style={{ margin: '0 0 4px', color: '#fbbf24', fontSize: '12px' }}>⚠ Low confidence — double-check the date below carefully.</p>
                  )}
                  {landlordScanResult.notes && (
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{landlordScanResult.notes}</p>
                  )}
                </div>
              )}
              {landlordScanError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
                  <p style={{ margin: 0, color: '#f87171', fontSize: '12px', fontWeight: '600' }}>{landlordScanError}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={handleLandlordUpload} disabled={landlordUploading} style={{ ...primaryBtn, flex: 1, opacity: landlordUploading ? 0.7 : 1 }}>{landlordUploading ? 'Uploading…' : 'Upload Document'}</button>
                <button onClick={() => { setShowLandlordUpload(false); setLandlordScanResult(null); setLandlordScanError(''); }} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '15px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          {!showLandlordUpload && <button onClick={() => setShowLandlordUpload(true)} style={{ ...primaryBtn, marginTop: '8px' }}>+ Upload Document</button>}
        </div>
      </AppShell>
    );
  }

  const letterTemplates = [
    { id: 'rent_increase', title: '📈 Rent Increase Notice', desc: 'Formal notice to tenant of rent increase' },
    { id: 'entry_notice', title: '🔑 Entry Notice', desc: '24-hour notice to enter the property' },
    { id: 'end_tenancy', title: '🏁 End of Tenancy Letter', desc: 'Confirmation that tenancy is ending' },
    { id: 'deposit_return', title: '💰 Deposit Return Letter', desc: 'Confirm deposit return to tenant' },
    { id: 'renewal', title: '🔄 Tenancy Renewal Letter', desc: 'Offer to renew the tenancy' },
    { id: 'arrears', title: '⚠️ Rent Arrears Letter', desc: 'Formal notice of outstanding rent' },
  ];

  const generateLetter = (id) => {
    const today = new Date().toLocaleDateString('en-GB');
    switch(id) {
      case 'rent_increase': return `${today}\n\nDear ${letterTenant || '[Tenant Name]'},\n\nRe: Rent Increase — ${letterProperty || '[Property Address]'}\n\nI am writing to inform you that the rent for the above property will increase from £${letterRent || '[Current Rent]'} per month to £${letterNewRent || '[New Rent]'} per month.\n\nThis change will take effect from ${letterEffectiveDate || '[Effective Date]'}.\n\nPlease ensure that any standing order or direct debit is updated accordingly before this date.\n\nIf you have any questions, please do not hesitate to contact me.\n\nYours sincerely,\n\n[Your Name]\n[Your Address]\n[Your Phone]`;
      case 'entry_notice': return `${today}\n\nDear ${letterTenant || '[Tenant Name]'},\n\nRe: Notice of Entry — ${letterProperty || '[Property Address]'}\n\nI am writing to give you notice that I will need to access the above property on [Date] at [Time].\n\nThe reason for entry is: [Reason — e.g. annual gas safety inspection]\n\nAs required by law, I am giving you at least 24 hours written notice of this visit. If this time is not convenient, please contact me as soon as possible so we can arrange an alternative.\n\nYours sincerely,\n\n[Your Name]\n[Your Phone]`;
      case 'end_tenancy': return `${today}\n\nDear ${letterTenant || '[Tenant Name]'},\n\nRe: End of Tenancy — ${letterProperty || '[Property Address]'}\n\nI am writing to confirm that your tenancy at the above address will end on [End Date].\n\nPlease ensure that:\n• All keys are returned by [End Date]\n• The property is left clean and in good condition\n• All personal belongings are removed\n• Final meter readings are provided\n\nA checkout inspection will be carried out and your deposit will be returned, less any agreed deductions, within [X] days.\n\nThank you for your tenancy.\n\nYours sincerely,\n\n[Your Name]`;
      case 'deposit_return': return `${today}\n\nDear ${letterTenant || '[Tenant Name]'},\n\nRe: Deposit Return — ${letterProperty || '[Property Address]'}\n\nFollowing the end of your tenancy at the above property, I am pleased to confirm that your deposit of £[Amount] is being returned to you in full / less deductions as outlined below.\n\n[List any deductions here, or delete this line]\n\nTotal amount being returned: £[Amount]\n\nThis will be transferred to your bank account within [X] days.\n\nThank you for your tenancy.\n\nYours sincerely,\n\n[Your Name]`;
      case 'renewal': return `${today}\n\nDear ${letterTenant || '[Tenant Name]'},\n\nRe: Tenancy Renewal — ${letterProperty || '[Property Address]'}\n\nI hope you are well. I am writing to offer you a renewal of your tenancy at the above property.\n\nI would like to offer a new fixed-term tenancy from [Start Date] to [End Date] at a rent of £${letterNewRent || '[Rent]'} per month.\n\nPlease let me know whether you would like to accept this offer by [Response Date].\n\nIf you have any questions, please do not hesitate to get in touch.\n\nYours sincerely,\n\n[Your Name]\n[Your Phone]`;
      case 'arrears': return `${today}\n\nDear ${letterTenant || '[Tenant Name]'},\n\nRe: Rent Arrears — ${letterProperty || '[Property Address]'}\n\nI am writing to inform you that your rent account is currently in arrears.\n\nTotal amount outstanding: £[Amount]\n\nThis debt relates to unpaid rent for the period [Period].\n\nI ask that you make payment of the outstanding amount immediately. If you are experiencing financial difficulties, please contact me as soon as possible so we can discuss your situation.\n\nIf payment is not received within 14 days, I may have no option but to take further action.\n\nYours sincerely,\n\n[Your Name]\n[Your Phone]`;
      default: return '';
    }
  };

  if (user && screen === 'letters') {

    return (
      <AppShell screen="letters" setScreen={setScreen} user={user} handleSignOut={handleSignOut} properties={properties} allDocuments={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty}>
        <div style={{ padding: isMobile ? '20px 16px 80px' : '32px' }}>
          <h1 style={{ color: 'white', fontWeight: '800', fontSize: '20px', marginBottom: '6px' }}>📝 Letter Templates</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '24px' }}>Professional letter templates for landlords. Fill in the details, copy and send.</p>

          {!selectedLetter ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
              {letterTemplates.map(t => (
                <div key={t.id} onClick={() => { setSelectedLetter(t.id); setEditableLetter(generateLetter(t.id)); }} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(43,124,211,0.4)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
                  <p style={{ margin: '0 0 6px', color: 'white', fontWeight: '700', fontSize: '15px' }}>{t.title}</p>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>{t.desc}</p>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <button onClick={() => { setSelectedLetter(null); setEditableLetter(''); }} style={{ color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: font, marginBottom: '20px', padding: 0 }}>← Back to templates</button>
              <h2 style={{ color: 'white', fontWeight: '800', fontSize: '16px', marginBottom: '16px' }}>{letterTemplates.find(t => t.id === selectedLetter)?.title}</h2>

              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '700', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Fill in the details</p>
                <select value={letterProperty} onChange={e => setLetterProperty(e.target.value)} style={inputStyle}>
                  <option value="">Select property...</option>
                  {properties.map(p => <option key={p.id} value={p.address_line_1}>{p.address_line_1}</option>)}
                </select>
                <input type="text" placeholder="Tenant name" value={letterTenant} onChange={e => setLetterTenant(e.target.value)} style={inputStyle} />
                {(selectedLetter === 'rent_increase' || selectedLetter === 'arrears') && (
                  <input type="text" placeholder="Current rent (£)" value={letterRent} onChange={e => setLetterRent(e.target.value)} style={inputStyle} />
                )}
                {(selectedLetter === 'rent_increase' || selectedLetter === 'renewal') && (
                  <>
                    <input type="text" placeholder="New rent (£)" value={letterNewRent} onChange={e => setLetterNewRent(e.target.value)} style={inputStyle} />
                    <input type="text" placeholder="Effective date (e.g. 1 August 2026)" value={letterEffectiveDate} onChange={e => setLetterEffectiveDate(e.target.value)} style={inputStyle} />
                  </>
                )}
                <button onClick={() => setEditableLetter(generateLetter(selectedLetter))} style={{ width: '100%', padding: '12px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: 'pointer', marginTop: '4px' }}>
                  ↻ Generate / Refresh Letter
                </button>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '700', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Your letter — edit as needed</p>
                <textarea
                  value={editableLetter}
                  onChange={(e) => setEditableLetter(e.target.value)}
                  rows={20}
                  style={{ width: '100%', padding: '16px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: 'Georgia, serif', lineHeight: '1.8', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', color: 'white', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { navigator.clipboard.writeText(editableLetter || generateLetter(selectedLetter)); }} style={{ ...primaryBtn, flex: 1 }}>📋 Copy Letter</button>
                <button onClick={() => { const txt = editableLetter || generateLetter(selectedLetter); const w = window.open('', '_blank'); w.document.write(`<html><body style="font-family:Georgia,serif;padding:40px;max-width:700px;margin:0 auto;line-height:1.8"><pre style="white-space:pre-wrap;font-family:Georgia,serif">${txt}</pre></body></html>`); w.print(); }} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontFamily: font, fontWeight: '600', cursor: 'pointer' }}>🖨️ Print</button>
                <button onClick={() => setEditableLetter('')} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>↩ Reset</button>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  if (user && screen === 'faq') {
    const faqs = [
      { q: 'How do I upload a document?', a: 'Go to All Properties, click on a property, then click "+ Upload Document". Choose the document type, select your file, and set the expiry date. Your document will be stored securely and you\'ll receive automatic reminders before it expires.' },
      { q: 'How do automatic reminders work?', a: 'Once you upload a document with an expiry date, The Landlord Mate automatically sends you email reminders at 90, 60, 30, 14 and 7 days before it expires. You don\'t need to do anything — reminders are fully automatic.' },
      { q: 'How do I share documents with my letting agent?', a: 'Go to your property page and click "Generate Share Link". Send this link to your agent — they can view all your compliance documents without needing to create an account.' },
      { q: 'How do I upgrade or change my plan?', a: 'Go to Settings and scroll to the Subscription section. You can upgrade your plan at any time. Contact us at support@thelandlordmate.com if you need help.' },
      { q: 'How do I cancel my subscription?', a: 'Go to Settings and click "Manage subscription" to cancel any time through our secure billing portal. Your documents will remain safely stored and accessible until the end of your current billing period.' },
      { q: 'What happens to my documents if I cancel?', a: 'Your documents are never deleted. If you cancel and later resubscribe, everything will be exactly as you left it. We keep your data safe.' },
      { q: 'Can I use The Landlord Mate on my phone?', a: 'Yes! The Landlord Mate works on any device. On iPhone or Android you can add it to your home screen for a full app experience — look for the "Add to Home Screen" banner when you first log in.' },
      { q: 'What documents should I upload?', a: 'The key compliance documents are: Gas Safety Certificate (annual), EICR Electrical Report (every 5 years), EPC Energy Performance Certificate (every 10 years), HMO Licence (if applicable), Rent Smart Wales Licence (Wales only), and your Tenancy Agreement.' },
      { q: 'Is my data secure?', a: 'Yes. All data is stored in a secure UK-based database (Supabase, London region) with bank-level encryption. We never share your data with third parties. See our Security & Data page for full details.' },
      { q: 'I\'m a letting agent — how does the agent portal work?', a: 'Sign up and choose "I\'m a Letting Agent". You\'ll get a unique invitation link to share with your landlords. When they sign up via your link they automatically appear in your portfolio dashboard. You get full compliance visibility across all your managed properties.' },
      { q: 'How do I get help?', a: 'Email us at support@thelandlordmate.com and we\'ll respond within 24 hours Monday to Friday. We\'re a small team and we genuinely care about helping you stay compliant.' },
    ];

    return (
      <AppShell screen="faq" setScreen={setScreen} user={user} handleSignOut={handleSignOut} properties={properties} allDocuments={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty}>
        <div style={{ padding: isMobile ? '20px 16px 80px' : '32px', maxWidth: '800px' }}>
          <h1 style={{ color: 'white', fontWeight: '800', fontSize: '22px', marginBottom: '6px' }}>❓ Help & FAQs</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '8px' }}>Got a question? We've got answers. Can't find what you need?</p>
          <a href="mailto:support@thelandlordmate.com" style={{ color: blue, fontSize: '13px', fontWeight: '700', marginBottom: '24px', display: 'block' }}>Email us at support@thelandlordmate.com →</a>

          {/* Contact box */}
          <div style={{ background: 'rgba(43,124,211,0.08)', border: '1px solid rgba(43,124,211,0.25)', borderRadius: '14px', padding: '20px 24px', marginBottom: '28px' }}>
            <p style={{ margin: '0 0 4px', color: 'white', fontWeight: '700', fontSize: '14px' }}>📞 Customer Support</p>
            <p style={{ margin: '0 0 8px', color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>We respond to all emails within 24 hours, Monday to Friday.</p>
            <a href="mailto:support@thelandlordmate.com" style={{ color: blue, fontSize: '13px', fontWeight: '700' }}>support@thelandlordmate.com</a>
          </div>

          {/* FAQs */}
          {faqs.map((faq, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px 24px', marginBottom: '10px' }}>
              <p style={{ margin: '0 0 8px', color: 'white', fontWeight: '700', fontSize: '14px' }}>Q: {faq.q}</p>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: '13px', lineHeight: '1.7' }}>{faq.a}</p>
            </div>
          ))}

          <div style={{ marginTop: '24px', padding: '20px 24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 8px' }}>Still need help?</p>
            <a href="mailto:support@thelandlordmate.com" style={{ color: blue, fontSize: '14px', fontWeight: '700', textDecoration: 'none' }}>Email support@thelandlordmate.com</a>
          </div>
        </div>
      </AppShell>
    );
  }

  if (user && screen === 'wales') {
    return (
      <AppShell screen="wales" setScreen={setScreen} user={user} handleSignOut={handleSignOut} properties={properties} allDocuments={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty}>
        <div style={{ padding: isMobile ? '20px 16px 80px' : '32px' }}>
          <h1 style={{ color: 'white', fontWeight: '800', fontSize: '20px', marginBottom: '6px' }}>🏴󠁧󠁢󠁷󠁬󠁳󠁥 Wales Compliance Centre</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '28px' }}>Everything you need under the Renting Homes (Wales) Act 2016.</p>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', marginBottom: '12px' }}>QUICK LINKS</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '28px' }}>
            {[
              { label: 'Rent Smart Wales', url: 'https://rentsmart.gov.wales' },
              { label: 'NRLA', url: 'https://www.nrla.org.uk' },
              { label: 'Welsh Gov Housing', url: 'https://www.gov.wales/renting-homes-landlords' },
              { label: 'TDS', url: 'https://www.tenancydepositscheme.com' },
              { label: 'DPS', url: 'https://www.depositprotection.com' },
              { label: 'MyDeposits', url: 'https://www.mydeposits.co.uk' },
            ].map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noreferrer" style={{ background: 'rgba(43,124,211,0.12)', border: '1px solid rgba(43,124,211,0.25)', color: blue, padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', textDecoration: 'none', fontFamily: font }}>
                {link.label} →
              </a>
            ))}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', marginBottom: '12px' }}>NRLA TEMPLATES & RESOURCES</p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '18px 20px', borderRadius: '12px', marginBottom: '28px' }}>
            <p style={{ margin: '0 0 8px', color: 'white', fontWeight: '700', fontSize: '14px' }}>Free landlord templates from the NRLA</p>
            <p style={{ margin: '0 0 14px', color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: '1.6' }}>Tenancy agreements, notice templates, inventory forms, rent increase notices and more — all free to NRLA members.</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a href="https://www.nrla.org.uk/resources/wales" target="_blank" rel="noreferrer" style={{ color: blue, fontSize: '12px', fontWeight: '600', background: 'rgba(43,124,211,0.1)', padding: '4px 10px', borderRadius: '4px', textDecoration: 'none' }}>Tenancy Agreements →</a>
              <a href="https://www.nrla.org.uk/resources/wales" target="_blank" rel="noreferrer" style={{ color: blue, fontSize: '12px', fontWeight: '600', background: 'rgba(43,124,211,0.1)', padding: '4px 10px', borderRadius: '4px', textDecoration: 'none' }}>Notice Templates →</a>
              <a href="https://www.nrla.org.uk/resources" target="_blank" rel="noreferrer" style={{ color: blue, fontSize: '12px', fontWeight: '600', background: 'rgba(43,124,211,0.1)', padding: '4px 10px', borderRadius: '4px', textDecoration: 'none' }}>All Resources →</a>
            </div>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', marginBottom: '12px' }}>COMPLIANCE REQUIREMENTS</p>
          {[
            { title: 'Rent Smart Wales Licence', desc: 'All landlords in Wales must be registered and licensed with Rent Smart Wales. Renewals every 5 years.', link: 'https://rentsmart.gov.wales', urgent: true },
            { title: 'Gas Safety Certificate', desc: 'Annual inspection by a Gas Safe registered engineer. Must be provided to tenants within 28 days.', urgent: false },
            { title: 'EICR (Electrical Report)', desc: 'Required every 5 years. Must be carried out by a qualified electrician.', urgent: false },
            { title: 'EPC (Energy Performance Certificate)', desc: 'Required before marketing. Valid for 10 years. Minimum rating of E required.', urgent: false },
            { title: 'Written Occupation Contract', desc: 'Under the Renting Homes Act, landlords must provide a written occupation contract within 14 days of occupation.', urgent: true },
            { title: 'Deposit Protection', desc: 'Deposits must be protected in an approved scheme (TDS, DPS or MyDeposits) within 30 days and information provided to the occupant.', urgent: false },
            { title: 'Smoke & Carbon Monoxide Alarms', desc: 'Working smoke alarms on every floor and CO alarms in rooms with gas appliances.', urgent: false },
            { title: 'Agent Licence Safeguards', desc: 'Licensed agents must also maintain client money protection, professional indemnity insurance, and redress scheme membership (TPO or Property Redress Scheme), on top of certificate compliance.', urgent: false, agentOnly: true },
          ].map((item, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${item.urgent ? 'rgba(43,124,211,0.3)' : 'rgba(255,255,255,0.07)'}`, padding: '18px 20px', borderRadius: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'white', fontSize: '14px' }}>{item.title}</p>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: '1.6' }}>{item.desc}</p>
                  {item.link && <a href={item.link} target="_blank" rel="noreferrer" style={{ color: blue, fontSize: '12px', fontWeight: '600', marginTop: '8px', display: 'inline-block' }}>Visit Rent Smart Wales →</a>}
                </div>
                {item.urgent && <span style={{ background: 'rgba(43,124,211,0.15)', color: blue, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>Wales</span>}
                {item.agentOnly && <span style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>Agents</span>}
              </div>
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  const handleChangeEmail = async () => {
    setSettingsEmailMsg(''); setSettingsEmailError('');
    if (!settingsNewEmail || !settingsNewEmail.includes('@')) { setSettingsEmailError('Please enter a valid email address.'); return; }
    const { error } = await supabase.auth.updateUser({ email: settingsNewEmail });
    if (error) { setSettingsEmailError(error.message); } else { setSettingsEmailMsg('Confirmation email sent to ' + settingsNewEmail + '. Click the link to confirm the change.'); setSettingsNewEmail(''); }
  };

  const handleSaveDisplayName = async () => {
    if (!settingsName.trim()) return;
    setSettingsNameError('');
    const { data, error } = await supabase.auth.updateUser({ data: { full_name: settingsName.trim() } });
    if (!error) {
      if (data?.user) setUser(data.user);
      const { error: rowError } = await supabase.from('users').update({ full_name: settingsName.trim() }).eq('id', user.id);
      if (rowError) console.error('Display name row update error:', rowError);
      setUserRecord(prev => prev ? { ...prev, full_name: settingsName.trim() } : prev);
      setSettingsNameSaved(true);
      setTimeout(() => setSettingsNameSaved(false), 3000);
    } else {
      console.error('Display name save error:', error);
      setSettingsNameError(`Save failed: ${error.message || 'please try again.'}`);
    }
  };

  const handleChangePassword = async () => {
    setSettingsPasswordMsg(''); setSettingsPasswordError('');
    if (!settingsNewPassword || settingsNewPassword.length < 8) { setSettingsPasswordError('New password must be at least 8 characters.'); return; }
    const { error } = await supabase.auth.updateUser({ password: settingsNewPassword });
    if (error) { setSettingsPasswordError(error.message); } else { setSettingsPasswordMsg('Password updated successfully!'); setSettingsNewPassword(''); setSettingsCurrentPassword(''); }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure? This will permanently delete your account and all your data. This cannot be undone.')) return;
    if (!window.confirm('Last chance — are you absolutely sure you want to delete your account?')) return;
    await supabase.from('documents').delete().eq('user_id', user.id);
    for (const p of properties) await supabase.from('documents').delete().eq('property_id', p.id);
    await supabase.from('properties').delete().eq('user_id', user.id);
    await supabase.from('users').delete().eq('id', user.id);
    try {
      await fetch('https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmhjZG92YnZ2dmR2a2pzZ2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTMzNzAsImV4cCI6MjA5NTg4OTM3MH0.pELmW7Shb4YnJ8AWmJipd0SK6tfONXl3IBHJwE0g7kI' },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (e) {
      // Even if this step fails, their data is already gone — don't block
      // sign-out over it. Worth checking Supabase Auth occasionally for any
      // orphaned identities this might leave behind.
    }
    await supabase.auth.signOut();
    setUser(null); setProperties([]); setAllDocuments([]); setScreen('login');
  };

  
  if (user && screen === 'settings') {
    return (
      <AppShell screen="settings" setScreen={setScreen} user={user} handleSignOut={handleSignOut} properties={properties} allDocuments={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty}>
        <div style={{ padding: isMobile ? '20px 16px 80px' : '32px', maxWidth: '600px' }}>
          <h1 style={{ color: 'white', fontWeight: '800', fontSize: '20px', marginBottom: '6px' }}>Settings</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '28px' }}>Manage your account and preferences.</p>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', marginBottom: '10px' }}>ACCOUNT</p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '12px', marginBottom: '12px' }}>
            <p style={{ color: 'white', fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>Email address</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 12px' }}>{user?.email}</p>
            {settingsEmailMsg && <p style={{ color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>✓ {settingsEmailMsg}</p>}
            {settingsEmailError && <p style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>⚠ {settingsEmailError}</p>}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input type="email" autoComplete="email" placeholder="New email address" value={settingsNewEmail} onChange={(e) => setSettingsNewEmail(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              <button onClick={handleChangeEmail} style={{ padding: '12px 16px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>Change</button>
            </div>
            <p style={{ color: 'white', fontWeight: '700', margin: '0 0 8px', fontSize: '14px' }}>Display name</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" name="tlm_display_name_field" id="tlm_display_name_field" autoComplete="off" data-lpignore="true" data-form-type="other" placeholder={user?.user_metadata?.full_name || 'Your name'} value={settingsName} onChange={(e) => setSettingsName(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
              <button onClick={handleSaveDisplayName} style={{ padding: '12px 16px', background: settingsNameSaved ? '#22c55e' : blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {settingsNameSaved ? '✓ Saved' : 'Save'}
              </button>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', margin: '6px 0 0' }}>{properties.length} {properties.length === 1 ? 'property' : 'properties'} · {allDocuments.length} documents</p>
            {settingsNameError && <p style={{ color: '#ef4444', fontSize: '12px', fontWeight: '700', margin: '8px 0 0' }}>⚠ {settingsNameError}</p>}
          </div>

          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '12px', marginBottom: '12px' }}>
            <p style={{ color: 'white', fontWeight: '700', margin: '0 0 12px', fontSize: '14px' }}>Change Password</p>
            {settingsPasswordMsg && <p style={{ color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>✓ {settingsPasswordMsg}</p>}
            {settingsPasswordError && <p style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>⚠ {settingsPasswordError}</p>}
            <input type="password" placeholder="New password (min 8 characters)" value={settingsNewPassword} onChange={(e) => setSettingsNewPassword(e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
            <button onClick={handleChangePassword} style={{ width: '100%', padding: '12px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Update Password</button>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', margin: '20px 0 10px' }}>BRANDING</p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '12px', marginBottom: '12px' }}>
            <p style={{ color: 'white', fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>Your Logo</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 12px' }}>Upload your company logo — shows in your dashboard sidebar.</p>
            {(pendingLandlordLogoPreview || landlordLogoUrl) && (
              <img src={pendingLandlordLogoPreview || landlordLogoUrl} alt="Your logo" style={{ height: '64px', objectFit: 'contain', marginBottom: '12px', display: 'block', borderRadius: '6px', maxWidth: '200px', background: 'white', padding: '8px 12px' }} />
            )}
            <input type="file" accept="image/*" onChange={e => handleLandlordLogoSelect(e.target.files[0])} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px', display: 'block' }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              {pendingLandlordLogoPreview && <button onClick={handleLandlordLogoSave} style={{ padding: '8px 16px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Save Logo</button>}
              {landlordLogoUrl && !pendingLandlordLogoPreview && <button onClick={handleLandlordLogoRemove} style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', borderRadius: '8px', fontSize: '12px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Remove Logo</button>}
              {pendingLandlordLogoPreview && <button onClick={() => { setPendingLandlordLogo(null); setPendingLandlordLogoPreview(''); }} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: '8px', fontSize: '12px', fontFamily: font, cursor: 'pointer' }}>Cancel</button>}
            </div>
            {landlordLogoSaved && <p style={{ color: '#22c55e', fontSize: '12px', fontWeight: '700', margin: '8px 0 0' }}>✓ Logo saved!</p>}
            {landlordLogoError && <p style={{ color: '#ef4444', fontSize: '12px', fontWeight: '700', margin: '8px 0 0' }}>{landlordLogoError}</p>}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', margin: '20px 0 10px' }}>SUBSCRIPTION</p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: 'white', fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>{userRecord?.lifetime_access ? 'Lifetime Access' : isSubscribed ? 'Active Subscription' : `Free Trial — ${trialStatus.daysLeft} days left`}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: 0 }}>{userRecord?.lifetime_access ? 'You have permanent access to every feature, no billing involved.' : isSubscribed ? 'Your subscription is active.' : 'Upgrade to keep access after your trial ends.'}</p>
              </div>
              <span style={{ background: isSubscribed ? 'rgba(34,197,94,0.15)' : 'rgba(43,124,211,0.15)', color: isSubscribed ? '#22c55e' : blue, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>{userRecord?.lifetime_access ? '✓ Lifetime' : isSubscribed ? '✓ Active' : 'Trial'}</span>
            </div>
            {!isSubscribed && (
              <button onClick={() => setForcePaywall(true)} disabled={subscribing} style={{ marginTop: '14px', padding: '10px 20px', background: blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', opacity: subscribing ? 0.7 : 1 }}>
                {subscribing ? 'Loading…' : 'Choose a plan'}
              </button>
            )}
            {isSubscribed && !userRecord?.lifetime_access && (
              <button onClick={handleManageSubscription} disabled={portalLoading} style={{ marginTop: '14px', padding: '10px 20px', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', opacity: portalLoading ? 0.7 : 1 }}>
                {portalLoading ? 'Loading…' : 'Manage subscription'}
              </button>
            )}
            {portalError && <p style={{ color: '#ef4444', fontSize: '12px', fontWeight: '700', margin: '10px 0 0' }}>⚠ {portalError}</p>}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', margin: '20px 0 10px' }}>MY DATA</p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '12px', marginBottom: '12px' }}>
            <p style={{ color: 'white', fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>Export Portfolio (CSV)</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 12px' }}>Download a spreadsheet of all your properties, their compliance status and next expiry dates.</p>
            {meetsTier('portfolio') ? (
              <button onClick={handleLandlordExportCSV} style={{ padding: '10px 20px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>📥 Export CSV</button>
            ) : (
              <button onClick={() => tierGateAlert('CSV portfolio export', 'portfolio')} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>🔒 Export CSV — Portfolio plan</button>
            )}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', margin: '20px 0 10px' }}>REMINDER SCHEDULE</p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '12px', marginBottom: '12px' }}>
            <p style={{ color: 'white', fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>Certificate Expiry Reminders</p>
            {meetsTier('pro') ? (
              <>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 14px' }}>Choose which days before expiry you'd like to be emailed. We always email on the expiry day itself and again 7 days after if nothing's been renewed.</p>
                {(() => {
                  const current = reminderDays || userRecord?.reminder_days || [90, 60, 30, 14, 7];
                  const options = [90, 60, 30, 14, 7, 3, 1];
                  return (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                        {options.map(d => {
                          const active = current.includes(d);
                          return (
                            <button
                              key={d}
                              onClick={() => {
                                const next = active ? current.filter(x => x !== d) : [...current, d];
                                handleSaveReminderDays(next);
                              }}
                              style={{ padding: '8px 16px', borderRadius: '8px', border: active ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.1)', background: active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)', color: active ? '#22c55e' : 'rgba(255,255,255,0.5)', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}
                            >{d} day{d === 1 ? '' : 's'}</button>
                          );
                        })}
                      </div>
                      {reminderDaysSaved && <p style={{ color: '#22c55e', fontSize: '12px', fontWeight: '700', margin: 0 }}>✓ Saved</p>}
                    </>
                  );
                })()}
              </>
            ) : (
              <>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 12px' }}>You're reminded at the standard 90, 60, 30, 14 and 7 day marks before any certificate expires.</p>
                <button onClick={() => tierGateAlert('Custom reminder schedules', 'pro')} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>🔒 Customise — Pro plan</button>
              </>
            )}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', margin: '20px 0 10px' }}>CALENDAR SYNC</p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '12px', marginBottom: '12px' }}>
            <p style={{ color: 'white', fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>Sync Expiry Dates to Your Calendar</p>
            {meetsTier('pro') ? (
              <>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 14px' }}>Add this link to Google Calendar or Apple Calendar and every certificate expiry shows up automatically, alongside the rest of your life.</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <input
                    readOnly
                    value={`https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/calendar-feed?token=${userRecord?.calendar_token || ''}`}
                    onClick={(e) => e.target.select()}
                    style={{ flex: 1, padding: '10px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(`https://pwfhcdovbvvvdvkjsgip.supabase.co/functions/v1/calendar-feed?token=${userRecord?.calendar_token || ''}`); setCalendarLinkCopied(true); setTimeout(() => setCalendarLinkCopied(false), 2000); }}
                    style={{ padding: '10px 16px', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >{calendarLinkCopied ? '✓ Copied' : 'Copy link'}</button>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0 }}>In Google Calendar: Other calendars → + → From URL. In Apple Calendar: File → New Calendar Subscription.</p>
              </>
            ) : (
              <>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 12px' }}>See every certificate expiry right in Google or Apple Calendar, no separate app needed.</p>
                <button onClick={() => tierGateAlert('Calendar sync', 'pro')} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>🔒 Sync calendar — Pro plan</button>
              </>
            )}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', margin: '20px 0 10px' }}>NOTIFICATIONS</p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '12px', marginBottom: '12px' }}>
            <p style={{ color: 'white', fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>Email Reminders</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 12px' }}>Automatic reminders at 90, 60, 30, 14 and 7 days before any document expires.</p>
            <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>✓ Active</span>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', margin: '20px 0 10px' }}>SUPPORT</p>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', borderRadius: '12px', marginBottom: '12px' }}>
            <p style={{ color: 'white', fontWeight: '700', margin: '0 0 8px', fontSize: '14px' }}>Need help?</p>
            <a href="mailto:support@thelandlordmate.com" style={{ color: blue, fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>support@thelandlordmate.com</a>
            <a href="https://thelandlordmate.com" target="_blank" rel="noreferrer" style={{ color: blue, fontSize: '13px', fontWeight: '600' }}>thelandlordmate.com →</a>
          </div>

          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '800', letterSpacing: '2px', margin: '20px 0 10px' }}>DANGER ZONE</p>
          <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: '20px', borderRadius: '12px', marginBottom: '12px' }}>
            <p style={{ color: 'white', fontWeight: '700', margin: '0 0 4px', fontSize: '14px' }}>Delete Account</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 14px' }}>Permanently delete your account and all your data. This cannot be undone.</p>
            <button onClick={handleDeleteAccount} style={{ padding: '10px 20px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>Delete My Account</button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (user && showPrintReport) {
    return (
      <div style={{ minHeight: '100vh', background: 'white', fontFamily: font, padding: '40px', color: '#0f1e30' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '16px', borderBottom: '3px solid #0f1e30' }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '900', color: '#0f1e30' }}>The Landlord Mate</h1>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Compliance Summary Report · {new Date().toLocaleDateString('en-GB')}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#666' }}>{user?.email}</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>{properties.length} {properties.length === 1 ? 'property' : 'properties'} · {allDocuments.length} documents</p>
            </div>
          </div>

          {properties.map(property => {
            const propDocs = allDocuments.filter(d => d.property_id === property.id);
            const score = (() => {
              if (!propDocs || propDocs.length === 0) return 0;
              let s = 0;
              const weights = { 'Gas Safety Certificate': 25, 'EICR (Electrical Report)': 20, 'EPC (Energy Performance)': 15, 'HMO Licence': 15, 'Smoke & Carbon Monoxide Alarms': 15, 'Tenancy Agreement': 10 };
              for (const [docType, points] of Object.entries(weights)) {
                const match = propDocs.find(d => d.document_type === docType);
                if (match) {
                  const status = getExpiryStatus(match.expiry_date);
                  if (!match.expiry_date || status?.type === 'good') s += points;
                  else if (status?.type === 'soon') s += Math.round(points * 0.7);
                  else if (status?.type === 'urgent') s += Math.round(points * 0.3);
                }
              }
              return Math.min(s, 100);
            })();
            const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
            return (
              <div key={property.id} style={{ marginBottom: '32px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', pageBreakInside: 'avoid' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '800', color: '#0f1e30' }}>{property.address_line_1}</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#666', textTransform: 'capitalize' }}>{property.property_type}{property.country ? ` · ${property.country}` : ''}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    {propDocs.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#999', lineHeight: 1 }}>—</p>
                    ) : (
                      <p style={{ margin: 0, fontSize: '28px', fontWeight: '900', color: scoreColor, lineHeight: 1 }}>{score}</p>
                    )}
                    <p style={{ margin: '2px 0 0', fontSize: '9px', color: '#666', fontWeight: '700', textTransform: 'uppercase' }}>Health Score</p>
                  </div>
                </div>
                {propDocs.length === 0 ? (
                  <p style={{ color: '#999', fontSize: '13px' }}>No documents uploaded</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', color: '#0f1e30', borderBottom: '1px solid #e2e8f0' }}>Document</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', color: '#0f1e30', borderBottom: '1px solid #e2e8f0' }}>Expiry Date</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', color: '#0f1e30', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {propDocs.map(doc => {
                        const status = getExpiryStatus(doc.expiry_date);
                        const statusLabel = status ? status.label : 'No expiry set';
                        const statusColor = status ? status.color : '#999';
                        return (
                          <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#0f1e30', fontWeight: '600' }}>{doc.document_type}</td>
                            <td style={{ padding: '8px 12px', color: '#666' }}>{doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-GB') : '—'}</td>
                            <td style={{ padding: '8px 12px' }}><span style={{ color: statusColor, fontWeight: '700', fontSize: '12px' }}>● {statusLabel}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#999' }}>Generated by The Landlord Mate · thelandlordmate.com · {new Date().toLocaleDateString('en-GB')}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowPrintReport(false)} style={{ padding: '8px 16px', background: '#f1f5f9', color: '#0f1e30', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>← Back</button>
              <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#0f1e30', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>🖨️ Print</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <AppShell screen="dashboard" setScreen={setScreen} user={user} handleSignOut={handleSignOut} properties={properties} allDocuments={allDocuments} landlordLogoUrl={landlordLogoUrl} setSelectedLetter={setSelectedLetter} setSelectedProperty={setSelectedProperty}>
        <Dashboard
          properties={properties}
          documents={allDocuments}
          setScreen={setScreen}
          userName={user?.user_metadata?.full_name?.split(' ')[0] || ''}
          showHomeBanner={showHomeBanner}
          onDismissBanner={handleDismissBanner}
          trialDaysLeft={trialStatus.daysLeft}
          showTrialNudge={showTrialNudge}
          onSubscribe={() => setForcePaywall(true)}
          onPrintReport={() => setShowPrintReport(true)}
          setSelectedProperty={(p) => handleSelectProperty(p)}
          handleSelectProperty={handleSelectProperty}
        />
      </AppShell>
    );
  }

  if (screen === 'verify') {
    return (
      <div style={{ minHeight: '100vh', background: navy, fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <img src={logo} alt="The Landlord Mate" style={{ height: '120px' }} />
          </div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
          <h1 style={{ color: '#0f1e30', marginTop: 0, fontSize: '22px', fontWeight: '800' }}>Check your email</h1>
          <p style={{ color: '#666', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>We've sent an activation link to <strong>{email}</strong>. Click the link to activate your account.</p>
          <p style={{ color: '#aaa', fontSize: '13px' }}>Already activated? <span onClick={() => setScreen('login')} style={{ color: '#0f1e30', fontWeight: '700', cursor: 'pointer' }}>Sign in</span></p>
        </div>
      </div>
    );
  }

  if (screen === 'forgot') {
    return (
      <div style={{ minHeight: '100vh', background: navy, fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <img src={logo} alt="The Landlord Mate" style={{ height: '120px' }} />
          </div>
          <h1 style={{ color: '#0f1e30', textAlign: 'center', marginTop: 0, fontSize: '22px', fontWeight: '800' }}>Reset your password</h1>
          {forgotSent ? (
            <div>
              <p style={{ textAlign: 'center', color: '#2e7d32', background: '#e8f5e9', padding: '16px', borderRadius: '8px' }}>✓ Check your email for a reset link!</p>
              <button onClick={() => { setScreen('login'); setForgotSent(false); }} style={{ width: '100%', padding: '14px', background: '#0f1e30', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontFamily: font, fontWeight: '700', cursor: 'pointer', marginTop: '16px' }}>Back to Sign In</button>
            </div>
          ) : (
            <div>
              <p style={{ color: '#666', fontSize: '14px', textAlign: 'center', marginBottom: '24px' }}>Enter your email and we'll send you a reset link.</p>
              {error && <p style={{ color: '#c62828', background: '#ffebee', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' }}>{error}</p>}
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={lightInputStyle} />
              <button onClick={handleForgotPassword} disabled={loading} style={{ width: '100%', padding: '14px', background: '#0f1e30', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontFamily: font, fontWeight: '700', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
              <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#666' }}>
                <span onClick={() => { setScreen('login'); setError(''); }} style={{ color: '#0f1e30', fontWeight: '700', cursor: 'pointer' }}>← Back to Sign In</span>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'signup') {
    return (
      <div style={{ minHeight: '100vh', background: navy, fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <img src={logo} alt="The Landlord Mate" style={{ height: '120px' }} />
          </div>
          <h1 style={{ color: '#0f1e30', textAlign: 'center', marginTop: 0, fontSize: '22px', fontWeight: '800' }}>Create your account</h1>
          <p style={{ textAlign: 'center', color: '#888', fontSize: '14px', marginBottom: '20px', marginTop: '-8px' }}>Start your 7-day free trial</p>

          {/* Account type selector */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button onClick={() => setAccountType('landlord')} style={{ flex: 1, padding: '10px', background: accountType === 'landlord' ? '#0f1e30' : '#f8fafc', color: accountType === 'landlord' ? 'white' : '#666', border: `2px solid ${accountType === 'landlord' ? '#0f1e30' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
              🏠 I'm a Landlord
            </button>
            <button onClick={() => setAccountType('agent')} style={{ flex: 1, padding: '10px', background: accountType === 'agent' ? '#0f1e30' : '#f8fafc', color: accountType === 'agent' ? 'white' : '#666', border: `2px solid ${accountType === 'agent' ? '#0f1e30' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '13px', fontFamily: font, fontWeight: '700', cursor: 'pointer' }}>
              🏢 I'm a Letting Agent
            </button>
          </div>
          {accountType === 'agent' && (
            <input type="text" placeholder="Agency name (e.g. Shepherd Sharpe)" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} style={lightInputStyle} />
          )}
          {error && <p style={{ color: '#c62828', background: '#ffebee', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' }}>{error}</p>}
          <input type="text" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} style={lightInputStyle} />
          <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={lightInputStyle} />
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <input type={showPassword ? 'text' : 'password'} placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...lightInputStyle, marginBottom: 0, paddingRight: '48px' }} />
            <span onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px' }}>{showPassword ? '🙈' : '👁️'}</span>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <Turnstile siteKey={TURNSTILE_SITE_KEY} onVerify={(token) => setCaptchaToken(token)} onExpire={() => setCaptchaToken('')} ref={captchaRef} />
          </div>
          <select value={referralSource} onChange={e => setReferralSource(e.target.value)} style={{ ...lightInputStyle, marginBottom: '16px', color: referralSource ? '#0f1e30' : '#999' }}>
            <option value="">How did you hear about us? (optional)</option>
            <option value="google">Google Search</option>
            <option value="facebook">Facebook / Social Media</option>
            <option value="word_of_mouth">Word of mouth / Friend</option>
            <option value="agent">Letting agent recommended</option>
            <option value="nrla">NRLA / Landlord association</option>
            <option value="property_hawk">Property Hawk (closing)</option>
            <option value="linkedin">LinkedIn</option>
            <option value="other">Other</option>
          </select>
          <button onClick={handleSignUp} disabled={loading} style={{ width: '100%', padding: '14px', background: '#0f1e30', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontFamily: font, fontWeight: '700', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#666' }}>
            Already have an account?{' '}
            <span onClick={() => { setScreen('login'); setError(''); }} style={{ color: '#0f1e30', fontWeight: '700', cursor: 'pointer' }}>Sign in</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: navy, fontFamily: font, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <img src={logo} alt="The Landlord Mate" style={{ height: '120px' }} />
        </div>
        <h1 style={{ color: '#0f1e30', textAlign: 'center', marginTop: 0, fontSize: '22px', fontWeight: '800' }}>Sign in to your account</h1>
        {error && <p style={{ color: '#c62828', background: '#ffebee', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' }}>{error}</p>}
        <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={lightInputStyle} />
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSignIn(); }} style={{ ...lightInputStyle, marginBottom: 0, paddingRight: '48px' }} />
          <span onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px' }}>{showPassword ? '🙈' : '👁️'}</span>
        </div>
        <p style={{ textAlign: 'right', margin: '0 0 16px', fontSize: '14px' }}>
          <span onClick={() => { setScreen('forgot'); setError(''); }} style={{ color: '#0f1e30', fontWeight: '600', cursor: 'pointer' }}>Forgot password?</span>
        </p>
        <div style={{ marginBottom: '20px' }}>
          <Turnstile siteKey={TURNSTILE_SITE_KEY} onVerify={(token) => setLoginCaptchaToken(token)} onExpire={() => setLoginCaptchaToken('')} ref={loginCaptchaRef} />
        </div>
        <button onClick={handleSignIn} disabled={loading} style={{ width: '100%', padding: '14px', background: '#0f1e30', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontFamily: font, fontWeight: '700', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#666' }}>
          Don't have an account?{' '}
          <span onClick={() => { setScreen('signup'); setError(''); }} style={{ color: '#0f1e30', fontWeight: '700', cursor: 'pointer' }}>Create one free</span>
        </p>
      </div>
    </div>
  );
}

export default App;

// build 1781970122
