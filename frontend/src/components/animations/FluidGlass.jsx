/* eslint-disable react/no-unknown-property */
import * as THREE from 'three';
import { useRef, useState, useEffect, memo, useMemo } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import {
    useFBO,
    MeshTransmissionMaterial,
    Float,
    Instances,
    Instance,
    Text
} from '@react-three/drei';
import { easing } from 'maath';

export default function FluidGlass({
    style = {},
    scrollProgress = 0
}) {
    // Mobile detection and SSR hydration protection
    const [isMounted, setIsMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const mql = window.matchMedia("(max-width: 768px)");
            const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
            setIsMobile(mql.matches || window.innerWidth <= 768 || (isTouch && window.innerWidth < 1024));
        };
        checkMobile();

        // Delay mounting until the CSS viewport has physically snapped to mobile dimensions, preventing Desktop FBO crashes
        const timer = setTimeout(() => {
            setIsMounted(true);
        }, 10);

        window.addEventListener('resize', checkMobile);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', checkMobile);
        };
    }, []);

    return (
        <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 5, ...style }}>
            <Canvas
                camera={{ position: [0, 0, 20], fov: 15 }}
                gl={{ antialias: true, stencil: false, depth: false }}
                dpr={isMobile ? [1, 1] : [1, 2]}
            >
                {isMounted && (
                    <LensScene scrollProgress={scrollProgress} />
                )}
            </Canvas>
        </div>
    );
}

// Ultra-Vibrant Rainbow Particle Core - Razor Sharp
const ParticleGalaxy = ({ speed, rotationIntensity }) => {
    const ref = useRef();

    // Generate 600 sleek particles in a sphere
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < 600; i++) {
            const r = 8 * Math.cbrt(Math.random()); // distribute outward
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            // Vibrant Rainbow Palette
            const colors = [
                '#ec4899', // Pink
                '#06b6d4', // Cyan
                '#f59e0b', // Yellow/Gold
                '#8b5cf6', // Purple
                '#10b981', // Green
                '#ffffff', // Core White sparks
            ];
            const color = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);

            // Random sizes, slightly larger for rainbow pop
            const scale = Math.random() * 0.08 + 0.03;

            temp.push({ position: [x, y, z], color, scale });
        }
        return temp;
    }, []);

    useFrame((state, delta) => {
        if (ref.current) {
            // Elegant, airy drift
            ref.current.rotation.y += delta * 0.08 * speed;
            ref.current.rotation.x += delta * 0.04 * speed;
            ref.current.rotation.z -= delta * 0.02 * speed;
        }
    });

    return (
        <Float speed={speed * 0.8} rotationIntensity={rotationIntensity} floatIntensity={2}>
            <group ref={ref}>
                <Instances limit={600} range={600}>
                    <sphereGeometry args={[1, 16, 16]} />
                    {/* Crucial fix: Use MeshBasicMaterial for pure, sharp, unlit color that doesn't blur through transmission */}
                    <meshBasicMaterial
                        toneMapped={false}
                        transparent={true}
                        blending={THREE.NormalBlending}
                        depthWrite={false}
                    />
                    {particles.map((data, i) => (
                        <Instance
                            key={i}
                            position={data.position}
                            scale={data.scale}
                            color={data.color}
                        />
                    ))}
                </Instances>
            </group>
        </Float>
    );
};


