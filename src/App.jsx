import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip } from 'recharts';
import ShaderThumbnail from './ShaderThumbnail';
import { audioEngine } from './AudioEngine';
import graphData from './datasets.json';
import './index.css';

const THEME_COLORS = {
  "Dynamics": "#047857",
  "Structure": "#059669",
  "Emergence": "#10b981",
  "Potentiality": "#34d399",
  "Utopia": "#a7f3d0"
};

const hashStr = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
       hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) / 10000000.0;
};

const globalListener = new THREE.AudioListener();

function createNodeAudioBuffer(audioCtx, seedHash, isOrganic) {
    const sampleRate = audioCtx.sampleRate;
    const length = sampleRate * 3.0; 
    const buffer = audioCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    
    const tuningHex = [87.31, 98.00, 110.00, 130.81, 146.83];
    const baseFreq = tuningHex[Math.floor(seedHash * 5) % 5] / 2; 
    
    for(let i=0; i<length; i++) {
        const t = i / sampleRate;
        
        // 1. Organic Base (Deep fundamental sine + a perfect 5th)
        let organic = Math.sin(2 * Math.PI * baseFreq * t) + 
                      0.5 * Math.sin(2 * Math.PI * (baseFreq * 1.5) * t);
        
        // Add "wind/breath" flutter 
        const organicTremolo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.5 * t); 
        organic *= organicTremolo;

        // 2. Utopian Digital Tones (High-frequency crystalline FM sine wave)
        const modulatorFreq = baseFreq * 4; 
        const carrierFreq = baseFreq * 8.02;
        const modulationIndex = 2.0; 
        const digitalBell = Math.sin(2 * Math.PI * carrierFreq * t + modulationIndex * Math.sin(2 * Math.PI * modulatorFreq * t));
        
        const digitalPulse = (Math.sin(Math.PI * (t * 8)) ** 4); 
        
        // 3. Symbiosis Blend
        let mix;
        if (isOrganic) {
            mix = organic * 0.8 + (digitalBell * digitalPulse) * 0.2;
        } else {
            mix = organic * 0.4 + (digitalBell * digitalPulse) * 0.6;
        }
        
        // 4. Overarching Breathing Envelope 
        const env = Math.sin(Math.PI * (t / 3.0)) ** 2;
        
        data[i] = mix * env * 0.12; 
    }
    return buffer;
}

// Shaders for rendering organic dataset nodes
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  uniform float u_time;
  uniform float u_seed;
  uniform float u_complexity;
  
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - 0.5;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    
    float noise = snoise(position * (0.8 + u_complexity * 0.2) + u_time * 0.5 + u_seed * 100.0);
    vec3 newPosition = position + normal * noise * (u_complexity * 1.5 + 1.0);
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  uniform vec3 u_color;
  uniform float u_time;
  uniform float u_seed;
  uniform float u_complexity;

  void main() {
    float pattern = sin(vUv.x * (10.0 + u_complexity*5.0) + u_time + u_seed) * cos(vUv.y * (10.0 + u_complexity*5.0) - u_time + u_seed);
    pattern = smoothstep(0.0, 1.0, pattern * 0.5 + 0.5);
    
    vec3 col = mix(u_color * 0.5, u_color * 1.8, pattern);
    
    float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
    rim = smoothstep(0.6, 1.0, rim);
    col += u_color * rim * 1.5;
    
    gl_FragColor = vec4(col, 0.9);
  }
`;

// Background Photographic Manifold Shaders
const manifoldVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const manifoldFragmentShader = `
  varying vec2 vUv;
  uniform sampler2D tex0;
  uniform sampler2D tex1;
  uniform sampler2D tex2;
  uniform float u_time;

  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
  }

  void main() {
      float noise1 = snoise(vUv * 3.0 + u_time * 0.03);
      float noise2 = snoise(vUv * 4.0 - u_time * 0.05);
      
      vec2 distortedUv = vUv + vec2(noise1, noise2) * 0.08;
      
      vec4 color0 = texture2D(tex0, distortedUv);
      vec4 color1 = texture2D(tex1, distortedUv + vec2(0.05, 0.0));
      vec4 color2 = texture2D(tex2, distortedUv - vec2(0.0, 0.05));
      
      float morph = (snoise(vUv * 1.5 + u_time * 0.015) + 1.0) * 0.5;
      vec4 finalCol = mix(color0, mix(color1, color2, morph), morph);
      
      // Infinitely bright exposure blowout
      finalCol.rgb *= 1.8; 
      finalCol.rgb += vec3(0.15);
      
      gl_FragColor = vec4(max(finalCol.rgb, 0.0), 1.0);
  }
