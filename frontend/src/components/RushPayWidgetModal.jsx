import { useEffect } from 'react';
import { API_BASE_URL } from '../config';

export default function RushPayWidgetModal({ paymentReference, widgetSessionToken, onClose, statusToken }) {
  useEffect(() => {
    const initWidget = () => {
      if (window.RushPayV2) {
        try {
          const callbackUrl = `${window.location.origin}/#/payment-status?reference=${paymentReference}&token=${statusToken}`;
          window.RushPayV2.init({
            containerId: "rushpay-embedded-widget",
            paymentReference: paymentReference,
            widgetSessionToken: widgetSessionToken,
            callbackUrl: callbackUrl,
            apiBase: "https://core.rushpay.cash",
            skipRedirect: true,
            onSuccess: () => {
              window.top.location.href = callbackUrl;
            },
            onClosed: () => {
              onClose();
            }
          });
        } catch (e) {
          console.error("RushPay initialization error:", e);
        }
      }
    };

    if (!window.RushPayV2) {
      const script = document.createElement('script');
      script.src = `${API_BASE_URL}/api/payment/rushpay-widget.js`;
      script.async = true;
      script.onload = initWidget;
      document.body.appendChild(script);
      return () => {
        try {
          document.body.removeChild(script);
        } catch (e) {}
      };
    } else {
      initWidget();
    }
  }, [paymentReference, widgetSessionToken, statusToken, onClose]);

  return (
    <div className="luxury-drawer-overlay" onClick={(e) => { if (e.target.className === 'luxury-drawer-overlay') onClose(); }} role="dialog" aria-modal="true" style={{ zIndex: 9999 }}>
      <div className="luxury-drawer" style={{ maxWidth: '460px' }}>
        <div className="luxury-drawer-header">
          <h2 style={{ fontSize: '1.1rem' }}>Secure Checkout</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="luxury-drawer-body" style={{ minHeight: '380px', background: '#fff', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div id="rushpay-embedded-widget" style={{ width: '100%', minHeight: '350px' }}>
            <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
              Initializing RushPay Secure Gateway...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
