/**
 * Mixpanel Script Loader
 *
 * Loads Mixpanel SDK
 * Only loads when analytics is enabled
 *
 * NO session recording in this phase (per task requirements)
 */

'use client'

import Script from 'next/script'
import { analyticsConfig } from '../../config'

/**
 * Mixpanel Script Component
 *
 * Loads Mixpanel SDK and initializes
 * Must be rendered in app layout
 */
export function MixpanelScripts() {
  // Only load if enabled
  if (!analyticsConfig.enabled || !analyticsConfig.mixpanel.enabled) {
    return null
  }

  const token = analyticsConfig.mixpanel.token

  if (!token) {
    if (analyticsConfig.debugMode) {
      console.warn('[Analytics/Mixpanel] No token - scripts not loaded')
    }
    return null
  }

  return (
    <>
      {/* Load Mixpanel SDK */}
      <Script id="mixpanel-loader" strategy="afterInteractive">
        {`
          (function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};a.people.toString=function(){return a.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");
          for(h=0;h<i.length;h++)g(a,i[h]);var j="set set_once union unset remove delete".split(" ");a.get_group=function(){function b(c){d[c]=function(){call2_args=arguments;call2=[c].concat(Array.prototype.slice.call(call2_args,0));a.push([e,call2])}}for(var d={},e=["get_group"].concat(Array.prototype.slice.call(arguments,0)),c=0;c<j.length;c++)b(j[c]);return d};b._i.push([e,f,c])};b.__SV=1.2;e=f.createElement("script");e.type="text/javascript";e.async=!0;e.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?MIXPANEL_CUSTOM_LIB_URL:"file:"===f.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";g=f.getElementsByTagName("script")[0];g.parentNode.insertBefore(e,g)}})(document,window.mixpanel||[]);
        `}
      </Script>

      {/* Initialize Mixpanel with anonymous ID from cookie */}
      <Script id="mixpanel-init" strategy="afterInteractive">
        {`
          // Helper: Get cookie value by name
          function getCookie(name) {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
              var parts = cookies[i].split('=');
              var cookieName = parts[0].trim();
              var cookieValue = parts[1];
              if (cookieName === name) {
                return cookieValue || null;
              }
            }
            return null;
          }

          // Helper: Set cookie
          function setCookie(name, value, expiryDays, isSecure) {
            var maxAge = expiryDays * 24 * 60 * 60;
            var cookieParts = [
              name + '=' + value,
              'path=/',
              'max-age=' + maxAge,
              'SameSite=Lax'
            ];
            if (isSecure) {
              cookieParts.push('Secure');
            }
            document.cookie = cookieParts.join('; ');
          }

          // Helper: Generate anonymous ID
          function generateAnonymousId() {
            return 'anon_' + crypto.randomUUID();
          }

          // Get or create anonymous ID from cookie
          var ANON_COOKIE_NAME = 'mp_anon_id';
          var anonymousId = getCookie(ANON_COOKIE_NAME);

          if (!anonymousId) {
            anonymousId = generateAnonymousId();
            var isProduction = window.location.protocol === 'https:';
            setCookie(ANON_COOKIE_NAME, anonymousId, 365, isProduction);
          }

          // Initialize Mixpanel
          mixpanel.init('${token}', {
            // NO auto-capture - we track explicitly
            track_pageview: false,

            // NO session recording in this phase
            record_sessions_percent: 0,

            // Cookie-based persistence (fallback to localStorage)
            persistence: 'localStorage+cookie',

            // Cross-subdomain cookie support
            cross_subdomain_cookie: true,

            // Cookie expiration: 1 year
            cookie_expiration: 365,

            // Secure cookie in production
            secure_cookie: window.location.protocol === 'https:',

            // Debug mode (controlled by environment)
            debug: ${analyticsConfig.debugMode},
          });

          // Identify with the anonymous ID immediately
          mixpanel.identify(anonymousId);

          if (${analyticsConfig.debugMode}) {
            console.log('[Analytics/Mixpanel] Initialized with anonymous ID:', anonymousId);
          }
        `}
      </Script>
    </>
  )
}
