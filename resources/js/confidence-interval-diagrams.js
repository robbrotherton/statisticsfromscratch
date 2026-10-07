/* Point-and-interval views share geometry; only the null model has a density. */
(function (global) {
  const stats = global.sfsStats;
  const blue = 'var(--sfs-confidence-color, #2f6f9f)';
  const red = 'var(--sfs-critical-color, #c63f3f)';
  const fmt = d3.format('.2f');
  const reduced = () => document.documentElement.dataset.motion === 'reduced' ||
    global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function interval(m, sigma, n, confidence = 95) {
    const se = sigma / Math.sqrt(n);
    const margin = stats.normalInv((1 + confidence / 100) / 2) * se;
    return { m, se, margin, lower: m - margin, upper: m + margin };
  }
  global.sfsConfidenceInterval = interval;
  function bar(g, half, color, dot = true) {
    g.attr('data-half',half).attr('stroke', color).attr('stroke-width', 2.5).attr('fill', 'none');
    g.selectAll('path').data([half]).join('path')
      .attr('d', h => `M${-h},-6V6M${-h},0H${h}M${h},-6V6`);
    g.selectAll('circle').data(dot ? [0] : []).join('circle')
      .attr('r', 4.5).attr('fill', color).attr('stroke', 'var(--bs-body-bg, white)').attr('stroke-width', 1.5);
  }
  function text(g, x, y, value, anchor = 'start') {
    return g.append('text').attr('x', x).attr('y', y).attr('text-anchor', anchor).text(value);
  }
  // Static math labels (e.g. σ_M) need tspans; only call this with trusted strings.
  function mathText(g, x, y, html, anchor = 'start') {
    return g.append('text').attr('x', x).attr('y', y).attr('text-anchor', anchor).html(html);
  }
  const sigmaM = "<tspan font-style='italic'>σ</tspan><tspan baseline-shift='sub' font-size='70%' font-style='italic'>M</tspan>";
  function setup(className) {
    const root = d3.create('div').attr('class', `${className} sfs-figure ci-interval-system`);
    const svg = root.append('svg').attr('role', 'img').attr('class', 'sfs-svg');
    return { root, svg };
  }
  function attachTutorial(root, applyAction) {
    let attempts = 0;
    function setup() {
      if (!root.isConnected) { if (++attempts < 60) requestAnimationFrame(setup); return; }
      const footer = root.closest('.callout')?.querySelector('.callout-footer');
      if (!footer || footer.dataset.sfsIfTutorial === 'true') return;
      const steps = Array.from(footer.children).filter(n => n.classList.contains('tutorial-step'));
      global.interactiveFigure.createTutorial({root, footer, steps, applyAction});
    }
    requestAnimationFrame(setup);
  }
  function observe(root, render) {
    let last = 0;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width > 0 && width !== last) { last = width; render(false); }
    });
    observer.observe(root.node());
    return observer;
  }

  global.makeIntervalDiagram = function (opts = {}) {
    const { root, svg } = setup('ci-single-interval');
    const state = { m: opts.m ?? 7, sigma: opts.sigma ?? Math.sqrt(14), n: opts.n ?? 6, confidence: opts.confidence ?? 95, shown: [] };
    const domain = opts.xDomain || (opts.mode === 'width' ? [265, 380] : [1, 13]);
    const readout = root.append('p').attr('class', 'ci-diagram-readout');
    // Width mode reuses Chapter 9's factor sliders; steps pick which one shows.
    // nRange and sigmaRange ([min, max, step]) fit the sliders to the example's units.
    const factors = opts.mode === 'width' ? [
      {key:'confidence', label:'Confidence level', color:blue, range:[50,99,1], tex:() => `${state.confidence}\\%\\text{ confidence}`},
      {key:'n', label:'Sample size', color:'var(--graph-series-3, #009e73)', range:opts.nRange || [5,100,1], tex:() => `n = ${state.n}`},
      {key:'sigma', label:'Population standard deviation', color:'var(--graph-series-2, #e69f00)', range:opts.sigmaRange || [10,100,1], tex:() => `\\sigma = ${state.sigma}`}
    ] : [];
    const strip = factors.length ? root.append('div').attr('class', 'sp-factors') : null;
    for (const f of factors) {
      f.row = strip.append('div').attr('class', 'sp-factor').attr('hidden', '').style('--sp-factor-color', f.color);
      const label = f.row.append('label').attr('class', 'sp-factor-slider');
      f.value = label.append('span').attr('class', 'sp-factor-value').style('min-width', '7.5rem');
      f.input = label.append('input').attr('type', 'range').attr('aria-label', f.label).attr('data-prevent-swipe', '')
        .attr('min', f.range[0]).attr('max', f.range[1]).attr('step', f.range[2])
        .on('input', function () { state[f.key] = Number(this.value); render(false); });
    }
    function syncFactors() {
      for (const f of factors) {
        f.row.attr('hidden', state.shown.includes(f.key) ? null : '');
        f.input.property('value', state[f.key])
          .style('--sp-fill', `${100 * (state[f.key] - f.range[0]) / (f.range[1] - f.range[0])}%`);
        const tex = f.tex();
        if (f.value.attr('data-tex') === tex) continue;
        f.value.attr('data-tex', tex).node().replaceChildren(global.interactiveFigure?.inlineMath
          ? global.interactiveFigure.inlineMath(tex) : document.createTextNode(`${f.label}: ${state[f.key]}`));
      }
    }
    function render(animate = false) {
      const width = Math.max(280, root.node().clientWidth || 640);
      const x = d3.scaleLinear().domain(domain).range([30, width - 30]);
      const p = interval(state.m, state.sigma, state.n, state.confidence);
      svg.selectAll('*').interrupt();
      svg.attr('viewBox', `0 0 ${width} ${opts.mode === 'anatomy' || opts.mode === 'equation' ? 145 : 154}`).attr('aria-label',
        `${state.confidence}% confidence interval: estimate ${fmt(p.m)}, lower ${fmt(p.lower)}, upper ${fmt(p.upper)}; margin of error ${fmt(p.margin)}.`);
      const g = svg.selectAll('g.ci-static-layer').data([0]).join('g').attr('class', 'ci-static-layer');
      g.selectAll('*').remove();
      const anatomy = opts.mode === 'anatomy' || opts.mode === 'equation';
      if (anatomy) {
        text(g, x(p.m), 25, 'Point estimate', 'middle');
        g.append('line').attr('x1', x(p.m)).attr('x2', x(p.m)).attr('y1', 32).attr('y2', 65).attr('stroke', 'currentColor').attr('opacity', .45);
        if (opts.mode === 'equation') mathText(g, x(p.lower)-10, 79, `<tspan font-style='italic'>M</tspan> − <tspan font-style='italic'>z</tspan> × ${sigmaM}`, 'end');
        else text(g, x(p.lower)-10, 79, 'Lower limit', 'end');
        if (opts.mode === 'equation') mathText(g, x(p.upper)+10, 79, `<tspan font-style='italic'>M</tspan> + <tspan font-style='italic'>z</tspan> × ${sigmaM}`);
        else text(g, x(p.upper)+10, 79, 'Upper limit');
        const yy = 107;
        g.append('line').attr('class','ci-margin-guide').attr('x1',x(p.m)).attr('x2',x(p.upper)).attr('y1',yy).attr('y2',yy).attr('stroke','currentColor').attr('stroke-dasharray','4 4').attr('stroke-width',1.5);
        if (opts.mode === 'equation') mathText(g, (x(p.m) + x(p.upper))/2, 132, `<tspan font-style='italic'>z</tspan> × ${sigmaM}`, 'middle');
        else text(g, (x(p.m) + x(p.upper))/2, 132, 'Margin of error', 'middle');
      } else {
        g.append('g').attr('transform', 'translate(0,109)').call(d3.axisBottom(x).ticks(width < 420 ? 4 : 7).tickSizeOuter(0));
        text(g, width/2, 146, opts.units || 'Population mean', 'middle');
        text(g, x(p.m), 39, `M = ${fmt(p.m)}`, 'middle');
        text(g, x(p.lower), 92, fmt(p.lower), 'middle');
        text(g, x(p.upper), 92, fmt(p.upper), 'middle');
      }
      const point = svg.selectAll('g.ci-single-bar').data([0]).join('g').attr('class', 'ci-single-bar');
      const half = x(p.upper)-x(p.m);
      // Interpolate endpoints only; the fixed axis and point remain stationary.
      const oldHalf = Number(point.attr('data-half')) || half;
      point.attr('transform', `translate(${x(p.m)},${anatomy ? 75 : 65})`).attr('data-half',half);
      if (animate && !reduced()) point.transition().duration(550).tween('interval', () => {
        const lerp = d3.interpolateNumber(oldHalf, half); return t => bar(point, lerp(t), blue);
      }); else bar(point, half, blue);
      readout.text(anatomy ? '' : opts.mode === 'width' ? `Margin of error ${fmt(p.margin)} · width ${fmt(2 * p.margin)} · standard error ${fmt(p.se)}` : `${state.confidence}% confidence interval`);
      syncFactors();
      root.node().intervalState = { ...state, ...p };
    }
    const applyAction = action => {
      if (action.n !== undefined) state.n = Math.max(2, Number(action.n));
      if (action['population-sd'] !== undefined) state.sigma = Math.max(.01, Number(action['population-sd']));
      if (action.confidence !== undefined) state.confidence = Math.max(50, Math.min(99, Number(action.confidence)));
      if (action['show-controls'] !== undefined) state.shown = [].concat(action['show-controls']);
      render(action.animate !== false);
    };
    render();
    const observer = observe(root, render);
    root.node().intervalDiagram = { applyAction, dispose() { observer.disconnect(); svg.selectAll('*').interrupt(); } };
    global.interactiveFigure.adopt(root.node(), {dispose:root.node().intervalDiagram.dispose});
    if (opts.mode === 'width') attachTutorial(root.node(), applyAction);
    return root.node();
  };

  global.makeCiConstruction = function (opts = {}) {
    const samples = opts.sampleFigures.map(id => {
      const mount = document.querySelector(`[data-interactive-figure="${id}"]`);
      if (!mount) throw new Error(`Missing opening card figure: ${id}`);
      const sample = JSON.parse(mount.dataset.interactiveOptions);
      return {...sample, m: d3.mean(sample.ranks), n: sample.ranks.length};
    });
    const { root, svg } = setup('ci-construction');
    const viewport = root.insert('div', 'svg').attr('class','ci-construction-viewport');
    const scene = viewport.append('div').attr('class','ci-construction-scene');
    scene.node().appendChild(svg.node());
    const source = scene.insert('div', 'svg').attr('class','ci-construction-source');
    const tray = source.append('div').attr('class','ci-construction-cards');
    const sampleLabel = source.append('p').attr('class','ci-diagram-readout ci-sample-label');
    const readout = scene.append('p').attr('class','ci-diagram-readout').attr('aria-live','polite');
    const fixed = svg.append('g').attr('class','ci-construction-fixed');
    const tracker = svg.append('g').attr('class','ci-estimate-tracker');
    const moving = svg.append('g').attr('class','ci-transfer-bar');
    const state = {sample:0, stage:0, summary:false};
    let previousSample = -1;
    let renderedSe = null;
    let renderedSummary = false;
    const layoutDuration = 680;
    const mu0 = opts.mu0 ?? 7;
    const sigma = Math.sqrt(14);
    function interruptMotion() {
      root.selectAll('*').interrupt();
    }
    function render(animate = false) {
      interruptMotion();
      const motion = animate && !reduced();
      const width = Math.max(280, root.node().clientWidth || 640);
      const x = d3.scaleLinear().domain([-1,15]).range([132,width-22]);
      const sample = samples[state.sample];
      const p = interval(sample.m,sigma,sample.n);
      const letter = String.fromCharCode(65 + state.sample);
      const sampleChanged = state.sample !== previousSample;
      if (sampleChanged) {
        tray.selectAll('*').remove();
        tray.node().appendChild(global.makePlayingCardHand({...sample, animate:false}));
        previousSample = state.sample;
      }
      sampleLabel.text(`Sample ${letter} · n = ${sample.n} · M = ${fmt(sample.m)}`);
      const summary = state.summary;
      const layoutChanged = summary !== renderedSummary;
      const layoutTarget = selection => motion && layoutChanged
        ? selection.transition().duration(layoutDuration).ease(d3.easeCubicInOut)
        : selection;
      root.classed('is-summary',summary);
      const curveBase = 140, nullY = 158, sampleY = 268;
      svg.attr('viewBox', `0 0 ${width} 500`);
      // Scroll one intact scene through a clipped window: every mark moves together.
      const svgScale = svg.node().getBoundingClientRect().height / 500;
      const scrollTop = source.node().getBoundingClientRect().height + 216 * svgScale;
      const fullHeight = scene.node().getBoundingClientRect().height;
      layoutTarget(viewport).style('height',`${summary ? 284 * svgScale : fullHeight}px`);
      layoutTarget(scene).style('transform',`translateY(${summary ? -scrollTop : 0}px)`);
      if (!summary) fixed.selectAll('*').remove();
      const spreadDelay = motion && !summary && !renderedSummary && renderedSe !== null && Math.abs(renderedSe-p.se)>1e-8
        ? layoutDuration : 0;
      const intervalDelay = spreadDelay ? spreadDelay + 180 : 0;
      const axisY = sampleY + (samples.length - 1) * 80 + 39;
      tracker.selectAll('g.ci-tracker-axis').data([0]).join('g')
        .attr('class','ci-tracker-axis').attr('transform',`translate(0,${axisY})`)
        .call(d3.axisBottom(x).tickValues([1,4,7,10,13]).tickSizeOuter(0));
      tracker.selectAll('text.ci-tracker-title').data([0]).join('text')
        .attr('class','ci-tracker-title').attr('x',22).attr('y',sampleY-43)
        .text('Observed sample means');
      tracker.selectAll('text.ci-tracker-units').data([0]).join('text')
        .attr('class','ci-tracker-units').attr('x',(x(-1)+x(15))/2).attr('y',axisY+28)
        .attr('text-anchor','middle').text('Mean card value');
      tracker.selectAll('line.ci-null-reference').data([0]).join('line')
        .attr('class','ci-null-reference').attr('x1',x(mu0)).attr('x2',x(mu0))
        .attr('y1',sampleY-27).attr('y2',axisY).attr('stroke','currentColor')
        .attr('stroke-dasharray','4 4').attr('opacity',.35);
      tracker.selectAll('text.ci-null-reference-label').data(summary ? [0] : []).join('text')
        .attr('class','ci-null-reference-label').attr('x',x(mu0)+8).attr('y',sampleY-35).text('μ₀ = 7');
      // Derive completed rows from the tutorial step so Back and direct links agree.
      const visibleSamples = samples.slice(0,state.sample+1);
      const rows = tracker.selectAll('g.ci-estimate-row').data(visibleSamples,(_,i)=>i).join('g')
        .attr('class','ci-estimate-row').attr('transform',(_,i)=>`translate(0,${sampleY+i*80})`);
      rows.each(function(s,i) {
        const row=d3.select(this), pi=interval(s.m,sigma,s.n);
        const complete=summary || i<state.sample || state.stage===2;
        const active=i===state.sample && !summary;
        const color=complete && (pi.lower>mu0 || pi.upper<mu0) ? red : blue;
        row.selectAll('*').interrupt().remove();
        text(row,12,-6,`Sample ${String.fromCharCode(65+i)}: 95% CI`).attr('class','ci-row-label');
        text(row,12,12,`n = ${s.n}`).attr('class','ci-row-label');
        text(row,x(s.m),-17,`M = ${fmt(s.m)}`,'middle');
        row.append('circle').attr('cx',x(s.m)).attr('r',4.5).attr('fill',color);
        // The active interval uses the existing transfer animation; earlier ones stay here.
        if (complete && !active) bar(row.append('g').attr('transform',`translate(${x(s.m)},0)`),x(pi.upper)-x(s.m),color);
        if (complete) {
          const labels=row.append('g').attr('class','ci-endpoint-labels');
          text(labels,x(pi.lower),23,fmt(pi.lower),'middle');
          text(labels,x(pi.upper),23,fmt(pi.upper),'middle');
          if(active && motion) labels.attr('opacity',0).transition().delay(intervalDelay+800).duration(250).attr('opacity',1);
        }
      });
      if (summary) {
        moving.attr('opacity',0);
        svg.attr('aria-label','Three selected intervals. A: 2.77 to 11.23; B: 4.01 to 9.99; C: 7.51 to 13.49. A and B include 7; C does not.');
      } else {
        text(fixed,22,20,'Null sampling model: μ₀ = 7');
        const data = d3.range(-1,15.025,.025);
        const criticalZ = p.margin/p.se;
        const curveTop = 42;
        const density = d3.scaleLinear().range([curveBase,curveTop]);
        function drawNull(se) {
          renderedSe = se;
          density.domain([0,stats.normalPdf(mu0,mu0,se)]);
          const lowerCritical = mu0-criticalZ*se, upperCritical = mu0+criticalZ*se;
          const tailArea = d3.area().x(x).y0(curveBase).y1(v=>density(stats.normalPdf(v,mu0,se)));
          fixed.selectAll('path.ci-critical-region')
            .data([
              [...data.filter(v=>v<lowerCritical),lowerCritical],
              [upperCritical,...data.filter(v=>v>upperCritical)]
            ]).join('path').attr('class','ci-critical-region').attr('d',tailArea)
            .attr('fill',red).attr('opacity',.35).attr('stroke','none');
          fixed.selectAll('path.ci-null-curve').data([0]).join('path').attr('class','ci-null-curve')
            .attr('d',d3.line().x(x).y(v=>density(stats.normalPdf(v,mu0,se)))(data))
            .attr('fill','none').attr('stroke','var(--sfs-null-color, currentColor)').attr('stroke-width',2);
        }
        const startSe = renderedSe ?? p.se;
        drawNull(spreadDelay ? startSe : p.se);
        if (spreadDelay) fixed.transition().duration(spreadDelay).ease(d3.easeCubicInOut)
          .tween('spread',()=>{const se=d3.interpolateNumber(startSe,p.se);return t=>drawNull(se(t));});
        fixed.append('line').attr('x1',x(-1)).attr('x2',x(15)).attr('y1',curveBase).attr('y2',curveBase).attr('stroke','currentColor').attr('opacity',.25);
        fixed.append('line').attr('x1',x(mu0)).attr('x2',x(mu0)).attr('y1',40).attr('y2',sampleY-27).attr('stroke','currentColor').attr('stroke-dasharray','4 4').attr('opacity',.35);

        if (state.stage>0) {
          const critical = fixed.append('g').attr('class','ci-critical-indicators');
          bar(critical.append('g').attr('class','ci-null-bracket').attr('transform',`translate(${x(mu0)},${nullY})`).attr('opacity',state.stage===2?.28:0),x(mu0+p.margin)-x(mu0),red,false);
          for(const v of [mu0-p.margin,mu0+p.margin]) critical.append('line').attr('x1',x(v)).attr('x2',x(v)).attr('y1',curveBase-(curveBase-curveTop)*Math.exp(-.5*criticalZ*criticalZ)).attr('y2',nullY).attr('stroke',red).attr('stroke-dasharray','3 3').attr('opacity',.6);
          if (spreadDelay) critical.attr('opacity',0).transition().delay(spreadDelay).duration(180).attr('opacity',1);
        }
        const targetX=x(state.stage===2?sample.m:mu0), targetY=state.stage===2?sampleY+state.sample*80:nullY;
        bar(moving,x(mu0+p.margin)-x(mu0),state.stage===2 && p.lower<=mu0 && p.upper>=mu0 ? blue : red,false);
        if (sampleChanged || !moving.attr('transform')) moving.attr('transform',`translate(${x(mu0)},${nullY})`).attr('opacity',0);
        let target = moving;
        if (motion) {
          if (spreadDelay) target = moving.attr('opacity',0).transition().delay(spreadDelay).duration(180).attr('opacity',1).transition();
          else target = moving.transition();
          target = target.duration(state.stage===2?1050:500).ease(d3.easeCubicInOut);
        }
        target.attr('transform',`translate(${targetX},${targetY})`).attr('opacity',state.stage===0?0:1);
        if (state.stage===1) {
          const labels=fixed.append('g').attr('class','ci-endpoint-labels');
          const low=mu0-p.margin;
          const high=mu0+p.margin;
          const y=nullY+23;
          text(labels,x(low),y,fmt(low),'middle');
          text(labels,x(high),y,fmt(high),'middle');
        }
        readout.text(state.stage===0?'':state.stage===1?'Sample means that would not reject H₀':`95% confidence interval · margin of error ${fmt(p.margin)}`);
        svg.attr('aria-label',`Sample ${letter}, mean ${fmt(sample.m)}, n ${sample.n}. Null sampling model centered at 7. ${state.stage===2 ? `95% confidence interval from ${fmt(p.lower)} to ${fmt(p.upper)}.` : readout.text()}`);
      }
      renderedSummary = summary;
      root.node().constructionState = {...state,...p,n:sample.n,mu0};
    }
    function applyAction(action) {
      state.sample=Math.max(0,Math.min(samples.length-1,Number(action.sample??state.sample)));
      state.stage=Math.max(0,Math.min(2,Number(action.stage??state.stage)));
      state.summary=Boolean(action.summary);
      render(action.animate!==false);
    }
    render(); const observer=observe(root,render);
    function cancelMotion() {
      render(false);
    }
    root.node().ciConstruction={
      applyAction, cancelMotion,
      dispose() { observer.disconnect(); interruptMotion(); }
    };
    global.interactiveFigure.adopt(root.node(), {cancelMotion,dispose:root.node().ciConstruction.dispose});
    attachTutorial(root.node(),applyAction);
    return root.node();
  };
})(window);
