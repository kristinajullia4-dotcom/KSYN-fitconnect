import React, { useState } from 'react';
import {
  Dumbbell,
  Flame,
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Users,
  Award,
  Phone,
  Mail,
  Send,
  Star,
  Shield,
  CreditCard,
  Briefcase,
  ChevronRight,
  Activity,
  Music,
  Target,
  Heart,
  CalendarCheck,
  Ticket,
  X
} from 'lucide-react';
import AuthModal from '../components/AuthModal';
import FranchiseTermsModal from '../components/FranchiseTermsModal';
import FreePassModal from '../components/FreePassModal';
import TermsModal from '../components/TermsModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import RefundPolicyModal from '../components/RefundPolicyModal';
import EulaModal from '../components/EulaModal';
import CookieConsentBanner from '../components/CookieConsentBanner';
import { BRANCH_DIRECTORY, DISTRICT_TABS } from '../config/branchData';

export default function Landing({ onNavigateLogin, onNavigateRegister }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('register');
  const [selectedDistrict, setSelectedDistrict] = useState('All Districts');

  const openAuthModal = (tab = 'register') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const [franchiseForm, setFranchiseForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    targetLocation: 'Makati CBD',
    customRegionDetail: '',
    investmentCapital: '₱4,000,000 – ₱6,000,000 (450–600 sqm Standard Commercial Hub)',
    notes: ''
  });
  // Backward compatibility alias for inquiryForm
  const inquiryForm = franchiseForm;
  const setInquiryForm = setFranchiseForm;

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showFranchiseTerms, setShowFranchiseTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showEulaModal, setShowEulaModal] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Free Pass 1-Day Trial states
  const [showFreePassModal, setShowFreePassModal] = useState(false);
  const [selectedFreePassBranch, setSelectedFreePassBranch] = useState(null);
  const [freePassSuccessBanner, setFreePassSuccessBanner] = useState(false);

  const navigateToLogin = () => {
    openAuthModal('login');
  };

  const navigateToRegister = () => {
    openAuthModal('register');
  };

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    if (!franchiseForm.fullName || !franchiseForm.email || !franchiseForm.phone) {
      alert('Please fill out all required fields.');
      return;
    }
    if (!agreedToTerms) {
      alert('Please accept the KSYN Franchise Terms & Conditions before submitting.');
      return;
    }
    if (!agreedToPrivacy) {
      alert('Please acknowledge and consent to the KSYN Privacy Policy (RA 10173).');
      return;
    }
    try {
      await fetch('/api/franchise-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: franchiseForm.fullName,
          email: franchiseForm.email,
          phone: franchiseForm.phone,
          desiredLocation: franchiseForm.customRegionDetail
            ? `${franchiseForm.targetLocation} - ${franchiseForm.customRegionDetail}`
            : franchiseForm.targetLocation,
          targetLocation: franchiseForm.targetLocation,
          customRegionDetail: franchiseForm.customRegionDetail,
          proposedCapital: franchiseForm.investmentCapital,
          notes: franchiseForm.notes
        })
      });
    } catch (err) {
      console.warn('Franchise inquiry submit:', err);
    }
    setFormSubmitted(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Accessible Skip Link (WCAG 2.1 AA) */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          top: '-100px',
          left: '16px',
          background: '#e1c256',
          color: '#000000',
          padding: '10px 18px',
          fontWeight: 800,
          borderRadius: '8px',
          zIndex: 100000,
          textDecoration: 'none',
          transition: 'top 0.2s ease',
          fontSize: '0.875rem'
        }}
        onFocus={(e) => (e.currentTarget.style.top = '16px')}
        onBlur={(e) => (e.currentTarget.style.top = '-100px')}
      >
        Skip to main content
      </a>

      {/* 1. TOP PUBLIC NAVIGATION */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10, 10, 10, 0.90)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #1f1f1f',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: '16px'
      }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img
            src="/ksyn-logo.png"
            alt="KSYN Gym Logo"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              objectFit: 'contain',
              boxShadow: '0 0 20px rgba(225, 194, 86, 0.4)'
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#ffffff' }}>
                KSYN <span style={{ color: '#e1c256' }}>FITNESS</span>
              </span>
            </div>
            <p style={{ fontSize: '0.6875rem', color: '#9ca3af', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Multi-Branch Commercial Fitness Franchise
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '26px', flexWrap: 'wrap' }}>
          <a
            href="#franchise"
            onClick={(e) => scrollToSection(e, 'franchise')}
            style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, transition: 'color 0.2s ease' }}
            onMouseEnter={(e) => (e.target.style.color = '#e1c256')}
            onMouseLeave={(e) => (e.target.style.color = '#9ca3af')}
          >
            Franchise Opportunities
          </a>
          <a
            href="#memberships"
            onClick={(e) => scrollToSection(e, 'memberships')}
            style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, transition: 'color 0.2s ease' }}
            onMouseEnter={(e) => (e.target.style.color = '#e1c256')}
            onMouseLeave={(e) => (e.target.style.color = '#9ca3af')}
          >
            Memberships & Pricing
          </a>
          <a
            id="nav-classes-link"
            href="#classes"
            onClick={(e) => scrollToSection(e, 'classes')}
            style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, transition: 'color 0.2s ease' }}
            onMouseEnter={(e) => (e.target.style.color = '#e1c256')}
            onMouseLeave={(e) => (e.target.style.color = '#9ca3af')}
          >
            Classes
          </a>
          <a
            href="#locations"
            onClick={(e) => scrollToSection(e, 'locations')}
            style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, transition: 'color 0.2s ease' }}
            onMouseEnter={(e) => (e.target.style.color = '#e1c256')}
            onMouseLeave={(e) => (e.target.style.color = '#9ca3af')}
          >
            Locations
          </a>
          <a
            href="#about"
            onClick={(e) => scrollToSection(e, 'about')}
            style={{ color: '#9ca3af', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, transition: 'color 0.2s ease' }}
            onMouseEnter={(e) => (e.target.style.color = '#e1c256')}
            onMouseLeave={(e) => (e.target.style.color = '#9ca3af')}
          >
            About KSYN
          </a>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button
            type="button"
            id="nav-free-pass-btn"
            onClick={() => setShowFreePassModal(true)}
            className="px-3 py-2 sm:px-3.5 sm:py-2 rounded-lg border border-[#e1c256]/70 bg-[#141414] hover:bg-[#e1c256]/15 text-[#e1c256] font-bold text-xs sm:text-sm tracking-wide transition-all shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
            style={{
              border: '1px solid rgba(225, 194, 86, 0.6)',
              background: '#141414',
              color: '#e1c256',
              borderRadius: '8px',
              fontWeight: 700,
              padding: '8px 14px',
              fontSize: '0.8125rem',
              cursor: 'pointer'
            }}
          >
            Claim 1-Day Pass
          </button>
          <button 
            type="button"
            id="nav-join-now-btn"
            onClick={navigateToLogin} 
            className="px-4 py-2 rounded-lg text-white hover:text-[#e1c256] hover:bg-[#1a1a1a] transition-all flex items-center gap-1.5 font-bold text-xs sm:text-sm border border-[#333333] cursor-pointer"
            style={{
              background: '#181818',
              color: '#ffffff',
              fontWeight: 700,
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #333333',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '0.8125rem'
            }}
          >
            Sign In / Portal &rarr;
          </button>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section style={{
        position: 'relative',
        padding: '110px 24px 80px 24px',
        width: '100%',
        margin: '0 auto',
        textAlign: 'center',
        overflow: 'hidden',
        backgroundImage: `linear-gradient(to bottom, rgba(11, 11, 11, 0.78), rgba(11, 11, 11, 0.94)), url('/images/ksyn-facility-bg.jpg'), url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1920&auto=format&fit=crop')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}>
        {/* Glow ambient background */}
        <div style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '640px',
          height: '360px',
          background: 'radial-gradient(ellipse at center, rgba(225, 194, 86, 0.16), transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1240px', margin: '0 auto' }}>
          {/* Hero Title & Subtitle Structure */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{
              fontSize: 'clamp(2.75rem, 5.5vw, 4.25rem)',
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              textTransform: 'uppercase',
              margin: '0 auto 12px auto',
              maxWidth: '1000px'
            }}>
              BRING KSYN TO YOUR CITY!
            </h1>
            <div style={{
              fontSize: 'clamp(1.125rem, 2.2vw, 1.375rem)',
              fontWeight: 800,
              color: '#e1c256',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '20px'
            }}>
              BE THE NEXT KSYN FRANCHISE OWNER!
            </div>
          </div>

          {/* Subheadline */}
          <p style={{
            fontSize: '1.1875rem',
            color: '#9ca3af',
            maxWidth: '780px',
            margin: '0 auto 40px auto',
            lineHeight: 1.65,
            fontWeight: 400
          }}>
            Modern fitness spaces, functional strength training, and flexible multi-club access across Metro Manila, expanding nationwide. Train with us as a member, or partner with our team to open a KSYN branch in your city.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '18px', flexWrap: 'wrap', marginBottom: '64px' }}>
            <button
              id="hero-join-now-btn"
              onClick={navigateToRegister}
              className="ksyn-btn ksyn-btn-gold"
              style={{
                padding: '15px 32px',
                fontSize: '1.0625rem',
                fontWeight: 800,
                boxShadow: '0 0 24px rgba(225, 194, 86, 0.4)'
              }}
            >
              Join Now / Claim Pass
            </button>
            <a
              id="hero-explore-memberships-btn"
              href="#memberships"
              onClick={(e) => scrollToSection(e, 'memberships')}
              className="ksyn-btn ksyn-btn-outline"
              style={{
                padding: '15px 30px',
                fontSize: '1.0625rem',
                fontWeight: 700,
                borderColor: '#333333',
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              Explore Memberships
            </a>
            <a
              id="hero-own-franchise-btn"
              href="#franchise"
              onClick={(e) => scrollToSection(e, 'franchise')}
              className="ksyn-btn ksyn-btn-outline"
              style={{
                padding: '15px 30px',
                fontSize: '1.0625rem',
                fontWeight: 700,
                borderColor: '#333333',
                background: 'rgba(255,255,255,0.03)'
              }}
            >
              <Briefcase size={18} color="#e1c256" /> Own a Franchise
            </a>
          </div>

          {/* Commercial Trust Stats HUD */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            textAlign: 'left'
          }}>
            {/* Card 1: Network */}
            <div className="ksyn-card" style={{ padding: '16px 20px', borderColor: '#222222', background: '#12141a', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Building2 size={16} color="#e1c256" />
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Network
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e1c256', lineHeight: 1.2 }}>
                7 Branches
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', whiteSpace: 'nowrap' }}>
                6 Active Clubs &bull; 1 Opening Soon
              </div>
            </div>
            {/* Card 2: Community */}
            <div className="ksyn-card" style={{ padding: '16px 20px', borderColor: '#222222', background: '#12141a', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Users size={16} color="#f7ffc4" />
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Community
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                8,500+
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', whiteSpace: 'nowrap' }}>
                Active members across Metro Manila
              </div>
            </div>
            {/* Card 3: Operating Hours */}
            <div className="ksyn-card" style={{ padding: '16px 20px', borderColor: '#222222', background: '#12141a', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Clock size={16} color="#7fa36d" />
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Operating Hours
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7fa36d', lineHeight: 1.2 }}>
                6:00 AM – 12:00 AM
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', whiteSpace: 'nowrap' }}>
                Standardized operating hours & QR entry
              </div>
            </div>
            {/* Card 4: Franchise */}
            <div className="ksyn-card" style={{ padding: '16px 20px', borderColor: '#222222', background: '#12141a', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <TrendingUp size={16} color="#e1c256" />
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                  Franchise
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#e1c256', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                Turnkey Franchise
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', whiteSpace: 'nowrap' }}>
                Standardized equipment & operations support
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ABOUT KSYN & BRAND PILLARS */}
      <section id="about" style={{
        padding: '90px 24px',
        background: '#0d0d0d',
        borderTop: '1px solid #1c1c1c',
        borderBottom: '1px solid #1c1c1c'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#e1c256',
              fontSize: '0.8125rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '12px'
            }}>
              <Award size={16} /> The KSYN Standard
            </div>
            <h2 style={{ fontSize: '2.375rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '14px' }}>
              Engineered for Champions. Built to Scale.
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '1.0625rem', maxWidth: '680px', margin: '0 auto', lineHeight: 1.6 }}>
              We created KSYN Fitness to bridge the gap between heavy-duty strength facilities and modern digital gym convenience. Here is why athletes stay and franchisees thrive.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* Pillar 1 */}
            <div className="ksyn-card" style={{ padding: '32px', background: '#121212' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(225, 194, 86, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <Dumbbell size={24} color="#e1c256" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '10px' }}>
                Championship Equipment
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.65 }}>
                Outfitted with custom heavy-duty racks, Eleiko calibrated plates, Hammer Strength plate-loaded equipment, and dumbbells up to 150 lbs. No lightweight compromises.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="ksyn-card" style={{ padding: '32px', background: '#121212' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(101, 130, 86, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <Clock size={24} color="#7fa36d" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '10px' }}>
                Extended Hours & Seamless Entry
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.65 }}>
                Train on your schedule with standardized 6:00 AM – 12:00 AM daily operating hours. Walk up to any club turnstile, scan your dynamic in-app digital pass, and unlock the facility instantly without paperwork or front desk lines.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="ksyn-card" style={{ padding: '32px', background: '#121212' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(247, 255, 196, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <Flame size={24} color="#f7ffc4" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '10px' }}>
                Elite Coaching & Classes
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.65 }}>
                High-energy group training (Yoga, HIIT, Zumba, Boxing), certified strength coaches, infrared saunas, and contrast therapy recovery lounges engineered for optimum performance.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="ksyn-card" style={{ padding: '32px', background: '#121212' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(225, 194, 86, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px'
              }}>
                <TrendingUp size={24} color="#e1c256" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '10px' }}>
                Turnkey Franchise Model
              </h3>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.65 }}>
                A streamlined operational blueprint with bulk equipment purchasing power, automated digital billing, and nationwide brand marketing that fuels high recurring retention.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MEMBERSHIP PLANS SECTION (#memberships) */}
      <section id="memberships" style={{ padding: '96px 24px', maxWidth: '1240px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#e1c256',
            fontSize: '0.8125rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '10px'
          }}>
            <CreditCard size={16} /> Transparent Pricing & Rates
          </div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '14px' }}>
            Unified Membership Rate Card
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '1.0625rem', maxWidth: '680px', margin: '0 auto', lineHeight: 1.6 }}>
            Every peso accounted for. Zero surprise deductions, waived annual dues on 12-month passes, and instant digital turnstile admission.
          </p>
        </div>

        {/* 3 Featured Public Pricing Showcase Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', alignItems: 'stretch', marginBottom: '48px' }}>
          {/* Plan 1: 1 Month Flexible */}
          <div className="ksyn-card" style={{
            padding: '36px',
            background: '#121212',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: '#262626'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Flexible Month-to-Month
                </span>
                <span style={{ fontSize: '0.625rem', background: '#262626', color: '#d1d5db', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                  1 Month (Flexible)
                </span>
              </div>
              <h3 style={{ fontSize: '1.625rem', fontWeight: 900, marginBottom: '14px' }}>
                1 Month Pass
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff' }}>₱2,400</span>
                <span style={{ color: '#9ca3af', fontSize: '0.9375rem' }}>/ 30 days</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#e1c256', fontWeight: 700, marginBottom: '16px' }}>
                Total Due Today: ₱4,400 (Includes ₱1k Access + ₱1k Annual)
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '24px' }}>
                Ideal for athletes requiring commitment freedom with single home club equipment access and 1 complimentary group fitness class.
              </p>

              <div style={{ borderTop: '1px solid #222222', paddingTop: '20px', marginBottom: '28px' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d5db' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> Single club strength & cardio access
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d5db' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> 1 Complimentary group fitness class (Yoga/HIIT/Zumba)
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d5db' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> Instant in-app dynamic QR turnstile pass
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d5db' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> Standard locker, shower, and hydration
                  </li>
                </ul>
              </div>
            </div>

            <button
              id="plan-1month-btn"
              onClick={navigateToRegister}
              className="ksyn-btn ksyn-btn-outline"
              style={{
                width: '100%',
                padding: '13px',
                fontSize: '0.9375rem',
                fontWeight: 700,
                borderColor: '#383838'
              }}
            >
              Select 1 Month Pass &rarr;
            </button>
          </div>

          {/* Plan 2: 12 Months Annual Elite (Centerpiece) */}
          <div className="ksyn-card ksyn-card-gold" style={{
            padding: '36px',
            background: 'linear-gradient(145deg, #181818 0%, #101010 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: '#e1c256',
            position: 'relative',
            transform: 'scale(1.02)',
            boxShadow: '0 8px 32px rgba(225, 194, 86, 0.25)'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: '#e1c256', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Full VIP All-Access Network
                </span>
                <span style={{
                  fontSize: '0.6875rem',
                  background: '#e1c256',
                  color: '#000000',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Star size={11} className="fill-black text-black" /> Annual Perks (Fee Waived)
                </span>
              </div>
              <h3 style={{ fontSize: '1.625rem', fontWeight: 900, marginBottom: '14px', color: '#ffffff' }}>
                12 Months Annual Elite
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#e1c256' }}>₱15,000</span>
                <span style={{ color: '#9ca3af', fontSize: '0.9375rem' }}>/ 365 days</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#658256', fontWeight: 800, marginBottom: '16px' }}>
                Total Due Today: ₱16,000 (₱1k Access Fee | ₱0 Annual Fee Waived)
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '24px' }}>
                Our flagship all-access tier. Train across every branch nationwide with unlimited signature group classes, VIP recovery suites, and guest privileges.
              </p>

              <div style={{ borderTop: '1px solid rgba(225, 194, 86, 0.25)', paddingTop: '20px', marginBottom: '28px' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e1c256', fontWeight: 800 }}>
                    <CheckCircle2 size={16} color="#e1c256" /> Unlimited Yoga, HIIT, Zumba & Boxing Classes
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff', fontWeight: 600 }}>
                    <CheckCircle2 size={16} color="#e1c256" /> All-branch network access (Makati Flagship, Katipunan, Alabang, etc.)
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> 2 Monthly guest passes for friends & training partners
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> Infrared sauna & cold recovery lounge privileges
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ffffff' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> 10% Member discount on pro-shop gear & supplements
                  </li>
                </ul>
              </div>
            </div>

            <button
              id="plan-annual-elite-btn"
              onClick={navigateToRegister}
              className="ksyn-btn ksyn-btn-gold"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 900
              }}
            >
              Join Annual Elite Pass &rarr;
            </button>
          </div>

          {/* Plan 3: 1-Day Trial Pass */}
          <div className="ksyn-card" style={{
            padding: '36px',
            background: '#121212',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderColor: '#262626'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Drop-In & Travelers
                </span>
                <span style={{ fontSize: '0.625rem', background: '#262626', color: '#e1c256', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                  1-Day (Trial)
                </span>
              </div>
              <h3 style={{ fontSize: '1.625rem', fontWeight: 900, marginBottom: '14px' }}>
                1-Day Pass
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff' }}>₱500</span>
                <span style={{ color: '#9ca3af', fontSize: '0.9375rem' }}>/ 24 hours</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#658256', fontWeight: 700, marginBottom: '16px' }}>
                Total Due: ₱500 (₱0 Access Fee | ₱0 Annual Fee)
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '24px' }}>
                Single club 24-hour pass for travelers, visiting athletes, and drop-in training sessions. Zero enrollment fees required.
              </p>

              <div style={{ borderTop: '1px solid #222222', paddingTop: '20px', marginBottom: '28px' }}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d5db' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> Full single-branch gym floor access
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d5db' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> Instant smartphone QR turnstile entry
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d5db' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> Full free-weights, platforms & cardio zones
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1d5db' }}>
                    <CheckCircle2 size={16} color="#e1c256" /> Zero setup fees, zero recurring commitments
                  </li>
                </ul>
              </div>
            </div>

            <button
              id="plan-1day-btn"
              onClick={navigateToRegister}
              className="ksyn-btn ksyn-btn-outline"
              style={{
                width: '100%',
                padding: '13px',
                fontSize: '0.9375rem',
                fontWeight: 700,
                borderColor: '#383838'
              }}
            >
              Claim 1-Day Trial Pass &rarr;
            </button>
          </div>
        </div>

        {/* Unified Rate Card Comparison Matrix */}
        <div className="ksyn-card" style={{ padding: '28px', background: '#0d0d0d', borderColor: '#222222', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                All Available Membership Packages
              </h3>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                Complete breakdown of Base Plan, Turnstile Access Fee, Annual Dues, and Total Due Today.
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#e1c256', fontWeight: 700, background: 'rgba(225, 194, 86, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
              Philippine Peso (PHP ₱)
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #222222', color: '#9ca3af', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 14px' }}>Membership Plan</th>
                  <th style={{ padding: '12px 14px' }}>Duration</th>
                  <th style={{ padding: '12px 14px' }}>Base Plan</th>
                  <th style={{ padding: '12px 14px' }}>Access Card Fee</th>
                  <th style={{ padding: '12px 14px' }}>Annual Fee</th>
                  <th style={{ padding: '12px 14px' }}>Total Due Today</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {/* 1-Day */}
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#ffffff' }}>
                    1-Day Pass <span style={{ fontSize: '0.6875rem', background: '#222', color: '#e1c256', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>1-Day (Trial)</span>
                  </td>
                  <td style={{ padding: '14px', color: '#9ca3af' }}>24 Hours</td>
                  <td style={{ padding: '14px', color: '#ffffff', fontWeight: 600 }}>₱500</td>
                  <td style={{ padding: '14px', color: '#658256' }}>₱0 (Waived)</td>
                  <td style={{ padding: '14px', color: '#658256' }}>₱0 (Waived)</td>
                  <td style={{ padding: '14px', color: '#ffffff', fontWeight: 800 }}>₱500</td>
                  <td style={{ padding: '14px', textAlign: 'right' }}>
                    <button onClick={navigateToRegister} className="ksyn-btn ksyn-btn-outline" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                      Enroll &rarr;
                    </button>
                  </td>
                </tr>

                {/* 1 Month */}
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#ffffff' }}>
                    1 Month Pass <span style={{ fontSize: '0.6875rem', background: '#222', color: '#f7ffc4', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>1 Month (Flexible)</span>
                  </td>
                  <td style={{ padding: '14px', color: '#9ca3af' }}>30 Days</td>
                  <td style={{ padding: '14px', color: '#ffffff', fontWeight: 600 }}>₱2,400</td>
                  <td style={{ padding: '14px', color: '#d1d5db' }}>₱1,000</td>
                  <td style={{ padding: '14px', color: '#d1d5db' }}>₱1,000</td>
                  <td style={{ padding: '14px', color: '#ffffff', fontWeight: 800 }}>₱4,400</td>
                  <td style={{ padding: '14px', textAlign: 'right' }}>
                    <button onClick={navigateToRegister} className="ksyn-btn ksyn-btn-outline" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                      Enroll &rarr;
                    </button>
                  </td>
                </tr>

                {/* 3 Months */}
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#ffffff' }}>
                    3 Months Pass <span style={{ fontSize: '0.6875rem', background: '#222', color: '#e1c256', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>3 Months (Popular)</span>
                  </td>
                  <td style={{ padding: '14px', color: '#9ca3af' }}>90 Days</td>
                  <td style={{ padding: '14px', color: '#ffffff', fontWeight: 600 }}>₱4,500</td>
                  <td style={{ padding: '14px', color: '#d1d5db' }}>₱1,000</td>
                  <td style={{ padding: '14px', color: '#d1d5db' }}>₱1,000</td>
                  <td style={{ padding: '14px', color: '#ffffff', fontWeight: 800 }}>₱6,500</td>
                  <td style={{ padding: '14px', textAlign: 'right' }}>
                    <button onClick={navigateToRegister} className="ksyn-btn ksyn-btn-outline" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                      Enroll &rarr;
                    </button>
                  </td>
                </tr>

                {/* 6 Months */}
                <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '14px', fontWeight: 700, color: '#ffffff' }}>
                    6 Months Pass <span style={{ fontSize: '0.6875rem', background: '#222', color: '#7fa36d', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>Best Value</span>
                  </td>
                  <td style={{ padding: '14px', color: '#9ca3af' }}>180 Days</td>
                  <td style={{ padding: '14px', color: '#ffffff', fontWeight: 600 }}>₱8,400</td>
                  <td style={{ padding: '14px', color: '#d1d5db' }}>₱1,000</td>
                  <td style={{ padding: '14px', color: '#d1d5db' }}>₱1,000</td>
                  <td style={{ padding: '14px', color: '#ffffff', fontWeight: 800 }}>₱10,400</td>
                  <td style={{ padding: '14px', textAlign: 'right' }}>
                    <button onClick={navigateToRegister} className="ksyn-btn ksyn-btn-outline" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                      Enroll &rarr;
                    </button>
                  </td>
                </tr>

                {/* 12 Months */}
                <tr style={{ background: 'rgba(225, 194, 86, 0.05)' }}>
                  <td style={{ padding: '14px', fontWeight: 800, color: '#e1c256' }}>
                    12 Months Annual Elite <span style={{ fontSize: '0.6875rem', background: '#e1c256', color: '#000', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>Annual Perks <Star size={10} className="fill-black text-black" /> Fee Waived</span>
                  </td>
                  <td style={{ padding: '14px', color: '#d1d5db', fontWeight: 600 }}>365 Days</td>
                  <td style={{ padding: '14px', color: '#ffffff', fontWeight: 700 }}>₱15,000</td>
                  <td style={{ padding: '14px', color: '#d1d5db' }}>₱1,000</td>
                  <td style={{ padding: '14px', color: '#658256', fontWeight: 700 }}>₱0 (WAIVED)</td>
                  <td style={{ padding: '14px', color: '#e1c256', fontWeight: 900, fontSize: '1.0625rem' }}>₱16,000</td>
                  <td style={{ padding: '14px', textAlign: 'right' }}>
                    <button onClick={navigateToRegister} className="ksyn-btn ksyn-btn-gold" style={{ padding: '6px 16px', fontSize: '0.75rem', fontWeight: 800 }}>
                      Enroll &rarr;
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 5. NEW: SIGNATURE GROUP FITNESS CLASSES SECTION (#classes) */}
      <section id="classes" style={{
        padding: '96px 24px',
        background: 'linear-gradient(180deg, #0d0d0d 0%, #080808 100%)',
        borderTop: '1px solid #1c1c1c',
        borderBottom: '1px solid #1c1c1c'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#e1c256',
              fontSize: '0.8125rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '10px'
            }}>
              <Flame size={16} /> Dynamic Group Training
            </div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '14px' }}>
              Signature Group Fitness Classes
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '1.0625rem', maxWidth: '720px', margin: '0 auto', lineHeight: 1.6 }}>
              Ignite your conditioning with high-energy, coach-led workouts built for every fitness background. From explosive power circuits to restorative breathwork.
            </p>
          </div>

          {/* 4 Featured Class Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '28px',
            alignItems: 'stretch'
          }}>
            {/* Class 1: Yoga & Recovery */}
            <div className="ksyn-card" style={{
              padding: '32px 28px',
              background: '#121212',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderTop: '4px solid #658256',
              borderRadius: '14px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'rgba(101, 130, 86, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Heart size={22} color="#658256" />
                  </div>
                  <span style={{
                    fontSize: '0.6875rem',
                    background: 'rgba(101, 130, 86, 0.15)',
                    color: '#658256',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    All Levels
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Clock size={14} color="#9ca3af" />
                  <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 600 }}>50–60 mins</span>
                </div>

                <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#ffffff', marginBottom: '12px' }}>
                  Yoga & Recovery
                </h3>

                <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '20px' }}>
                  Vinyasa flow, mobility drills, core balance, and guided post-workout stretch sessions. Designed to decompress joints and accelerate muscular recovery.
                </p>

                <div style={{ borderTop: '1px solid #222', paddingTop: '16px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '10px' }}>
                    Targeted Benefits:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem', color: '#d1d5db' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#658256" /> Spinal decompression & hip mobility
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#658256" /> Central nervous system recovery
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#658256" /> Core stability & postural alignment
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <button
                  onClick={navigateToRegister}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    borderColor: '#2e2e2e',
                    marginBottom: '8px'
                  }}
                >
                  Enroll / Book Class
                </button>
                <div style={{ fontSize: '0.6875rem', color: '#6b7280', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>Included with Black Elite & Multi-Pass Memberships</span>
                </div>
              </div>
            </div>

            {/* Class 2: HIIT */}
            <div className="ksyn-card" style={{
              padding: '32px 28px',
              background: '#121212',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderTop: '4px solid #ef4444',
              borderRadius: '14px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Flame size={22} color="#ef4444" />
                  </div>
                  <span style={{
                    fontSize: '0.6875rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    High Intensity
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Clock size={14} color="#9ca3af" />
                  <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 600 }}>45–50 mins</span>
                </div>

                <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#ffffff', marginBottom: '12px' }}>
                  HIIT Conditioning
                </h3>

                <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '20px' }}>
                  Fast-paced athletic conditioning, kettlebell circuits, and functional endurance protocols. Push your anaerobic threshold for maximum post-workout caloric burn.
                </p>

                <div style={{ borderTop: '1px solid #222', paddingTop: '16px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '10px' }}>
                    Targeted Benefits:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem', color: '#d1d5db' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#ef4444" /> Accelerated EPOC metabolic burn
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#ef4444" /> Aerobic & anaerobic work capacity
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#ef4444" /> Explosive full-body power output
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <button
                  onClick={navigateToRegister}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    borderColor: '#2e2e2e',
                    marginBottom: '8px'
                  }}
                >
                  Enroll / Book Class
                </button>
                <div style={{ fontSize: '0.6875rem', color: '#6b7280', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>Included with Black Elite & Multi-Pass Memberships</span>
                </div>
              </div>
            </div>

            {/* Class 3: Zumba & Dance Cardio */}
            <div className="ksyn-card" style={{
              padding: '32px 28px',
              background: '#121212',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderTop: '4px solid #e1c256',
              borderRadius: '14px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'rgba(225, 194, 86, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Music size={22} color="#e1c256" />
                  </div>
                  <span style={{
                    fontSize: '0.6875rem',
                    background: 'rgba(225, 194, 86, 0.15)',
                    color: '#e1c256',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Moderate to High
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Clock size={14} color="#9ca3af" />
                  <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 600 }}>55–60 mins</span>
                </div>

                <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#ffffff', marginBottom: '12px' }}>
                  Zumba & Dance Cardio
                </h3>

                <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '20px' }}>
                  High-energy rhythmic cardio, full-body burn, and infectious choreography led by certified instructors. An exhilarating musical workout for all fitness levels.
                </p>

                <div style={{ borderTop: '1px solid #222', paddingTop: '16px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '10px' }}>
                    Targeted Benefits:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem', color: '#d1d5db' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#e1c256" /> 500+ Calorie cardiovascular burn
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#e1c256" /> Coordination, agility & rhythm
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#e1c256" /> Endorphin boost & stress relief
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <button
                  onClick={navigateToRegister}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    borderColor: '#2e2e2e',
                    marginBottom: '8px'
                  }}
                >
                  Enroll / Book Class
                </button>
                <div style={{ fontSize: '0.6875rem', color: '#6b7280', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>Included with Black Elite & Multi-Pass Memberships</span>
                </div>
              </div>
            </div>

            {/* Class 4: Boxing & Strike Conditioning */}
            <div className="ksyn-card" style={{
              padding: '32px 28px',
              background: '#121212',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderTop: '4px solid #e1c256',
              borderRadius: '14px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: 'rgba(225, 194, 86, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Target size={22} color="#e1c256" />
                  </div>
                  <span style={{
                    fontSize: '0.6875rem',
                    background: 'rgba(225, 194, 86, 0.15)',
                    color: '#e1c256',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    High Intensity
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Clock size={14} color="#9ca3af" />
                  <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 600 }}>45–60 mins</span>
                </div>

                <h3 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#ffffff', marginBottom: '12px' }}>
                  Boxing & Strike
                </h3>

                <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '20px' }}>
                  Heavy-bag combos, pad work, agility footwork, and stress-relief kickboxing drills. Hone technical punch speed and build rotational core strength.
                </p>

                <div style={{ borderTop: '1px solid #222', paddingTop: '16px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '10px' }}>
                    Targeted Benefits:
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem', color: '#d1d5db' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#e1c256" /> Striking speed, power & precision
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#e1c256" /> Rotational torso & shoulder endurance
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={14} color="#e1c256" /> Footwork agility & mental toughness
                    </li>
                  </ul>
                </div>
              </div>

              <div>
                <button
                  onClick={navigateToRegister}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    borderColor: '#2e2e2e',
                    marginBottom: '8px'
                  }}
                >
                  Enroll / Book Class
                </button>
                <div style={{ fontSize: '0.6875rem', color: '#6b7280', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>Included with Black Elite & Multi-Pass Memberships</span>
                </div>
              </div>
            </div>
          </div>

          {/* Health & Caloric Burn Disclaimer */}
          <div style={{
            marginTop: '36px',
            padding: '16px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid #222222',
            borderRadius: '10px',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#9ca3af',
            lineHeight: 1.5
          }}>
            <strong style={{ color: '#d1d5db' }}>Health & Physiological Disclaimer:</strong> Caloric expenditure and physical conditioning outcomes vary per individual based on effort, body composition, and baseline metabolism. Consult a licensed physician prior to beginning any high-intensity athletic conditioning or functional barbell program.
          </div>
        </div>
      </section>

      {/* 6. LOCATIONS / CLUB NETWORK SECTION (#locations) */}
      <section
        id="locations"
        style={{
          padding: '96px 0',
          borderTop: '1px solid #1f232b',
          borderBottom: '1px solid #1f232b',
          backgroundColor: '#090a0d',
          width: '100%'
        }}
      >
        {/* CENTERED CONTAINER WITH GENEROUS LEFT AND RIGHT MARGINS */}
        <div
          style={{
            maxWidth: '1180px',
            margin: '0 auto',
            padding: '0 32px',
            boxSizing: 'border-box'
          }}
        >
          {/* Section Header */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#e1c256',
                fontSize: '0.75rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '10px'
              }}
            >
              <MapPin size={14} color="#e1c256" /> OUR LOCATIONS
            </div>
            <h2
              style={{
                fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '-0.02em',
                margin: '0 0 10px 0'
              }}
            >
              7 Clubs Across Metro Manila • Nationwide Expansion
            </h2>
            <p
              style={{
                color: '#9ca3af',
                fontSize: '0.9375rem',
                maxWidth: '640px',
                margin: '0 auto',
                lineHeight: 1.6
              }}
            >
              Modern strength and conditioning facilities across Metro Manila, with nationwide franchise expansion underway in key growth hubs including Cebu and Davao.
            </p>

            {/* District Filter Pills */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                marginTop: '28px',
                marginBottom: '12px'
              }}
            >
              {DISTRICT_TABS.map((tab) => {
                const isActive = selectedDistrict === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedDistrict(tab)}
                    style={{
                      height: '34px',
                      padding: '0 16px',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 800 : 600,
                      cursor: 'pointer',
                      border: isActive ? '1px solid #e1c256' : '1px solid #222733',
                      backgroundColor: isActive ? '#e1c256' : '#12151d',
                      color: isActive ? '#000000' : '#9ca3af',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7-Branch Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              alignItems: 'stretch'
            }}
          >
            {BRANCH_DIRECTORY.filter((b) => {
              if (selectedDistrict === 'All Districts') return true;
              return b.district === selectedDistrict;
            }).map((b) => {
              const isFlagship = b.status?.includes('Flagship');
              const isRebranding = b.status?.includes('Rebranding');
              const isOpeningSoon = !b.is_active || b.status?.includes('Opening Soon');

              const statusBadgeBg = isFlagship
                ? 'rgba(225, 194, 86, 0.12)'
                : isRebranding
                ? 'rgba(225, 194, 86, 0.12)'
                : isOpeningSoon
                ? 'rgba(113, 113, 122, 0.2)'
                : 'rgba(101, 130, 86, 0.12)';

              const statusBadgeColor = isFlagship
                ? '#e1c256'
                : isRebranding
                ? '#fbbf24'
                : isOpeningSoon
                ? '#a1a1aa'
                : '#7fa36d';

              const statusBadgeBorder = isFlagship
                ? '1px solid rgba(225, 194, 86, 0.35)'
                : isRebranding
                ? '1px solid rgba(225, 194, 86, 0.35)'
                : isOpeningSoon
                ? '1px solid rgba(113, 113, 122, 0.4)'
                : '1px solid rgba(101, 130, 86, 0.35)';

              const statusText = isOpeningSoon
                ? 'Opening Soon'
                : isRebranding
                ? 'Rebranding'
                : isFlagship
                ? 'Active Flagship'
                : 'Active';

              return (
                <div
                  key={b.id}
                  style={{
                    backgroundColor: '#12151e', // Tactile surface color with clear contrast!
                    border: isFlagship ? '1px solid rgba(225, 194, 86, 0.4)' : '1px solid #1f2533',
                    borderRadius: '16px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                    transition: 'border-color 0.2s ease, transform 0.2s ease'
                  }}
                >
                  <div>
                    {/* Top Row: Code + Status Badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: '12px'
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: '#181d28',
                          color: '#e1c256',
                          border: '1px solid rgba(225, 194, 86, 0.3)',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          fontSize: '0.6875rem',
                          fontFamily: 'monospace',
                          fontWeight: 800
                        }}
                      >
                        {b.code}
                      </span>
                      <span
                        style={{
                          backgroundColor: statusBadgeBg,
                          color: statusBadgeColor,
                          border: statusBadgeBorder,
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        {statusText}
                      </span>
                    </div>

                    {/* Branch Title & District */}
                    <h3
                      style={{
                        fontSize: '1.125rem',
                        fontWeight: 800,
                        color: '#ffffff',
                        margin: '0 0 4px 0',
                        letterSpacing: '-0.01em'
                      }}
                    >
                      {b.name}
                    </h3>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#9ca3af',
                        fontWeight: 500,
                        marginBottom: '16px'
                      }}
                    >
                      {b.district}
                    </div>

                    {/* Inset Information Box */}
                    <div
                      style={{
                        backgroundColor: '#0a0d13',
                        border: '1px solid #1a202c',
                        borderRadius: '10px',
                        padding: '14px',
                        marginBottom: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: '#d1d5db' }}>
                        <MapPin size={14} color="#e1c256" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span style={{ lineHeight: 1.45 }}>{b.location}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: '#e5e7eb' }}>
                        <Clock size={14} color="#e1c256" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span style={{ fontWeight: 600 }}>{b.operating_hours}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#9ca3af' }}>
                        <Phone size={13} color="#6b7280" style={{ flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace' }}>{b.phone}</span>
                      </div>
                    </div>

                    {/* Feature Chips */}
                    {b.features && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                          marginBottom: '20px'
                        }}
                      >
                        {b.features.map((feat, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 600,
                              backgroundColor: '#171c26',
                              color: '#9ca3af',
                              border: '1px solid #232b3a',
                              padding: '3px 8px',
                              borderRadius: '4px'
                            }}
                          >
                            {feat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons (100% Readable with High Contrast) */}
                  <div
                    style={{
                      paddingTop: '16px',
                      borderTop: '1px solid #1a202c'
                    }}
                  >
                    {b.is_active ? (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {/* Secondary Button: Free Pass */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFreePassBranch(b.id);
                            setShowFreePassModal(true);
                          }}
                          style={{
                            flex: 1,
                            height: '38px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid #374151',
                            color: '#f3f4f6', // Crisp off-white text!
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#e1c256';
                            e.currentTarget.style.color = '#e1c256';
                            e.currentTarget.style.backgroundColor = 'rgba(225, 194, 86, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#374151';
                            e.currentTarget.style.color = '#f3f4f6';
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                          }}
                        >
                          Free Pass
                        </button>

                        {/* Primary Button: Join Club */}
                        <button
                          type="button"
                          onClick={() => openAuthModal('register')}
                          style={{
                            flex: 1,
                            height: '38px',
                            borderRadius: '8px',
                            backgroundColor: '#e1c256',
                            border: '1px solid #e1c256',
                            color: '#000000', // Bold black text on gold!
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 10px rgba(225, 194, 86, 0.25)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e0b210';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#e1c256';
                          }}
                        >
                          Join Club
                        </button>
                      </div>
                    ) : (
                      /* Pipeline Waitlist Button */
                      <button
                        type="button"
                        onClick={() => openAuthModal('register')}
                        style={{
                          width: '100%',
                          height: '38px',
                          borderRadius: '8px',
                          backgroundColor: '#161a22',
                          border: '1px solid #28303f',
                          color: '#9ca3af',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#4b5563';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#28303f';
                          e.currentTarget.style.color = '#9ca3af';
                        }}
                      >
                        Pipeline • Join Priority Waitlist
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. FRANCHISE OPPORTUNITY SECTION (#franchise) */}
      <section id="franchise" style={{ padding: '96px 24px', maxWidth: '1240px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#e1c256',
            fontSize: '0.8125rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '10px'
          }}>
            <TrendingUp size={16} /> Franchise Partnership
          </div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '14px' }}>
            Invest in the Future of Fitness Franchising
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '1.0625rem', maxWidth: '700px', margin: '0 auto', lineHeight: 1.6 }}>
            Partner with our commercial fitness franchise network. Benefit from standardized operations, turnkey gym facility planning, and multi-tenant management systems.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'start' }}>
          {/* Left Column: Value Propositions */}
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '20px', color: '#ffffff' }}>
              Why Franchise with KSYN Fitness?
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '0.9375rem', lineHeight: 1.65, marginBottom: '32px' }}>
              We have eliminated the guesswork from commercial gym ownership. As a KSYN franchise partner, you receive end-to-end operational support, proven equipment procurement rates, and cutting-edge member retention systems.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(225, 194, 86, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Building2 size={22} color="#e1c256" />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '4px' }}>
                    ₱500k Franchise Fee & ₱4M–₱10M+ CapEx Roadmap
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', lineHeight: 1.6 }}>
                    Clear financial architecture with a ₱500,000 initial franchise fee and total CapEx scaled for 450 sqm to 900+ sqm premium commercial facilities.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(101, 130, 86, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Dumbbell size={22} color="#7fa36d" />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '4px' }}>
                    Commercial Equipment Fleet Procurement (LGNDRY & HYROX)
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', lineHeight: 1.6 }}>
                    Direct procurement pipelines for high-end LGNDRY plate-loaded and pin-selected machines, functional HYROX turf zones, and cardio deck.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(247, 255, 196, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <ShieldCheck size={22} color="#f7ffc4" />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '4px' }}>
                    Turnstile, Dual RFID / QR Access & POS Integration
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', lineHeight: 1.6 }}>
                    Integrated turnstile hardware, physical RFID keycard management, dynamic 60s QR passes, and front-desk POS cashier terminals.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(225, 194, 86, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Users size={22} color="#e1c256" />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '4px' }}>
                    Staff Onboarding, Operations & National Marketing
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: '#9ca3af', lineHeight: 1.6 }}>
                    Comprehensive training for coaches, desk staff, and managers, paired with nationwide marketing campaigns and pre-opening membership drives.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Inquiry Form */}
          <div className="ksyn-card" style={{
            padding: '36px',
            background: '#141414',
            borderColor: '#262626',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.6)'
          }}>
            {formSubmitted ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(225, 194, 86, 0.15)',
                  border: '2px solid #e1c256',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px auto'
                }}>
                  <CheckCircle2 size={32} color="#e1c256" />
                </div>
                <h3 style={{ fontSize: '1.375rem', fontWeight: 900, marginBottom: '8px', color: '#ffffff' }}>
                  Franchise Inquiry Received
                </h3>
                <p style={{ color: '#9ca3af', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '28px', maxWidth: '520px', margin: '0 auto 28px auto' }}>
                  Thank you, <strong>{franchiseForm.fullName}</strong>. Our Franchise Development team will reach out to you at <strong>{franchiseForm.email}</strong> within 24 hours. Here is your onboarding roadmap:
                </p>
                {/* 6-Step Roadmap displayed ONLY after submission */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  textAlign: 'left',
                  marginBottom: '28px'
                }}>
                  {[
                    { step: '01', title: 'Inquiry & Screening', desc: 'Application review and initial background screening.' },
                    { step: '02', title: 'Discovery Call', desc: 'Brand alignment and financial capability evaluation.' },
                    { step: '03', title: 'Site Inspection', desc: 'Foot traffic, structural footprint (450–900+ sqm), and feasibility check.' },
                    { step: '04', title: 'Agreement Signing', desc: 'Remittance of ₱500k franchise fee and legal contract execution.' },
                    { step: '05', title: 'Fit-Out & Installation', desc: 'Architectural build-out, LGNDRY equipment delivery, and POS/turnstile setup.' },
                    { step: '06', title: 'Grand Opening', desc: 'Staff onboarding, digital pre-selling, and official launch.' }
                  ].map((s) => (
                    <div
                      key={s.step}
                      style={{
                        background: '#0e1117',
                        border: '1px solid #1f2533',
                        borderRadius: '8px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <span style={{
                        fontSize: '0.6875rem',
                        fontFamily: 'monospace',
                        fontWeight: 900,
                        color: '#e1c256',
                        background: 'rgba(225, 194, 86, 0.1)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        width: 'fit-content'
                      }}>
                        STEP {s.step}
                      </span>
                      <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                        {s.title}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.4, margin: 0 }}>
                        {s.desc}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setFormSubmitted(false);
                    setFranchiseForm({
                      fullName: '',
                      email: '',
                      phone: '',
                      targetLocation: 'Makati CBD',
                      customRegionDetail: '',
                      investmentCapital: '₱4,000,000 – ₱6,000,000',
                      notes: ''
                    });
                    setAgreedToTerms(false);
                  }}
                  className="ksyn-btn ksyn-btn-outline"
                  style={{ padding: '8px 20px', fontSize: '0.8125rem', borderColor: '#333' }}
                >
                  Submit Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit}>
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '6px' }}>
                    Tell us more about your interest in opening a KSYN Fitness franchise with us
                  </h3>
                  <p style={{ color: '#9ca3af', fontSize: '0.8125rem' }}>
                    Complete the form below to receive detailed unit economics, ROI projections, and available territory maps across Metro Manila and key nationwide expansion hubs (including Cebu, Davao, and regional centers).
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#d1d5db' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Roberto Gomez"
                      value={franchiseForm.fullName}
                      onChange={(e) => setFranchiseForm({ ...franchiseForm, fullName: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        background: '#0a0a0a',
                        border: '1px solid #2e2e2e',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#e1c256')}
                      onBlur={(e) => (e.target.style.borderColor = '#2e2e2e')}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#d1d5db' }}>
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="investor@example.com"
                        value={franchiseForm.email}
                        onChange={(e) => setFranchiseForm({ ...franchiseForm, email: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          background: '#0a0a0a',
                          border: '1px solid #2e2e2e',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '0.875rem',
                          outline: 'none'
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#e1c256')}
                        onBlur={(e) => (e.target.style.borderColor = '#2e2e2e')}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#d1d5db' }}>
                        Contact Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+63 917 123 4567"
                        value={franchiseForm.phone}
                        onChange={(e) => setFranchiseForm({ ...franchiseForm, phone: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          background: '#0a0a0a',
                          border: '1px solid #2e2e2e',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '0.875rem',
                          outline: 'none'
                        }}
                        onFocus={(e) => (e.target.style.borderColor = '#e1c256')}
                        onBlur={(e) => (e.target.style.borderColor = '#2e2e2e')}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#d1d5db' }}>
                      Target Branch Location *
                    </label>
                    <select
                      value={franchiseForm.targetLocation}
                      onChange={(e) => setFranchiseForm({ ...franchiseForm, targetLocation: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        background: '#0a0a0a',
                        border: '1px solid #2e2e2e',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="Makati CBD">Makati Central Business District</option>
                      <option value="Quezon City">Quezon City (Diliman / Tomas Morato)</option>
                      <option value="Alabang / South Metro">Alabang / Muntinlupa / Parañaque</option>
                      <option value="Ortigas / Pasig">Ortigas Center / Pasig City</option>
                      <option value="Cebu IT Park">Cebu City / IT Park</option>
                      <option value="Davao City">Davao City (Lanang / Ecoland)</option>
                      <option value="Other Metro City / Regional Province">Other Metro City / Regional Province</option>
                    </select>

                    {/* Conditional City/Region Filler Field */}
                    {(franchiseForm.targetLocation === 'Other Metro City / Regional Province' || franchiseForm.targetLocation?.includes('Other')) && (
                      <div className="mt-3 animate-fadeIn" style={{ marginTop: '12px' }}>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '4px' }}>
                          Please specify your Target City, Municipality, or Preferred Commercial Hub *
                        </label>
                        <input
                          type="text"
                          name="customRegionDetail"
                          required
                          value={franchiseForm.customRegionDetail || ''}
                          onChange={(e) => setFranchiseForm({ ...franchiseForm, customRegionDetail: e.target.value })}
                          placeholder="e.g., Davao City, Cebu IT Park, Iloilo Business Park, Clark Pampanga"
                          className="w-full bg-[#1A1A1A] border border-[#333333] rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:border-[#e1c256] focus:outline-none transition-colors text-sm"
                          style={{
                            width: '100%',
                            backgroundColor: '#1A1A1A',
                            border: '1px solid #333333',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            color: '#ffffff',
                            fontSize: '0.875rem',
                            outline: 'none'
                          }}
                        />
                        <p className="text-[11px] text-gray-500 mt-1" style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                          Our expansion team evaluates territory viability based on commercial density and foot traffic metrics.
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#d1d5db' }}>
                      Estimated Investment Capital
                    </label>
                    <select
                      value={franchiseForm.investmentCapital}
                      onChange={(e) => setFranchiseForm({ ...franchiseForm, investmentCapital: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        background: '#0a0a0a',
                        border: '1px solid #2e2e2e',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="₱4,000,000 – ₱6,000,000 (450–600 sqm Standard Commercial Hub)">₱4,000,000 – ₱6,000,000 (450–600 sqm Standard Commercial Hub)</option>
                      <option value="₱6,000,000 – ₱10,000,000 (600–900 sqm High-Density Club)">₱6,000,000 – ₱10,000,000 (600–900 sqm High-Density Club)</option>
                      <option value="₱10,000,000+ (900+ sqm Multi-Zone Flagship Center)">₱10,000,000+ (900+ sqm Multi-Zone Flagship Center)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#d1d5db' }}>
                      Comments or Proposed Site (Optional)
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Brief details regarding commercial space availability, prior retail experience, etc."
                      value={franchiseForm.notes}
                      onChange={(e) => setFranchiseForm({ ...franchiseForm, notes: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        background: '#0a0a0a',
                        border: '1px solid #2e2e2e',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#e1c256')}
                      onBlur={(e) => (e.target.style.borderColor = '#2e2e2e')}
                    />
                  </div>

                  {/* Unbundled Franchise Terms & Privacy Consent */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    {/* Checkbox 1: Terms */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <input
                        type="checkbox"
                        id="franchise-terms-checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        style={{ marginTop: '3px', accentColor: '#e1c256', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <label htmlFor="franchise-terms-checkbox" style={{ cursor: 'pointer' }}>
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>
                          By submitting this application, I accept the{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowFranchiseTerms(true);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#e1c256',
                              textDecoration: 'underline',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            KSYN Franchise Terms & Conditions
                          </button>. *
                        </p>
                      </label>
                    </div>

                    {/* Checkbox 2: Privacy */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <input
                        type="checkbox"
                        id="franchise-privacy-checkbox"
                        checked={agreedToPrivacy}
                        onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                        style={{ marginTop: '3px', accentColor: '#e1c256', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <label htmlFor="franchise-privacy-checkbox" style={{ cursor: 'pointer' }}>
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>
                          I consent to the collection and processing of my corporate and contact data pursuant to the{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowPrivacyModal(true);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#e1c256',
                              textDecoration: 'underline',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            KSYN Privacy Policy (RA 10173)
                          </button>. *
                        </p>
                      </label>
                    </div>
                  </div>

                  {/* Franchise Commercial Disclosure */}
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid #222222',
                    borderRadius: '8px',
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                    lineHeight: 1.45
                  }}>
                    <strong style={{ color: '#d1d5db' }}>Commercial Disclosure:</strong> Historical figures, capital investment ranges, and revenue splits are illustrative for preliminary evaluation and do not constitute a financial guarantee of future profits. Territory reservations are subject to feasibility review and signed licensing agreements.
                  </div>

                  <button
                    id="submit-franchise-inquiry-btn"
                    type="submit"
                    className="ksyn-btn ksyn-btn-gold"
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: '1rem',
                      fontWeight: 800,
                      marginTop: '8px'
                    }}
                  >
                    <Send size={16} /> Submit Franchise Inquiry
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* 8. PRE-FOOTER CALL TO ACTION */}
      <section style={{
        padding: '72px 24px',
        maxWidth: '1000px',
        margin: '0 auto 64px auto',
        textAlign: 'center'
      }}>
        <div className="ksyn-card" style={{
          padding: '52px 36px',
          background: 'linear-gradient(135deg, #181818 0%, #101010 100%)',
          borderColor: 'rgba(225, 194, 86, 0.4)',
          borderRadius: '20px',
          boxShadow: '0 12px 50px rgba(0, 0, 0, 0.8)'
        }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '14px' }}>
            Ready to Transform Your Fitness Journey?
          </h2>
          <p style={{ color: '#9ca3af', fontSize: '1rem', maxWidth: '560px', margin: '0 auto 32px auto', lineHeight: 1.6 }}>
            Join thousands of active members across KSYN Fitness commercial facilities. Enjoy extended club access (6:00 AM – 12:00 AM Daily) with instant in-app digital pass entry.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              id="cta-join-now-btn"
              onClick={navigateToRegister}
              className="ksyn-btn ksyn-btn-gold"
              style={{ padding: '14px 34px', fontSize: '1rem', fontWeight: 800, boxShadow: '0 0 20px rgba(225, 194, 86, 0.4)' }}
            >
              Sign Up / Join KSYN Now
            </button>
            <button
              id="cta-signin-btn"
              onClick={navigateToLogin}
              className="ksyn-btn ksyn-btn-outline"
              style={{ padding: '14px 28px', fontSize: '1rem', fontWeight: 700, borderColor: '#333' }}
            >
              Sign In to Member Portal
            </button>
          </div>
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer style={{
        borderTop: '1px solid #1f1f1f',
        padding: '64px 24px 32px 24px',
        background: '#0a0a0a',
        color: '#6b7280',
        fontSize: '0.875rem'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '40px',
          marginBottom: '48px'
        }}>
          {/* Col 1: Brand Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <img
                src="/ksyn-logo.png"
                alt="KSYN Gym Logo"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  objectFit: 'contain'
                }}
              />
              <span style={{ fontWeight: 900, fontSize: '1.125rem', color: '#ffffff', letterSpacing: '-0.02em' }}>
                KSYN <span style={{ color: '#e1c256' }}>FITNESS</span>
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', lineHeight: 1.6, marginBottom: '16px' }}>
              The gold standard in commercial strength facilities, dynamic group fitness classes, and nationwide digital franchise networks across the Philippines.
            </p>
            <div style={{ display: 'flex', gap: '14px', fontSize: '0.8125rem', color: '#d1d5db' }}>
              <span>Instagram</span>
              <span>Facebook</span>
              <span>YouTube</span>
              <span>LinkedIn</span>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
              Explore KSYN
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
              <li>
                <a href="#memberships" onClick={(e) => scrollToSection(e, 'memberships')} style={{ color: '#9ca3af', textDecoration: 'none' }}>
                  Membership Tiers
                </a>
              </li>
              <li>
                <a href="#classes" onClick={(e) => scrollToSection(e, 'classes')} style={{ color: '#9ca3af', textDecoration: 'none' }}>
                  Signature Group Classes
                </a>
              </li>
              <li>
                <a href="#franchise" onClick={(e) => scrollToSection(e, 'franchise')} style={{ color: '#9ca3af', textDecoration: 'none' }}>
                  Franchise Opportunities
                </a>
              </li>
              <li>
                <a href="#locations" onClick={(e) => scrollToSection(e, 'locations')} style={{ color: '#9ca3af', textDecoration: 'none' }}>
                  Club Locations & Amenities
                </a>
              </li>
              <li>
                <a href="#about" onClick={(e) => scrollToSection(e, 'about')} style={{ color: '#9ca3af', textDecoration: 'none' }}>
                  About Our Network
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Contact & Support */}
          <div>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
              Contact & Inquiries
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem', color: '#9ca3af' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={14} color="#e1c256" /> franchise@ksynfitness.com
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={14} color="#e1c256" /> support@ksynfitness.com
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} color="#e1c256" /> (02) 8800-KSYN (5796)
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MapPin size={14} color="#e1c256" style={{ marginTop: '2px', flexShrink: 0 }} /> HQ: Alphaland Makati Place, Ayala Ave. Ext. corner Malugay St., Makati City, Metro Manila
              </li>
            </ul>
          </div>

          {/* Col 4: Portals & Legal */}
          <div>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
              Access & Legal
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8125rem' }}>
              <li>
                <a
                  href="#login"
                  id="footer-existing-member-login"
                  onClick={(e) => { e.preventDefault(); openAuthModal('login'); }}
                  style={{ color: '#e1c256', textDecoration: 'none', fontWeight: 700 }}
                >
                  Existing Member Sign In &rarr;
                </a>
              </li>
              <li>
                <a
                  href="#register"
                  id="footer-join-now-link"
                  onClick={(e) => { e.preventDefault(); openAuthModal('register'); }}
                  style={{ color: '#d1d5db', textDecoration: 'none', fontSize: '0.8125rem' }}
                >
                  Join / Sign Up as New Member &rarr;
                </a>
              </li>
              <li>
                <a
                  href="/login"
                  onClick={(e) => { e.preventDefault(); openAuthModal('login'); }}
                  style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.75rem' }}
                >
                  Staff & Admin Portal
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#9ca3af',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.target.style.color = '#e1c256')}
                  onMouseLeave={(e) => (e.target.style.color = '#9ca3af')}
                >
                  Privacy Policy (DPA 2012 Compliant)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#9ca3af',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.target.style.color = '#e1c256')}
                  onMouseLeave={(e) => (e.target.style.color = '#9ca3af')}
                >
                  Terms of Gym Service & Waiver
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setShowRefundModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#9ca3af',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.target.style.color = '#e1c256')}
                  onMouseLeave={(e) => (e.target.style.color = '#9ca3af')}
                >
                  Refund & Cancellation Policy (RA 7394)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setShowEulaModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#9ca3af',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.target.style.color = '#e1c256')}
                  onMouseLeave={(e) => (e.target.style.color = '#9ca3af')}
                >
                  End User License Agreement (EULA)
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Corporate Regulatory Disclosures */}
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          borderTop: '1px solid #1a1a1a',
          paddingTop: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: '0.75rem',
          color: '#6b7280'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              &copy; {new Date().getFullYear()} <strong>KSYN Fitness Inc.</strong> All rights reserved. Registered under Philippine Corporate & Commercial Law.
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ color: '#9ca3af' }}>SEC Reg. No. CS2024-08912</span>
              <span style={{ color: '#9ca3af' }}>BIR TIN: 009-842-192-000 VAT Reg.</span>
              <span style={{ color: '#9ca3af' }}>DTI Certificate No. 4910284</span>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', lineHeight: 1.5 }}>
            Data Protection Office: <span style={{ color: '#e1c256' }}>dpo@ksynfitness.com</span> • Consumer Care & Grievances: <span style={{ color: '#e1c256' }}>support@ksynfitness.com</span> • Operating in strict compliance with RA 10173 (DPA 2012) and RA 7394 (Consumer Act of the Philippines).
          </div>
        </div>
      </footer>

      {/* Unified Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialTab={authModalTab}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={onNavigateLogin}
      />

      {/* Franchise Governance & Terms Modal */}
      <FranchiseTermsModal
        isOpen={showFranchiseTerms}
        onClose={() => setShowFranchiseTerms(false)}
        onAccept={() => {
          setAgreedToTerms(true);
          setShowFranchiseTerms(false);
        }}
      />

      {/* Free Pass 1-Day Trial Modal */}
      <FreePassModal
        isOpen={showFreePassModal}
        initialBranchId={selectedFreePassBranch}
        onClose={() => {
          setShowFreePassModal(false);
          setSelectedFreePassBranch(null);
        }}
      />

      {/* Free Pass Submission Confirmation Toast */}
      {freePassSuccessBanner && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 100,
            maxWidth: '460px',
            backgroundColor: '#121212',
            border: '1px solid #e1c256',
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.85), 0 0 24px rgba(225, 194, 86, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            color: '#f3f4f6'
          }}
        >
          <div style={{
            background: 'rgba(225, 194, 86, 0.15)',
            border: '1px solid rgba(225, 194, 86, 0.35)',
            borderRadius: '10px',
            padding: '8px',
            color: '#e1c256',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px'
          }}>
            <CheckCircle2 size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#e1c256', marginBottom: '4px' }}>
              Raffle Entry Submitted!
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#d1d5db', lineHeight: 1.5 }}>
              Your entry for a free 1-day pass has been submitted! If selected by the branch admin for this month's pass, an access pass and details will be sent directly to your email.
            </p>
          </div>
          <button
            onClick={() => setFreePassSuccessBanner(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Legal & Governance Modals */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onAccept={() => {
          setAgreedToPrivacy(true);
          setShowPrivacyModal(false);
        }}
      />

      <TermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setAgreedToTerms(true);
          setShowTermsModal(false);
        }}
      />

      <RefundPolicyModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
      />

      <EulaModal
        isOpen={showEulaModal}
        onClose={() => setShowEulaModal(false)}
      />

      {/* Floating Cookie & Local Storage Consent Banner */}
      <CookieConsentBanner
        onOpenPrivacyPolicy={() => setShowPrivacyModal(true)}
      />
    </div>
  );
}
