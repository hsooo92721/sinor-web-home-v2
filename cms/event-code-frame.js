// Authored code runs in an opaque sandbox. Only validated YouTube IDs reach the host player.
export function eventCodeFrame(source, title = '이벤트 콘텐츠') {
  const host = document.createElement('div');
  host.style.cssText = 'position:relative;width:100%;min-width:0';
  const frame = document.createElement('iframe');
  frame.title = title;
  frame.className = 'event-code-frame';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.referrerPolicy = 'no-referrer';
  frame.style.cssText = 'display:block;width:100%;height:1px;border:0;min-width:0';
  host.append(frame);
  const token = crypto.randomUUID();
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: http: data: blob:; font-src https: data:; media-src https: http: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const bootstrap = `(${sandboxBootstrap.toString()})(${JSON.stringify(token)})`;
  frame.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + policy + '"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}img,video{max-width:100%}</style><script>' + bootstrap + '</script>' + source;
  const players = new Map();
  const receive = event => {
    if (event.source !== frame.contentWindow || event.data?.token !== token) return;
    if (event.data.type === 'sinor-event-height') {
      const height = Number(event.data.height);
      if (Number.isFinite(height)) frame.style.height = Math.min(50000, Math.max(1, height)) + 'px';
    }
    if (event.data.type !== 'sinor-event-videos' || !Array.isArray(event.data.videos)) return;
    const present = new Set();
    for (const item of event.data.videos.slice(0, 8)) {
      if (!/^[A-Za-z0-9_-]{11}$/.test(item.videoId) || !/^[0-9]{1,3}$/.test(item.key)) continue;
      if (![item.top,item.left,item.width,item.height].every(n=>Number.isFinite(n)&&Math.abs(n)<=50000)) continue;
      present.add(item.key);
      let player = players.get(item.key);
      if (!player) {
        player = document.createElement('iframe');
        player.title = 'YouTube 영상';
        player.src = 'https://www.youtube-nocookie.com/embed/' + item.videoId + '?autoplay=1&playsinline=1&rel=0';
        player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        player.allowFullscreen = true;
        player.referrerPolicy = 'strict-origin-when-cross-origin';
        player.style.cssText = 'position:absolute;z-index:1;border:0;border-radius:20px';
        players.set(item.key, player);
        host.append(player);
      }
      Object.assign(player.style,{top:item.top+'px',left:item.left+'px',width:Math.max(0,item.width)+'px',height:Math.max(0,item.height)+'px'});
    }
    for (const [key, player] of players) if (!present.has(key)) { player.remove(); players.delete(key); }
  };
  window.addEventListener('message', receive);
  host.dispose = () => { window.removeEventListener('message', receive); for (const player of players.values()) player.remove(); players.clear(); };
  return host;
}

function sandboxBootstrap(token) {
  const slots = new Map();
  let sequence = 0;
  const post = data => parent.postMessage({...data,token}, '*');
  function sync() {
    // Capture only approved video embeds; other frames remain blocked by CSP.
    for (const embed of document.querySelectorAll('iframe[src]')) {
      let url;
      try { url = new URL(embed.src); } catch { continue; }
      if (url.protocol !== 'https:' || !['www.youtube-nocookie.com','www.youtube.com'].includes(url.hostname)) continue;
      const match = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})$/);
      if (!match || sequence >= 8) continue;
      const rect = embed.getBoundingClientRect();
      const slot = document.createElement('div');
      slot.className = embed.className;
      slot.style.cssText = embed.style.cssText;
      slot.style.height = 'auto';
      slot.style.aspectRatio = Math.max(1,rect.width)+' / '+Math.max(1,rect.height);
      slot.setAttribute('aria-label','영상 재생 영역');
      embed.replaceWith(slot);
      slots.set(String(++sequence),{slot,videoId:match[1]});
      resize.observe(slot);
    }
    const videos=[];
    for (const [key,item] of slots) {
      if (!item.slot.isConnected) { slots.delete(key); continue; }
      const rect=item.slot.getBoundingClientRect();
      videos.push({key,videoId:item.videoId,top:rect.top+scrollY,left:rect.left+scrollX,width:rect.width,height:rect.height});
    }
    post({type:'sinor-event-videos',videos});
    post({type:'sinor-event-height',height:Math.ceil(Math.max(document.body?.scrollHeight||0,document.body?.getBoundingClientRect().height||0))});
  }
  const resize = new ResizeObserver(sync);
  addEventListener('DOMContentLoaded',()=>{
    resize.observe(document.body);
    new MutationObserver(sync).observe(document.body,{childList:true,subtree:true,attributes:true,characterData:true});
    sync();
  });
  addEventListener('load',sync);
  addEventListener('resize',sync);
}
