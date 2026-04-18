import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = `
varying vec2 vUv;
uniform float u_time;
uniform vec3 u_color;
uniform float u_seed;

// Simplex 2D noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
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
    // p is -1 to 1 local space
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    
    // Create an organic noise grid
    float n = snoise(p * 2.5 + u_seed * 100.0 + u_time * 0.15);
    
    // Hyperforest tree-ring / ripple structural effect
    float rings = abs(sin((r + n * 0.3) * (8.0 + u_seed * 5.0) - u_time));
    rings = smoothstep(0.0, 0.4, rings);
    
    // Radial glow
    float glow = 1.0 - smoothstep(0.1, 1.0, r);
    
    vec3 col = u_color * rings * glow * 1.5;
    col += u_color * 0.2 * (1.0 - r); // Base ambient
    
    // Subtle sci-fi overlay
    col += u_color * 0.15 * sin(vUv.y * 60.0 + u_time * 8.0);
    
    gl_FragColor = vec4(col, glow * 0.95);
}
`;

export default function ShaderThumbnail({ seed, color }) {
    const mountRef = useRef(null);

    useEffect(() => {
        const currentMount = mountRef.current;
        if (!currentMount) return;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        
        renderer.setSize(100, 100);
        renderer.setPixelRatio(window.devicePixelRatio);
        currentMount.appendChild(renderer.domElement);

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                u_time: { value: 0 },
                u_seed: { value: seed },
                u_color: { value: new THREE.Color(color) }
            },
            transparent: true,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        let animationFrameId;
        const animate = () => {
            material.uniforms.u_time.value = performance.now() * 0.001;
            renderer.render(scene, camera);
            animationFrameId = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            cancelAnimationFrame(animationFrameId);
            currentMount.removeChild(renderer.domElement);
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, [seed, color]);

    return (
        <div 
            ref={mountRef} 
            style={{ 
                width: '100px', 
                height: '100px', 
                borderRadius: '50%', // Circle thumbnail
                overflow: 'hidden', 
                border: "2px solid " + color + "55",
                background: 'rgba(5, 10, 5, 0.4)',
                marginRight: '1rem',
                flexShrink: 0,
                boxShadow: "0 0 15px " + color + "22"
            }} 
        />
    );
}
