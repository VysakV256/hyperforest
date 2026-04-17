import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import graphData from './datasets.json';
import './index.css';

const THEME_COLORS = {
  "Dynamics": "#2a9d8f",
  "Structure": "#e9c46a",
  "Emergence": "#f4a261",
  "Potentiality": "#8a5a99",
  "Utopia": "#2b9348"
};

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

// Pre-create geometries so we aren't creating 300+ geometries
const baseGeometry = new THREE.IcosahedronGeometry(4, 32); 
const themeGeometry = new THREE.SphereGeometry(12, 32, 32);

export default function App() {
  const fgRef = useRef();
  const [hoverNode, setHoverNode] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Store materials so we can update uniforms globally
  const materialsRef = useRef([]);

  // Animation Loop for Shaders
  useEffect(() => {
    let animationFrameId;
    const animate = () => {
      const time = performance.now() * 0.001;
      materialsRef.current.forEach(mat => {
        if (mat.uniforms && mat.uniforms.u_time) {
          mat.uniforms.u_time.value = time;
        }
      });
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleNodeHover = useCallback((node, prevNode) => {
    setHoverNode(node || null);
    
    // UI Interaction - pause orbital rotation if hovering
    if (fgRef.current) {
        fgRef.current.controls().autoRotate = node ? false : true;
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

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
    
    // Convert string ID to a chaotic seed float
    const hashStr = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
           hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash) / 10000000.0;
    };

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
    
    // If we have themes, add a smaller glow ring
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
        <h1>Hyperforest</h1>
        <p>Hubbard Brook Datasets • Neural Architecture</p>
      </div>
      
      <div className="instructions">
        <p>Rotate / Scroll to Zoom</p>
        <p>Hover over nodes for signals</p>
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
        className={"glass-panel node-tooltip " + (hoverNode ? 'visible' : '')}
        style={{
          left: mousePos.x + 20,
          top: mousePos.y + 20
        }}
      >
        {hoverNode && (
          <>
            <span className="package-id">{hoverNode.package || hoverNode.id}</span>
            <h2>{hoverNode.name}</h2>
            
            {hoverNode.themes && (
              <div style={{ marginBottom: '1rem' }}>
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

            {hoverNode.abstract && (
              <p className="abstract">{hoverNode.abstract}</p>
            )}

            {hoverNode.csv_preview && hoverNode.csv_preview.length > 0 && (
              <div style={{ width: '100%', height: '80px', marginTop: '1rem', marginBottom: '0.5rem' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hoverNode.csv_preview}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={hoverNode.themes ? THEME_COLORS[hoverNode.themes[0]] : "#2a9d8f"} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={hoverNode.themes ? THEME_COLORS[hoverNode.themes[0]] : "#2a9d8f"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <YAxis domain={['dataMin', 'dataMax']} hide={true} />
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
          </>
        )}
      </div>
    </div>
  );
}
