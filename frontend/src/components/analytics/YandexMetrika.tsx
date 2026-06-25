'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { COOKIE_CONSENT_KEY, getStoredCookieConsent } from '@/lib/consent';

const METRIKA_ID = 107147478;

export function YandexMetrika() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(getStoredCookieConsent() === 'accepted');

    const onStorage = (event: StorageEvent) => {
      if (event.key === COOKIE_CONSENT_KEY) {
        setEnabled(event.newValue === 'accepted');
      }
    };

    const onConsentChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ consent?: string }>).detail;
      setEnabled(detail?.consent === 'accepted');
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('vh:cookie-consent-changed', onConsentChanged);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('vh:cookie-consent-changed', onConsentChanged);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <Script
        id="yandex-metrika"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();
          for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}','ym');
          ym(${METRIKA_ID},'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:'dataLayer',accurateTrackBounce:true,trackLinks:true});`,
        }}
      />
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${METRIKA_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
