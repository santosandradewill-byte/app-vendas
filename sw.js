/* Service worker do app de pedidos.
   Papel: guardar o app no aparelho para abrir SEM internet.
   Regra: para o proprio app (mesma origem), tenta a rede primeiro (assim a versao nova entra
   quando ha sinal) e, se a rede falhar ou demorar, entrega o que esta guardado.
   Nunca toca em outras origens (Supabase, Google): essas passam direto.
   Sem dados do usuario aqui: so o arquivo do app. */
const CACHE = 'app-pedidos-v1';
const TEMPO_REDE = 4000;   /* ms esperando a rede antes de usar a copia guardada */

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function comTempo(p, ms){
  return new Promise((ok, erro) => {
    const t = setTimeout(() => erro(new Error('tempo')), ms);
    p.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); erro(e); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;          /* nuvem e Google passam direto */
  /* o app em si: pagina (navegacao) ou o proprio arquivo html/js/manifesto */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const chave = new Request(url.origin + url.pathname);  /* ignora ?v=... e #token */
    try{
      const resp = await comTempo(fetch(req), TEMPO_REDE);
      if(resp && resp.ok && (resp.type === 'basic' || resp.type === 'default')){
        cache.put(chave, resp.clone()).catch(() => {});
      }
      return resp;
    }catch(err){
      const guardado = await cache.match(chave, {ignoreSearch:true});
      if(guardado) return guardado;
      if(req.mode === 'navigate'){
        /* sem rede e sem copia da pagina pedida: entrega a raiz guardada, se houver */
        const raiz = await cache.match(new Request(url.origin + '/app-vendas/'), {ignoreSearch:true})
                  || await cache.match(new Request(url.origin + '/'), {ignoreSearch:true});
        if(raiz) return raiz;
      }
      throw err;
    }
  })());
});

self.addEventListener('message', e => {
  if(e.data === 'limpar'){ caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))); }
});
