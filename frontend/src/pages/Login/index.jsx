import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import LoginOTPForm from './components/LoginOTPForm';
import PropertySelectForm from './components/PropertySelectForm';
import DomainLoginForm from './components/DomainLoginForm';
import Message from './components/Message';
import bgImage from '../../assets/BG.png';
import './Login.css';

const VIEWS = {
  LOGIN:                           'login',
  FORGOT:                          'forgot',
  LOGIN_OTP:                       'login_otp',
  PROPERTY_SELECT:                 'property_select',
  DOMAIN_LOGIN:                    'domain_login',
  CLIENT_ACCOUNT_PROPERTY_SELECT:  'client_account_property_select',
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
  const [otpData, setOtpData] = useState({ email: '', rememberMe: false });
  const [currentSlide, setCurrentSlide] = useState(0);

  // Stores the full auth payload returned after successful OTP verification.
  // Passed down to subsequent screens (PropertySelectForm, DomainLoginForm)
  // so they have access to the user object without re-fetching.
  const [authData, setAuthData] = useState(null);

  // Stores the single selected property ID after PropertySelectForm.
  // Passed to DomainLoginForm so it can validate the staff's propertyIds.
  // '__all__' is a special value meaning "All Properties" — DomainLoginForm
  // uses clientAccount credentials in this case and skips property access check.
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);

  const showMsg = (text, type = 'error') => setMessage({ text, type });
  const hideMsg = () => setMessage({ text: '', type: '' });

  const handleViewChange = (nextView) => {
    hideMsg();
    setView(nextView);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="lp-wrap"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: '130%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
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
              <div className="lp-slide-logo-mark">H</div>
              <span className="lp-slide-brand">HostOps</span>
            </div>
            <div>
              <div className="lp-slide-tagline">
                Your<br />properties,<br /><em>always</em><br />in view.
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
        </div>

        {/* ── RIGHT: Form Panel ── */}
        <div className="lp-form-panel">
          <Message text={message.text} type={message.type} />

          {view === VIEWS.LOGIN && (
            <LoginForm
              showMsg={showMsg}
              hideMsg={hideMsg}
              onForgot={() => handleViewChange(VIEWS.FORGOT)}
              onRequiresOtp={(email, rememberMe) => {
                setOtpData({ email, rememberMe });
                handleViewChange(VIEWS.LOGIN_OTP);
                showMsg('Please verify your device to continue.', 'success');
              }}
              onClientAccountLogin={(data) => {
                // ── Client Account login ───────────────────────────────────────
                // Client accounts skip OTP and DomainLoginForm on initial login.
                // After login they go to CLIENT_ACCOUNT_PROPERTY_SELECT where they
                // can pick "All Properties" or a specific property.
                // Picking "All Properties" routes through DomainLoginForm for
                // credential re-confirmation before dashboard access.
                // The auth middleware sets req.staffPropertyIds = [] for these
                // sessions so /api/properties returns all parent client properties.
                setAuthData(data);
                showMsg(
                  `Welcome, ${data.clientAccount.firstName}! Please select a property to continue.`,
                  'success',
                );
                setView(VIEWS.CLIENT_ACCOUNT_PROPERTY_SELECT);
              }}
            />
          )}

          {view === VIEWS.LOGIN_OTP && (
            <LoginOTPForm
              email={otpData.email}
              rememberMe={otpData.rememberMe}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onBack={() => handleViewChange(VIEWS.LOGIN)}
              onOTPSuccess={(data) => {
                // Store full auth payload so PropertySelectForm and
                // DomainLoginForm have access to the user object.
                setAuthData(data);
                showMsg(
                  `Welcome, ${data.user.firstName}! Please select a property to continue.`,
                  'success',
                );
                setView(VIEWS.PROPERTY_SELECT);
              }}
            />
          )}

          {view === VIEWS.PROPERTY_SELECT && (
            <PropertySelectForm
              userData={authData?.user}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onContinue={(propertyId) => {
                // '__all__' or a specific apartment ID.
                // Both cases go to DomainLoginForm:
                //   '__all__'     → DomainLoginForm uses clientAccount credentials,
                //                   skips property access check, clears property scope.
                //   specific id   → DomainLoginForm uses staff credentials,
                //                   validates property access as normal.
                setSelectedPropertyId(propertyId);
                hideMsg();
                setView(VIEWS.DOMAIN_LOGIN);
              }}
              onBack={() => handleViewChange(VIEWS.LOGIN)}
            />
          )}

          {view === VIEWS.DOMAIN_LOGIN && (
            <DomainLoginForm
              userData={authData?.user}
              selectedPropertyId={selectedPropertyId}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onBack={() => {
                hideMsg();
                setView(VIEWS.PROPERTY_SELECT);
              }}
            />
          )}

          {view === VIEWS.CLIENT_ACCOUNT_PROPERTY_SELECT && (
            // ── Client Account Property Selection ───────────────────────────────
            // isClientAccount=true is passed so we know the context.
            // "All Properties" → onContinue('__all__') → DOMAIN_LOGIN view,
            //   DomainLoginForm shows clientAccount credential form.
            // Specific property → PropertySelectForm navigates to /dashboard
            //   directly (already authenticated as clientAccount).
            <PropertySelectForm
              userData={authData?.clientAccount}
              isClientAccount={true}
              showMsg={showMsg}
              hideMsg={hideMsg}
              onContinue={(propertyId) => {
                // Only called when '__all__' is selected (specific property
                // navigates internally in PropertySelectForm for clientAccount).
                // Route through DomainLoginForm for credential confirmation.
                setSelectedPropertyId(propertyId);
                hideMsg();
                setView(VIEWS.DOMAIN_LOGIN);
              }}
              onBack={() => handleViewChange(VIEWS.LOGIN)}
            />
          )}

          {view === VIEWS.FORGOT && (
            <ForgotPasswordForm
              showMsg={showMsg}
              onBack={() => handleViewChange(VIEWS.LOGIN)}
            />
          )}

          <a href="https://hostops.online/" className="lp-back-home">
            ← Back to homepage
          </a>
        </div>

      </div>
    </div>
  );
}