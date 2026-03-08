import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/vibe-analytics.js — lightweight JS pixel for user sites
router.get('/vibe-analytics.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const script = `(function(){
  if(typeof window==='undefined')return;
  var s=document.currentScript;
  var slug=(s&&s.getAttribute('data-slug'))||'';
  if(!slug){
    var h=location.hostname;
    var m=h.match(/^([a-z0-9-]+)\\.hostingvibe\\.ru$/);
    if(m)slug=m[1];
  }
  if(!slug)return;
  var data=JSON.stringify({
    slug:slug,
    path:location.pathname,
    referrer:document.referrer||undefined
  });
  if(navigator.sendBeacon){
    navigator.sendBeacon('https://hostingvibe.ru/api/track',new Blob([data],{type:'application/json'}));
  }else{
    var x=new XMLHttpRequest();
    x.open('POST','https://hostingvibe.ru/api/track');
    x.setRequestHeader('Content-Type','application/json');
    x.send(data);
  }
})();`;

  res.send(script);
});

export default router;
