'use client';

import Script from 'next/script';

const GA_MEASUREMENT_ID = 'G-RTB411K3Q1';

export function GoogleAnalytics() {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}

type EventParams = Record<string, string | number | boolean | null>;

function sendAppEvent(action: string, params?: EventParams) {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({
    eventName: action,
    properties: params ?? {},
    path: window.location.pathname,
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    if (navigator.sendBeacon('/api/events', blob)) {
      return;
    }
  }

  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // 計測失敗でユーザー操作を止めない
  });
}

/** GA4 とアプリ内イベントログへ送信するヘルパー */
export function sendGAEvent(action: string, params?: EventParams) {
  if (typeof window !== 'undefined') {
    if (window.gtag) {
      window.gtag('event', action, params);
    }
    sendAppEvent(action, params);
  }
}
