// DARKee – exécuté dans la page même (monde MAIN) de Docs, Sheets et Slides.
// Ces éditeurs dessinent tout le document, photos comprises, dans un canvas : il n'y a pas de <img> à préserver.
// On applique donc la correction inverse au moment où une photo est dessinée dans le canvas ;
// le filtre sombre de la page la remet ensuite dans ses vraies couleurs. Le texte, lui, n'est pas touché.
// La correction à utiliser est posée par content.js sur <html data-dark-google-canvas="…"> (vide = rien à faire).
//
// Docs ne redessine pas la page tant que rien n'y bouge : on garde donc la trace des photos dessinées
// (où et comment) pour les repeindre nous-mêmes dès que la correction change.
(() => {
  const proto = CanvasRenderingContext2D.prototype;
  const { drawImage: draw, clearRect: clear, fillRect: fill } = proto;
  const root = document.documentElement;
  const drawn = new Map(); // contexte → photos dessinées et toujours visibles
  const MAX_PER_CANVAS = 200;

  const isPicture = (src) =>
    src instanceof HTMLImageElement ||
    src instanceof SVGImageElement ||
    src instanceof HTMLVideoElement ||
    (typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap);

  const correction = () => root.dataset.darkGoogleCanvas || '';

  function paint(ctx, src, args, ownFilter) {
    const previous = ctx.filter;
    const parts = [ownFilter, correction()].filter((f) => f && f !== 'none');
    ctx.filter = parts.length ? parts.join(' ') : 'none';
    try {
      return draw.call(ctx, src, ...args);
    } finally {
      ctx.filter = previous;
    }
  }

  // Rectangle (x, y, w, h) du repère courant → boîte englobante en pixels du canvas.
  function toCanvas(ctx, x, y, w, h) {
    const t = ctx.getTransform();
    const xs = [], ys = [];
    for (const px of [x, x + w]) {
      for (const py of [y, y + h]) {
        xs.push(t.a * px + t.c * py + t.e);
        ys.push(t.b * px + t.d * py + t.f);
      }
    }
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }

  function destination(ctx, src, args) {
    if (args.length >= 8) return toCanvas(ctx, args[4], args[5], args[6], args[7]);
    if (args.length >= 4) return toCanvas(ctx, args[0], args[1], args[2], args[3]);
    return toCanvas(ctx, args[0], args[1], src.width, src.height);
  }

  // Une zone repeinte par l'éditeur efface les photos qui s'y trouvaient : on les oublie.
  function forget(ctx, area) {
    const list = drawn.get(ctx);
    if (!list) return;
    const kept = list.filter((d) => d.rect.x1 <= area.x0 || d.rect.x0 >= area.x1 || d.rect.y1 <= area.y0 || d.rect.y0 >= area.y1);
    if (kept.length !== list.length) drawn.set(ctx, kept);
  }

  proto.drawImage = function (src, ...args) {
    if (!isPicture(src)) return draw.call(this, src, ...args);
    const rect = destination(this, src, args);
    forget(this, rect);
    const list = drawn.get(this) || [];
    list.push({
      src, args, rect,
      transform: this.getTransform(),
      alpha: this.globalAlpha,
      op: this.globalCompositeOperation,
      filter: this.filter,
    });
    drawn.set(this, list.slice(-MAX_PER_CANVAS));
    return paint(this, src, args, this.filter);
  };

  proto.clearRect = function (x, y, w, h) {
    forget(this, toCanvas(this, x, y, w, h));
    return clear.call(this, x, y, w, h);
  };

  proto.fillRect = function (x, y, w, h) {
    forget(this, toCanvas(this, x, y, w, h));
    return fill.call(this, x, y, w, h);
  };

  function repaint() {
    for (const [ctx, list] of drawn) {
      if (!ctx.canvas.isConnected) {
        drawn.delete(ctx);
        continue;
      }
      for (const d of list) {
        ctx.save();
        ctx.setTransform(d.transform);
        ctx.globalAlpha = d.alpha;
        ctx.globalCompositeOperation = d.op;
        paint(ctx, d.src, d.args, d.filter);
        ctx.restore();
      }
    }
  }

  new MutationObserver(repaint).observe(root, { attributes: true, attributeFilter: ['data-dark-google-canvas'] });
})();