const LensScene = memo(function LensScene({ scrollProgress, isMobile }) {
    const ref = useRef();
    const backgroundRef = useRef();
    const { viewport: vp, camera, pointer, gl, size } = useThree();

    // Dynamically match exact screen width/height to fix aspect ratio Distortion and Blur 
    const buffer = useFBO(
        isMobile ? size.width : size.width * 2,
        isMobile ? size.height : size.height * 2,
        {
            samples: isMobile ? 0 : 4,
            depth: true,
            type: THREE.HalfFloatType
        }
    );

    const [scene] = useState(() => {
        const s = new THREE.Scene();
        // Pristine Light Theme Background for external canvas
        s.background = new THREE.Color('#f8fafc');
        return s;
    });

    // Sleek, minimal cylinder geometry for pure refraction power
    const fallbackGeometry = useMemo(() => new THREE.CylinderGeometry(1.2, 1.2, 0.1, 64), []);

    useFrame((state, delta) => {
        const { viewport } = state;
        const v = viewport.getCurrentViewport(camera, [0, 0, 5]);

        const destX = (pointer.x * v.width) / 2;
        const destY = (pointer.y * v.height) / 2;

        if (ref.current) {
            easing.damp3(ref.current.position, [destX, destY, 5], 0.1, delta);
            easing.damp3(ref.current.rotation, [Math.PI / 2 + pointer.y * 0.1, 0, -pointer.x * 0.1], 0.15, delta);

            // Keep the mobile sphere exceptionally small to fit 300px wide screens beautifully
            const baseScale = isMobile ? 0.15 : 0.48;
            const targetScale = baseScale + (scrollProgress * (isMobile ? 0.5 : 14.0));
            easing.damp(ref.current.scale, 'x', targetScale, 0.1, delta);
            easing.damp(ref.current.scale, 'y', targetScale, 0.1, delta);
            easing.damp(ref.current.scale, 'z', targetScale, 0.1, delta);
        }

        if (backgroundRef.current) {
            backgroundRef.current.rotation.y += 0.001;
            backgroundRef.current.rotation.x += 0.0005;
        }

        gl.setRenderTarget(buffer);
        gl.clear();
        gl.render(scene, camera);
        gl.setRenderTarget(null);
    });

    const innerContent = (
        <group position={[0, 0, 0]}>
            {/* Deep Space cinematic glowing backdrop INSIDE the lens only */}
            <mesh ref={backgroundRef} scale={30}>
                <sphereGeometry args={[1, 64, 64]} />
                <meshBasicMaterial
                    side={THREE.BackSide}
                    color="#e2e8f0"
                />
            </mesh>

            {/* High-Key Bright Lighting for Inner Elements */}
            <ambientLight intensity={1.5} color="#ffffff" />
            <pointLight position={[10, 10, -5]} intensity={2} color="#ffffff" />
            <pointLight position={[-10, -10, -5]} intensity={1.5} color="#f8fafc" />

            {/* Central 3D Text (Permanent and perfectly sharp on PC, conditionally hidden on mobile if too heavy) */}
            {!isMobile && (
                <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.2}>
                    <Text
                        position={[0, 0, -2]} // Sitting slightly back
                        fontSize={vp.width > 10 ? 0.8 : 0.6}
                        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf" // Crisp Sans
                        fontWeight={900}
                        letterSpacing={-0.05}
                        maxWidth={vp.width * 0.9}
                        lineHeight={1}
                        textAlign="center"
                        anchorX="center"
                        anchorY="middle"
                        color="#0f172a"
                        fillOpacity={Math.max(0, 1 - (scrollProgress * 5))} // Fade out text quickly to prevent massive magnification block
                    >
                        CE Intelligence
                    </Text>
                </Float>
            )}

            {/* The Rainbow Data Nexus */}
            <group scale={isMobile ? 0.8 : Math.max(0.001, Math.min(scrollProgress * 1.5, 1))}>
                {/* Cinematic Rainbow Particle Cloud */}
                <ParticleGalaxy speed={1.5} rotationIntensity={0.8} />
            </group>
        </group>
    );

    return (
        <>
            {createPortal(innerContent, scene)}

            <mesh scale={[vp.width, vp.height, 1]}>
                <planeGeometry />
                <meshBasicMaterial map={buffer.texture} transparent opacity={0} />
            </mesh>

            <mesh
                ref={ref}
                scale={isMobile ? 0.15 : 0.48}
                rotation-x={Math.PI / 2}
                geometry={fallbackGeometry}
                renderOrder={1}
            >
                {/* Updated Glass Material: Removed aberration/distortion for razor sharpness 
                    and drastically optimized resolution to fix Mobile scroll lag */}
                <MeshTransmissionMaterial
                    buffer={buffer.texture}
                    ior={1.15}
                    thickness={0.5}
                    anisotropy={isMobile ? 0.1 : 0.3}
                    chromaticAberration={0.0}
                    transmission={1}
                    roughness={0.0}
                    backside={false}
                    distortion={0.0}
                    distortionScale={0.0}
                    temporalDistortion={0.0}
                    color="#ffffff"
                    transparent
                    opacity={1}
                />
            </mesh>
        </>
    );
});
