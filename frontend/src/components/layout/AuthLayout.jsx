import React from 'react';

const AuthLayout = ({ children }) => {
  return (
    <div className="lp-wrap">
      <div className="lp-card">
        <div className="lp-logo">
          <div className="lp-logo-mark">H</div>
          <div className="lp-brand">HostOps</div>
        </div>
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
