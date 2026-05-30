/* ============================================================
   NanaiNest — cards.js
   Renders .cardpreset files (exported from the in-app Card Studio /
   CardDesign editor) as real, rotatable 3D holo cards.

   This is a faithful vanilla-JS port of the editor's renderFace()
   layer engine: bg / img / text / frame layers, per-layer depth
   (translateZ parallax), colour tint, holographic foil (masked to
   opaque pixels), specular sweep, sparkle, and the full frame
   material / pattern / texture / bevel stack.

   A card has a FRONT and a BACK face (from frontLayers / backLayers).
   Interactions:
     • pointer-move  → live tilt + parallax + moving foil shine
     • drag          → free spin on Y (release snaps to nearest face)
     • click / tap   → flip front ⇄ back
   Honours prefers-reduced-motion and coarse-pointer (touch) devices.
   ============================================================ */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULT_PRESET = './cards/_default/card.cardpreset';

  /* ---------- utilities (ported from the editor) ---------- */
  const FONT_STACKS = {
    'System Sans': '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
    'System Rounded': '"SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
    'Avenir Next': '"Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif',
    'Manrope': '"Manrope", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
    'DM Sans': '"DM Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
    'Montserrat': '"Montserrat", "Avenir Next", "Helvetica Neue", Arial, sans-serif',
    'Outfit': '"Outfit", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
    'Playfair Display': '"Playfair Display", Georgia, "Times New Roman", serif',
    'Cormorant Garamond': '"Cormorant Garamond", Garamond, Georgia, serif',
    'Bebas Neue': '"Bebas Neue", "Avenir Next Condensed", Impact, sans-serif',
    'Oswald': '"Oswald", "Avenir Next Condensed", "Arial Narrow", sans-serif',
    'Space Mono': '"Space Mono", "SF Mono", Menlo, Consolas, monospace'
  };
  const DEFAULT_BG_CORNER_RADIUS = 10, MAX_BG_CORNER_RADIUS = 60;

  const numericOr = (v, f) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
  const bgCornerRadius = (l) => Math.max(0, Math.min(MAX_BG_CORNER_RADIUS, numericOr(l && l.bgCornerRadius, DEFAULT_BG_CORNER_RADIUS)));
  const bgCornerRadiusCss = (l) => bgCornerRadius(l) + 'px';
  const fontStackForFamily = (f) => FONT_STACKS[f] || FONT_STACKS['System Sans'];
  function applyTextTransform(text, t) {
    const v = text || '';
    if (t === 'uppercase') return v.toLocaleUpperCase();
    if (t === 'title') return v.toLowerCase().replace(/\b([a-z])/g, c => c.toLocaleUpperCase());
    return v;
  }
  function hexToRgba(hex, a) {
    const h = (hex || '#000000').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) || 0;
    const g = parseInt(h.slice(2, 4), 16) || 0;
    const b = parseInt(h.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${a})`;
  }

  /* ---------- effect builders (ported verbatim) ---------- */
  function buildTextBoxBackground(layer) {
    const fillStyle = layer.boxFillStyle || 'solid';
    const base = hexToRgba(layer.boxColor || '#000000', layer.boxOpacity ?? 0.45);
    if (fillStyle === 'none') return 'transparent';
    if (fillStyle === 'gradient') {
      const a = layer.boxGradientA || layer.boxColor || '#111827';
      const b = layer.boxGradientB || '#4f46e5';
      const angle = layer.boxGradientAngle ?? 135;
      return `linear-gradient(${angle}deg, ${a}, ${b})`;
    }
    if (fillStyle === 'glass') {
      const highlight = layer.boxInnerHighlight === false
        ? 'transparent'
        : 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04) 42%, transparent 100%)';
      return `${highlight}, ${base}`;
    }
    return base;
  }
  function buildTextBoxBorder(layer) {
    if (!layer.boxBorder) return 'none';
    const width = layer.boxBorderWidth ?? 1;
    let color = layer.boxBorderColor || '#ffffff';
    let opacity = layer.boxBorderOpacity ?? 0.25;
    if (layer.boxBorderStyle === 'gold') { color = '#fff3c4'; opacity = Math.max(opacity, 0.45); }
    else if (layer.boxBorderStyle === 'accent') { color = layer.boxBorderColor || '#67e8f9'; opacity = Math.max(opacity, 0.35); }
    return `${width}px solid ${hexToRgba(color, opacity)}`;
  }
  function buildTextBoxShadow(layer) {
    const shadows = [];
    if (layer.boxShadow !== false) {
      const size = layer.boxShadowSize ?? 18;
      const opacity = layer.boxShadowOpacity ?? 0.35;
      shadows.push(`0 ${Math.round(size * 0.45)}px ${size}px rgba(0,0,0,${opacity})`);
    }
    if (layer.boxGlow) {
      const size = layer.boxGlowSize ?? 16;
      const color = layer.boxGlowColor || '#a78bfa';
      shadows.push(`0 0 ${size}px ${color}`);
      shadows.push(`0 0 ${size * 2}px ${hexToRgba(color, 0.3)}`);
    }
    return shadows.length ? shadows.join(', ') : 'none';
  }
  function buildFrameMaterial(style, layer) {
    const solid = hexToRgba(layer.frameBorderColor || '#ffffff', layer.frameBorderOpacity ?? 1);
    switch (style) {
      case 'rainbow': return { background: 'linear-gradient(120deg, #ff2d6f, #ff8c00, #ffd500, #7bff6a, #00e3ff, #4d6dff, #c56bff, #ff2d6f)', backgroundSize: '300% 300%', className: 'frame-holo-shift' };
      case 'silver': return { background: 'linear-gradient(135deg, #d8d8d8 0%, #ffffff 20%, #8f8f8f 45%, #ffffff 60%, #c6c6c6 80%, #8f8f8f 100%)', backgroundSize: '250% 250%', className: 'frame-holo-shift' };
      case 'gold': return { background: 'linear-gradient(135deg, #8a5a0a 0%, #f7df87 18%, #c89b2a 38%, #fff3c4 55%, #b3801d 75%, #7a4f08 100%)', backgroundSize: '250% 250%', className: 'frame-holo-shift' };
      case 'metal': return { background: 'linear-gradient(135deg, #1e1e1e 0%, #8a8a8a 25%, #2a2a2a 50%, #bdbdbd 65%, #3a3a3a 85%, #1e1e1e 100%)', backgroundSize: '250% 250%', className: 'frame-holo-shift-slow' };
      default: return { background: solid };
    }
  }
  function buildImgHoloOverlay(style, layer) {
    switch (style) {
      case 'gold': return { background: 'linear-gradient(120deg, #8a5a0a, #f7df87, #c89b2a, #fff3c4, #b3801d, #7a4f08, #8a5a0a)', blend: 'overlay' };
      case 'silver': return { background: 'linear-gradient(120deg, #d8d8d8, #ffffff, #8f8f8f, #ffffff, #c6c6c6, #8f8f8f, #d8d8d8)', blend: 'overlay' };
      case 'cosmic': return { background: 'linear-gradient(120deg, #8338ec, #ff006e, #3a86ff, #06d6a0, #ff006e, #8338ec)', blend: 'overlay' };
      case 'fire': return { background: 'linear-gradient(120deg, #ff3131, #ff8c00, #ffd700, #ff6b35, #ff3131)', blend: 'screen' };
      case 'ice': return { background: 'linear-gradient(120deg, #0096c7, #90e0ef, #ffffff, #caf0f8, #0096c7)', blend: 'color-dodge' };
      case 'custom': {
        const a = layer.imgHoloCustomA || '#ff00c8', b = layer.imgHoloCustomB || '#00e3ff', c = layer.imgHoloCustomC || '#ffd500';
        return { background: `linear-gradient(120deg, ${a}, ${b}, ${c}, ${b}, ${a})`, blend: 'overlay' };
      }
      case 'rainbow':
      default: return { background: 'linear-gradient(120deg, #ff2d6f, #ff8c00, #ffd500, #7bff6a, #00e3ff, #4d6dff, #c56bff, #ff2d6f)', blend: 'overlay' };
    }
  }
  function buildFramePattern(pattern, color, opacity, spacing) {
    const c = hexToRgba(color, opacity), t = 'transparent';
    const sp = Math.max(2, spacing), half = sp / 2;
    switch (pattern) {
      case 'lines-v': return `repeating-linear-gradient(90deg,  ${t} 0 ${half}px, ${c} ${half}px ${sp}px)`;
      case 'lines-h': return `repeating-linear-gradient(0deg,   ${t} 0 ${half}px, ${c} ${half}px ${sp}px)`;
      case 'lines-d': return `repeating-linear-gradient(45deg,  ${t} 0 ${half}px, ${c} ${half}px ${sp}px)`;
      case 'lines-dr': return `repeating-linear-gradient(-45deg, ${t} 0 ${half}px, ${c} ${half}px ${sp}px)`;
      case 'dots': return `radial-gradient(${c} 1px, ${t} 1.8px) 0 0 / ${sp}px ${sp}px`;
      case 'micro-dots': return `radial-gradient(${c} 0.8px, ${t} 1.5px) 0 0 / ${sp}px ${sp}px`;
      case 'checker': return `conic-gradient(${c} 0.25turn, ${t} 0.25turn 0.5turn, ${c} 0.5turn 0.75turn, ${t} 0.75turn) 0 0 / ${sp}px ${sp}px`;
      case 'pinstripe': return `repeating-linear-gradient(90deg, ${t} 0 ${sp - 1}px, ${c} ${sp - 1}px ${sp}px)`;
      case 'crosshatch': return `repeating-linear-gradient(45deg, ${t} 0 ${half}px, ${c} ${half}px ${sp}px), repeating-linear-gradient(-45deg, ${t} 0 ${half}px, ${c} ${half}px ${sp}px)`;
      case 'diamond': return `repeating-linear-gradient(45deg, ${t} 0 ${sp - 1}px, ${c} ${sp - 1}px ${sp}px), repeating-linear-gradient(-45deg, ${t} 0 ${sp - 1}px, ${c} ${sp - 1}px ${sp}px)`;
      case 'circuit': return `linear-gradient(90deg, ${c} 1px, ${t} 1px) 0 0 / ${sp}px ${sp}px, linear-gradient(0deg, ${c} 1px, ${t} 1px) 0 0 / ${sp}px ${sp}px, radial-gradient(${c} 1px, ${t} 1.8px) 0 0 / ${sp * 2}px ${sp * 2}px`;
      default: return 'transparent';
    }
  }
  function buildFrameTexture(texture, opacity) {
    const o = opacity ?? 0.18;
    switch (texture) {
      case 'brushed': return `repeating-linear-gradient(105deg, rgba(255,255,255,${o}) 0 1px, transparent 1px 4px)`;
      case 'grain': return `radial-gradient(rgba(255,255,255,${o}) 0.7px, transparent 1.2px) 0 0 / 7px 7px, radial-gradient(rgba(0,0,0,${o * 0.7}) 0.6px, transparent 1.1px) 3px 4px / 9px 9px`;
      case 'carbon': return `linear-gradient(45deg, rgba(255,255,255,${o}) 25%, transparent 25% 75%, rgba(255,255,255,${o}) 75%) 0 0 / 8px 8px, linear-gradient(45deg, transparent 25%, rgba(0,0,0,${o}) 25% 75%, transparent 75%) 4px 4px / 8px 8px`;
      case 'linen': return `repeating-linear-gradient(0deg, rgba(255,255,255,${o}) 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, rgba(0,0,0,${o * 0.7}) 0 1px, transparent 1px 5px)`;
      default: return 'transparent';
    }
  }
  function buildFrameShadow(layer) {
    if (layer.frameShadow === false) return 'none';
    const size = layer.frameShadowSize ?? 16, opacity = layer.frameShadowOpacity ?? 0.26;
    return `0 ${Math.round(size * 0.45)}px ${size}px rgba(0,0,0,${opacity})`;
  }

  /* ---------- src resolution against the preset folder ---------- */
  function resolveSrc(src, baseURL) {
    if (!src) return null;
    if (/^data:/.test(src) || /^https?:\/\//.test(src) || src.startsWith('/')) return src;
    return baseURL + src.replace(/^\.?\//, '');
  }

  /* ---------- order layers by the preset's explicit order array ---------- */
  function orderLayers(layers, order) {
    if (!Array.isArray(layers)) return [];
    if (!Array.isArray(order) || !order.length) return layers.slice();
    const byId = new Map(layers.map(l => [l.id, l]));
    const out = [];
    order.forEach(id => { if (byId.has(id)) { out.push(byId.get(id)); byId.delete(id); } });
    byId.forEach(l => out.push(l)); // any layers not listed in order go last
    return out;
  }

  /* ============================================================
     renderFace — paints one face (front or back) into `faceEl`.
     ============================================================ */
  function renderFace(faceEl, layers, order, bgColor, cardW, cardH, baseURL) {
    const ordered = orderLayers(layers, order);
    const faceBgLayer = ordered.find(l => l.type === 'bg');
    const faceRadius = bgCornerRadiusCss(faceBgLayer);
    faceEl.style.background = bgColor || '#0A0E27';
    faceEl.style.borderRadius = faceRadius;
    faceEl.innerHTML = '';

    ordered.forEach(layer => {
      if (layer.visible === false) return;
      const isImageLike = layer.type === 'img' || layer.type === 'bg';

      /* ── TEXT ── */
      if (layer.type === 'text') {
        const pX = layer.boxEnabled ? (layer.boxPaddingX ?? 18) : 0;
        const pY = layer.boxEnabled ? (layer.boxPaddingY ?? 10) : 0;
        const textAlign = layer.textAlign || 'center';

        const container = document.createElement('div');
        container.className = 'card-text-layer';
        container.style.cssText = `
          left:${layer.x ?? 50}%; top:${layer.y ?? 50}%; width:${layer.width ?? 80}%;
          transform:translateX(-50%) translateY(-50%) translateZ(${layer.depth || 0}px);
          transform-style:preserve-3d; opacity:${layer.opacity ?? 1};
          padding:${pY}px ${pX}px; box-sizing:border-box; text-align:${textAlign};`;

        if (layer.boxEnabled) {
          const zGap = layer.boxZGap ?? 6;
          const blurVal = layer.boxBlur ? `blur(${layer.boxBlurAmount ?? 10}px)` : 'none';
          const box = document.createElement('div');
          box.style.cssText = `
            position:absolute; inset:0; border-radius:${layer.boxRadius ?? 14}px;
            background:${buildTextBoxBackground(layer)}; transform:translateZ(-${zGap}px);
            border:${buildTextBoxBorder(layer)}; box-shadow:${buildTextBoxShadow(layer)};
            backdrop-filter:${blurVal}; -webkit-backdrop-filter:${blurVal}; pointer-events:none;`;
          container.appendChild(box);
        }

        const textEl = document.createElement('div');
        textEl.style.position = 'relative';
        textEl.style.fontFamily = fontStackForFamily(layer.fontFamily || 'System Sans');
        textEl.style.fontSize = `${layer.fontSize || 22}px`;
        textEl.style.fontWeight = layer.fontWeight || '700';
        textEl.style.fontStyle = layer.fontStyle || 'normal';
        textEl.style.color = layer.color || '#ffffff';
        textEl.style.letterSpacing = `${layer.letterSpacing || 0}em`;
        textEl.style.lineHeight = layer.lineHeight || 1.3;
        textEl.style.textShadow = layer.textShadow ? '0 2px 10px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.9)' : 'none';
        textEl.style.whiteSpace = textAlign === 'justify' ? 'normal' : 'pre-wrap';
        textEl.style.wordBreak = 'break-word';
        textEl.textContent = applyTextTransform(layer.content || '', layer.textTransform || 'none');
        container.appendChild(textEl);
        faceEl.appendChild(container);
        return;
      }

      /* ── FRAME ── */
      if (layer.type === 'frame') {
        const shape = layer.frameShape || 'rect';
        const bdrW = Math.max(0, layer.frameBorderWidth ?? 6);
        const fillRgba = hexToRgba(layer.frameFillColor || '#ffffff', layer.frameFillOpacity ?? 0);
        const style = layer.frameBorderStyle || 'solid';
        const pattern = layer.frameBorderPattern || 'none';
        const texture = layer.frameBorderTexture || 'none';
        const patColor = layer.frameBorderPatternColor || '#000000';
        const patOpac = layer.frameBorderPatternOpacity ?? 0.35;
        const patSp = Math.max(2, layer.frameBorderPatternSpacing ?? 8);
        const sparkle = !!layer.frameSparkle;
        const cr = Math.max(0, layer.frameCornerRadius ?? 14);
        const rad = shape === 'circle' ? '50%' : `${cr}px`;
        const innerRad = shape === 'circle' ? '50%' : `${Math.max(0, cr - bdrW)}px`;
        const ringMask = `-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;padding:${bdrW}px;box-sizing:border-box;`;

        const frameEl = document.createElement('div');
        frameEl.className = 'card-layer card-frame-layer';
        frameEl.style.cssText = `
          inset:auto; left:${layer.frameX ?? 50}%; top:${layer.frameY ?? 50}%;
          width:${layer.frameWidth ?? 60}%; height:${layer.frameHeight ?? 40}%;
          transform:translateX(-50%) translateY(-50%) translateZ(${layer.depth || 0}px);
          opacity:${layer.opacity ?? 1}; border-radius:${rad}; box-sizing:border-box; pointer-events:none;
          filter:${layer.frameShadow === false ? 'none' : `drop-shadow(${buildFrameShadow(layer)})`};`;

        if ((layer.frameFillOpacity ?? 0) > 0) {
          const fillEl = document.createElement('div');
          fillEl.style.cssText = `position:absolute; inset:${bdrW}px; background:${fillRgba}; border-radius:${innerRad};`;
          frameEl.appendChild(fillEl);
        }
        if (bdrW > 0) {
          const mat = buildFrameMaterial(style, layer);
          const ringEl = document.createElement('div');
          ringEl.className = 'frame-ring' + (mat.className ? ' ' + mat.className : '');
          ringEl.style.cssText = `position:absolute; inset:0; border-radius:inherit; background:${mat.background}; background-size:${mat.backgroundSize || 'auto'}; ${ringMask}`;
          frameEl.appendChild(ringEl);
          if (texture !== 'none') {
            const texEl = document.createElement('div');
            texEl.style.cssText = `position:absolute; inset:0; border-radius:inherit; background:${buildFrameTexture(texture, layer.frameBorderTextureOpacity ?? 0.18)}; mix-blend-mode:overlay; ${ringMask} pointer-events:none;`;
            frameEl.appendChild(texEl);
          }
          if (layer.frameBevel !== false) {
            const bevelEl = document.createElement('div');
            bevelEl.style.cssText = `position:absolute; inset:0; border-radius:inherit; background:linear-gradient(145deg, rgba(255,255,255,0.34), transparent 32%, rgba(0,0,0,0.24) 72%, rgba(255,255,255,0.12)); mix-blend-mode:soft-light; ${ringMask} pointer-events:none;`;
            frameEl.appendChild(bevelEl);
          }
          if (pattern !== 'none') {
            const patEl = document.createElement('div');
            patEl.style.cssText = `position:absolute; inset:0; border-radius:inherit; background:${buildFramePattern(pattern, patColor, patOpac, patSp)}; ${ringMask} pointer-events:none;`;
            frameEl.appendChild(patEl);
          }
          if (sparkle) {
            const spEl = document.createElement('div');
            spEl.className = 'frame-sparkle-overlay';
            spEl.style.cssText = `position:absolute; inset:0; border-radius:inherit; ${ringMask} pointer-events:none;`;
            frameEl.appendChild(spEl);
          }
          if (layer.frameOuterBorder) {
            const outerEl = document.createElement('div');
            outerEl.style.cssText = `position:absolute; inset:0; border-radius:inherit; border:${layer.frameOuterBorderWidth ?? 1}px solid ${hexToRgba(layer.frameOuterBorderColor || '#ffffff', layer.frameOuterBorderOpacity ?? 0.25)}; box-sizing:border-box; pointer-events:none;`;
            frameEl.appendChild(outerEl);
          }
          if (layer.frameInnerBorder) {
            const innerEl = document.createElement('div');
            innerEl.style.cssText = `position:absolute; inset:${bdrW}px; border-radius:${innerRad}; border:${layer.frameInnerBorderWidth ?? 1}px solid ${hexToRgba(layer.frameInnerBorderColor || '#ffffff', layer.frameInnerBorderOpacity ?? 0.35)}; box-sizing:border-box; pointer-events:none;`;
            frameEl.appendChild(innerEl);
          }
        }
        faceEl.appendChild(frameEl);
        return;
      }

      /* ── IMAGE / BG ── */
      const src = resolveSrc(layer.src, baseURL);
      const div = document.createElement('div');
      div.className = 'card-layer';
      div.style.opacity = layer.opacity ?? 1;

      if (layer.type === 'img' && layer.imgFull === false) {
        const scale = layer.imgScale ?? 80;
        const sx = (layer.imgStretchX ?? 100) / 100;
        const sy = (layer.imgStretchY ?? 100) / 100;
        const radius = layer.imgRadius ?? 0;
        div.style.inset = 'auto';
        div.style.left = `${layer.imgX ?? 50}%`;
        div.style.top = `${layer.imgY ?? 50}%`;
        div.style.width = `${scale * sx}%`;
        div.style.height = `${scale * sy}%`;
        div.style.transform = `translateX(-50%) translateY(-50%) translateZ(${layer.depth || 0}px)`;
        div.style.borderRadius = `${radius}%`;
        div.style.overflow = 'hidden';
        if (src) {
          const img = document.createElement('img');
          img.src = src; img.draggable = false;
          img.style.cssText = `width:100%; height:100%; object-fit:fill; display:block; border-radius:${radius}%;`;
          div.appendChild(img);
        } else { return; } // no placeholder on the public site
      } else {
        const fullRadius = layer.type === 'bg' ? bgCornerRadius(layer) : 18;
        div.style.transform = `translateZ(${layer.depth || 0}px)`;
        div.style.borderRadius = `${fullRadius}px`;
        if (layer.type === 'bg' && src) {
          div.style.background = `url("${src}") center/cover no-repeat`;
        } else if (layer.type === 'bg' && layer.gradient) {
          div.style.background = layer.gradient;            // site-only extension for image-free default cards
        } else if (layer.type === 'img' && src) {
          const img = document.createElement('img');
          img.src = src; img.draggable = false;
          img.style.cssText = `width:100%; height:100%; object-fit:cover; display:block; border-radius:${fullRadius}px;`;
          div.appendChild(img);
        } else if (layer.type === 'bg') {
          div.style.background = bgColor || 'transparent'; // solid fallback, no dashed placeholder
        } else { return; }
      }

      /* ── tint overlay ── */
      if (isImageLike && src && layer.imgTint) {
        const tintColor = layer.imgTintColor || '#5B9BFF';
        const tintIntens = layer.imgTintIntensity ?? 0.6;
        const positioned = layer.type === 'img' && layer.imgFull === false;
        const tintRadius = positioned ? `${layer.imgRadius ?? 0}%` : (layer.type === 'bg' ? bgCornerRadiusCss(layer) : '18px');
        const maskSize = positioned ? '100% 100%' : 'cover';
        const tintEl = document.createElement('div');
        tintEl.style.cssText = `position:absolute; inset:0; border-radius:${tintRadius}; background:${tintColor}; mix-blend-mode:color; opacity:${tintIntens}; pointer-events:none;
          -webkit-mask-image:url("${src}"); mask-image:url("${src}"); -webkit-mask-size:${maskSize}; mask-size:${maskSize};
          -webkit-mask-position:center; mask-position:center; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;`;
        div.appendChild(tintEl);
      }

      /* ── holographic foil ── */
      if (isImageLike && src && layer.imgHolo) {
        const intens = layer.imgHoloIntensity ?? 0.55;
        const overlay = buildImgHoloOverlay(layer.imgHoloStyle || 'rainbow', layer);
        const positioned = layer.type === 'img' && layer.imgFull === false;
        const overlayRadius = positioned ? `${layer.imgRadius ?? 0}%` : (layer.type === 'bg' ? bgCornerRadiusCss(layer) : '18px');
        const maskSize = positioned ? '100% 100%' : 'cover';
        const maskCss = `-webkit-mask-image:url("${src}"); mask-image:url("${src}"); -webkit-mask-size:${maskSize}; mask-size:${maskSize}; -webkit-mask-position:center; mask-position:center; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat;`;

        const holoEl = document.createElement('div');
        holoEl.className = 'img-holo-tilt';
        holoEl.style.cssText = `position:absolute; inset:0; border-radius:${overlayRadius}; background:${overlay.background}; background-size:260% 260%; mix-blend-mode:${overlay.blend}; opacity:${intens}; pointer-events:none; ${maskCss}`;
        div.appendChild(holoEl);

        const specEl = document.createElement('div');
        specEl.className = 'img-holo-specular';
        specEl.style.cssText = `position:absolute; inset:0; border-radius:${overlayRadius}; opacity:${Math.min(1, intens * 1.4)}; pointer-events:none; ${maskCss}`;
        div.appendChild(specEl);

        if (layer.imgHoloSparkle) {
          const spEl = document.createElement('div');
          spEl.className = 'frame-sparkle-overlay';
          spEl.style.cssText = `position:absolute; inset:0; border-radius:${overlayRadius}; pointer-events:none; ${maskCss}`;
          div.appendChild(spEl);
        }
      }
      faceEl.appendChild(div);
    });
  }

  /* ============================================================
     CardInstance — fetch a preset, build both faces, wire 3D.
     ============================================================ */
  async function fetchPreset(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function baseDirOf(presetUrl) {
    return presetUrl.replace(/[^/]*$/, ''); // strip filename, keep trailing slash
  }

  async function mountCard(host) {
    // Resolve which preset file to load. data-preset can be a folder ("./cards/01/")
    // or a direct file ("./cards/01/card.cardpreset").
    let presetPath = host.getAttribute('data-preset') || DEFAULT_PRESET;
    if (!/\.cardpreset(\?|$)/.test(presetPath)) {
      presetPath = presetPath.replace(/\/?$/, '/') + 'card.cardpreset';
    }

    let preset, baseURL;
    try {
      preset = await fetchPreset(presetPath);
      baseURL = baseDirOf(presetPath);
    } catch (e) {
      try { preset = await fetchPreset(DEFAULT_PRESET); baseURL = baseDirOf(DEFAULT_PRESET); }
      catch (e2) { host.classList.add('pcard--failed'); return; }
    }

    const cardW = (preset.cardSize && preset.cardSize.width) || 280;
    const cardH = (preset.cardSize && preset.cardSize.height) || 380;

    // Build DOM — mirror the Card Studio editor's 3D rig exactly:
    //   perspective(viewport) → scale(fit slot) → float(idle anim) → rotate(drag/flip) → faces
    // Keeping the idle float and the drag rotation on SEPARATE nested elements is
    // what the editor does, so the autonomous float and the drag spin compose.
    host.classList.add('pcard--ready');
    host.style.setProperty('--card-w', cardW);
    host.style.setProperty('--card-h', cardH);

    const mk = (cls) => { const d = document.createElement('div'); d.className = cls; return d; };
    const viewport = mk('pcard__viewport');  // perspective
    const scaleEl  = mk('pcard__scale');     // shrinks the fixed cardW×cardH card into the slot
    const floatEl  = mk('pcard__float');     // idle float (the editor's cardFloat)
    const inner    = mk('pcard__inner');     // drag / flip rotation
    const front    = mk('pcard__face pcard__face--front');
    const back     = mk('pcard__face pcard__face--back');
    inner.appendChild(front); inner.appendChild(back);
    floatEl.appendChild(inner);
    scaleEl.appendChild(floatEl);
    viewport.appendChild(scaleEl);

    scaleEl.style.width = cardW + 'px';
    scaleEl.style.height = cardH + 'px';

    renderFace(front, preset.frontLayers || [], preset.frontLayerOrder, preset.frontBgColor, cardW, cardH, baseURL);
    renderFace(back, preset.backLayers || [], preset.backLayerOrder, preset.backBgColor || preset.frontBgColor, cardW, cardH, baseURL);

    // keep any pre-existing slot number badge on top
    host.insertBefore(viewport, host.firstChild);

    fitScale(host, scaleEl, cardW);
    attachInteractions(host, scaleEl, floatEl, inner, cardW);
  }

  function fitScale(host, scaleEl, cardW) {
    const w = host.clientWidth || cardW;
    scaleEl.style.setProperty('--pscale', (w / cardW).toFixed(4));
  }

  /* ---------- 3D interaction — faithful to the Card Studio editor ----------
     • idle    → the card gently floats (CSS .pcard__float animation)
     • drag    → free-spin on Y (×0.5), tilt on X (clamped ±25°); shine tracks tilt
     • release → settle to the nearest face (0° / 180°), shine returns to centre,
                 float resumes after the snap
     • dblclick / Enter / Space → flip
     rotY/rotX live on the inner (rotate) layer; the float lives on its parent,
     so the autonomous float and the drag spin compose — exactly like the editor.
     ------------------------------------------------------------------------ */
  function attachInteractions(host, scaleEl, floatEl, rotEl, cardW) {
    let rotX = 0, rotY = 0, isFlipped = false, dragging = false, prevX = 0, prevY = 0;

    const setT = () => { rotEl.style.transform = `rotateY(${rotY}deg) rotateX(${rotX}deg)`; };
    const syncHolo = () => {
      host.style.setProperty('--holo-tx', (rotY * 1.8).toFixed(2) + '%');
      host.style.setProperty('--holo-ty', (rotX * 1.8).toFixed(2) + '%');
    };

    // reduced motion → no float, no drag; static front face
    if (reduce) { floatEl.style.animation = 'none'; return; }

    const stopFloat  = () => { floatEl.style.animation = 'none'; };
    const startFloat = () => { floatEl.style.animation = ''; }; // revert to the stylesheet value

    host.addEventListener('pointerdown', (e) => {
      dragging = true; prevX = e.clientX; prevY = e.clientY;
      rotEl.style.transition = 'none'; stopFloat();
      if (host.setPointerCapture) { try { host.setPointerCapture(e.pointerId); } catch (_) {} }
    });
    host.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - prevX, dy = e.clientY - prevY;
      rotY += dx * 0.5;
      rotX = Math.max(-25, Math.min(25, rotX - dy * 0.3));
      if (rotY > 180) rotY -= 360;
      if (rotY < -180) rotY += 360;
      setT(); syncHolo();
      prevX = e.clientX; prevY = e.clientY;
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      rotEl.style.transition = 'transform 0.8s ease-out';
      rotY = Math.round(rotY / 180) * 180;
      rotX = 0;
      isFlipped = ((rotY / 180) % 2 !== 0);
      setT();
      host.style.removeProperty('--holo-tx');   // shine settles back to centre
      host.style.removeProperty('--holo-ty');
      setTimeout(startFloat, 900);
    };
    host.addEventListener('pointerup', endDrag);
    host.addEventListener('pointercancel', endDrag);

    const flip = () => {
      rotY = isFlipped ? 0 : 180;
      isFlipped = !isFlipped;
      rotEl.style.transition = 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)';
      setT();
    };
    host.addEventListener('dblclick', flip);
    host.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });

    // keep scale correct on resize
    let rT;
    window.addEventListener('resize', () => {
      clearTimeout(rT);
      rT = setTimeout(() => fitScale(host, scaleEl, cardW), 150);
    }, { passive: true });
  }

  /* ---------- lazy mount via IntersectionObserver ---------- */
  function init() {
    const hosts = [...document.querySelectorAll('.pcard[data-preset]')];
    if (!hosts.length) return;
    const mounted = new WeakSet();
    const go = (h) => { if (mounted.has(h)) return; mounted.add(h); mountCard(h); };
    if (!('IntersectionObserver' in window)) { hosts.forEach(go); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { io.unobserve(en.target); go(en.target); }
      });
    }, { rootMargin: '200px 0px' });
    hosts.forEach(h => io.observe(h));
    // Safety net: in zero-area / embedded / headless viewports the observer's
    // root can never intersect, so mount any still-unmounted card after a beat.
    // In a normal browser the IO fires long before this, so lazy-load is intact.
    setTimeout(() => hosts.forEach(go), 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
