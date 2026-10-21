/* WIZPay Checkout SDK - MIT. https://github.com/wiznicheTeam/wizpay-checkout-sdk */
"use strict";var WizPayCheckoutBundle=(()=>{var y=Object.defineProperty;var Z=Object.getOwnPropertyDescriptor;var V=Object.getOwnPropertyNames;var K=Object.prototype.hasOwnProperty;var Y=(r,e,t)=>e in r?y(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t;var J=(r,e)=>{for(var t in e)y(r,t,{get:e[t],enumerable:!0})},G=(r,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of V(e))!K.call(r,n)&&n!==t&&y(r,n,{get:()=>e[n],enumerable:!(i=Z(e,n))||i.enumerable});return r};var Q=r=>G(y({},"__esModule",{value:!0}),r);var l=(r,e,t)=>Y(r,typeof e!="symbol"?e+"":e,t);var Ce={};J(Ce,{CheckoutWidget:()=>m,WizPayError:()=>g,default:()=>Se,formatMoney:()=>f,isPublishableKey:()=>I,keyMode:()=>v,mount:()=>W});var b=class{constructor(e,t,i){this.root=e;this.client=t;this.onResolved=i;l(this,"token",X());l(this,"suggestions",[]);l(this,"timer");l(this,"manual",!1)}value(){var s;let e=a=>{var d,p;return(p=(d=this.root.querySelector(`[data-wzp="${a}"]`))==null?void 0:d.value.trim())!=null?p:""},t=e("street"),[,i="",n=""]=(s=/^\s*([0-9]+[A-Za-z-]*)\s+(.*)$/.exec(t))!=null?s:[],o=e("apt");return{street:n||t,houseNumberOrName:[i,o].filter(Boolean).join(" "),city:e("city"),stateOrProvince:e("state"),postalCode:e("postal"),country:e("country")||"US"}}isComplete(){let e=this.value();return!!(e.street&&e.city&&e.postalCode)}attach(){let e=this.root.querySelector('[data-wzp="street"]'),t=this.root.querySelector('[data-wzp="ac-list"]');!e||!t||(e.addEventListener("input",()=>{this.onResolved(),!this.manual&&(clearTimeout(this.timer),this.timer=setTimeout(()=>void this.lookup(e.value,t),220))}),e.addEventListener("blur",()=>setTimeout(()=>this.hide(t),150)),t.addEventListener("mousedown",i=>{let n=i.target.closest("[data-place-id]");n&&(i.preventDefault(),this.select(n.dataset.placeId,t))}))}async lookup(e,t){if(e.trim().length<3)return this.hide(t);try{let{suggestions:i}=await this.client.autocompleteAddress(e,this.token,this.value().country);this.suggestions=i!=null?i:[],this.render(t)}catch{this.manual=!0,this.hide(t)}}render(e){if(this.suggestions.length===0)return this.hide(e);e.innerHTML=this.suggestions.map(t=>`<li class="wzp__opt" role="option" data-place-id="${ee(t.placeId)}">${C(t.text)}</li>`).join(""),e.hidden=!1}hide(e){e.hidden=!0,e.innerHTML=""}async select(e,t){this.hide(t);try{let{address:i}=await this.client.addressDetails(e,this.token);this.fill(i),this.onResolved()}catch{this.manual=!0}}fill(e){let t=(i,n)=>{let o=this.root.querySelector(`[data-wzp="${i}"]`);o&&n&&(o.value=n)};t("street",[e.houseNumberOrName,e.street].filter(Boolean).join(" ")),t("city",e.city),t("state",e.stateOrProvince),t("postal",e.postalCode),t("country",e.country)}};function X(){var e,t,i;let r=new Uint8Array(16);return(i=(t=(e=globalThis.crypto)!=null?e:{}).getRandomValues)==null||i.call(t,r),Array.from(r,n=>n.toString(16).padStart(2,"0")).join("")}var C=r=>r.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),ee=r=>C(r).replace(/"/g,"&quot;");var k="https://js.basistheory.com",w=null;function P(r){return w||(w=new Promise((e,t)=>{var a;let i=window,n=()=>{var d;if(!((d=i.BasisTheory)!=null&&d.init)){t(new Error("WIZPay: Basis Theory loaded but did not initialise."));return}i.BasisTheory.init(r,{elements:!0}).then(e,t)};if((a=i.BasisTheory)!=null&&a.init){n();return}let o=document.querySelector(`script[src="${k}"]`);if(o){o.addEventListener("load",n),o.addEventListener("error",()=>t(E()));return}let s=document.createElement("script");s.src=k,s.async=!0,s.onload=n,s.onerror=()=>{w=null,t(E())},document.head.appendChild(s)}),w)}function E(){return new Error(`WIZPay: could not load the secure card fields from ${k}. If your site sets a Content-Security-Policy, allow https://js.basistheory.com in script-src and https://*.basistheory.com in frame-src.`)}function f(r,e,t="en-US"){let i=(Number.isFinite(r)?r:0)/100;try{return new Intl.NumberFormat(t,{style:"currency",currency:e}).format(i)}catch{return`${i.toFixed(2)} ${e}`}}function M(r){return`${Math.round(r)/100}%`}function u(r){return String(r!=null?r:"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}var te="https://api.wizpay.ai",re=/^wzp_pk_(test|live)_[A-Za-z0-9_-]{43}$/,ie=/^wzp_(test|live)_/;function v(r){let e=typeof r=="string"?re.exec(r):null;return e?e[1]:null}function I(r){return v(r)!==null}function ne(r){return typeof r=="string"&&ie.test(r)&&!r.startsWith("wzp_pk_")}function L(r){if(ne(r))throw new Error("WIZPay: that is a SECRET key. It must never appear in browser code \u2014 anyone viewing the page can read it. Revoke it in your dashboard and use your publishable key (wzp_pk_\u2026) here instead.");let e=v(r);if(!e)throw new Error(`WIZPay: publishableKey must look like wzp_pk_test_\u2026 or wzp_pk_live_\u2026 \u2014 received ${se(r)}.`);return e}function se(r){return typeof r!="string"?String(r):r===""?"an empty string":`"${r.slice(0,11)}\u2026"`}function B(r){return(r!=null?r:te).replace(/\/+$/,"")}function oe(){return`
.wzp{--wzp-radius:10px;--wzp-gap:14px;color:var(--wzp-text);background:var(--wzp-surface);font:400 15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-sizing:border-box}
.wzp *,.wzp *::before,.wzp *::after{box-sizing:inherit}
.wzp[data-theme="light"]{--wzp-text:#16191d;--wzp-muted:#5b6672;--wzp-line:#d9dee4;--wzp-surface:#fff;--wzp-surface-2:#f6f8fa;--wzp-danger:#b42318}
.wzp[data-theme="dark"]{--wzp-text:#e9edf2;--wzp-muted:#9aa6b2;--wzp-line:#2b3440;--wzp-surface:#141922;--wzp-surface-2:#1b2230;--wzp-danger:#f97066}
.wzp__head{display:flex;align-items:center;gap:10px;margin-bottom:var(--wzp-gap)}
.wzp__logo{max-height:28px;max-width:140px}
.wzp__name{font-weight:700}
/* Attribution belongs under the button, not above the form. The merchant's own
   brand owns the top of their checkout; ours only needs to say who handled the
   payment. */
.wzp__powered{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:12px;color:var(--wzp-muted);font-size:11px;letter-spacing:.2px}
.wzp__poweredmark{height:14px;width:14px;opacity:.75;vertical-align:-2px}
.wzp__badge{margin-left:auto;padding:2px 8px;border-radius:999px;background:#fff3cd;color:#8a6100;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.wzp__field{margin-bottom:var(--wzp-gap)}
.wzp__label{display:block;margin-bottom:6px;font-size:13px;font-weight:600}
/* Each address input names itself. A placeholder is not a label: it disappears
   the moment someone types, so a half-filled form stops saying what its fields
   are, and screen readers treat it as a hint rather than a name. */
.wzp__sublabel{display:block;margin:0 0 4px;font-size:12px;font-weight:500;color:var(--wzp-muted)}
.wzp__row>div{min-width:0}
.wzp__optional{font-weight:400;opacity:.75}
.wzp__input,.wzp__bt{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface);color:var(--wzp-text);font-size:15px}
.wzp__input:focus{outline:2px solid var(--wzp-brand);outline-offset:1px}
.wzp__bt{padding:0 12px;display:flex;align-items:center}
.wzp__row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.wzp__tabs{display:flex;gap:8px;margin-bottom:var(--wzp-gap)}
.wzp__tab{flex:1;min-height:42px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface);color:var(--wzp-text);font:inherit;font-weight:600;cursor:pointer}
.wzp__tab[aria-selected="true"]{border-color:var(--wzp-brand);box-shadow:inset 0 0 0 1px var(--wzp-brand)}
.wzp__tips{display:flex;flex-wrap:wrap;gap:8px}
.wzp__tip{flex:1 1 72px;min-height:42px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface);color:var(--wzp-text);font:inherit;cursor:pointer}
.wzp__tip[aria-pressed="true"]{border-color:var(--wzp-brand);background:var(--wzp-brand);color:#fff}
.wzp__summary{margin:var(--wzp-gap) 0;padding:12px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface-2)}
.wzp__line{display:flex;justify-content:space-between;gap:12px;font-size:14px;padding:3px 0}
.wzp__line--total{margin-top:6px;padding-top:9px;border-top:1px solid var(--wzp-line);font-size:16px;font-weight:700}
.wzp__muted{color:var(--wzp-muted);font-size:13px}
.wzp__pay{width:100%;min-height:48px;border:0;border-radius:var(--wzp-radius);background:var(--wzp-brand);color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer}
.wzp__pay:disabled{opacity:.55;cursor:not-allowed}
.wzp__pay[data-busy="true"]{cursor:progress}
/* Sits inside the button so its width does not jump between states. */
.wzp__spinner{display:inline-block;width:15px;height:15px;margin-right:8px;vertical-align:-2px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:wzp-spin .7s linear infinite}
@keyframes wzp-spin{to{transform:rotate(360deg)}}

/* The shape of the form, shown while the session, the config and the vault's
   iframes are still loading. A blank box for a second on a payment page reads
   as a broken page, and people leave. */
.wzp__skeleton{display:block}
.wzp__sk{border-radius:var(--wzp-radius);background:var(--wzp-surface-2);animation:wzp-pulse 1.4s ease-in-out infinite}
.wzp__sk--label{height:11px;width:38%;margin-bottom:8px;border-radius:4px}
.wzp__sk--field{height:44px;margin-bottom:var(--wzp-gap)}
.wzp__sk--pay{height:48px;margin-top:4px}
@keyframes wzp-pulse{0%,100%{opacity:1}50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){
  .wzp__sk{animation:none}
  .wzp__spinner{animation-duration:2.4s}
}
.wzp__error{margin-bottom:var(--wzp-gap);padding:10px 12px;border-radius:var(--wzp-radius);background:rgba(180,35,24,.1);color:var(--wzp-danger);font-size:14px}
.wzp__error--notice{background:rgba(0,90,160,.1);color:var(--wzp-brand)}
.wzp__saved{display:flex;flex-direction:column;gap:8px;margin-bottom:var(--wzp-gap)}
.wzp__card{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface);cursor:pointer;text-align:left;font:inherit;color:inherit;width:100%}
.wzp__card[aria-pressed="true"]{border-color:var(--wzp-brand);box-shadow:inset 0 0 0 1px var(--wzp-brand)}
.wzp__check{display:flex;align-items:flex-start;gap:9px;margin-bottom:var(--wzp-gap);font-size:14px;cursor:pointer}
.wzp__ac{position:relative}
.wzp__threeds{min-height:420px;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);overflow:hidden;background:var(--wzp-surface)}
.wzp__threeds[hidden]{display:none}
.wzp__list{position:absolute;z-index:20;left:0;right:0;margin-top:2px;padding:0;list-style:none;max-height:210px;overflow:auto;border:1px solid var(--wzp-line);border-radius:var(--wzp-radius);background:var(--wzp-surface);box-shadow:0 8px 24px rgba(0,0,0,.14)}
.wzp__opt{padding:9px 12px;cursor:pointer;font-size:14px}
.wzp__opt:hover,.wzp__opt[aria-selected="true"]{background:var(--wzp-surface-2)}
@media (max-width:420px){.wzp__row{grid-template-columns:1fr}}
`.trim()}function S(r,e){var i;if(r==="light"||r==="dark")return r;let t=e?ae(e):null;return t!==null?t<.5?"dark":"light":typeof window!="undefined"&&((i=window.matchMedia)!=null&&i.call(window,"(prefers-color-scheme: dark)").matches)?"dark":"light"}function ae(r){if(typeof window=="undefined"||!window.getComputedStyle)return null;for(let e=r;e;e=e.parentElement){let t=de(window.getComputedStyle(e).backgroundColor);if(!t)continue;let[i,n,o]=t;return(.299*i+.587*n+.114*o)/255}return null}function de(r){let e=/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/i.exec(r!=null?r:"");if(!e)return null;let t=e[4]===void 0?1:Number(e[4]);return!Number.isFinite(t)||t<.5?null:[Number(e[1]),Number(e[2]),Number(e[3])]}var T=!1;function R(r=document){if(T||r.getElementById("wizpay-checkout-styles")){T=!0;return}let e=r.createElement("style");e.id="wizpay-checkout-styles",e.textContent=oe(),r.head.appendChild(e),T=!0}function H(r){return(r==null?void 0:r.type)==="threeDS2"&&!!r.token}async function $(r,e){let t=he(r.token);if(r.subtype==="challenge"){let o=await pe(r,t,e);return{details:{"threeds2.challengeResult":z({transStatus:o,authorisationToken:r.authorisationToken})}}}let n=await le(r,t,e);return{details:{"threeds2.fingerprint":z({threeDSCompInd:n,authorisationToken:r.authorisationToken})}}}async function le(r,e,t){var d,p,c;let i=String((d=e.threeDSMethodURL)!=null?d:"");if(!i)return"U";let n=ce();t.container.appendChild(n);let o=String((p=e.threeDSServerTransID)!=null?p:""),s=z({threeDSServerTransID:o,threeDSMethodNotificationURL:t.returnPageUrl}),a=await Promise.race([A(t.returnPageUrl,"fingerprint"),ge((c=t.fingerprintTimeoutMs)!=null?c:1e4).then(()=>null)]).finally(()=>n.remove());return D(n,i,{threeDSMethodData:s}),a===null?"N":"Y"}async function pe(r,e,t){var a,d,p;let i=String((a=e.acsURL)!=null?a:"");if(!i)throw new Error("WIZPay: the bank asked to verify this payment but gave no verification address.");let n=ue();t.container.appendChild(n);let o=z({threeDSServerTransID:e.threeDSServerTransID,acsTransID:e.acsTransID,messageVersion:(d=e.messageVersion)!=null?d:"2.2.0",messageType:"CReq",challengeWindowSize:"05"}),s=A(t.returnPageUrl,"challenge");D(n,i,{creq:o});try{let c=await s;return String((p=c==null?void 0:c.transStatus)!=null?p:"N")}finally{n.remove()}}function A(r,e){let t=new URL(r,window.location.href).origin;return new Promise(i=>{let n=o=>{var a;if(o.origin!==t)return;let s=me(o.data);!s||s.source!=="wizpay-3ds"||s.kind&&s.kind!==e||(window.removeEventListener("message",n),i((a=s.payload)!=null?a:s))};window.addEventListener("message",n)})}function D(r,e,t){let i=document.createElement("form");i.method="POST",i.action=e,i.target=r.name,i.style.display="none";for(let[n,o]of Object.entries(t)){let s=document.createElement("input");s.type="hidden",s.name=n,s.value=o,i.appendChild(s)}document.body.appendChild(i),i.submit(),i.remove()}function ce(){let r=document.createElement("iframe");return r.name=`wzp-3ds-fp-${Date.now()}`,r.width="0",r.height="0",r.style.cssText="display:none;border:0",r}function ue(){let r=document.createElement("iframe");return r.name=`wzp-3ds-ch-${Date.now()}`,r.style.cssText="width:100%;min-height:420px;border:0;display:block",r.setAttribute("title","Verify your payment with your bank"),r}function he(r){if(!r)return{};try{return JSON.parse(atob(r))}catch{return{}}}function me(r){if(typeof r=="object"&&r)return r;if(typeof r!="string")return null;try{return JSON.parse(r)}catch{return null}}function z(r){return btoa(JSON.stringify(r))}function ge(r){return new Promise(e=>setTimeout(e,r))}function q(r){let{session:e,config:t,theme:i,isTest:n,hidePayButton:o}=r,s=t.branding,a=e.methods.length?e.methods:["card"];return`
<div class="wzp" data-theme="${i}" style="--wzp-brand:${u(s.brandColor)};--wzp-accent:${u(s.accentColor)}">
  ${n?'<div class="wzp__head"><span class="wzp__badge" title="No real money will move">Test mode</span></div>':""}

  <div class="wzp__error" data-wzp="error" hidden role="alert"></div>

  <!-- 3D Secure renders here. Kept OUTSIDE the form wrapper so hiding the form
       for a challenge never unmounts the card iframes, which would lose the
       card the shopper already typed. -->
  <div class="wzp__threeds" data-wzp="threeds" hidden></div>

  <div data-wzp="form">

  ${a.length>1?we(a):""}

  <div data-wzp="saved" hidden>
    <span class="wzp__label">Your saved cards</span>
    <div class="wzp__saved" data-wzp="saved-list"></div>
  </div>

  <div data-wzp="card-panel">
    <div class="wzp__field">
      <label class="wzp__label" for="wzp-number">Card number</label>
      <div class="wzp__bt" id="wzp-number"></div>
    </div>
    <div class="wzp__row">
      <div class="wzp__field">
        <label class="wzp__label" for="wzp-expiry">Expiry</label>
        <div class="wzp__bt" id="wzp-expiry"></div>
      </div>
      <div class="wzp__field">
        <label class="wzp__label" for="wzp-cvc">Security code</label>
        <div class="wzp__bt" id="wzp-cvc"></div>
      </div>
    </div>
    <div class="wzp__field">
      <label class="wzp__label" for="wzp-holder">Name on card</label>
      <input class="wzp__input" id="wzp-holder" data-wzp="holder" autocomplete="cc-name" placeholder="Jane Buyer">
    </div>
  </div>

  <div data-wzp="ach-panel" hidden>
    <div class="wzp__row">
      <div class="wzp__field">
        <label class="wzp__label" for="wzp-routing">Routing number</label>
        <input class="wzp__input" id="wzp-routing" data-wzp="routing" inputmode="numeric" autocomplete="off">
      </div>
      <div class="wzp__field">
        <label class="wzp__label" for="wzp-account">Account number</label>
        <input class="wzp__input" id="wzp-account" data-wzp="account" inputmode="numeric" autocomplete="off">
      </div>
    </div>
  </div>

  ${ye()}

  <div class="wzp__field">
    <label class="wzp__label" for="wzp-email">Email</label>
    <input class="wzp__input" id="wzp-email" data-wzp="email" type="email" autocomplete="email" placeholder="jane@example.com">
  </div>

  ${e.tips.enabled?fe(e):""}

  <div data-wzp="save-card-row" hidden>
    <label class="wzp__check">
      <input type="checkbox" data-wzp="save-card">
      <span>Save this card for next time</span>
    </label>
  </div>

  <div class="wzp__summary" data-wzp="summary"></div>

  ${e.surchargeDisclosure?`<p class="wzp__muted" data-wzp="disclosure">${u(e.surchargeDisclosure)}</p>`:""}

  ${o?"":'<button class="wzp__pay" data-wzp="pay" type="button" disabled>Pay</button>'}

  <div class="wzp__powered">
    <span>Powered by</span>
    ${be()}
  </div>
  </div>

  ${t.termsUrl?`<p class="wzp__muted">By paying you agree to the <a href="${u(t.termsUrl)}" target="_blank" rel="noopener noreferrer">terms</a>.</p>`:""}
