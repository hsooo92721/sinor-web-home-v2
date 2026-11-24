// Authored code executes only in an opaque sandbox, never in the CMS document.
export function eventCodeFrame(source, title = '이벤트 콘텐츠') {
  const frame = document.createElement('iframe');
  frame.title = title;
  frame.className = 'event-code-frame';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  frame.style.cssText = 'display:block;width:100%;height:1px;border:0;min-width:0';
  const token = crypto.randomUUID();
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: http: data: blob:; font-src https: data:; media-src https: http: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const bootstrap = `(()=>{const send=()=>parent.postMessage({type:'sinor-event-height',token:${JSON.stringify(token)},height:Math.ceil(Math.max(document.body?.scrollHeight||0,document.body?.getBoundingClientRect().height||0))},'*');addEventListener('load',()=>{new ResizeObserver(send).observe(document.body);new MutationObserver(send).observe(document.body,{childList:true,subtree:true,attributes:true,characterData:true});send()});addEventListener('resize',send)})()`;
  // The first CSP remains enforced even if authored HTML includes another policy.
  frame.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + policy + '"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}img,video{max-width:100%}</style><script>' + bootstrap + '</script>' + source;
  const receive = event => {
    if (event.source !== frame.contentWindow || event.data?.token !== token || event.data?.type !== 'sinor-event-height') return;
    const height = Number(event.data.height);
    if (Number.isFinite(height)) frame.style.height = Math.min(50000, Math.max(1, height)) + 'px';
  };
  window.addEventListener('message', receive);
  frame.dispose = () => window.removeEventListener('message', receive);
  return frame;
}
