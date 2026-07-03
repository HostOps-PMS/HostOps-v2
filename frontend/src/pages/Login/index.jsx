import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import LoginOTPForm from './components/LoginOTPForm';
import LoginTOTPForm from './components/LoginTOTPForm';
import LoginVerifyMethodForm from './components/LoginVerifyMethodForm';
import PropertySelectForm from './components/PropertySelectForm';
import PinModal from './components/PinModal';
import Message from './components/Message';
import bgImage from '../../assets/bg.png';
import hostOpsLogo from '../../assets/HostOpsLOGO.png';
import safeStorage from '../safeStorage';
import './Login.css';

const VIEWS = {
  LOGIN:                           'login',
  FORGOT:                          'forgot',
  LOGIN_VERIFY_METHOD:             'login_verify_method',
  LOGIN_OTP:                       'login_otp',
  LOGIN_TOTP:                      'login_totp',
  PROPERTY_SELECT:                 'property_select',
  PIN_MODAL:                       'pin_modal',
  CLIENT_ACCOUNT_PROPERTY_SELECT:  'client_account_property_select',
  CLIENT_ACCOUNT_PIN_MODAL:        'client_account_pin_modal',
};

const SLIDES = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
];

export default function LoginPage() {
  const [view,    setView]    = useState(VIEWS.LOGIN);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [otpData, setOtpData] = useState({ email: '', rememberMe: false, totpEnabled: false });
  const [backupMode, setBackupMode] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Stores the full auth payload returned after successful OTP verification.
  // Passed down to subsequent screens (PropertySelectForm, PinModal)
  // so they have access to the user object without re-fetching.
  const [authData, setAuthData] = useState(null);

  // Stores the single selected property ID after PropertySelectForm.
  // Passed to PinModal so staff PIN checks can include the property context.
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);

  const showMsg = (text, type = 'error') => setMessage({ text, type });
  const hideMsg = () => setMessage({ text: '', type: '' });

  const handleViewChange = (nextView) => {
    hideMsg();
    setView(nextView);
  };

  const handleAuthSuccess = (data) => {
    // Staff login response uses data.staff (no data.user).
    // Normalise so the rest of the flow always reads from data.user.
    if (data.isStaff && data.staff && !data.user) {
      data = { ...data, user: { ...data.staff, role: 'staff', isStaff: true } };
    }

    setAuthData(data);

    const role = data.user?.role;

    // ── Admin only → redirect straight to admin dashboard ─────────
    // team_leader and staff must go through property select + PIN first.
    // Previously team_leader was redirected here — that was the bug.
    if (data.isAdmin || role === 'admin') {
      showMsg(`Welcome, ${data.user.firstName || data.user.businessName}! Redirecting...`, 'success');
      setTimeout(() => {
        const dashboardBase = import.meta.env.VITE_DASHBOARD_URL || 'https://core.hostops.online';
        const params = new URLSearchParams({
          _t: data.accessToken,
          _u: JSON.stringify(data.user),
        });
        if (data.sk)         params.append('_sk', data.sk);
        if (data.rememberMe) params.append('_rm', 'true');
        window.location.href = `${dashboardBase}/admin#${params.toString()}`;
      }, 800);
      return;
    }

    // ── Team leader, staff, client → property select → PIN ────────
    // All three roles need to pick a property then verify their PIN
    // before reaching the dashboard.
    const displayName = data.user?.firstName || data.user?.businessName || '';
    showMsg(
      `Welcome${displayName ? `, ${displayName}` : ''}! Please select a property to continue.`,
      'success',
    );
    setView(VIEWS.PROPERTY_SELECT);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

const [showLogin, setShowLogin] = useState(window.innerWidth > 768);

  return (
    <div
      className="lp-wrap"
      style={{
        backgroundImage: window.innerWidth > 768 ? `url(${bgImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        minHeight: '100dvh',
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .lp-wrap {
            min-height: unset !important;
            height: fit-content !important;
            padding: 0 !important;
            align-items: flex-start !important;
            background: #fff !important;
          }
          html, body, #root {
            height: auto !important;
            min-height: unset !important;
            background: #fff !important;
          }
        }
      `}</style>
      <div className="lp-card">

        {/* ── LEFT: Slideshow Panel ── */}
        <div className="lp-slideshow">
          {SLIDES.map((src, i) => (
            <div
              key={i}
              className={`lp-slide${i === currentSlide ? ' active' : ''}`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
          <div className="lp-slide-overlay" />
          <div className="lp-slide-content">
            <div className="lp-slide-logo">
             <img src={hostOpsLogo} alt="HostOps" style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
              <span className="lp-slide-brand">HostOps</span>
            </div>
            <div>
              <div className="lp-slide-tagline">
                Your<br /> properties,<br /> <em>always</em><br /> in view.
              </div>
              <p className="lp-slide-sub">Real-time insights for every property you manage.</p>
              <div className="lp-slide-dots">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    className={`lp-slide-dot${i === currentSlide ? ' active' : ''}`}
                    onClick={() => setCurrentSlide(i)}
                  />
                ))}
              </div>
            </div>
          </div>
          {!showLogin && (
            <button className="lp-get-started-btn" onClick={() => setShowLogin(true)}>
              Get Started
            </button>
          )}
        </div>

        {/* ── RIGHT: Form Panel ── */}
        <div className={`lp-form-panel${showLogin ? ' lp-form-visible lp-form-slide-up' : ' lp-form-hidden'}`} style={!showLogin ? {display:'none'} : {}}>
          <Message text={message.text} type={message.type} />

          {view === VIEWS.LOGIN && (
            <LoginForm
              showMsg={showMsg}
              hideMsg={hideMsg}
              onForgot={() => handleViewChange(VIEWS.FORGOT)}
              onRequiresOtp={(email, rememberMe, totpEnabled) => {
                setOtpData({ email, rememberMe, totpEnabled });
                if (totpEnabled) {
                  handleViewChange(VIEWS.LOGIN_VERIFY_METHOD);
                  showMsg('Please verify your identity to continue.', 'success');
                } else {
                  handleViewChange(VIEWS.LOGIN_OTP);
                  showMsg('Please verify your device to continue.', 'success');
                }
              }}
              onClientAccountLogin={(data) => {
                // ── Client Account login ───────────────────────────────────────
                // Client accounts skip OTP. After login they go to
                // CLIENT_ACCOUNT_PROPERTY_SELECT where they pick one of their
                // parent client's embedded properties, then go through PIN_MODAL.
                setAuthData(data);
                showMsg(
                  `Welcome, ${data.clientAccount.firstName}! Please select a property to continue.`,
                  'success',
                );
                setView(VIEWS.CLIENT_ACCOUNT_PROPERTY_SELECT);
              }}
              onAuthSuccess={handleAuthSuccess}
            />
          )}

          {view === VIEWS.LOGIN_VERIFY_METHOD && (
            <LoginVerifyMethodForm
              email={otpData.email}
              onChooseTotp={() => { setBackupMode(false); handleViewChange(VIEWS.LOGIN_TOTP); }}
              onChooseEmail={() => handleViewChange(VIEWS.LOGIN_OTP)}
              onChooseBackup={() => { setBackupMode(true); handleViewChange(VIEWS.LOGIN_TOTP); }}
              onBack={() => handleViewChange(VIEWS.LOGIN)}
            />
          )}

          {view === VIEWS.LOGIN_OTP && (
            <LoginOTPForm
              email={otpData.email}
              rememberMe={otpData.rememberMe}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onBack={() => handleViewChange(otpData.totpEnabled ? VIEWS.LOGIN_VERIFY_METHOD : VIEWS.LOGIN)}
              onAuthSuccess={handleAuthSuccess}
            />
          )}

          {view === VIEWS.LOGIN_TOTP && (
            <LoginTOTPForm
              email={otpData.email}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onBack={() => handleViewChange(VIEWS.LOGIN_VERIFY_METHOD)}
              onAuthSuccess={handleAuthSuccess}
              backupMode={backupMode}
            />
          )}

          {view === VIEWS.PROPERTY_SELECT && (
            // ── Regular client / staff / team_leader property selection ───
            // After login (or OTP), user picks a property.
            // onPropertySelected is called with the selected property _id
            // and the name so we can store them and advance to PIN_MODAL.
            <PropertySelectForm
              userData={authData?.user}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onPropertySelected={(propertyId, propertyName) => {
                // FIX: Use safeStorage instead of sessionStorage.
                // sessionStorage is cleared on cross-origin redirects so
                // DashboardContext never saw the saved property, causing
                // showPropertySelector:true → redirect loop on every refresh.
                safeStorage.setItem('hp_selected_property_id',   propertyId);
                safeStorage.setItem('hp_selected_property_name', propertyName || '');
                setSelectedPropertyId(propertyId);
                hideMsg();
                setView(VIEWS.PIN_MODAL);
              }}
              onContinue={(propertyId) => {
                // Kept for safety — not triggered in normal flow since
                // PropertySelectForm now calls onPropertySelected instead.
                setSelectedPropertyId(propertyId);
                hideMsg();
                setView(VIEWS.PIN_MODAL);
              }}
              onBack={() => handleViewChange(VIEWS.LOGIN)}
            />
          )}

          {view === VIEWS.PIN_MODAL && (
            // ── PIN verification ───────────────────────────────────────────
            // After property selection, ALL user types must enter their PIN.
            //   - staff:        PIN verified against Staff model + property access check
            //   - client:       PIN verified against own User doc
            //   - team_leader:  PIN verified against their assigned client (serverId) User doc
            <PinModal
              userData={authData?.user}
              selectedPropertyId={selectedPropertyId}
              isStaff={authData?.isStaff || authData?.user?.role === 'staff' || false}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onBack={() => {
                hideMsg();
                setView(VIEWS.PROPERTY_SELECT);
              }}
            />
          )}

          {view === VIEWS.CLIENT_ACCOUNT_PROPERTY_SELECT && (
            // ── Client Account Property Selection ─────────────────────────────
            // isClientAccount=true so PropertySelectForm knows the context.
            // After property selection → CLIENT_ACCOUNT_PIN_MODAL.
            <PropertySelectForm
              userData={authData?.clientAccount}
              isClientAccount={true}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onPropertySelected={(propertyId, propertyName) => {
                // FIX: safeStorage instead of sessionStorage — same reason as above.
                safeStorage.setItem('hp_selected_property_id',   propertyId);
                safeStorage.setItem('hp_selected_property_name', propertyName || '');
                setSelectedPropertyId(propertyId);
                hideMsg();
                setView(VIEWS.CLIENT_ACCOUNT_PIN_MODAL);
              }}
              onContinue={(propertyId) => {
                // Kept for safety — not triggered in normal flow.
                setSelectedPropertyId(propertyId);
                hideMsg();
                setView(VIEWS.CLIENT_ACCOUNT_PIN_MODAL);
              }}
              onBack={() => handleViewChange(VIEWS.LOGIN)}
            />
          )}

          {view === VIEWS.CLIENT_ACCOUNT_PIN_MODAL && (
            // ── Client Account PIN verification ───────────────────────────
            // clientAccount sessions always have full property access — PIN only.
            <PinModal
              userData={authData?.clientAccount}
              selectedPropertyId={selectedPropertyId}
              isStaff={false}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onBack={() => {
                hideMsg();
                setView(VIEWS.CLIENT_ACCOUNT_PROPERTY_SELECT);
              }}
            />
          )}

          {view === VIEWS.FORGOT && (
            <ForgotPasswordForm
              showMsg={showMsg}
              onBack={() => handleViewChange(VIEWS.LOGIN)}
            />
          )}

          {/* Hide "Back to homepage" on property-select and PIN screens — those
              views have their own back navigation and the link looks cluttered. */}
          {view !== VIEWS.PROPERTY_SELECT &&
           view !== VIEWS.PIN_MODAL &&
           view !== VIEWS.CLIENT_ACCOUNT_PROPERTY_SELECT &&
           view !== VIEWS.CLIENT_ACCOUNT_PIN_MODAL &&
           view !== VIEWS.LOGIN_VERIFY_METHOD &&
           view !== VIEWS.LOGIN_TOTP && (
            <a href="https://hostops.online/" className="lp-back-home">
              ← Back to homepage
            </a>
          )}
        </div>

      </div>
    </div>
  );
}