</div>`.trim()}function we(r){let e=t=>t==="ach"?"Bank transfer":"Card";return`<div class="wzp__tabs" role="tablist" data-wzp="tabs">${r.map((t,i)=>`<button class="wzp__tab" type="button" role="tab" data-method="${u(t)}" aria-selected="${i===0}">${e(t)}</button>`).join("")}</div>`}function fe(r){var t;return`
  <div class="wzp__field">
    <span class="wzp__label">Add a tip</span>
    <div class="wzp__tips" data-wzp="tips">
      <button class="wzp__tip" type="button" data-tip="none" aria-pressed="true">None</button>
      ${((t=r.tips.presetBps)!=null?t:[]).map((i,n)=>`<button class="wzp__tip" type="button" data-tip="${n}" aria-pressed="false">${u(M(i))}</button>`).join("")}
      ${r.tips.allowCustom?'<button class="wzp__tip" type="button" data-tip="custom" aria-pressed="false">Other</button>':""}
    </div>
    <input class="wzp__input" data-wzp="tip-custom" type="number" min="0" step="0.01" placeholder="Tip amount" hidden style="margin-top:8px">
  </div>`}function ye(){return`
  <div class="wzp__field wzp__ac" data-wzp="address">
    <span class="wzp__label">Billing address</span>

    <label class="wzp__sublabel" for="wzp-street">Street address</label>
    <input class="wzp__input" id="wzp-street" data-wzp="street" autocomplete="address-line1"
           placeholder="788 Mount Vernon Avenue">
    <ul class="wzp__list" data-wzp="ac-list" role="listbox" hidden></ul>

    <div class="wzp__row" style="margin-top:10px">
      <div>
        <label class="wzp__sublabel" for="wzp-apt">Apt / suite <span class="wzp__optional">optional</span></label>
        <input class="wzp__input" id="wzp-apt" data-wzp="apt" autocomplete="address-line2" placeholder="Apt 4B">
      </div>
      <div>
        <label class="wzp__sublabel" for="wzp-city">City</label>
        <input class="wzp__input" id="wzp-city" data-wzp="city" autocomplete="address-level2" placeholder="Columbus">
      </div>
    </div>

    <div class="wzp__row" style="margin-top:10px">
      <div>
        <label class="wzp__sublabel" for="wzp-state">State</label>
        <input class="wzp__input" id="wzp-state" data-wzp="state" autocomplete="address-level1"
               placeholder="OH" maxlength="2">
      </div>
      <div>
        <label class="wzp__sublabel" for="wzp-postal">ZIP code</label>
        <input class="wzp__input" id="wzp-postal" data-wzp="postal" autocomplete="postal-code" placeholder="43203">
      </div>
    </div>
    <input type="hidden" data-wzp="country" value="US">
  </div>`}function N(r,e,t,i){let n=(s,a,d="")=>`<div class="wzp__line ${d}"><span>${u(s)}</span><span>${u(i(a,e,t))}</span></div>`,o=[n("Subtotal",r.subtotalMinor)];return r.tipMinor>0&&o.push(n("Tip",r.tipMinor)),r.surchargeMinor>0&&o.push(n("Card surcharge",r.surchargeMinor)),o.push(n("Total",r.totalMinor,"wzp__line--total")),o.join("")}function O(r){let e=t=>`<div class="wzp__sk wzp__sk--label" style="width:${t}"></div><div class="wzp__sk wzp__sk--field"></div>`;return`