`;

// Pre-create geometries so we aren't creating 300+ geometries
const baseGeometry = new THREE.IcosahedronGeometry(4, 32); 
const themeGeometry = new THREE.SphereGeometry(12, 32, 32);

export default function App() {
  const fgRef = useRef();
  const [hoverNode, setHoverNode] = useState(null);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioEnabledRef = useRef(false);
  const spatialNodesMapRef = useRef(new Map());
  
  const hoverTimeoutRef = useRef();
  const positionLockRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const isPinnedRef = useRef(false);

  const setIsPinnedWrapper = useCallback((val) => {
      setIsPinned(val);
      isPinnedRef.current = val;
  }, []);

  // Store materials so we can update uniforms globally
  const materialsRef = useRef([]);
  const manifoldUniformsRef = useRef(null);

  // Background Manifold Builder
  useEffect(() => {
    // Delay slightly to ensure forcegraph scene is securely initialized on mount
    const timer = setTimeout(() => {
      if (fgRef.current && fgRef.current.scene) {
         const texLoader = new THREE.TextureLoader();
         const t0 = texLoader.load('/backgrounds/bg_0.jpg');
         const t1 = texLoader.load('/backgrounds/bg_1.jpg');
         const t2 = texLoader.load('/backgrounds/bg_3.jpg');
         
         [t0,t1,t2].forEach(t => {
             t.wrapS = THREE.RepeatWrapping;
             t.wrapT = THREE.RepeatWrapping;
             t.colorSpace = THREE.SRGBColorSpace;
         });

         const manifoldMat = new THREE.ShaderMaterial({
             vertexShader: manifoldVertexShader,
             fragmentShader: manifoldFragmentShader,
             uniforms: {
                 u_time: { value: 0 },
                 tex0: { value: t0 },
                 tex1: { value: t1 },
                 tex2: { value: t2 }
             },
             side: THREE.BackSide,
             depthWrite: false
         });
         
         manifoldUniformsRef.current = manifoldMat.uniforms;
         const manifoldMesh = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 32), manifoldMat);
         fgRef.current.scene().add(manifoldMesh);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Animation Loop for Shaders & Audio Culling
  useEffect(() => {
    let animationFrameId;
    let lastAudioUpdate = 0;
    
    const animate = () => {
      const time = performance.now() * 0.001;
      materialsRef.current.forEach(mat => {
        if (mat.uniforms && mat.uniforms.u_time) {
          mat.uniforms.u_time.value = time;
        }
      });
      
      if (manifoldUniformsRef.current) {
          manifoldUniformsRef.current.u_time.value = time;
      }
      
      // Geometric Voice Culling - Triangulates nearest topologies exactly 10x per second
      if (audioEnabledRef.current && fgRef.current && (time - lastAudioUpdate > 0.1)) {
          lastAudioUpdate = time;
          const camPos = fgRef.current.camera().position;
          const nodesArray = Array.from(spatialNodesMapRef.current.values());
          
          nodesArray.sort((a, b) => {
              return a.mesh.position.distanceToSquared(camPos) - b.mesh.position.distanceToSquared(camPos);
          });
          
          // Absolute concurrent threading cap: Top 12 voices
          nodesArray.forEach((item, index) => {
              if (index < 12) {
                  if (!item.pAudio.isPlaying) item.pAudio.play();
              } else {
                  if (item.pAudio.isPlaying) item.pAudio.pause();
              }
          });
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleNodeHover = useCallback((node) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    if (node) {
      setHoverNode((prev) => {
          if (prev?.id !== node.id) {
              positionLockRef.current = true;
              setIsPinnedWrapper(false);
              setDragOffset({ x: 0, y: 0 });
          }
          return node;
      });
      if (fgRef.current) {
          fgRef.current.controls().autoRotate = false;
      }
    } else {
      hoverTimeoutRef.current = setTimeout(() => {
        if (!isPinnedRef.current) {
          setHoverNode(null);
          positionLockRef.current = false;
        }
        if (fgRef.current) fgRef.current.controls().autoRotate = true;
      }, 400); 
    }
  }, [setIsPinnedWrapper]);

  const handleMouseMove = useCallback((e) => {
    if (!positionLockRef.current) {
        setPanelPos({ x: e.clientX, y: e.clientY });
    }
  }, []);

  useEffect(() => {
    const handleMove = (e) => {
      if (isDragging) {
         setDragOffset({
            x: e.clientX - dragStartPosRef.current.x,
            y: e.clientY - dragStartPosRef.current.y
         });
      }
    };
    const handleUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    }
  }, [isDragging]);

  useEffect(() => {
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
      if (audioEnabled) {
          audioEngine.playNode(hoverNode);
      }
  }, [hoverNode, audioEnabled]);

  const handleAudioStart = async () => {
      if (!audioEnabled) {
          if (globalListener.context.state === 'suspended') {
              await globalListener.context.resume();
          }
          await audioEngine.init();
          
          if (fgRef.current) {
              fgRef.current.camera().add(globalListener);
          }
          setAudioEnabled(true);
          audioEnabledRef.current = true;
      }
  };

  const renderNode = useCallback((node) => {
    if (node.group === 'theme') {
      const gColor = new THREE.Color(THEME_COLORS[node.id] || '#ffffff');
      const mat = new THREE.MeshPhongMaterial({
        color: gColor,
        emissive: gColor,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.9,
      });
      return new THREE.Mesh(themeGeometry, mat);
    } 
    
    // Dataset node: Render a unique ShaderMaterial
    const mainTheme = node.themes ? node.themes[0] : "Dynamics";
    const baseColorHex = THEME_COLORS[mainTheme] || '#ffffff';

    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_seed: { value: hashStr(node.id) },
        u_complexity: { value: node.keywords ? Math.min(node.keywords.length / 5.0, 1.0) : 0.5 },
        u_color: { value: new THREE.Color(baseColorHex) }
      },
      transparent: true,
      side: THREE.DoubleSide
    });

    materialsRef.current.push(shaderMaterial);

    const mesh = new THREE.Mesh(baseGeometry, shaderMaterial);
    
    // Attach volumetric procedural audio 
    if (!mesh.userData.audioApplied) {
        const positionalAudio = new THREE.PositionalAudio(globalListener);
        const isOrganic = node.themes && ["Emergence", "Utopia"].includes(node.themes[0]);
        const buffer = createNodeAudioBuffer(globalListener.context, hashStr(node.id), isOrganic);
        
        positionalAudio.setBuffer(buffer);
        positionalAudio.setRefDistance(15);
        positionalAudio.setMaxDistance(150);
        positionalAudio.setRolloffFactor(1);
        positionalAudio.setLoop(true);
        positionalAudio.setVolume(1.0);
        
        mesh.add(positionalAudio);
        mesh.userData.audioApplied = true;
        spatialNodesMapRef.current.set(node.id, { mesh, pAudio: positionalAudio });
        
        // Removed aggressive native auto-play. The animate loop handles hardware authorization securely.
    }
    
    return mesh;
  }, []);

  // Post process graph setup
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-200);
      fgRef.current.d3Force('link').distance(80);
      fgRef.current.controls().autoRotate = true;
      fgRef.current.controls().autoRotateSpeed = 0.5;
    }
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020503' }}>
      
      {/* UI Overlay */}
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '0.2rem' }}>
          <h1>Hyperforest</h1>
          <button 
            className={`audio-btn ${audioEnabled ? 'enabled' : ''}`}
            onClick={handleAudioStart}
          >
            {audioEnabled ? '🔊 Audio Synced' : '🔇 Start Audio Space'}
          </button>
        </div>
        <p>Hubbard Brook Datasets • Living Architecture</p>
        
        <div className="intro-panel">
          ✨ Explore the data multiverse in infinite freedom
        </div>
      </div>
      
      {/* Source Data Portal Links */}
      <div className="source-links-panel glass-panel">
        <h3>Primary Orchestrators</h3>
        <a href="https://data.hubbardbrook.org/" target="_blank" rel="noopener noreferrer">Hubbard Brook Data Catalog</a>
        <a href="https://portal.edirepository.org/" target="_blank" rel="noopener noreferrer">EDI Global Ecosystem Portal</a>
      </div>

      <div className="instructions">
        <p><strong>Scroll</strong> to zoom • <strong>Drag</strong> to rotate</p>
        <p><strong>Hover</strong> node for dataset topology</p>
        <p><strong>Drag Tooltip</strong> to pin globally in space</p>
      </div>

      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeThreeObject={renderNode}
        onNodeHover={handleNodeHover}
        backgroundColor="#000000"
        showNavInfo={false}
        linkColor={(link) => {
          const tColor = THEME_COLORS[link.target.id] || THEME_COLORS[link.target];
          return tColor ? tColor + '55' : '#ffffff55'; // Transparent hex
        }}
        linkWidth={1}
        linkOpacity={0.2}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleColor={(link) => {
            return THEME_COLORS[link.target.id] || THEME_COLORS[link.target] || '#ffffff';
        }}
      />

      {/* Tooltip Overlay */}
      <div 
        className={`glass-panel node-tooltip ${(hoverNode || isTooltipHovered || isPinned) ? 'visible' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{
          left: Math.min(panelPos.x + 20, window.innerWidth - 420),
          top: panelPos.y > window.innerHeight / 2 ? 'auto' : panelPos.y + 20,
          bottom: panelPos.y > window.innerHeight / 2 ? Math.max(20, window.innerHeight - panelPos.y + 20) : 'auto',
          maxHeight: 'calc(100vh - 40px)',
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
          touchAction: 'none'
        }}
        onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            setIsTooltipHovered(true);
        }}
        onMouseLeave={() => {
            setIsTooltipHovered(false);
            if (!isPinnedRef.current) {
                setHoverNode(null);
                positionLockRef.current = false;
                if (fgRef.current) fgRef.current.controls().autoRotate = true;
            }
        }}
        onPointerDown={(e) => {
            e.stopPropagation();
            setIsDragging(true);
            setIsPinnedWrapper(true);
            dragStartPosRef.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        }}
      >
        {isPinned && (
           <button 
                className="close-btn" 
                onClick={(e) => { 
                    e.stopPropagation();
                    setIsPinnedWrapper(false); 
                    setHoverNode(null); 
                    positionLockRef.current = false; 
                }}
            >
                ✕
           </button>
        )}
        
        {(hoverNode || isTooltipHovered || isPinned) && hoverNode && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <ShaderThumbnail 
                  seed={hashStr(hoverNode.id)} 
                  color={hoverNode.themes ? THEME_COLORS[hoverNode.themes[0]] : THEME_COLORS["Dynamics"]} 
              />
              <div style={{ flex: 1 }}>
                <span className="package-id">{hoverNode.package || hoverNode.id}</span>
                <h2 style={{marginTop: '0.5rem'}}>{hoverNode.name}</h2>
                {hoverNode.themes && (
                  <div>
                    {hoverNode.themes.map(t => (
                      <span 
                        key={t} 
                        className="theme-pill"
                        style={{ 
                          backgroundColor: THEME_COLORS[t] + '22',
                          color: THEME_COLORS[t],
                          border: "1px solid " + THEME_COLORS[t] + "55"
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {hoverNode.abstract && (
              <p className="abstract">{hoverNode.abstract}</p>
            )}

            {hoverNode.csv_preview && hoverNode.csv_preview.length > 0 && (
              <div style={{ width: '100%', height: '140px', marginTop: '1rem', marginBottom: '0.5rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hoverNode.csv_preview} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={hoverNode.themes ? THEME_COLORS[hoverNode.themes[0]] : "#2a9d8f"} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={hoverNode.themes ? THEME_COLORS[hoverNode.themes[0]] : "#2a9d8f"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                        dataKey="date" 
                        tick={{fontSize: 10, fill: '#95bba2'}} 
                        tickFormatter={(t) => (t && t.length >= 4) ? t.substring(0,4) : t} 
                        minTickGap={20} 
                        axisLine={false} 
                        tickLine={false}
                    />
                    <YAxis domain={['dataMin', 'dataMax']} hide={true} />
                    <Tooltip 
                        contentStyle={{ 
                            backgroundColor: 'rgba(5, 20, 10, 0.9)', 
                            border: '1px solid rgba(30, 150, 60, 0.4)', 
                            borderRadius: '8px', 
                            fontSize: '12px',
                            color: '#e0f2e5'
                        }}
                        itemStyle={{ color: hoverNode.themes ? THEME_COLORS[hoverNode.themes[0]] : '#e0f2e5' }}
                        labelStyle={{ color: '#95bba2', marginBottom: '4px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={hoverNode.themes ? THEME_COLORS[hoverNode.themes[0]] : "#2a9d8f"} 
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {hoverNode.keywords && hoverNode.keywords.length > 0 && (
              <div className="keywords-list">
                {hoverNode.keywords.map((kw, i) => (
                  <span key={i} className="keyword-tag">{kw}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