<div class="wzp wzp__skeleton" data-theme="${r}" aria-hidden="true">
  ${e("30%")}
  <div class="wzp__row">
    <div>${e("52%")}</div>
    <div>${e("58%")}</div>
  </div>
  ${e("34%")}
  ${e("26%")}
  <div class="wzp__sk wzp__sk--field"></div>
  <div class="wzp__sk wzp__sk--pay"></div>
</div>`.trim()}function be(){return'<svg class="wzp__poweredmark" viewBox="0 0 24 24" role="img" aria-label="Wizniche" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24ZM6.14686 14.6879L6.13682 14.6807C5.97472 14.564 5.86013 14.4044 5.78581 14.2204L5.78337 14.2143L3.82011 8.78533L3.8174 8.77638C3.79575 8.70493 3.77418 8.61819 3.77236 8.53251C3.76246 8.32228 3.83626 8.12593 3.99917 7.97925C4.16002 7.83444 4.3583 7.77148 4.5655 7.77148C4.74319 7.77148 4.91214 7.82315 5.05749 7.9322C5.19473 8.03517 5.2932 8.17168 5.3492 8.333L5.35014 8.33571L6.69478 12.3135L8.04591 8.35461C8.1054 8.1744 8.22045 8.02964 8.37797 7.9278C8.53534 7.82437 8.7124 7.77148 8.90077 7.77148C9.08556 7.77148 9.26036 7.82252 9.4138 7.92777C9.57354 8.02681 9.69466 8.17005 9.75562 8.3546L11.1068 12.3135L12.4523 8.33299C12.5083 8.17168 12.6068 8.03517 12.744 7.9322C12.8894 7.82315 13.0583 7.77148 13.236 7.77148C13.4381 7.77148 13.6356 7.83171 13.7925 7.97918C13.9574 8.12144 14.0392 8.31644 14.0292 8.53245C14.0274 8.61814 14.0058 8.70491 13.9841 8.77638L13.9814 8.78533L12.0182 14.2143L12.0157 14.2204C11.939 14.4103 11.817 14.5713 11.6459 14.6868L11.6429 14.6889C11.4788 14.7973 11.2928 14.8463 11.0984 14.8463C10.8975 14.8463 10.7085 14.791 10.539 14.6832L10.5293 14.677L10.5199 14.6702C10.3577 14.5515 10.2388 14.3941 10.1744 14.2026L8.90077 10.5703L7.62714 14.2026C7.56046 14.4006 7.43319 14.5591 7.26338 14.676L7.26074 14.6779C7.09353 14.7908 6.90422 14.8463 6.70317 14.8463C6.50852 14.8463 6.32342 14.7972 6.15738 14.6945L6.14686 14.6879ZM19.9918 8.5449C19.4855 8.02929 18.8242 7.77148 18.0076 7.77148C17.5504 7.77148 17.1299 7.86869 16.7461 8.0631C16.3705 8.25751 16.0725 8.53222 15.852 8.88723V7.89827H14.7375V14.8463H15.852V11.0046C15.852 10.2777 16.0235 9.72404 16.3664 9.34367C16.7175 8.96331 17.187 8.77312 17.7749 8.77312C18.3547 8.77312 18.8119 8.95908 19.1467 9.331C19.4814 9.69446 19.6488 10.2227 19.6488 10.9159V14.8463H20.7511V10.751C20.7511 9.78744 20.498 9.05206 19.9918 8.5449Z"/></svg>'}var g=class extends Error{constructor(t,i,n){super(t);this.status=i;this.code=n;this.name="WizPayError"}},_=class{constructor(e,t={}){this.headers=e;l(this,"base");l(this,"doFetch");var n;this.base=B(t.apiBase);let i=(n=t.fetchImpl)!=null?n:typeof globalThis.fetch=="function"?globalThis.fetch.bind(globalThis):void 0;if(!i)throw new Error("WIZPay: no fetch implementation available. On Node, use 18 or newer.");this.doFetch=i}async post(e,t){return this.request("POST",e,t)}async get(e){return this.request("GET",e)}async delete(e,t){return this.request("DELETE",e,t)}async request(e,t,i){let n=await this.doFetch(`${this.base}${t}`,{method:e,headers:{"Content-Type":"application/json",...this.headers},body:i===void 0?void 0:JSON.stringify(i)}),o=await n.text(),s={};try{s=o?JSON.parse(o):{}}catch{throw new g(`WIZPay returned a non-JSON response (HTTP ${n.status}). Check that apiBase points at a WIZPay API.`,n.status)}if(!n.ok){let a=s,d=typeof a.message=="string"&&a.message||typeof a.error=="string"&&a.error||`WIZPay request failed (HTTP ${n.status})`;throw new g(d,n.status,typeof a.code=="string"?a.code:void 0)}return s}};var x=class{constructor(e,t,i,n={}){this.sessionId=t;this.clientSecret=i;l(this,"http");this.http=new _({"x-publishable-key":e},n)}config(e){return this.http.post("/v1/checkout/config",{storeId:e})}load(){return this.http.post(`/v1/checkout/sessions/${this.sessionId}`,{clientSecret:this.clientSecret})}quote(e){return this.http.post(`/v1/checkout/sessions/${this.sessionId}/quote`,{clientSecret:this.clientSecret,...e})}savedMethods(){return this.http.post(`/v1/checkout/sessions/${this.sessionId}/payment-methods`,{clientSecret:this.clientSecret})}forgetMethod(e){return this.http.delete(`/v1/checkout/sessions/${this.sessionId}/payment-methods/${e}`,{clientSecret:this.clientSecret})}confirm(e){return this.http.post(`/v1/checkout/sessions/${this.sessionId}/confirm`,{clientSecret:this.clientSecret,...e})}details(e){return this.http.post(`/v1/checkout/sessions/${this.sessionId}/details`,{clientSecret:this.clientSecret,details:e})}autocompleteAddress(e,t,i){return this.http.post("/v1/checkout/places/autocomplete",{input:e,sessionToken:t,country:i})}addressDetails(e,t){return this.http.post("/v1/checkout/places/details",{placeId:e,sessionToken:t})}};function F(){let{navigator:r,screen:e}=window;return{acceptHeader:"*/*",userAgent:r.userAgent,language:r.language,colorDepth:e.colorDepth,screenHeight:e.height,screenWidth:e.width,timeZoneOffset:new Date().getTimezoneOffset(),javaEnabled:!1,javaScriptEnabled:!0}}var m=class{constructor(e){this.options=e;l(this,"client");l(this,"isTest");l(this,"root");l(this,"bt");l(this,"elements",{});l(this,"address");l(this,"session");l(this,"config");l(this,"pricing");l(this,"method","card");l(this,"tip");l(this,"funding","unknown");l(this,"theme","light");l(this,"lastReady",!1);l(this,"lastBusy",!1);l(this,"payLabel","Pay");l(this,"cardFields",{number:!1,expiry:!1,cvc:!1});l(this,"savedMethodId");l(this,"busy",!1);l(this,"destroyed",!1);this.isTest=L(e.publishableKey)==="test",this.client=new x(e.publishableKey,e.sessionId,e.clientSecret,{apiBase:e.apiBase})}async mount(){var e;this.root=_e(this.options.selector),R(),this.root.innerHTML=O(S("auto",this.root)),this.session=await this.client.load(),this.config=await this.client.config(xe(this.session)),this.pricing=this.session.pricing,this.method=(e=this.session.methods[0])!=null?e:"card",this.theme=S(this.config.theme,this.root),this.root.innerHTML=q({hidePayButton:this.options.hidePayButton,session:this.session,config:this.config,theme:this.theme,isTest:this.isTest}),this.bindUi(),this.renderSummary(),await this.mountCardFields(),await this.loadSavedCards(),this.updatePayButton()}destroy(){var e;this.destroyed=!0;for(let t of Object.values(this.elements))(e=t.unmount)==null||e.call(t);this.elements={},this.root&&(this.root.innerHTML="")}async mountCardFields(){let e=this.config.basisTheoryPublicKey;if(!e){this.fail(new Error("WIZPay: card payments are not configured for this store."));return}this.bt=await P(e);let t=Te(this.theme);this.elements.number=this.bt.createElement("cardNumber",{targetId:"wzp-number",style:t}),this.elements.expiry=this.bt.createElement("cardExpirationDate",{targetId:"wzp-expiry",style:t}),this.elements.cvc=this.bt.createElement("cardVerificationCode",{targetId:"wzp-cvc",style:t}),await Promise.all([this.elements.number.mount("#wzp-number"),this.elements.expiry.mount("#wzp-expiry"),this.elements.cvc.mount("#wzp-cvc")]),this.elements.number.on("change",i=>{this.cardFields.number=!!i.complete,this.updatePayButton();let n=ke(i);n!==this.funding&&(this.funding=n,this.requote())});for(let i of["expiry","cvc"])this.elements[i].on("change",n=>{this.cardFields[i]=!!n.complete,this.updatePayButton()})}async loadSavedCards(){if(this.session.methods.includes("card"))try{let{paymentMethods:e}=await this.client.savedMethods();if(e.length===0)return;this.renderSavedCards(e),this.show("save-card-row")}catch{this.show("save-card-row")}}async requote(){var e,t;try{this.pricing=await this.client.quote({method:this.method,funding:this.funding,tip:this.tip}),this.renderSummary(),(t=(e=this.options).onPricingChange)==null||t.call(e,this.pricing)}catch(i){this.fail(i)}}renderSummary(){let e=this.q("summary");e&&(e.innerHTML=N(this.pricing,this.session.currency,this.config.locale,f)),this.payLabel=`Pay ${f(this.pricing.totalMinor,this.session.currency,this.config.locale)}`,this.updatePayButton()}async pay(){var e,t,i,n,o,s,a,d,p,c;if(!this.busy){this.busy=!0,this.updatePayButton(),this.clearError();try{let h=await this.client.confirm({method:this.method,tip:this.tip,...this.savedMethodId?{savedMethodId:this.savedMethodId}:{tokenIntentId:await this.tokenize()},...this.method==="ach"?{accountHolderName:(e=this.q("holder"))==null?void 0:e.value.trim()}:{},saveCard:(i=(t=this.q("save-card"))==null?void 0:t.checked)!=null?i:!1,holderName:(n=this.q("holder"))==null?void 0:n.value.trim(),email:(o=this.q("email"))==null?void 0:o.value.trim(),billingAddress:{...(a=(s=this.address)==null?void 0:s.value())!=null?a:{}},browserInfo:F()});if(h.status==="requires_action"){await this.handleAction(h);return}if(h.status==="succeeded"&&this.method==="ach"&&this.showNotice("Your bank transfer has started. It usually clears in a few business days."),h.status==="failed"){this.showError((d=h.failureReason)!=null?d:"Your payment was declined. Please try another card.");return}(c=(p=this.options).onSuccess)==null||c.call(p,h)}catch(h){this.fail(h)}finally{this.busy=!1,this.updatePayButton()}}}async tokenize(){if(!this.bt)throw new Error("WIZPay: secure card fields are not ready yet.");if(this.method==="ach")return this.tokenizeBank();let e=this.elements.expiry;if(typeof e.month!="function"||typeof e.year!="function")throw new Error("WIZPay: the secure expiry field did not initialise correctly.");return(await this.bt.tokenIntents.create({type:"card",data:{number:this.elements.number,expiration_month:e.month(),expiration_year:e.year(),cvc:this.elements.cvc}})).id}async tokenizeBank(){var o,s,a,d;let e=(s=(o=this.q("routing"))==null?void 0:o.value.trim())!=null?s:"",t=(d=(a=this.q("account"))==null?void 0:a.value.trim())!=null?d:"";if(!/^\d{9}$/.test(e))throw new Error("WIZPay: a US routing number is 9 digits.");if(!/^\d{4,17}$/.test(t))throw new Error("WIZPay: check the account number.");let i=await fetch("https://api.basistheory.com/token-intents",{method:"POST",headers:{"Content-Type":"application/json","BT-API-KEY":this.config.basisTheoryPublicKey},body:JSON.stringify({type:"bank",data:{routing_number:e,account_number:t}})}),n=await i.json().catch(()=>({}));if(!i.ok||!n.id)throw new Error("WIZPay: could not securely store those bank details.");return n.id}async handleAction(e){let t=e.action;if(H(t)){await this.runNativeThreeDS(t);return}let i=t==null?void 0:t.url;if(typeof i=="string"&&i){window.location.assign(i);return}this.showError("Your bank needs to verify this payment, but we could not open the verification step.")}async runNativeThreeDS(e){var n,o,s,a;let t=this.q("threeds");if(!t)return;let i=e.subtype==="challenge";i&&(this.toggle("threeds",!0),this.setFormVisible(!1));try{let{details:d}=await $(e,{returnPageUrl:(n=this.options.threeDSReturnUrl)!=null?n:ze,container:t}),p=await this.client.details(d);if(p.status==="succeeded"){(s=(o=this.options).onSuccess)==null||s.call(o,p);return}if(p.status==="requires_action"){await this.runNativeThreeDS(p.action);return}this.restoreAfterChallenge(i),this.showError((a=p.failureReason)!=null?a:"Your bank could not verify this payment.")}catch(d){this.restoreAfterChallenge(i),this.fail(d)}}restoreAfterChallenge(e){e&&(this.toggle("threeds",!1),this.setFormVisible(!0))}setFormVisible(e){let t=this.q("form");t&&(t.hidden=!e)}bindUi(){var e,t,i,n,o;(e=this.q("pay"))==null||e.addEventListener("click",()=>void this.pay()),this.address=new b(this.root,this.client,()=>this.updatePayButton()),this.address.attach(),(t=this.q("tabs"))==null||t.addEventListener("click",s=>{var d;let a=s.target.closest("[data-method]");if(a){this.method=(d=a.dataset.method)!=null?d:"card";for(let p of Array.from(this.root.querySelectorAll("[data-method]")))p.setAttribute("aria-selected",String(p===a));this.toggle("card-panel",this.method==="card"),this.toggle("ach-panel",this.method==="ach"),this.updatePayButton(),this.requote()}}),(i=this.q("tips"))==null||i.addEventListener("click",s=>{let a=s.target.closest("[data-tip]");if(!a)return;let d=a.dataset.tip;for(let c of Array.from(this.root.querySelectorAll("[data-tip]")))c.setAttribute("aria-pressed",String(c===a));let p=this.q("tip-custom");p&&(p.hidden=d!=="custom"),this.tip=d==="none"?void 0:d==="custom"?{customMinor:U(p==null?void 0:p.value)}:{presetIndex:Number(d)},this.requote()}),(n=this.q("tip-custom"))==null||n.addEventListener("input",s=>{this.tip={customMinor:U(s.target.value)},this.requote()});for(let s of["holder","email"])(o=this.q(s))==null||o.addEventListener("input",()=>this.updatePayButton())}renderSavedCards(e){let t=this.q("saved-list");t&&(t.innerHTML=e.map(i=>{var n,o,s,a;return`<button class="wzp__card" type="button" data-saved="${i.id}" aria-pressed="false">
             <span>${((n=i.brand)!=null?n:"Card").toUpperCase()} \xB7\xB7\xB7\xB7 ${(o=i.last4)!=null?o:"\u2022\u2022\u2022\u2022"}</span>
             <span class="wzp__muted" style="margin-left:auto">${(s=i.expMonth)!=null?s:""}/${(a=i.expYear)!=null?a:""}</span>
           </button>`}).join("")+'<button class="wzp__card" type="button" data-saved="new" aria-pressed="true">Use a new card</button>',t.addEventListener("click",i=>{let n=i.target.closest("[data-saved]");if(!n)return;for(let s of Array.from(t.querySelectorAll("[data-saved]")))s.setAttribute("aria-pressed",String(s===n));let o=n.dataset.saved;this.savedMethodId=o==="new"?void 0:o,this.toggle("card-panel",!this.savedMethodId),this.toggle("save-card-row",!this.savedMethodId),this.updatePayButton(),this.requote()}),this.show("saved"))}isReady(){var i,n,o,s;let e=(n=(i=this.address)==null?void 0:i.isComplete())!=null?n:!1,t=this.method==="ach"?!!((o=this.q("routing"))!=null&&o.value&&((s=this.q("account"))!=null&&s.value)):!!this.savedMethodId||this.cardFields.number&&this.cardFields.expiry&&this.cardFields.cvc;return e&&t&&!this.destroyed}updatePayButton(){var i,n;let e=this.isReady();(e!==this.lastReady||this.busy!==this.lastBusy)&&(this.lastReady=e,this.lastBusy=this.busy,(n=(i=this.options).onReadyChange)==null||n.call(i,{ready:e,busy:this.busy}));let t=this.q("pay");t&&(t.disabled=this.busy||!e,t.dataset.busy=String(this.busy),t.innerHTML=this.busy?'<span class="wzp__spinner" aria-hidden="true"></span>Processing\u2026':u(this.payLabel),t.setAttribute("aria-busy",String(this.busy)))}async submit(){if(!this.busy){if(!this.isReady())throw new Error("WIZPay: the payment details are not complete yet.");await this.pay()}}q(e){var t,i;return(i=(t=this.root)==null?void 0:t.querySelector(`[data-wzp="${e}"]`))!=null?i:null}toggle(e,t){let i=this.q(e);i&&(i.hidden=!t)}show(e){this.toggle(e,!0)}showNotice(e){let t=this.q("error");t&&(t.textContent=e,t.classList.add("wzp__error--notice"),t.hidden=!1)}showError(e){let t=this.q("error");t&&(t.textContent=e,t.hidden=!1)}clearError(){let e=this.q("error");e&&(e.hidden=!0,e.classList.remove("wzp__error--notice"))}fail(e){var t,i;this.showError(ve(e)),(i=(t=this.options).onError)==null||i.call(t,e)}};function ve(r){let e=typeof(r==null?void 0:r.message)=="string"?r.message:"",t=/status code\s*\d{3}/i.test(e)||/error\.data|\bundefined\b|\[object |TypeError|SyntaxError/i.test(e)||e==="";return/failed to fetch|networkerror|network request failed|load failed/i.test(e)?"We could not reach the payment service. Check your connection and try again.":/\b4\d{2}\b/.test(e)&&/card|token|vault|basis/i.test(e)?"We could not read your card details. Please check the number, expiry date and security code.":t?"We could not complete this payment. Please check your details and try again.":e}var ze="https://js.wizpay.ai/v1/3ds-return.html";function _e(r){if(typeof r!="string")return r;let e=document.querySelector(r);if(!e)throw new Error(`WIZPay: no element matches "${r}". Add it before calling mount().`);return e}function xe(r){let e=r.storeId;if(!e)throw new Error("WIZPay: this session did not say which store it belongs to, so the checkout cannot load that store's configuration. Your WIZPay API may predate this field \u2014 upgrade it, or contact support.");return e}function ke(r){var t;let e=(t=r.cardFunding)==null?void 0:t.toLowerCase();return e==="credit"||e==="debit"||e==="prepaid"?e:"unknown"}function U(r){let e=Number.parseFloat(r!=null?r:"");return Number.isFinite(e)&&e>0?Math.round(+`${e}e2`):0}function Te(r){return{base:{color:r==="dark"?"#e9edf2":"#16191d",fontSize:"15px",fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',"::placeholder":{color:r==="dark"?"#9aa6b2":"#8a94a0"}},invalid:{color:r==="dark"?"#f97066":"#b42318"}}}async function W(r){let e=new m(r);return await e.mount(),e}var j={mount:W,CheckoutWidget:m},Se=j;typeof window!="undefined"&&(window.WizPayCheckout=j);return Q(Ce);})();
//# sourceMappingURL=checkout.js.map
